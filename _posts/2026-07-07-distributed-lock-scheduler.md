---
title: "여러 인스턴스에서 스케줄 작업 중복 실행 막기"
date: 2026-07-07
categories: [Backend, Concurrency]
tags: [scheduler, distributed-lock, concurrency, troubleshooting, experience]
description: "멀티 인스턴스 환경에서 재동기화 Cron이 중복 실행되던 문제를, 별도 인프라 없이 DB 조건부 UPDATE 하나로 만든 분산 락으로 막은 기록."
image:
  path: /assets/img/thumbnails/lock-scheduler.png
published: false
---

분산 락의 개념·TTL·펜싱 토큰 같은 원리는 [분산 락 글](https://rlckdwkd55.github.io/posts/distributed-lock/)에 따로 정리했다. 이 글은 그 원리를 실제 스케줄러에 적용한 구현 기록이다. 코드는 사내 서비스에서 발췌하되 식별 정보는 지웠다.

<!-- 이미지: 구글 검색 "다중 인스턴스 스케줄러 중복 실행" · 저장 /assets/img/posts/backend/concurrency/distributed-lock-scheduler/multi-instance.png -->

## 재동기화 Cron이 인스턴스 수만큼 돌았다

외부 DB에서 끌어온 문서를 검색 대상으로 색인해 두는데, 원본이 계속 바뀐다. 그래서 주기적으로 재동기화(재색인)하는 스케줄러가 필요했다. Cron 표현식으로 실행 주기를 정하는, 여기까진 흔한 작업이다. (Cron 표현식 자체는 [Cron 정리](https://rlckdwkd55.github.io/posts/cron/)에 따로 적어뒀다.)

문제는 서비스가 여러 인스턴스로 뜬다는 것이었다. 프로세스마다 스케줄러 루프를 그대로 돌리면, 같은 시각에 같은 작업이 인스턴스 수만큼 중복 실행된다. 같은 문서를 두 번, 세 번 재색인하는 건 단순 낭비를 넘어 벡터 저장소에 중복을 쌓거나 서로의 결과를 덮어쓰는 위험이 있었다.

실제 로그에도 그대로 찍혔다. 인스턴스 3개가 같은 시각에 같은 job을 집어 동시에 실행에 들어갔다.

```text
# before — 락 없이, 인스턴스 3개가 같은 job(seq=42)을 동시에 획득
2026-06-30 03:00:12 [inst-a:8123] [Scheduler] job='doc-resync' 동기화 시작
2026-06-30 03:00:12 [inst-b:5507] [Scheduler] job='doc-resync' 동기화 시작
2026-06-30 03:00:13 [inst-c:4471] [Scheduler] job='doc-resync' 동기화 시작
2026-06-30 03:04:41 [inst-a:8123] [Scheduler] job='doc-resync' 완료 (문서 1,200건 재색인)
2026-06-30 03:04:55 [inst-c:4471] [Scheduler] job='doc-resync' 완료 (문서 1,200건 재색인)
2026-06-30 03:05:02 [inst-b:5507] [Scheduler] job='doc-resync' 완료 (문서 1,200건 재색인)
```

같은 1,200건을 세 번 재색인했다. 세 실행이 서로의 결과를 겹쳐 쓰면서 색인 상태도 한동안 어긋났다.

제약은 분명했다. 스케줄러 전용 인프라(Quartz 클러스터, 전용 워커, 메시지 큐)를 새로 두지 않는다. 운영 중인 스택에 이미 MySQL이 있으니, 가능하면 그 DB 하나로 끝내고 싶었다.

## 왜 프로세스 안의 락으로는 안 되나

처음엔 "루프 하나에 락 하나 걸면 되지 않나" 싶었다. 그런데 `asyncio.Lock`이든 `threading.Lock`이든 이건 한 프로세스 메모리 안에서만 유효하다. 인스턴스 A의 락과 인스턴스 B의 락은 서로 존재조차 모른다. 각자 "나는 락을 잡았다"고 믿으며 동시에 실행한다.

여러 프로세스가 공유하는 건 결국 DB뿐이다. 그러니 조율 지점도 DB 안에 두는 게 자연스러웠다. 작업 테이블의 행 하나를 락으로 삼고, 그 행을 원자적으로 차지한 인스턴스만 실행하게 하면 된다.

## 설계: 폴링으로 후보를 고르고, UPDATE로 소유권을 건다

구조를 두 단계로 나눴다.

1. 폴링(SELECT) — 30초마다 "실행할 때가 된" 작업 후보를 훑는다. 가벼운 조회다.
2. 락 획득(조건부 UPDATE) — 후보마다 원자적 UPDATE를 날려, 행을 실제로 바꾼 인스턴스 하나만 실행한다.

1단계는 여러 인스턴스에서 같은 후보를 뽑을 수 있는 경합 가능한 단계다. 그래서 여기서 중복을 막으려 하지 않았다. 중복을 실제로 걸러내는 건 오직 2단계의 원자적 UPDATE다. 1단계는 "굳이 UPDATE까지 안 가도 될 것"을 미리 쳐내는 값싼 필터일 뿐이다.

### 폴링 루프

루프는 단순하다. 30초 자고, due 작업을 긁어, 작업마다 태스크를 띄운다.

```python
_POLL_INTERVAL = 30

async def scheduler_loop() -> None:
    while True:
        try:
            await asyncio.sleep(_POLL_INTERVAL)

            async with AsyncSessionLocal() as session:
                repo = SyncSchedulerJobRepository(session)
                due_jobs = await repo.get_due_jobs(get_kst_now())

            for job in due_jobs:
                triggered_by = "manual" if job.force_next_run else "schedule"
                asyncio.create_task(
                    SyncSchedulerService.try_acquire_and_run(job, triggered_by),
                    name=f"scheduler-job-{job.seq}",
                )
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"[SchedulerLoop] 예외 발생: {e}")
            await asyncio.sleep(_POLL_INTERVAL)
```

`get_due_jobs`는 "삭제 안 됐고, 켜져 있거나 수동 트리거됐고, 실행 시각이 지난" 작업을 고른다. 말했듯 이 결과는 인스턴스마다 겹칠 수 있다. 그래서 그냥 후보일 뿐이다.

```python
async def get_due_jobs(self, now):
    result = await self.session.execute(
        select(SyncSchedulerJobEntity).where(
            SyncSchedulerJobEntity.deleted_at.is_(None),
            or_(
                SyncSchedulerJobEntity.is_enabled.is_(True),
                SyncSchedulerJobEntity.force_next_run.is_(True),
            ),
            SyncSchedulerJobEntity.next_run_at <= now,
        )
    )
    return list(result.scalars().all())
```

### 락 획득: 조건부 UPDATE 한 방

핵심은 여기다. 후보를 하나 잡으면, 각 인스턴스는 자기 세션에서 단 하나의 UPDATE를 날린다.

```python
async def try_acquire_lock(self, seq, host_id, now, next_run) -> bool:
    result = await self.session.execute(
        text("""
            UPDATE sync_scheduler_jobs
            SET locked_by       = :hid,
                locked_at       = :now,
                lock_expires_at = DATE_ADD(:now, INTERVAL 30 MINUTE),
                next_run_at     = :next_run
            WHERE seq          = :seq
              AND (is_enabled = true OR force_next_run = true)
              AND deleted_at   IS NULL
              AND (locked_by IS NULL OR lock_expires_at < :now)  -- 비었거나 만료됐을 때만
              AND next_run_at <= :now                            -- 실행할 때가 됐을 때만
        """),
        {"hid": host_id, "now": now, "next_run": next_run, "seq": seq},
    )
    await self.session.commit()
    return result.rowcount == 1
```

UPDATE의 WHERE 평가와 쓰기는 그 행에 대해 원자적이다. 여러 인스턴스가 동시에 이 문장을 던져도, 조건을 만족하는 순간 행을 바꿔 잠그는 건 하나뿐이고, 나머지는 뒤늦게 도착해 `locked_by IS NULL OR lock_expires_at < now` 조건에서 걸러진다. 그래서 실제로 행을 바꾼 인스턴스는 하나뿐이고, 그 인스턴스만 `rowcount == 1`을 받는다. 나머지는 `0`이라 조용히 물러난다.

```python
@staticmethod
async def try_acquire_and_run(job, triggered_by: str) -> bool:
    now = get_kst_now()
    next_run = _calc_next_run(job.cron_expression, now)

    async with AsyncSessionLocal() as session:
        repo = SyncSchedulerJobRepository(session)
        acquired = await repo.try_acquire_lock(job.seq, HOST_ID, now, next_run)

    if not acquired:
        logger.debug(f"[Scheduler] job={job.name} 락 획득 실패 (다른 서버가 실행 중이거나 아직 실행 시각 아님)")
        return False

    logger.info(f"[Scheduler] job='{job.name}' 락 획득 성공, 동기화 시작")
    await SyncSchedulerService._execute_sync(job, triggered_by)
    return True
```

락을 넣은 뒤 같은 시각의 로그는 이렇게 바뀌었다. 세 인스턴스가 동시에 UPDATE를 던져도 행을 바꾼 건 하나뿐이라, 하나만 실행하고 둘은 skip한다.

```text
# after — 조건부 UPDATE로 job(seq=42)을 inst-b 하나만 획득
2026-07-05 03:00:11 [inst-a:8123] [Scheduler] job=doc-resync 락 획득 실패 (다른 서버가 실행 중이거나 아직 실행 시각 아님)
2026-07-05 03:00:11 [inst-b:5507] [Scheduler] job='doc-resync' 락 획득 성공, 동기화 시작
2026-07-05 03:00:11 [inst-c:4471] [Scheduler] job=doc-resync 락 획득 실패 (다른 서버가 실행 중이거나 아직 실행 시각 아님)
2026-07-05 03:04:38 [inst-b:5507] [Scheduler] job='doc-resync' 완료 (문서 1,200건 재색인)
```

1,200건을 한 번만 재색인한다. `rowcount`로 본 획득 결과가 곧 실행 권한이었다.

여기서 `rowcount`를 소유권 증거로 쓰는 게 이 설계의 전부다. "SELECT로 비었는지 보고 → 비었으면 UPDATE"처럼 두 문장으로 나눴다면 그 사이에 다른 인스턴스가 끼어드는 check-then-act 경합이 생긴다. 조회와 잠금을 한 UPDATE의 WHERE로 합쳐 그 틈을 없앴다.

## `next_run_at`을 획득 시점에 미리 당겨두는 이유

한 가지 눈여겨볼 점은, 락을 잡는 그 UPDATE에서 `next_run_at`을 다음 예정 시각으로 함께 갱신한다는 것이다. 작업이 끝난 뒤가 아니라 시작하는 순간 다음 실행 시각을 밀어버린다.

이유는 폴링 주기와 작업 시간의 관계다. 폴링은 30초마다 도는데, 재동기화는 그보다 오래 걸릴 수 있다. 만약 다음 실행 시각을 작업 완료 후에 갱신한다면, 작업이 도는 동안에도 `next_run_at`은 여전히 과거라 같은 인스턴스의 다음 폴링이 이 작업을 또 due로 집어 두 번째 태스크를 띄운다. `lock_expires_at`이 아직 안 지났으니 UPDATE 자체는 막히겠지만, 매 폴링마다 헛된 획득 시도가 쌓인다. 획득 시점에 `next_run_at`을 미리 당겨두면 애초에 후보 목록에서 빠져 이 낭비가 사라진다.

트레이드오프도 있다. 실행이 실패해도 `next_run_at`은 이미 다음 주기로 넘어가 있어서, 실패분을 즉시 재시도하지 않고 다음 주기를 기다린다. 재동기화는 다음 주기에 어차피 최신 원본을 다시 읽으므로 이 편이 오히려 깔끔하다고 판단했다. 즉시 재시도가 중요한 작업이라면 이 선택은 달라진다.

## 안전장치와 뒷정리

- 임대 만료(lease, 30분) — `lock_expires_at = now + 30분`. 락을 쥔 인스턴스가 죽어도 30분이 지나면 다른 인스턴스가 `lock_expires_at < now` 조건으로 다시 잡는다. 데드락 방지의 핵심이다. 명시적 해제(unlock)가 유실돼도 시스템이 스스로 회복한다.
- `host_id`로 소유 추적 — `HOST_ID = f"{socket.gethostname()}:{os.getpid()}"`. 어느 호스트·프로세스가 잡았는지 `locked_by`에 남겨 로그로 추적한다. 같은 호스트에 프로세스가 여럿이어도 구분된다.
- 실행 후 정리 — 끝나면 `update_after_run`이 결과(성공/부분 실패/실패)와 메시지를 기록하고 `locked_by = None`, `force_next_run = False`로 되돌려 락을 푼다. 정상 경로에선 lease 만료를 기다릴 필요가 없다.
- 수동 트리거 — 운영 중 즉시 실행이 필요하면 `next_run_at = now`, `force_next_run = True`로 세워 다음 폴링에서 바로 due가 되게 했다. 트리거 경로도 똑같이 조건부 UPDATE 락을 거치므로 중복 걱정이 없다.

## 부딪힌 엣지 케이스

fire-and-forget 태스크의 예외. 루프는 `asyncio.create_task`로 작업을 던지고 결과를 기다리지 않는다. 이러면 태스크 안에서 터진 예외는 아무도 안 보고 조용히 사라진다. 그래서 실행 본체(`_execute_sync`)의 로그 생성·최종 갱신을 각각 `try/except`로 감싸, 실패해도 그 사실이 로그에 남도록 했다.

```python
except Exception as e:
    # 최종 갱신이 실패하면 로그가 RUNNING인 채로 영영 멈춘 것처럼 보이므로 실제 결과를 남긴다.
    logger.error(f"[Scheduler] 최종 로그 갱신 실패 (log_seq={log_seq}): {e}. 실제 결과: {summary}")
```

부분 실패. 한 작업이 문서 여러 개를 도는데, 하나가 실패했다고 전부 실패로 몰면 안 됐다. 문서마다 세션을 따로 열어 독립적으로 커밋하고(→ [SQLAlchemy async 세션 수명](https://rlckdwkd55.github.io/posts/sqlalchemy-async/) 참고), 결과를 `SUCCESS` / `PARTIAL_FAIL` / `FAIL`로 나눠 기록했다. 하나가 죽어도 나머지는 색인된다.

lease 시간과 작업 시간의 관계. 만약 재동기화가 30분을 넘기면, lease가 먼저 만료돼 다른 인스턴스가 같은 작업을 다시 잡을 수 있다. 중복 실행이 되살아나는 것이다. 현재 작업량 기준으론 30분이 넉넉하지만, 문서 수가 크게 늘면 lease를 늘리거나 진행 중 갱신(heartbeat)을 넣어야 한다는 걸 한계로 적어뒀다.

## 왜 Redis나 Quartz를 안 썼나

Redis 락(SETNX + TTL)이나 Quartz 클러스터도 후보였다. 하지만 이미 있는 DB로 충분했다. 작업 빈도가 낮고(분·시간 단위), 조건부 UPDATE 한 문장으로 원자성이 보장되니 새 미들웨어를 들일 이유가 없었다. 새 인프라는 그 자체로 운영·장애·모니터링 부담을 얹는다. 문제 규모에 맞는 도구를 고른 셈이다.

물론 이 선택엔 조건이 붙는다. 초당 수백 번 다투는 고빈도 락이라면 DB 행 경합이 병목이 될 수 있고, 그땐 Redis가 맞다. 지금은 아니라는 판단이었을 뿐이다.

## 돌아보며

- 멀티 인스턴스 스케줄러의 중복 실행은 프로세스 락으로는 못 막는다. 공유 지점인 DB에 조율을 둬야 한다.
- 값싼 폴링 SELECT로 후보를 고르고, 실제 중복 차단은 조건부 UPDATE + `rowcount == 1` 한 지점으로 몰았다. 조회와 잠금을 한 문장에 합쳐 check-then-act 경합을 없앤 게 핵심이었다.
- 획득 시점에 `next_run_at`을 당겨 긴 작업의 재선택 낭비를 막고, 30분 lease로 죽은 인스턴스의 락을 자동 회수했다.
- fire-and-forget 예외, 부분 실패, lease와 작업 시간의 관계까지 다뤄야 운영에서 문제가 없었다.
- 규모에 맞으면 기존 DB 하나로 충분했다. 인프라를 늘리는 건 그다음 문제다.

참고 : https://dev.mysql.com/doc/refman/8.0/en/update.html
