---
title: "RAG 답변에 용어 일치 검증·교정 루프 붙이기"
date: 2026-06-08
categories: [AI, RAG]
tags: [rag, llm, validation]
description: "RAG 답변이 표준 용어를 벗어나는 문제를, 생성 뒤 용어 검증과 교정 재생성 루프로 잡은 과정을 실제 구현 기준으로 정리한다."
image:
  path: /assets/img/thumbnails/terminology-validation.png
published: false
---

## 문제: 답은 맞는데 "용어"가 튄다

RAG를 붙인 사내 챗봇에서, 답 자체는 틀리지 않는데 **표준 용어 대신 유의어나 비슷한 표현**이 튀어
나오는 일이 반복됐다. 문서에는 "재동기화"라고 적혀 있는데 답변은 "재싱크"라고 하고, "반출 승인"을
"출고 허가"쯤으로 풀어 쓰는 식이다. 뜻은 통해도, 한 고객사가 사내에서 정해 쓰는 용어와 다르면
사용자는 "이게 맞는 얘기가 맞나" 하고 멈칫한다. 도메인 용어가 어긋나면 답의 신뢰가 흔들렸다.

[검색과 생성 자체](https://rlckdwkd55.github.io/posts/rag/)는 리랭킹까지 붙여 꽤 다듬은 상태였다.
그런데도 이 문제는 남았다. 원인이 검색이 아니라 **출력 단계**에 있었기 때문이다. 좋은 문서를 잘
찾아와도, 마지막 생성 LLM이 자기 말투로 바꿔 쓰면 용어는 그 순간 새어 버린다. 그래서 "생성이
끝났다"를 곧바로 "응답 완료"로 보지 않기로 했다.

## 접근: 생성 뒤에 "검증 → 교정" 한 단계를 더

우리 파이프라인은 [LangGraph](https://rlckdwkd55.github.io/posts/langgraph/) 기반 멀티 에이전트
구조라, 전문 에이전트 하나가 `쿼리 생성 → 검색 → 답변 생성(Step2)`을 돈다. 여기에 Step2 바로 뒤에
한 단계를 더 끼웠다.

```text
Step2 생성 → [용어 검증] ──(yes)──► 응답
                 │
              (no: 이유 누적)
                 ▼
          교정 프롬프트로 재생성 → 다시 검증 (최대 N회)
                 │
          (N회 모두 실패) → 답변 내보내지 않고 supervisor로 에스컬레이션
```

<!-- 이미지: 구글 검색 "RAG 검증 재생성 루프" · 저장 /assets/img/posts/ai/terminology/validation-loop.png -->

핵심은 "검증을 사람이 읽는 문장이 아니라 **기계가 분기할 수 있는 판정**으로 받는다"는 점이다.
자유 텍스트 판정은 파싱이 흔들려서, 검증 결과를 신뢰하고 분기할 수가 없다.

## 구현 골자: 구조화 판정 → 이유 누적 → 교정 재생성

검증 결과 스키마는 딱 두 필드로 뒀다. 판정은 `yes`/`no` 이진값, 그리고 `no`일 때만 채워지는 이유다.

```python
class TerminologyValidation(BaseModel):
    """용어 일치 검증 결과"""
    binary_score: str = Field(
        description="답변의 용어가 원본 문서와 일치하면 'yes', 불일치하면 'no'"
    )
    reason: Optional[str] = Field(
        None,
        description="불일치하는 경우(binary_score='no'), 어떤 용어가 어떻게 잘못 쓰였는지 구체적으로 설명",
    )
```

검증 LLM은 `with_structured_output`으로 이 스키마에 강제로 맞춰 뽑는다. `method="json_mode"`로
JSON을 받고, `include_raw=True`로 원본 응답(토큰 사용량·메타데이터)도 함께 챙긴다.

```python
validator_llm = llm.bind(max_tokens=_MAX_TOKENS_TERMINOLOGY).with_structured_output(
    TerminologyValidation, include_raw=True, method="json_mode"
)
```

여기서 `max_tokens=256`을 굳이 건 이유가 있다. 검증 출력은 `{"binary_score": ..., "reason": ...}`
한 덩어리라 길 필요가 없는데, 구조화 출력 파서가 드리프트하면 모델이 JSON을 못 닫고 토큰을
줄줄 흘리는 경우가 있다. 이 한도는 vLLM이 생성을 끊는 hard cap이자 비용이 새는 것을 막는 마지막
방어선 역할을 한다. 사용자에게 보이는 답변 생성에는 이 캡을 걸지 않고, 중간 판정 단계에만 걸었다.

검증 프롬프트는 설정에서 주입받는데, 기본형은 이렇게 "원본 문서"와 "생성된 답변"을 나란히 놓고
비교시키는 형태다.

```python
_DEFAULT_TERMINOLOGY_VALIDATION_PROMPT = (
    "## 원본 문서:\n{source_documents}\n\n"
    "## 생성된 답변:\n{answer}\n\n"
    "답변에서 사용된 용어가 원본 문서에 등장하는 표현과 정확히 일치합니까?\n"
    "유의어, 약어, 또는 다른 표현으로 바꿔 쓴 경우는 불일치로 봅니다.\n"
    "모든 용어가 원본 문서의 표현과 일치하면 'yes', 하나라도 다르면 'no'로만 답하세요."
)
```

그리고 검증이 실패하면 그 **이유를 시도별로 누적**해, 다음 재생성 프롬프트에 그대로 얹는다.

```python
_accumulated_reasons: list[str] = []
for attempt in range(terminology_validation_max_retries):
    validation_prompt = terminology_validation_prompt.format(
        source_documents=tool_result_for_step2,
        answer=content,
    )
    val_result = (await validator_llm.ainvoke([HumanMessage(content=validation_prompt)])).get("parsed")
    score = val_result.binary_score.strip().lower() if val_result else "yes"

    if score == "yes":
        break  # 통과 → 루프 종료

    if getattr(val_result, "reason", None):
        _accumulated_reasons.append(f"[시도 {attempt + 1}] {val_result.reason}")

    _reasons_text = "\n".join(_accumulated_reasons)
    correction_msg = SystemMessage(content=(
        f"다음과 같은 용어 불일치가 발견되었습니다:\n{_reasons_text}\n\n"
        "위 문제를 모두 수정하여 원본 문서에 등장하는 정확한 용어를 그대로 사용해 답변을 다시 작성하세요. "
        "유의어, 약어, 다른 표현으로 바꾸지 마세요."
    ))
    # 앞선 대화 + 방금 생성한 답변 + 교정 지시를 함께 넘겨 재생성
    retry_response = await llm.ainvoke(final_messages + [final_response, correction_msg])
    content = retry_response.content
else:
    # for 루프가 break 없이 끝났다 = 모든 시도 실패
    _terminology_all_failed = True
```

두 가지가 이 루프의 뼈대다.

- **구조화 출력** — `yes`/`no`로 분기가 명확하니 코드가 판정을 믿고 흐름을 나눌 수 있다.
- **이유 누적** — 매 재시도가 이전 지적을 기억하게 해서, "재싱크를 재동기화로 고치랬더니 이번엔
  다른 용어를 흘리는" 반복을 줄인다. `[시도 N]` 태그를 붙여 어느 회차의 지적인지도 남긴다.

파이썬 `for ... else`를 쓴 건 의도적이다. `else`는 루프가 `break` 없이 끝났을 때만, 즉 **한 번도
통과하지 못했을 때만** 실행된다. "전부 실패" 상태를 별도 플래그로 관리하지 않아도 자연스럽게 잡힌다.

## 왜: 무한 루프 방지와 "기준 고정"

검증 루프에서 조심해야 할 건 두 가지다. 하나는 **끝나지 않는 것**, 다른 하나는 **엉뚱한 기준으로
검증하는 것**이다.

**재시도 상한.** 재생성이 매번 새 답을 만들고 그걸 또 검증하니, 상한이 없으면 이론상 영원히 돈다.
그래서 `terminology_validation_max_retries`(기본 1회, 설정에서 조정)로 못을 박았다. 검증·재생성은
각각 LLM 호출이라 지연·비용이 곧바로 붙는다. 상한은 품질과 응답 속도 사이의 타협점이다.

**검증 기준 고정.** 우리 파이프라인엔 대화 맥락으로 대명사를 풀어 검색 쿼리를 만드는 단계가 있어서,
"질문"이 도중에 바뀔 여지가 있다. 그래서 사용자의 **원본 질문을 그래프 상태(`original_user_question`)에
따로 보존**해, 쿼리 생성이나 언어 판정이 재작성된 문장에 오염되지 않게 했다.

```python
# 그래프 진입 시 원본 질문을 상태에 심어둔다
'original_user_question': chat_req.message,
```

그리고 용어 검증 자체의 기준은 **재작성된 질문이 아니라 실제로 검색해 온 원본 문서**(`source_documents`)다.
"답변이 근거 문서의 표현을 그대로 쓰는가"만 본다. 무엇을 기준으로 삼는지를 한 곳에 고정해 두지
않으면, 검증이 통과·실패를 오락가락하며 신뢰를 잃는다.

## 트레이드오프: 못 고치면 "차라리 안 내보낸다"

가장 고민한 결정이 여기다. N회를 다 쓰고도 용어를 못 맞추면 어떻게 할까. 마지막으로 생성된
답변을 그냥 내보낼 수도 있었지만, 그렇게 하지 않았다. **틀린 용어가 섞인 답을 자신 있게 내보내는
것보다, 답을 못 만들었다고 인정하는 편이 낫다**고 봤다.

그래서 전부 실패하면 그 답변은 버리고, supervisor로 돌아가면서 실패 신호와 에이전트 이름을 남긴다.

```python
if _terminology_all_failed:
    _failed_agents = list(state.get("terminology_failed_agents", []))
    if agent_name not in _failed_agents:
        _failed_agents.append(agent_name)
    _val_fail_signal = AIMessage(
        content=(
            f"[TERMINOLOGY_VALIDATION_FAILED] 에이전트 '{agent_name}'의 답변이 "
            f"용어 검증을 {terminology_validation_max_retries}회 모두 통과하지 못했습니다. "
            "정확한 용어를 포함한 답변 생성이 불가능합니다."
        ),
        name=agent_name,
    )
    return Command(
        update={"messages": [_val_fail_signal],
                "terminology_failed_agents": _failed_agents},
        goto="supervisor",
    )
```

supervisor는 이 목록을 받아 "이 에이전트는 용어 검증을 계속 실패했으니 다시 부르지 말라"는 맥락을
자기 판단에 반영한다. 같은 실패를 반복하지 않게 하는 안전장치다.

검증 단계마다 `trace_terminology_val` 이벤트로 시도 횟수·소요 시간·원본/교정 답변 미리보기·토큰
사용량을 남겨서, 나중에 실패율과 평균 시도 횟수, 실패 사유 TOP N을 통계로 볼 수 있게 했다. 어떤
용어가 자주 새는지 보이면, 그건 곧 프롬프트나 용어집을 손볼 지점이 된다.

## 배운 것

- RAG 신뢰성은 입력(검색 관련성)만이 아니라 **출력(용어) 검증**까지 봐야 비로소 닫힌다.
  검색을 아무리 잘해도 마지막 생성이 용어를 바꾸면 소용없다.
- 검증은 [구조화 출력](https://rlckdwkd55.github.io/posts/llm-function-calling/)으로 받아 코드가
  분기할 수 있게 하고, 실패 시엔 **이유를 누적해 교정 재생성**하면 수렴이 빠르다.
- 루프에는 반드시 **재시도 상한**과 **기준 고정**을, 그리고 못 고쳤을 때의 **명확한 실패 경로**를
  둔다. "틀린 답을 내보내지 않는다"는 결정이, 검증 루프를 붙인 진짜 이유였다.

<br><br>
참고 : https://langchain-ai.github.io/langgraph/tutorials/rag/langgraph_self_rag/
