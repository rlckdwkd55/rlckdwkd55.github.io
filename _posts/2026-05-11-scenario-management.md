---
title: "시나리오 답변을 벡터로 색인하고 DB·Qdrant 동기화하기"
date: 2026-05-11
categories: [AI]
tags: [qdrant, vector-db, rag]
description: "자주 묻는 정형 질문에 고정 답을 즉시 주는 '시나리오'를, 질문 패턴을 벡터로 색인해 관리하고 관계형 DB와 Qdrant를 CRUD마다 동기화해 유령 데이터를 막은 실전 회고."
image:
  path: /assets/img/thumbnails/scenario.png
published: false
---

## 배경: 모든 질문을 LLM에 보낼 필요는 없다

챗봇을 운영하다 보면 들어오는 질문의 상당수가 정형화되어 있다. "환불 어떻게 해요?",
"영업시간 알려줘", "배송 조회" 같은 것들이다. 이런 질문까지 매번 LLM으로 보내면 응답이
느리고, 토큰 비용이 나가고, 무엇보다 **답이 매번 조금씩 달라진다**. 정해진 답을 줘야 하는
질문에 생성 모델이 매번 새 문장을 만드는 건 리스크였다.

그래서 **시나리오**를 뒀다. "이런 질문엔 이 답을 즉시 준다"는 규칙이다. 관리자가 질문
패턴과 고정 답변을 등록해 두면, 사용자 질문이 그 패턴과 충분히 유사할 때 LLM을 거치지 않고
등록된 답을 바로 돌려준다.

