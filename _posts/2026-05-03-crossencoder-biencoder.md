---
title: "Bi-Encoder vs Cross-Encoder 정리"
date: 2026-05-03
categories: [AI, RAG]
tags: [reranking, embedding]
description: "질문과 문서를 각각 임베딩하는 Bi-Encoder와 함께 넣어 채점하는 Cross-Encoder의 구조 차이를 attention 관점에서 짚고, 실무가 둘을 2단계로 겹쳐 쓰는 이유를 정리한다."
image:
  path: /assets/img/thumbnails/crossencoder.png
published: false
---

[bge-m3 임베딩](https://rlckdwkd55.github.io/posts/embeddings-bge-m3/)으로 벡터 검색을 붙이면,
의미는 비슷한데 정작 질문에 답하는 문서가 상위권 아래로 밀리는 경우가 나온다. "환불 수수료는
얼마인가"라는 질문에 "환불 절차 안내" 문서가 1위로 올라오는 식이다. 둘 다 '환불' 주변을
맴돌지만, 질문이 콕 집은 **수수료**라는 초점은 벡터 하나로 뭉개진다.
[RAG](https://rlckdwkd55.github.io/posts/rag/) 파이프라인이 "1차는 Bi-Encoder, 2차는
Cross-Encoder"로 요약하는 리랭킹 구성은 바로 이 초점 손실을 겨눈다. 출발점은 두 인코더가
관련도를 계산하는 방식이 애초에 다르다는 데 있다.

---

## 질문과 문서를 언제 만나게 하는가

관련도를 재는 방법은 결국 "질문과 문서를 언제, 어떻게 만나게 하느냐"로 갈린다.

- **Bi-Encoder** — 질문과 문서를 **각각 따로** 인코딩해 벡터로 만든 뒤, 그 벡터끼리 유사도를
  잰다. 둘은 마지막 순간에 벡터로만 만난다.
- **Cross-Encoder** — 질문과 문서를 **하나의 입력으로 붙여** 모델에 넣고, 내부에서 토큰끼리
  섞은 다음 관련도 점수를 직접 뽑는다. 둘은 처음부터 함께 들어간다.

이 "언제 만나는가"의 차이가 속도와 정확도를 통째로 가른다.

---

## Bi-Encoder — 미리 벡터로 만들어 두는 구조

```text
질문  → [ 인코더 ] → 풀링 → 벡터 q ─┐
                                    ├→ score = cosine(q, d)
문서  → [ 인코더 ] → 풀링 → 벡터 d ─┘
        (문서 벡터는 오프라인에서 미리 계산)
```

문서마다 토큰 임베딩을 뽑고 **풀링(mean 또는 [CLS])** 으로 뭉쳐 고정 길이 벡터 하나로 만든다.
핵심은 이 문서 벡터가 **질문과 무관하게** 결정된다는 점이다. 그래서 색인 시점에 전부 미리
계산해 [Qdrant](https://rlckdwkd55.github.io/posts/qdrant/) 같은 벡터 DB에 저장해 둘 수 있다.

검색 때는 질문만 인코딩해 ANN 인덱스로 최근접을 찾으면 끝이다. 문서가 수백만 개라도 질의당
연산은 "질문 1회 인코딩 + 근사 검색" 뿐이라 **매우 빠르다.** 대규모 1차 검색(retrieval)이
Bi-Encoder의 자리인 이유다.

대신 구조적 한계가 분명하다. 문서의 모든 뉘앙스가 **벡터 하나로 압축**된 뒤에야 질문과 만난다.
문서 안 어떤 단어가 질문의 어떤 단어에 대응하는지는 볼 수 없다. 앞의 예처럼 '환불'은 잡아도
'수수료'라는 초점은 압축 과정에서 희석된다. 이걸 **표현 병목(representation bottleneck)** 이라
부른다.

```python
from sentence_transformers import SentenceTransformer, util

model = SentenceTransformer("BAAI/bge-m3")

doc_emb = model.encode(docs)          # 오프라인: 문서 벡터 미리 계산·저장
q_emb   = model.encode("환불 수수료는 얼마인가")   # 질의 시: 질문만 인코딩
scores  = util.cos_sim(q_emb, doc_emb)            # 저장된 벡터와 유사도만 비교
```

---

## Cross-Encoder — 함께 넣어 직접 채점하는 구조

```text
[CLS] 환불 수수료는 얼마인가 [SEP] 환불 시 수수료 3%가 부과됩니다 [SEP]
        │
        └→ [ 인코더: 모든 토큰이 서로 attention ] → [CLS] → 관련도 점수(스칼라)
```

Cross-Encoder는 질문과 문서를 `[SEP]`로 이어 붙인 **하나의 시퀀스**를 넣는다. Transformer의
self-attention은 이 안에서 질문 토큰과 문서 토큰을 **구분 없이 섞는다.** '수수료'(질문)가
문서의 '수수료 3%'를 직접 바라보고 가중치를 높일 수 있다. 토큰 대 토큰으로 교차 참조한 결과를
`[CLS]` 위의 작은 분류 헤드가 스칼라 하나로 요약한다. 이게 관련도 점수다.

여기엔 미리 계산할 '문서 벡터'라는 게 없다. 같은 문서라도 질문이 바뀌면 attention 패턴이 통째로
달라지므로, **질문·문서 쌍마다 모델을 처음부터 한 번씩 돌려야 한다.** 후보가 k개면 forward
pass가 k번. 그래서 느리다. 정밀한 재정렬(reranking)에만 쓰는 이유이자, 벡터 검색을 대체할 수
없는 이유다.

```python
from sentence_transformers import CrossEncoder

model = CrossEncoder("BAAI/bge-reranker-v2-m3")

query = "환불 수수료는 얼마인가"
candidates = [
    "환불 시 수수료 3%가 부과됩니다.",
    "환불 절차는 마이페이지에서 신청할 수 있습니다.",
    "배송은 보통 2~3일 걸립니다.",
]
pairs  = [(query, doc) for doc in candidates]   # 질문+문서를 '쌍'으로 묶어
scores = model.predict(pairs)                   # 쌍마다 관련도를 직접 채점

ranked = sorted(zip(candidates, scores), key=lambda x: x[1], reverse=True)
```

<!-- 이미지: 구글 검색 "바이인코더 크로스인코더 차이" · 저장 /assets/img/posts/ai/reranking/architecture.png -->

---

## 정확도 차이의 근원 — 교차 attention

차이의 근원은 **정보가 만나는 시점**이다. Bi-Encoder는 압축을 먼저 하고 비교를 나중에 한다.
문서 512토큰의 의미가 벡터 하나(예: 1024차원)로 눌린 뒤에야 질문을 만나니, "질문과 무관하게
문서를 요약"할 수밖에 없다. 질문이 무엇이든 같은 요약본을 쓰는 셈이다.

Cross-Encoder는 순서가 반대다. 비교를 먼저, 압축을 나중에 한다. 질문을 이미 본 상태에서 문서를
읽으므로 "이 질문 관점에서 이 문서의 어디가 중요한가"를 반영한다. 같은 문서라도 질문이
'수수료'냐 '절차'냐에 따라 다른 곳에 집중한다. 압축 손실 이전에 교차 참조가 일어나니 표현
병목이 없다.

Sentence-BERT 논문이 이 트레이드오프를 수치로 못박는다. BERT를 Cross-Encoder로 써서 문장 1만
개에서 가장 비슷한 쌍을 찾으려면 약 5천만 번 추론, 시간으로 **약 65시간**이 걸린다. 같은 작업을
Bi-Encoder(SBERT)로 벡터를 미리 만들어 두면 **몇 초**로 끝난다. Cross-Encoder가 더 정확하지만
규모를 감당 못 한다는 결론이고, 여기서 "둘을 겹쳐 쓰자"는 발상이 나온다.

---

## 2단계로 겹쳐 쓰는 구성

둘은 경쟁이 아니라 **역할 분담**이다. 넓게 빠르게 후보를 건지고, 좁게 정확하게 정렬한다.

```text
1단계  Bi-Encoder (벡터 검색)   : 수백만 문서 → 빠르게 top-k 회수   (예: k=50)
2단계  Cross-Encoder (리랭킹)   : top-k만 정밀 채점 → 재정렬 → top-n (예: n=5)
```

여기서 k가 비용과 품질을 동시에 쥔 손잡이다. Cross-Encoder는 딱 k번만 돌면 되니, 전체 문서 수
N과 무관하게 비용이 k에 묶인다. 문서가 100만 개든 1000만 개든 2단계 비용은 그대로다. k를 키우면
1단계가 놓친 정답을 2단계가 주워 올 여지가 커지지만(회수율↑) 그만큼 느려지고, 줄이면 빠른 대신
1단계 실수를 되돌릴 기회가 준다. 보통 k=50~100 근처에서 타협한다.

이 조합의 정확도 상한은 결국 **1단계 회수율**이 정한다. 정답 문서가 애초에 top-k에 못 들면
Cross-Encoder가 아무리 정밀해도 살려낼 수 없다. 그래서 1단계를 [BM25 키워드 검색과 벡터 검색을
섞고 RRF로 합치는](https://rlckdwkd55.github.io/posts/rrf/) 하이브리드로 두껍게 깔고, 그 위에
Cross-Encoder 리랭커(`bge-reranker` 계열)를 얹는 구성이 실무의 표준 형태다.

---

## 비교 정리

| | Bi-Encoder | Cross-Encoder |
|---|---|---|
| 입력 | 질문·문서 **각각** | 질문+문서 **함께** |
| 만나는 시점 | 벡터로 압축된 뒤 | 토큰 단계에서 곧바로 |
| 문서 표현 | 질문과 무관, 고정 | 질문마다 달라짐 |
| 사전 계산 | 가능(벡터 저장) | 불가(쌍마다 추론) |
| 질의당 비용 | 인코딩 1회 + ANN | forward pass k회 |
| 속도 | 매우 빠름 | 느림 |
| 정확도 | 보통(표현 병목) | 높음(교차 attention) |
| 역할 | 1차 대량 검색 | 상위 소수 재정렬 |

---

## 실무에서 걸리는 지점

- **레이턴시 예산부터 본다.** 리랭킹은 질의 경로에 forward pass k번을 더한다. 실시간 응답이라면
  k, 리랭커 크기, GPU 유무가 곧 응답 시간이다. k를 무작정 키우면 안 된다.
- **입력 길이 절단에 주의.** Cross-Encoder는 질문+문서를 한 시퀀스에 담으니 긴 문서는 max
  length에서 잘린다. 정작 근거가 뒷부분에 있으면 점수가 무너진다. 청크 크기와 리랭커 입력 한계를
  맞춰 봐야 한다.
- **점수는 상대적이다.** Cross-Encoder 점수는 모델마다 스케일이 다르고 확률도 아니다. 절대
  임계값으로 컷하기보다 순위(재정렬) 용도로 쓰는 게 안전하다.
- **항상 필요하진 않다.** 후보가 이미 적거나 1차 검색이 충분히 정확하면 리랭킹은 비용만 늘리는
  장식이 된다. Recall@k 대비 nDCG 개선을 재보고 넣을 값어치를 확인한다.

거리 함수·정규화가 1차 검색 점수에 어떻게 얽히는지는 [벡터 유사도
글](https://rlckdwkd55.github.io/posts/vector-similarity/)에서 따로 다룬다. 요약하면, Bi로 넓게
회수하고 Cross로 좁게 재정렬하는 2단계 구성에서 상한은 1단계 회수율이, 비용은 k가 쥔다.

<br><br>
참고 : https://arxiv.org/abs/1908.10084 <br>
참고 : https://www.sbert.net/examples/applications/retrieve_rerank/README.html
