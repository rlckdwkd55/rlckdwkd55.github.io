---
title: "대량 평가를 안전하게 돌리기"
date: 2026-06-22
categories: [Backend]
tags: [concurrency, async, orchestration, semaphore]
description: "수십 문항짜리 평가 데이터셋을 병렬로 실행하되, 한 항목의 실패가 전체를 무너뜨리지 않고 과부하 없이 중간에 안전하게 멈출 수 있도록 만든 평가 실행 오케스트레이션 회고."
image:
  path: /assets/img/thumbnails/assessment-orchestration.png
published: false
---

> 평가 한 건을 어떻게 채점하는지(LLM-as-Judge)는 [지난 글](https://rlckdwkd55.github.io/posts/llm-as-judge/)에서 다뤘다.
> 이번 글은 그 채점을 **데이터셋 단위로, 수십 건을 동시에, 안전하게 실행**하는
> 오케스트레이션을 어떻게 짰는지에 대한 회고다.

챗봇 파이프라인을 손볼 때마다 "이번 수정이 답변 품질을 떨어뜨리지 않았나"를 확인하고
싶었다. 그래서 질문·정답 쌍을 모아둔 평가 데이터셋을 만들고, 버튼 하나로 전체를 돌려
점수를 뽑는 기능을 붙였다. 문제는 "전체를 돌린다"가 생각보다 위험한 작업이었다는 점이다.

## 문제: 수십 문항을 한 번에 돌리면

한 문항을 평가하는 비용은 절대 가볍지 않다. **챗봇 세션을 새로 만들고 → 파이프라인을
스트리밍으로 끝까지 돌리고 → 생성된 답변을 LLM으로 채점하고 → 의미 유사도까지 계산**한다.
문항 하나에 수 초, 데이터셋은 수십 문항. 전부 외부 의존(LLM·벡터DB·내부 파이프라인)이라
느리고 불안정하다. 순차로 `for`를 돌리거나 반대로 전부 `gather`로 던지면 세 가지가
바로 터졌다.

1. **한 항목의 실패가 전체를 죽인다** — 중간 문항에서 예외가 나면 실행 자체가 중단되고,
   그때까지의 결과도 애매해진다.
2. **동시성 폭주** — 40개를 한 번에 던지면 LLM 호출과 DB 커넥션이 순식간에 포화된다.
3. **멈출 수가 없다** — 잘못된 설정으로 돌린 걸 알아채도, 끝까지 기다리는 것 말고는
   방법이 없다.

실행 구조 자체는 두 단계로 나눴다. `create_run`에서 실행 레코드와 항목별 대기 결과를
먼저 만들어두고(스냅샷, 설계 4에서 다룬다), `execute_run`은 실제 작업을 백그라운드
태스크로 띄우고 바로 응답을 돌려준다.

```python
async def execute_run(self, run_seq: int) -> AssessRunEntity:
    run = await self.run_repo.get_by_seq(run_seq)
    if not run:
        raise CommonException(ErrorCode.ASSESS_RUN_NOT_FOUND)
    if run.status == AssessRunStatus.RUNNING:
        raise CommonException(ErrorCode.ASSESS_RUN_ALREADY_RUNNING)

    # 요청 스레드를 붙잡지 않고 백그라운드로 실행 — API는 즉시 반환된다
    asyncio.create_task(AssessExecutionService._run(run.seq, ...))
    return run
```

API가 실행이 끝날 때까지 기다리면 타임아웃에 걸린다. 그래서 `create_task`로 던지고,
진행 상황은 항목별 결과 레코드의 상태로 폴링하게 했다. 아래 네 가지 설계는 전부 이
백그라운드 `_run` 안에서 벌어지는 일이다.

## 설계 1: 항목별 독립 세션 — 실패 격리

가장 먼저 잡은 건 실패 격리다. 문항 하나가 죽어도 나머지는 계속 가야 한다. 그러려면
**항목마다 완전히 독립된 DB 세션**을 열어야 했다. 세션을 공유하면 한 항목에서 난 예외가
세션을 오염시켜 나머지 커밋까지 말려들기 때문이다.

```python
@staticmethod
async def _run_single_item(run_seq, result_seq, semaphore, ...) -> None:
    async with semaphore:
        async with AsyncSessionLocal() as session:      # 항목마다 독립 세션
            run = await run_repo.get_by_seq(run_seq)
            result = await result_repo.get_by_seq(result_seq)
            ...
            try:
                # 챗봇 세션 생성 → 파이프라인 스트리밍 → 채점 → 유사도
                ...
                result.result_status = AssessResultStatus.SUCCESS
            except Exception as e:
                logger.error(f"[AssessExecution] run={run_seq} result={result_seq} 항목 평가 실패: {repr(e)}")
                result.result_status = AssessResultStatus.ERROR
                result.error_message = str(e)[:500]      # 실패도 결과로 남긴다

            await run_repo.increment_completed_items(run_seq)
            await session.commit()
```

핵심은 `try/except`가 **항목 하나의 경계 안**에 있다는 점이다. 예외를 잡아 그 문항만
`ERROR`로 기록하고, 에러 메시지를 500자로 잘라 남긴 뒤, 완료 카운터를 올리고 커밋한다.
바깥의 `gather`는 이 사실을 모른 채 나머지 문항을 계속 돌린다. 실패도 하나의 정상적인
결과로 기록하는 셈이라, 전체는 끝까지 완주한다.

이 항목별 독립 세션 패턴은 사실 스케줄러 도메인에서 이미 쓰던 방식을 그대로 가져온
것이다. 주기 작업도 "한 작업 실패가 다른 작업을 막으면 안 된다"는 요구가 똑같았다.
비동기 세션의 수명·격리 규칙은 [SQLAlchemy 비동기 글](https://rlckdwkd55.github.io/posts/sqlalchemy-async/)에서
정리했는데, 그 규칙이 여기서 그대로 실패 격리의 근거가 됐다.

## 설계 2: 세마포어로 동시성 제한

독립 세션으로 실패는 격리됐지만, 전부 `gather`로 던지면 이번엔 동시성이 문제다. 40개
문항이 동시에 챗봇 세션을 만들고 LLM을 때리면 순식간에 포화된다. 그렇다고 순차로
돌리면 너무 느리다. 그 사이를 `asyncio.Semaphore`로 잡았다.

```python
concurrency = max(1, settings.ASSESS_RUN_CONCURRENCY)
semaphore = asyncio.Semaphore(concurrency)

await asyncio.gather(*[
    AssessExecutionService._run_single_item(run_seq, result_seq, semaphore, ...)
    for result_seq in result_seqs
])
```

태스크는 문항 수만큼 전부 생성하지만, 실제로 동시에 일하는 건 세마포어 슬롯 수만큼이다.
설계 1의 `_run_single_item`이 `async with semaphore:`로 시작하는 이유가 이것이다.
동시성 값은 설정에서 주입받고 `max(1, ...)`로 감쌌다 — 설정이 0이나 음수로 들어와도
최소 1개는 돌아 데드락에 빠지지 않게 하는 방어다.

트레이드오프는 명확하다. 값을 키우면 빠르지만 외부 의존이 흔들리고, 줄이면 안정적이지만
느리다. 실패율이 튀지 않는 선을 기준으로 값을 잡았다. 최대한 병렬로 돌리는 것 자체가
목적이 아니라, 과부하 없이 얻을 수 있는 만큼만 병렬로 얻는 것이 목적이었기 때문이다.

<!-- 이미지: 구글 검색 "세마포어 동시 실행 제한" · 저장 /assets/img/posts/backend/assessment/semaphore.png -->

다만 세마포어는 프로세스 하나 안에서만 유효하다. 인스턴스가 여러 대라면 각자 자기
세마포어를 들고 있어 전체 동시성은 그만큼 곱해진다. 그건 세마포어가 아니라
[분산 락](https://rlckdwkd55.github.io/posts/distributed-lock/)이 필요한 다른 문제다.

## 설계 3: 소프트 취소(soft cancel)

가장 오래 고민한 부분이다. 실행을 중단하고 싶을 때 진행 중인 태스크를 `cancel()`로
강제로 죽이면, 챗봇 세션은 만들어졌는데 채점은 안 된 어중간한 상태가 남는다. 그래서
**이미 시작한 항목은 마저 끝내고, 아직 시작 안 한 항목만 건너뛰는** 소프트 취소를 택했다.

취소 API는 단순하다. 태스크를 건드리지 않고 **DB 상태 플래그만 뒤집는다.**

```python
async def cancel_run(self, run_seq: int) -> AssessRunEntity:
    run = await self.run_repo.get_by_seq(run_seq)
    if run.status != AssessRunStatus.RUNNING:
        raise CommonException(ErrorCode.ASSESS_RUN_NOT_RUNNING)

    # 진행 중이던 항목까지 강제 중단하지는 않는다 — 이미 시작된 항목은 마저 끝내고,
    # 아직 시작 전인 항목만 _run_single_item에서 이 상태를 보고 건너뛴다 (soft cancel).
    run.status = AssessRunStatus.CANCELLED
    run.error_message = "사용자에 의해 중지되었습니다."
    return await self.run_repo.save(run)
```

실제 취소 판정은 각 항목이 **세마포어 슬롯을 잡은 직후** 스스로 한다. 이 시점에 DB에서
실행 상태를 다시 읽어, CANCELLED면 자기 몫을 포기하고 빠진다.

```python
async with semaphore:
    async with AsyncSessionLocal() as session:
        run = await run_repo.get_by_seq(run_seq)
        ...
        if run.status == AssessRunStatus.CANCELLED:
            # 아직 시작 전이던 항목 — 이미 진행 중이던 항목은 여기까지 오지 않고 계속 처리된다.
            result.result_status = AssessResultStatus.ERROR
            result.error_message = "취소된 평가입니다."
            await session.commit()
            return
        # 여기를 지난 항목은 취소가 들어와도 끝까지 완료된다
```

취소 API와 실행 태스크는 서로를 직접 알지 못한다. 오직 **DB의 상태 컬럼**으로만 소통한다.
세마포어가 이미 진행 중인 항목 수를 좁혀두기 때문에, 취소를 눌러도 최대 슬롯 개수만큼만
더 돌고 멈춘다.

마지막으로 집계 단계에서도 이 상태를 존중한다. 실행이 끝나고 결과를 합산할 때, 사용자가
중지시킨 경우엔 COMPLETED/FAILED로 되돌리지 않고 **CANCELLED를 그대로 유지**한다.

```python
if run.status != AssessRunStatus.CANCELLED:
    run.status = AssessRunStatus.COMPLETED if success_results else AssessRunStatus.FAILED
    run.error_message = None if success_results else "모든 항목 평가에 실패했습니다."
```

이걸 빠뜨렸다가, 취소한 실행이 마지막에 "완료"로 덮여 히스토리가 헷갈린 적이 있다.
소프트 취소는 시작 플래그만 세운다고 끝나는 게 아니라, 집계 단계까지 그 의도를 이어
지켜줘야 한다.

## 설계 4: 실행 시작 시점의 스냅샷

마지막 함정은 데이터였다. 평가가 도는 도중에 누군가 데이터셋의 질문이나 정답을 수정하면,
같은 실행 안에서도 문항마다 다른 기준으로 채점되는 사고가 난다. 그래서 실행을 만들 때
**질문·정답을 결과 레코드로 복사**해두고, 실행은 원본이 아니라 이 스냅샷만 본다.

```python
# create_run: 실행 전 대기 상태 스냅샷 — 이후 데이터셋 항목이 수정돼도 이 실행 결과에는 영향 없도록 복사
pending_results = [
    AssessResultEntity(
        run_seq=run.seq,
        dataset_item_seq=item.seq,
        question=item.question,          # 스냅샷
        ground_truth=item.ground_truth,  # 스냅샷
        result_status=AssessResultStatus.ERROR,
        error_message="대기 중",
    )
    for item in items
]
await self.result_repo.save_all(pending_results)
```

덕분에 `_run_single_item`은 데이터셋 원본을 다시 조회하지 않고 `result.question`,
`result.ground_truth`로 채점한다. 실행이 시작된 순간의 데이터가 그 실행 내내 고정된다.
같은 기준으로 다시 재는 것, 즉 재현성 있는 평가의 최소 조건이었다.

이 대기 결과들은 부수 효과도 있었다. 실행을 던지자마자 프론트가 폴링할 대상이 이미
DB에 존재하므로, 진행률(전체 N개 중 몇 개 완료)을 처음부터 그릴 수 있다.

## 곁다리에서 붙잡은 것: 세션 간 read-after-write

구현하며 가장 오래 붙잡은 버그는 오케스트레이션이 아니라 세션 가시성이었다. 파이프라인
스트리밍이 끝난 뒤 방금 생성된 답변을 조회하는데, 파이프라인의 마무리 커밋이 **다른
세션**에서 일어나다 보니 같은 세션으로 곧바로 읽으면 드물게 직전 커밋이 안 보였다.
결국 새 세션 + 짧은 백오프 재시도로 방어했다.

```python
@staticmethod
async def _fetch_latest_history(session_id):
    for attempt in range(5):
        if attempt > 0:
            await asyncio.sleep(0.3 * attempt)   # 0, 0.3, 0.6, 0.9, 1.2초
        async with AsyncSessionLocal() as session:
            chat_history_repo = ChatHistoryRepository(session)
            histories = list(await chat_history_repo.get_chat_histories_by_session_id(session_id, skip=0, limit=1))
            if histories and histories[0].ai_answer:
                return histories[0]
    return None
```

독립 세션은 실패를 격리해주는 대신, "내가 방금 쓴 걸 다른 세션이 언제 보게 되는가"라는
질문을 대신 안겨준다. 실패 격리를 얻으려고 세션을 나누면 이 가시성 비용이 따라온다.

## 돌아보면

- 대량·외부 의존 작업은 **실패 격리(항목별 독립 세션 + 항목 경계 안의 try/except)** 가
  먼저다. 실패조차 하나의 결과로 기록하면 전체는 끝까지 완주한다.
- **세마포어**로 동시성을 묶어 과부하와 속도를 절충했다. 목적은 최대한 병렬이 아니라
  과부하 없이 얻을 수 있는 만큼의 병렬이었다.
- 중단은 **소프트 취소**로. 취소 API는 DB 플래그만 뒤집고, 각 항목이 슬롯을 잡을 때
  스스로 판정한다. 시작 플래그뿐 아니라 집계 단계까지 그 의도를 지켜야 한다.
- 기준 데이터는 **실행 시작 시점 스냅샷**으로 고정해, 실행 중 원본 수정에 흔들리지 않게 했다.
- 독립 세션의 대가로 **세션 간 read-after-write 가시성**을 직접 다뤄야 했다. 격리를
  택하면 가시성 문제도 함께 온다.

<br><br>
참고 : https://docs.python.org/3/library/asyncio-sync.html#asyncio.Semaphore