이 글에서 다루는 건 그중에서도 **시나리오를 관리하고, 질문 패턴을 벡터로 색인하고, 관계형
DB와 벡터 DB([Qdrant](https://rlckdwkd55.github.io/posts/qdrant/))를 동기화하는 부분**이다.
실제로 들어온 질문을 시나리오로 라우팅하고 즉시 응답하는 흐름은 팀에서 함께 만들었기 때문에,
여기서는 내가 맡은 관리·색인·동기화 로직만 코드 기준으로 정리한다.

<!-- 이미지: 구글 검색 "vector db relational db sync crud" · 저장 /assets/img/posts/ai/scenario/<name>.png -->

## 질문 패턴을 벡터로 색인

시나리오 하나는 이렇게 생겼다.

```text
시나리오 "환불 안내"
  질문 패턴: ["환불 어떻게 해요?", "환불 방법 알려줘", "결제 취소하고 싶어요"]
  고정 답변: "환불은 마이페이지 > 주문내역에서 신청하실 수 있습니다..."
```

한 시나리오에 질문 패턴이 여러 개 붙는다. 같은 의도라도 사용자가 던지는 문장은 제각각이기
때문이다. 이 패턴들을 [임베딩](https://rlckdwkd55.github.io/posts/embeddings-bge-m3/)해 벡터로 저장해 두면, 사용자 질문 벡터와의 **유사도**로 "어느
시나리오에 해당하는가"를 판정할 수 있다. 문자열 완전 일치나 키워드 매칭으로는 "환불 방법"과
"결제 취소하고 싶어요"를 같은 의도로 묶지 못하지만, 의미 공간에서는 가깝게 놓인다.

구현에서 중요하게 잡은 건 **패턴 하나를 벡터 포인트 하나로** 저장한 점이다. 시나리오
단위로 뭉쳐서 하나의 벡터로 만들지 않았다. 패턴별로 독립된 포인트가 있어야, 사용자 질문이
"결제 취소" 쪽 표현에 가까울 때 그 포인트가 직접 매칭되고, 그 포인트의 메타데이터에서
시나리오와 답변을 바로 꺼낼 수 있다.

```python
@staticmethod
def _build_documents(seq: int, name: str, response: str, questions: List[str]) -> List[Document]:
    """각 질문 패턴을 별도 Qdrant Document로 생성"""
    return [
        Document(
            page_content=q,
            metadata={
                "scenario_seq": seq,
                "scenario_name": name,
                "response": response,
                "filename": name,
                "page_numbers": [],
            }
        )
        for q in questions if q.strip()
    ]
```

`page_content`에는 임베딩 대상인 **질문 패턴 문장**을 넣고, 정작 사용자에게 돌려줄 **고정
답변(`response`)은 메타데이터에 실었다**. 매칭이 성사되면 벡터 검색 결과의 메타데이터만
읽어 답을 즉시 반환할 수 있고, 답을 얻으려고 관계형 DB를 다시 조회할 필요가 없다.
`scenario_seq`를 함께 넣어 둔 덕분에, 나중에 특정 시나리오의 포인트만 골라 지우는 것도
가능해진다(뒤에서 동기화의 핵심이 된다).

## 관리의 핵심: DB ↔ Qdrant 동기화

시나리오는 관리자가 화면에서 **추가·수정·삭제**한다. 문제는 시나리오 데이터가 **두 곳에
산다**는 것이다.

- 관계형 DB — 시나리오와 질문 패턴의 원본(정답 소스)
- Qdrant — 질문 패턴을 임베딩한 벡터 포인트(검색용 색인)

이 둘이 어긋나는 순간 **유령 데이터**가 생긴다. DB에서는 지웠는데 Qdrant엔 벡터가 남아
있으면, 관리 화면엔 없는 시나리오가 검색에선 매칭되어 이미 폐기한 답변을 사용자에게 계속
내보내게 된다. 반대로 질문 패턴을 고쳤는데 벡터를 갱신하지 않으면, 옛 문장 기준으로 매칭이
돈다. 그래서 **모든 CRUD가 DB와 Qdrant를 함께 손대도록** 설계하는 게 이 기능의 본질이었다.

### 생성 — 컬렉션 자동 생성 후 색인

시나리오를 저장하고 질문 패턴 엔티티를 만든 뒤, Qdrant 쪽을 손댄다. 컬렉션이 없으면 먼저
만들고, 패턴들을 문서로 변환해 추가한다.

```python
try:
    if not await self.vector_manager.exists_collection(SCENARIOS_COLLECTION):
        await self.vector_manager.save(SCENARIOS_COLLECTION)

    docs = self._build_documents(saved.seq, saved.name, saved.response, valid_questions)
    if docs:
        await self.vector_manager.add_documents(SCENARIOS_COLLECTION, docs)
except Exception as e:
    logger.error(f"[ScenarioService] 시나리오 Qdrant 저장 실패 (seq={saved.seq}): {e}")
    raise CommonException(ErrorCode.VECTOR_SYNC_FAILED)
```

여기서 한 가지 원칙을 정했다. **벡터 동기화가 실패하면 조용히 넘기지 않고 예외를 던진다**
(`VECTOR_SYNC_FAILED`). Qdrant 저장이 깨졌는데 API가 성공으로 응답하면, 그 순간부터 DB와
색인이 어긋난 채로 방치된다. 차라리 실패를 드러내서 트랜잭션이 롤백되고 관리자가 다시
시도하게 하는 편이 유령 데이터보다 낫다고 봤다.

### 수정 — 해당 시나리오 포인트만 삭제 후 재추가

수정이 까다로웠다. 질문 패턴은 통째로 교체되기 때문에, 옛 패턴 벡터가 남으면 안 된다. 그래서
질문 패턴이 들어온 경우 DB에서는 기존 패턴을 지우고 새로 넣은 뒤, Qdrant에서는 **그
시나리오의 포인트만 골라 지우고 다시 추가**한다.

```python
# 질문 패턴 교체 (DB)
if req.questions is not None:
    await self.repo.delete_questions(seq)
    valid_questions = [q.strip() for q in req.questions if q.strip()]
    for q_text in valid_questions:
        self.repo.session.add(ScenarioQuestionEntity(scenario_seq=seq, question=q_text))
    await self.repo.session.flush()

# Qdrant: 해당 시나리오 포인트만 삭제 후 재추가
if await self.vector_manager.exists_collection(SCENARIOS_COLLECTION):
    await self.vector_manager.delete_scenario_points(SCENARIOS_COLLECTION, seq)
else:
    await self.vector_manager.save(SCENARIOS_COLLECTION)

docs = self._build_documents(updated.seq, updated.name, updated.response, valid_questions)
if docs:
    await self.vector_manager.add_documents(SCENARIOS_COLLECTION, docs)
```

핵심은 `delete_scenario_points(collection, seq)`이다. 컬렉션 전체가 아니라 **`scenario_seq`가
일치하는 포인트만** 지운다. 앞에서 메타데이터에 `scenario_seq`를 심어 둔 게 여기서 값을
한다. 컬렉션을 통째로 지우고 다시 만드는 대신, 수정된 시나리오 하나의 흔적만 걷어내고 새
패턴을 올리므로 다른 시나리오 색인은 그대로 살아 있다.

질문 패턴을 건드리지 않고 이름이나 답변만 바꾼 경우에도, 기존 활성 패턴을 다시 읽어 문서를
재생성한다. 답변(`response`)이 메타데이터에 들어가기 때문에, 답변만 고쳐도 벡터 포인트의
메타데이터를 새 값으로 갱신해 줘야 하기 때문이다.

### 삭제·일괄 삭제 — 포인트 정리 누락 막기

삭제에서 가장 흔한 실수가 "DB만 지우고 색인은 잊는" 것이다. 단건 삭제는 질문 패턴과
시나리오를 지운 뒤 해당 포인트를 정리한다.

```python
await self.repo.delete_questions(seq)
await self.repo.delete(entity)

if await self.vector_manager.exists_collection(SCENARIOS_COLLECTION):
    await self.vector_manager.delete_scenario_points(SCENARIOS_COLLECTION, seq)
```

일괄 삭제에서도 같은 정리를 **건별로 반복**한다. 여러 seq를 받아 하나씩 돌면서, 존재하지
않는 건 건너뛰고, 존재하는 건 DB 삭제와 포인트 삭제를 함께 수행한다.

```python
for seq in req.seq_list:
    entity = await self.repo.get_by_seq(seq)
    if not entity:
        continue
    await self.repo.delete_questions(seq)
    await self.repo.delete(entity)
    if await self.vector_manager.exists_collection(SCENARIOS_COLLECTION):
        await self.vector_manager.delete_scenario_points(SCENARIOS_COLLECTION, seq)
```

일괄 처리에서 "DB는 루프에서 다 지우고 벡터는 마지막에 한 번만" 같은 식으로 짜면, 중간에
하나가 실패했을 때 어디까지 동기화됐는지 알 수 없게 된다. 그래서 **건별로 DB와 색인을 같이
처리**해 상태가 항상 짝을 이루게 했다.

### 소프트 삭제와 하드 삭제가 섞이는 지점

한 가지 짚어 둘 만한 점은, **관계형 DB는 소프트 삭제, Qdrant는 하드 삭제**라는 것이다.
DB에서는 `deleted_at`에 시각을 찍어 논리적으로만 지운다.

```python
async def delete(self, entity: ScenarioEntity) -> None:
    entity.deleted_at = get_kst_now()
    await self.session.flush()
```

조회는 `deleted_at IS NULL` 조건으로 살아 있는 것만 본다. 반면 Qdrant에서는 포인트를
**실제로 제거**한다. 벡터 색인에 논리적으로만 지운 포인트가 남아 있으면 유사도 검색이 그걸
그대로 후보에 올리기 때문에, 색인 쪽은 물리적으로 걷어내는 게 맞다. 원본은 이력을 위해
남기되 검색 대상에서는 확실히 빼는, 두 저장소의 역할이 다른 데서 나온 선택이었다.

### 복구용 전체 재인덱싱

색인이 어쩌다 어긋났을 때를 대비해 수동 복구 경로도 뒀다. 컬렉션을 통째로 지우고 DB에 살아
있는 시나리오 전체로 다시 만든다.

```python
async def _rebuild_vectors(self) -> None:
    """수동 복구용: scenarios 컬렉션을 전체 재인덱싱"""
    await self.vector_manager.delete_collection(SCENARIOS_COLLECTION)
    all_entities = await self.repo.get_all()
    ...
```

다만 이 경로는 컬렉션을 먼저 지우고 다시 채우기 때문에, 재인덱싱이 도는 동안엔 매칭이 비는
창이 생긴다. 무중단이 필요했다면 [재임베딩 순서](https://rlckdwkd55.github.io/posts/reembedding-order/)에서 정리한
build-then-swap(새 색인을 다 만든 뒤 마지막에 전환)으로 갔겠지만, 시나리오 색인은 규모가
작고 어디까지나 예외적 복구용이라 단순한 재생성으로 충분하다고 판단했다.

## 절대 임계값 매칭이 RRF와 다른 점

시나리오 매칭에는 검색 랭킹과 근본적으로 다른 요구가 있었다. 문서 검색이라면 "가장 관련 있는
상위 몇 개"를 뽑으면 된다. 후보가 조금 덜 관련 있어도 목록에 섞여 들어가는 게 큰 문제가 아니다.
그래서 dense와 sparse 점수를 순위 기반으로 합치는 [RRF](https://rlckdwkd55.github.io/posts/rrf/) 같은 방식이 잘 맞는다.

그런데 시나리오는 **"충분히 유사할 때만" 발동해야** 한다. 애매하게 비슷한 질문에 고정 답을
잘못 쏘면 사용자에게 엉뚱한 안내가 나간다. 여기서 필요한 건 상대적 순위가 아니라 **"이
질문이 이 패턴과 정말 가까운가"라는 절대적인 판정**이다.

- RRF는 순위를 융합하므로 점수 자체의 절대적 의미가 흐려진다. "1등"이라도 실제로는 별로 안
  가까울 수 있는데, 순위만 보면 그걸 알 수 없다.
- 시나리오는 코사인 유사도 값 자체에 임계값(예: 0.9 이상)을 걸어, 그 선을 넘을 때만
  발동시켜야 한다. 아무것도 임계값을 못 넘으면 시나리오를 태우지 않고 일반 LLM 흐름으로
  넘기는 게 정답이다.

그래서 시나리오는 하이브리드 검색 파이프라인에 얹지 않고, **dense 전용 컬렉션**으로 따로
두어 코사인 값 자체로 판정했다. 같은 벡터 검색이라도 "순위를 매기는 문제"와 "임계값을 넘는지
판정하는 문제"는 설계가 다르다는 걸 여기서 확실히 배웠다.

## 정리

- 정형 질문은 LLM에 보내지 말고 **질문 패턴을 벡터로 색인해 유사도로 매칭**하면 빠르고,
  답이 흔들리지 않는다. 패턴은 시나리오 단위가 아니라 **문장 하나당 포인트 하나**로 저장하고,
  고정 답변은 메타데이터에 실어 매칭 즉시 반환했다.
- 데이터가 **관계형 DB와 벡터 DB 두 곳**에 있으면 모든 CRUD에서 동기화를 보장해야 유령
  데이터가 안 생긴다. 메타데이터의 `scenario_seq`로 **해당 시나리오 포인트만** 삭제·재추가하는
  게 동기화의 축이었다.
- 삭제·일괄 처리에서 **색인 정리 누락**이 가장 흔한 함정이라, 건별로 DB와 벡터를 함께
  처리하고 동기화 실패는 예외로 드러냈다(`VECTOR_SYNC_FAILED`).
- 원본은 소프트 삭제, 색인은 하드 삭제 — 두 저장소의 역할이 다르면 삭제 방식도 달라진다.
- 시나리오 매칭은 순위 융합(RRF)이 아니라 **절대 임계값 판정**이 맞다. "상위 몇 개"가 아니라
  "충분히 가까운가"가 질문이었다.
