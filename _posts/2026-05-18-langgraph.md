---
title: "LangGraph란?"
date: 2026-05-18
categories: [AI]
tags: [langgraph, llm, agent, orchestration]
description: "선형 체인(LCEL)으로는 담기 힘든 분기·순환·상태 공유를, 상태 그래프로 다루는 LangGraph를 State·Node·Edge와 조건부 엣지, 체크포인트까지 정리한다."
image:
  path: /assets/img/thumbnails/langgraph.png
published: false
---

체인(LCEL)은 `프롬프트 | 모델 | 파서`처럼 파이프(`|`)로 이어 붙여 "입력 → 프롬프트 → 모델 → 출력"을 한 방향으로 흘린다. 읽기 쉽고 디버깅도 단순하지만, 데이터가 한 방향으로만 흐른다는 전제가 곧 한계가 된다.

한계는 [RAG](https://rlckdwkd55.github.io/posts/rag/)를 제대로 만들 때 드러난다. 실제 검색·생성 흐름은 직선이 아니다.

- 검색 결과가 부실하면 **질문을 다시 써서 재검색**해야 한다(되돌아가기).
- 답변이 근거를 벗어나면 **다시 생성**해야 한다(반복).
- 질문 유형에 따라 **다른 경로**로 나눠야 한다(분기).
- 재시도는 **몇 번까지만** 허용해야 한다(상태를 보고 판단).

이걸 LCEL로 억지로 표현하면 `RunnableBranch`와 재귀 호출, 예외 처리가 얽혀 금세 손대기 어려운 코드가 된다. 선형 체인은 **분기·순환(cycle)·상태 공유**를 자연스럽게 담지 못한다. LangGraph는 LLM 흐름을 **상태 그래프(state graph)**, 즉 일종의 **상태 기계**로 모델링해 이 문제를 푼다.

---

## 네 가지 기본 요소

### State — 그래프 전체가 공유하는 데이터

체인은 단계 사이로 값을 **넘겨주는** 구조라 여러 단계 앞의 값을 뒤에서 다시 쓰기가 번거롭다. LangGraph는 대신 **하나의 공유 상태**를 두고 모든 노드가 그 상태를 읽고 갱신한다. 상태는 보통 `TypedDict`로 스키마를 정의한다.

```python
from typing import Annotated, TypedDict
import operator

class State(TypedDict):
    question: str                             # 원본 질문(검증 기준으로 보존)
    documents: list[str]                      # 검색된 근거 문서
    answer: str                               # 생성된 답변
    retries: int                              # 재생성 횟수(루프 가드용)
    messages: Annotated[list, operator.add]   # 리듀서: 덮어쓰지 않고 누적
```

핵심은 `messages`에 붙은 **리듀서(reducer)** 다. 노드가 어떤 키를 돌려주면 상태의 그 값을 **덮어쓰는(last write wins)** 게 기본이지만, 대화 이력처럼 **쌓여야** 하는 값은 덮어쓰면 안 된다. `Annotated[list, operator.add]`로 리듀서를 지정하면 노드가 돌려준 리스트를 기존 리스트에 **더해서(append)** 병합한다. 즉 "이 필드를 어떻게 갱신할지"를 스키마 수준에서 못 박는 장치다.

### Node — 상태를 받아 일부를 바꿔 돌려주는 함수

노드는 그냥 함수다. 현재 상태를 인자로 받고 **바꾸고 싶은 키만** 담은 딕셔너리를 돌려준다. 상태 전체를 통째로 반환할 필요가 없다.

```python
def retrieve(state: State) -> dict:
    docs = search(state["question"])          # 벡터 검색 등
    return {"documents": docs}                # documents만 갱신

def generate(state: State) -> dict:
    answer = llm_generate(state["question"], state["documents"])
    return {"answer": answer, "retries": state["retries"] + 1}
```

돌려준 딕셔너리는 리듀서 규칙에 따라 병합된다. 리듀서가 없는 `answer`는 덮어쓰기, `messages`였다면 누적이다.

### Edge — 다음 노드로 가는 길

엣지는 노드 사이의 연결이다. `add_edge("A", "B")`는 "A 다음엔 무조건 B"라는 고정 경로다. 시작과 끝은 `START`, `END`라는 특수 노드로 표시한다.

### 조건부 엣지 — 상태를 보고 갈림길을 고른다

분기의 핵심이다. **라우팅 함수**가 현재 상태를 보고 "다음에 어디로 갈지"를 문자열로 돌려주면, LangGraph가 그 값에 매핑된 노드로 보낸다.

```python
def route_after_validate(state: State) -> str:
    if is_grounded(state["answer"], state["documents"]):
        return "end"                          # 근거에 충실 → 종료
    if state["retries"] >= 3:
        return "end"                          # 재시도 상한 가드
    return "regenerate"                       # 불충분 → 다시 생성
```

라우팅 함수 안에서 `retries`를 검사해 **순환을 끊는 가드**를 둔 점이 중요하다. 그래프는 루프를 표현할 수 있는 만큼, 종료 조건을 챙기지 않으면 무한 루프에 빠진다.

---

## 검색 → 생성 → 검증 → (불일치 시) 재생성 루프

네 요소를 엮어 실무에서 자주 쓰는 흐름을 만든다. RAG에서 답변이 근거를 벗어나면 다시 생성하는, [용어 일치 검증 루프](https://rlckdwkd55.github.io/posts/terminology-validation/)와 같은 구조다.

```text
        ┌──────────────── (불충분 & 재시도 남음) ────────────────┐
        ▼                                                         │
START → retrieve → generate → [validate] ──(충실 or 상한)──► END  │
                       ▲                                          │
                       └──────────── regenerate ─────────────────┘
```

<!-- 이미지: 구글 검색 "langgraph state node edge conditional graph" · 저장 /assets/img/posts/ai/langgraph/<name>.png -->

```python
from langgraph.graph import StateGraph, START, END

builder = StateGraph(State)
builder.add_node("retrieve", retrieve)
builder.add_node("generate", generate)
builder.add_node("validate", validate)

builder.add_edge(START, "retrieve")
builder.add_edge("retrieve", "generate")
builder.add_edge("generate", "validate")

# validate 다음은 상태에 따라 갈린다
builder.add_conditional_edges(
    "validate",
    route_after_validate,
    {"regenerate": "generate", "end": END},   # 반환 문자열 → 실제 노드
)

graph = builder.compile()
result = graph.invoke({"question": "재동기화 절차는?", "retries": 0})
```

`{"regenerate": "generate"}` 매핑이 **이미 지나온 노드로 되돌아가는 순환**을 만든다. 선형 체인이라면 재귀 함수와 카운터로 직접 구현했을 로직이, 그래프에서는 "엣지를 뒤로 연결한다"는 선언 하나로 끝난다. 흐름이 **코드 구조가 아니라 그래프 구조**로 드러난다.

에이전트의 "도구 호출 → 결과 관찰 → 다시 판단" 루프도 같은 모양이다. 모델이 [함수 호출(function calling)](https://rlckdwkd55.github.io/posts/llm-function-calling/)로 도구를 부르면 도구 노드로 가고, 결과를 상태에 넣은 뒤 다시 모델 노드로 돌아온다. 더 부를 도구가 없으면 `END`로 빠진다. 에이전트란 결국 **조건부 엣지가 달린 순환 그래프**다.

---

## 체크포인트와 사람 개입

`compile`할 때 **체크포인터(checkpointer)**를 붙이면 각 노드 실행 후의 상태가 저장되고, `thread_id`로 스레드(대화)를 구분하면 다음 호출 때 **이전 상태에서 이어서** 실행된다. 멀티턴 대화나 중단·재개에 필수다.

```python
from langgraph.checkpoint.memory import MemorySaver

graph = builder.compile(checkpointer=MemorySaver())   # 운영에선 SqliteSaver 등
config = {"configurable": {"thread_id": "user-42"}}

graph.invoke({"question": "첫 질문", "retries": 0}, config)
graph.invoke({"question": "이어지는 질문", "retries": 0}, config)  # 이력 유지
```

`MemorySaver`는 프로세스 메모리에 담으니 데모용이고, 운영에서는 SQLite·Postgres 기반 체크포인터로 상태를 **영속화**한다. 프로세스가 죽어도 스레드 상태가 남으므로 긴 작업 중간에 재시작해도 이어갈 수 있다.

체크포인터가 있으면 **사람이 중간에 끼어드는(Human-in-the-Loop)** 흐름도 자연스럽다. 특정 노드 직전에 멈추고, 사람이 상태를 검토·수정한 뒤 재개한다.

```python
graph = builder.compile(
    checkpointer=MemorySaver(),
    interrupt_before=["generate"],   # 이 노드 실행 직전에 멈춘다
)

graph.invoke({"question": "민감한 질문", "retries": 0}, config)
# → generate 직전에서 정지. 사람이 상태(검색 문서 등)를 확인/수정
graph.invoke(None, config)           # None으로 호출 → 멈춘 지점부터 재개
```

민감한 액션(외부 API 호출, DB 쓰기, 결제 등) 직전에 승인 단계를 넣거나 검색 결과를 사람이 걸러 주는 데 쓴다. 상태가 저장돼 있어 멈춰 있는 동안 프로세스가 다른 일을 해도 되고 재개 시점도 자유롭다. 체크포인트 없는 순수 체인으로는 흉내 내기 어려운 부분이다.

---

## 체인 vs 그래프

| | Chain (LCEL) | LangGraph |
|---|---|---|
| 흐름 | 선형(한 방향) | 분기·순환 가능 |
| 상태 | 단계 간 전달 | 공유 상태 + 리듀서 |
| 반복 | 재귀로 억지 구현 | 엣지로 자연스럽게 |
| 중단/재개 | 어려움 | 체크포인터로 지원 |
| 사람 개입 | 흐름 밖에서 처리 | 노드 사이에 삽입 |
| 가시성 | 코드로 흐름 파악 | 그래프로 흐름 드러남 |
| 적합 | 단순 파이프라인 | 에이전트·조건부·재시도 |

## 트레이드오프

- **오버엔지니어링** — 분기도 루프도 없는 "프롬프트 → 모델 → 출력"에 StateGraph를 얹으면 상태 스키마와 노드 등록이 군더더기다. "제어 흐름이 실제로 휘어지는가"가 도입 기준이다.
- **상태 설계가 곧 품질** — 덮어써야 할 값에 누적 리듀서를 붙이거나 그 반대면, 흐름은 도는데 값이 이상해진다. 필드와 리듀서 선택이 버그의 온상이다.
- **순환의 대가는 무한 루프** — 되돌아가는 엣지를 만들 수 있다는 건 종료 조건을 직접 책임져야 한다는 뜻이다. `retries` 같은 카운터 가드를 항상 상태에 둔다.

단순 파이프라인은 체인으로 충분하고, **흐름이 실제로 휘어질 때** 상태 그래프가 강력하다. State·Node·Edge와 조건부 엣지, 그리고 체크포인터. 이 어휘만 잡으면 에이전트도 결국 조건부 엣지가 달린 순환 그래프로 읽힌다.

<br><br>
참고 : https://langchain-ai.github.io/langgraph/concepts/low_level/
