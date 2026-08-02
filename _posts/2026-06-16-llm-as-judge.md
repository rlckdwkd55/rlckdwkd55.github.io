---
title: "챗봇 응답 품질을 LLM으로 자동 채점하기"
date: 2026-06-16
categories: [AI, LLM]
tags: [llm-as-judge, llm]
description: "사람이 눈으로 확인하던 챗봇 응답 검증을, 정답 대비 rubric 채점(LLM judge)과 다중 샘플·회피 규칙·임베딩 유사도로 자동화한 평가 파이프라인을 실제 구현 코드와 함께 회고한다."
image:
  path: /assets/img/thumbnails/llm-judge.png
published: false
---

## 문제: 품질 검증이 전부 수작업이었다

RAG 파이프라인([RAG 개요](https://rlckdwkd55.github.io/posts/rag/))을 손볼 때마다 매번 같은
고민에 빠졌다. **"이 수정으로 답변이 좋아졌나, 나빠졌나?"** 를 확인하는 방법이 없었다. 있는 건
사람이 직접 챗봇에 질문을 쳐 보고 눈으로 답을 읽는 것뿐이었다.

이 방식엔 세 가지 문제가 있었다.

- **느리다.** 질문 하나에 답 하나 읽는 데도 시간이 걸리는데, 수십·수백 케이스를 매번 돌리는 건 현실적으로 불가능했다.
- **주관적이다.** 같은 답변을 두고도 사람마다 "이 정도면 맞다"와 "핵심이 빠졌다"로 갈렸다. 판정 기준이 사람 머릿속에만 있었다.
- **회귀를 못 잡는다.** 프롬프트를 고치거나 검색 로직을 바꾸면, A 케이스는 좋아지고 B 케이스는 조용히 나빠지곤 한다. 사람이 A만 확인하고 넘어가면 B의 퇴행은 배포 뒤에야 발견된다.

결국 필요한 건 **"응답 품질을 반복해서, 같은 잣대로, 자동으로 재는 장치"** 였다. 그래서
데이터셋 등록 → 파이프라인 실행 → **자동 채점** → 통계 집계로 이어지는 평가 도메인을 만들었다.
이 글은 그중 핵심인 **채점(judge)** 을 어떻게 신뢰할 수 있게 만들었는지에 대한 회고다.

## 왜 채점자로 LLM을 쓰는가

"생성된 답변이 정답에 얼마나 부합하나"를 규칙(정규식·문자열 일치)으로 채점하려던 시도는
금방 무너졌다. 자연어 답변은 표현이 무한히 다양하다. 정답이 "월 5만 원"인데 생성 답변이
"한 달에 오만 원입니다"라면, 문자열 비교로는 0점이지만 사람이 보기엔 완벽한 정답이다.

그래서 **채점 자체를 또 다른 LLM에게 맡기기로 했다(LLM-as-Judge).** 질문·정답 기준 답변·생성
답변을 함께 주고 "의미상 얼마나 일치하는지" 점수를 매기게 하는 것이다. 이때 두 가지를 지켰다.
**채점 기준(rubric)을 명확히 주는 것**, 그리고 결과를 **자유 서술이 아니라 구조화된 값으로
받는 것**이다.

채점 결과는 Pydantic 모델로 스키마를 고정했다. ([Pydantic v2](https://rlckdwkd55.github.io/posts/pydantic/)로
경계에서 파싱=검증하는 그 방식 그대로다.)

```python
class JudgeVerdict(BaseModel):
    """LLM judge 채점 결과"""
    score: float = Field(description="0~100 사이 점수. 생성된 답변이 정답 기준 답변과 의미상 얼마나 일치하는지")
    is_correct: bool = Field(description="전반적으로 정답으로 볼 수 있으면 true, 아니면 false")
    reasoning: str = Field(description="판단 근거를 한두 문장으로 설명")
```

`score`(연속 점수), `is_correct`(이진 판정), `reasoning`(근거)을 한꺼번에 받는다. 근거를 함께
받는 이유는, 점수만 보면 judge가 왜 그렇게 매겼는지 알 수 없어서다. 나중에 채점기 자체를
검증할 때 이 `reasoning`이 결정적인 단서가 됐다.

LLM에서 이 스키마를 강제하는 건 LangChain의 구조화 출력이다. 기존 문서 채점(GradeDocuments)·
용어 검증(TerminologyValidation)에서 이미 쓰던 패턴을 그대로 재사용했다.

```python
llm = create_llm(ai_model)  # hosting_type(LOCAL vLLM / CLOVA / API)에 맞는 클라이언트
judge_llm = llm.bind(max_tokens=_MAX_TOKENS_JUDGE).with_structured_output(
    JudgeVerdict, include_raw=True, method="json_mode"
)
```

여기서 채점 모델은 서비스 모델과 별개로 이름으로 조회해 주입한다. `judge_model_name`만 알면
`create_llm` 팩토리가 hosting_type에 맞는 클라이언트를 만들어 준다. (vLLM을 직접 쓰지 않고
팩토리를 거치는 이유는, 모델 이름만으로는 어느 포트에 떠 있는지 알 수 없기 때문이다.) 덕분에
"평가할 모델"과 "채점할 모델"을 자유롭게 조합할 수 있었다.

## 채점을 신뢰할 수 있게 만드는 장치들

LLM에게 채점을 맡기는 순간 새로운 걱정이 생긴다. **judge가 대충 매기면?** 실제로 초기 실험에서
judge는 온갖 방식으로 어긋났다. 이걸 잡으려고 넣은 장치들이 이 파이프라인의 핵심이다.

### 1. rubric — 이진 채점 쏠림을 막는다

가장 먼저 부딪힌 문제는 **judge가 0점 아니면 100점만 준다**는 것이었다. "맞으면 100, 아니면 0"
식으로 판단해 버려서, 미묘하게 부족한 답변("핵심은 맞지만 수치 하나 틀림")을 구분하지 못했다.
점수가 이진값처럼 뭉치니 회귀를 미세하게 추적할 수 없었다.

그래서 프롬프트에 **점수 구간별 기준(rubric)** 을 명시하고, 중간값을 적극 쓰라고 못 박았다.

```text
점수는 아래 기준을 참고해 0~100 사이에서 세밀하게 매기세요
(0/100 양극단만 쓰지 말고 중간값도 적극 사용):
- 90~100점: 핵심 내용과 세부사항까지 모두 정확히 일치
- 70~89점: 핵심 내용은 일치하나 일부 세부사항(수치, 조건 등)이 누락되거나 다소 부정확함
- 40~69점: 핵심 내용의 일부만 일치하거나, 방향은 맞지만 중요한 조건을 놓침
- 10~39점: 관련은 있으나 핵심 내용이 대부분 틀리거나 다른 질문에 대한 답변
- 0~9점: 완전히 틀리거나 무관한 답변, 또는 '정보를 찾을 수 없다/모른다'며 답변 자체를 회피한 경우
```

구간마다 "무엇이 그 점수인지"를 예시로 못 박으니, 점수 분포가 눈에 띄게 완만해졌다. 같은
데이터셋을 rubric 도입 전후로 돌려 점수대별 비율을 세어 보면 차이가 분명했다.

| 점수 구간 | rubric 도입 전 | rubric 도입 후 |
|---|---|---|
| 0~9 | 40% | 17% |
| 10~39 | 4% | 13% |
| 40~69 | 5% | 22% |
| 70~89 | 7% | 27% |
| 90~100 | 44% | 21% |

도입 전에는 0점대와 90점대에 84%가 몰려 사실상 이진 판정이었다. rubric을 준 뒤로는 중간
구간(40~89)이 12%에서 49%로 늘어, 미묘하게 부족한 답변을 점수로 구분할 수 있게 됐다. rubric은
judge의 자유도를 좁혀 판정을 재현 가능하게 만든다.

<!-- 이미지: 구글 검색 "LLM 평가 루브릭 점수 분포" · 저장 /assets/img/posts/ai/llm/llm-as-judge/rubric-distribution.png -->

### 2. 회피 답변 규칙 — 후하게 봐주는 걸 막는다

두 번째 문제. 챗봇이 **"정보를 찾을 수 없습니다"** 라고 답을 회피했을 때, judge가 이걸 "틀리지도
않았으니 부분점수"라며 40~50점씩 주곤 했다. 하지만 사용자 입장에서 답을 못 준 건 명백한
실패다. 회피에 부분점수를 주면 "모른다고 하면 중간은 간다"는 왜곡된 신호가 통계에 섞인다.

그래서 rubric의 최하 구간에 회피를 명시적으로 묶고, 별도 문장으로 한 번 더 강조했다.

```text
주의: 답변을 회피하거나 모른다고 답한 경우는 부분점수를 주지 말고 0~9점으로 채점하세요.
```

### 3. 다중 샘플 — judge의 흔들림을 평균으로 누른다

LLM 채점은 같은 입력에도 매번 조금씩 다른 점수를 낸다. 한 번 호출한 값 하나를 그대로 믿으면,
그 흔들림이 곧바로 평가 결과의 노이즈가 된다. 그래서 judge를 **여러 번 돌려** 점수는 평균,
정답 여부는 다수결로 집계했다.

```python
samples = max(1, judge_sample_count)
scores, correct_votes, reasonings = [], [], []
for _ in range(samples):
    try:
        raw_result = await judge_llm.ainvoke([HumanMessage(content=prompt)])
        parsed = raw_result.get("parsed")
        if parsed:
            scores.append(parsed.score)
            correct_votes.append(parsed.is_correct)
            reasonings.append(parsed.reasoning)
    except Exception as e:
        logger.warning(f"[JudgeService] judge 호출 실패, 이번 샘플 스킵: {e}")

if not scores:
    raise RuntimeError("judge 채점에 모두 실패했습니다.")

avg_score = sum(scores) / len(scores)
is_correct = sum(1 for v in correct_votes if v) > len(correct_votes) / 2
```

`score`는 평균으로 분산을 줄이고, `is_correct`는 다수결로 정한다. 샘플 하나가 파싱에 실패해도
전체가 죽지 않게 그 샘플만 건너뛰고, **전부 실패했을 때만** 예외를 던진다. 대량 평가에서 한
케이스의 일시적 실패가 배치 전체를 무너뜨리지 않게 하는 방어다.

### 4. 임베딩 유사도 — judge 점수를 교차 확인하는 보조 지표

judge 점수 하나만 믿기엔 여전히 불안했다. 그래서 정답과 생성 답변의 **임베딩 코사인 유사도**를
보조 지표로 함께 계산했다. LLM의 판단과는 독립된, 의미 근접도의 정량 신호다. judge가 90점을
줬는데 임베딩 유사도가 유독 낮다면, 그 케이스는 사람이 다시 들여다볼 후보가 된다.

중요한 설계 선택은 **새 임베딩 모델을 띄우지 않았다**는 점이다. 이미 문서 검색에 쓰고 있는
[bge-m3](https://rlckdwkd55.github.io/posts/embeddings-bge-m3/) dense 임베딩 클라이언트를 그대로
재사용했다.

```python
async def compute_semantic_similarity(self, generated_answer, ground_truth):
    if self.vector_store_manager.dense_embeddings is None:
        return None
    loop = asyncio.get_running_loop()
    vec_a, vec_b = await asyncio.gather(
        loop.run_in_executor(self.vector_store_manager.executor,
                             self.vector_store_manager.dense_embeddings.embed_query, generated_answer),
        loop.run_in_executor(self.vector_store_manager.executor,
                             self.vector_store_manager.dense_embeddings.embed_query, ground_truth),
    )
    return _cosine_similarity(vec_a, vec_b)
```

동기 임베딩 호출을 executor로 밀어 이벤트 루프를 막지 않게 하고, 두 벡터를 `gather`로 동시에
뽑는다. 임베딩이 준비 안 됐거나 실패하면 유사도는 `None`으로 조용히 빠져, judge 점수만으로도
평가가 굴러가게 했다. 어디까지나 judge를 **보조**하는 지표이지 대체하는 게 아니기 때문이다.

## 채점기 자신도 검증 대상이었다

이 작업에서 가장 흥미로웠던 깨달음은, **judge 자체가 결함을 가진 측정 도구**라는 점이었다.
위에서 이야기한 이진 쏠림, 회피 오채점은 전부 judge가 만들어 낸 문제였다. 채점기를 도입하는
순간, "채점기가 제대로 채점하는가"라는 한 겹의 검증이 새로 생긴다.

이걸 확인할 수 있었던 건 `reasoning`을 함께 받아 뒀기 때문이다. 점수가 이상한 케이스의 근거를
읽어 보면 judge가 어디서 헛짚었는지 드러났다. 이를테면 챗봇이 "해당 정보는 문서에서 찾을 수
없습니다"라고 답한 케이스에 judge가 63점을 주며 남긴 근거는 이랬다.

> 답변이 질문의 주제(연차 이월 규정)를 정확히 파악했고, 관련 정보가 없음을 정직하게 밝혔으므로
> 방향은 맞다고 볼 수 있어 부분 점수를 준다.

회피를 "정직함"으로 읽고 점수로 보상해 버린 것이다. 이런 근거를 눈으로 확인하고 나서야 회피
규칙을 rubric 최하 구간에 못 박았다. 임베딩 유사도와 judge 점수가 크게 어긋나는 케이스도 같은
방식으로 골라냈다. 채점 결과를 다시 읽고 rubric을 고치는 루프가 한동안 이어졌다.

## 왜 이게 중요한가

- **회귀 방지** — 수정 전후로 같은 데이터셋을 돌려 점수 변화를 본다. "A를 고쳤더니 B가 나빠지는" 조용한 퇴행을 배포 전에 잡는다.
- **객관화** — 사람마다 다르던 판정을, rubric이라는 명시적 잣대로 통일했다. 점수의 근거까지 남으니 왜 그 점수인지 되짚을 수 있다.
- **반복 가능성** — 수작업 검증을 자동화하니, 평가를 돌리는 비용이 거의 0에 수렴했다. 실험을 자주, 겁 없이 돌릴 수 있게 됐다.

이 채점기를 수백 케이스에 걸쳐 안전하게 병렬로 돌리는 실행 계층은 별도로 설계했다.
[대량 평가 오케스트레이션](https://rlckdwkd55.github.io/posts/assessment-orchestration/)에서 이어 다뤘다.

수작업으로 눈으로 읽던 품질 검증을 rubric·다중 샘플·임베딩 유사도로 감싼 자동 채점으로
옮겼고, 점수와 함께 `reasoning`을 남긴 덕에 채점기 자신의 오차까지 되짚어 고칠 수 있었다.
아직도 judge를 완전히 믿지는 않지만, 적어도 "좋아졌나"를 매번 같은 잣대로 다시 재 볼 수는 있게 됐다.

<br><br>
참고 : https://arxiv.org/abs/2306.05685
