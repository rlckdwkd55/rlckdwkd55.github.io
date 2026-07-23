---
title: "Qdrant 포인트 ID 파싱을 공용 유틸로 통합하기"
date: 2026-04-20
categories: [Backend]
tags: [refactoring, dry, qdrant]
description: "두 파일에 똑같이 복제돼 있던 Qdrant 포인트 ID 파싱 로직을, 예외 처리를 보강해 공용 유틸 한 곳으로 합친 기록."
image:
  path: /assets/img/thumbnails/point-id-util.png
published: false
---

## 문제: 같은 파싱 코드가 두 곳에 복제돼 있었다

문서 청크를 수정하는 기능을 손보다가 같은 코드 조각을 두 번 마주쳤다. 하나는
청크 수정을 실제로 실행하는 인프라 계층(`infra/vector_database.py`)에,
다른 하나는 그 위에서 흐름을 조율하는 도메인 서비스(`document/service.py`)에 있었다.
두 조각은 사실상 같은 코드였다.

```python
# vector_database.py 와 service.py 에 각각 복제돼 있던 코드
import uuid
try:
    pid = uuid.UUID(point_id)
except (ValueError, AttributeError):
    pid = int(point_id)
```

왜 이 변환이 필요한지부터 짚어야 한다. 우리가 벡터 DB로 쓰는 [Qdrant](https://rlckdwkd55.github.io/posts/qdrant/)는
포인트(point)를 식별할 때 아무 문자열이나 받지 않는다. 포인트 ID로 허용되는 타입은
UUID 아니면 부호 없는 정수(unsigned int) 두 가지뿐이다. 그런데 이 ID가 시스템 안에서
돌아다닐 때는 대부분 문자열이다. API 요청 파라미터로 들어올 때도, 다른 포인트를
`retrieve`로 조회해 그 결과에서 꺼낼 때도 문자열이다. 그래서 Qdrant 클라이언트에
`ids=[...]`로 넘기기 직전에, 이 문자열을 원래 타입(UUID/int)으로 되돌리는 파싱이
한 번 들어가야 한다.

문제는 그 파싱이 필요한 곳에서 그때그때 인라인으로 작성됐다는 점이다. 그러다 보니
도메인 계층과 인프라 계층 두 곳에 똑같은 로직이 각자 자라 있었다.

## 중복이 위험한 이유

중복 자체보다, 중복이 갈라질 수 있다는 게 문제다.

- 파싱 규칙을 한쪽에서만 고치면(예: 새 ID 형식을 허용) 다른 쪽은 옛 규칙 그대로
  남는다. 그 순간부터 같은 point_id가 계층마다 다르게 해석될 수 있다.
- 위 코드에는 결함도 하나 있었다. UUID도 int도 아닌 값이 들어오면 `int(point_id)`가
  `ValueError`를 그대로 위로 던진다. 부르는 쪽은 그런 예외를 예상하지 못했으니,
  잘못된 ID 하나가 500 에러로 번질 수 있었다.
- `except (ValueError, AttributeError)`는 `TypeError`(예: `point_id`가 `None`)
  같은 경우를 놓친다.

복제된 데다 양쪽 다 예외 처리가 어설픈 상태였다.

## 필요했던 것

정리하면 세 가지였다.

1. **단일 출처** — point_id를 Qdrant 타입으로 바꾸는 규칙은 한 군데에만 있어야 한다.
2. **결정성** — 같은 문자열은 언제나 같은 타입·같은 값으로 변환돼야 한다. 계층에 따라
   결과가 달라지면 안 된다.
3. **명확한 실패** — 변환 불가능한 값은 애매하게 넘어가지 말고, 부르는 쪽이 잡아서
   처리할 수 있는 하나의 예외로 실패해야 한다.

## 해결: parse_point_id 공용 유틸

파싱을 `app/utils/point_id.py` 한 곳으로 뽑아냈다. 인라인 조각을 그냥 옮기기만 한 게
아니라, 위 요구에 맞춰 예외 처리를 다시 짰다.

```python
# app/utils/point_id.py
import uuid


def parse_point_id(point_id: str) -> uuid.UUID | int:
    """Qdrant point_id 문자열을 UUID 또는 int로 변환한다.
    둘 다 아니면 ValueError를 던진다 (document/service.py, infra/vector_database.py 공용)."""
    try:
        return uuid.UUID(point_id)
    except (ValueError, AttributeError, TypeError):
        pass
    try:
        return int(point_id)
    except (ValueError, TypeError):
        raise ValueError(f"유효하지 않은 point_id: {point_id!r}")
```

호출부는 양쪽 다 인라인 로직을 지우고 한 줄로 바꿨다.

```python
# before: 두 파일이 각자 uuid/int 파싱을 인라인으로 수행
# after:
from app.utils.point_id import parse_point_id
pid = parse_point_id(point_id)
```

도메인 서비스 쪽은 여기에 더해, 던져진 `ValueError`를 도메인 예외로 감쌌다. 잘못된
ID는 이제 500이 아니라 "그런 문서 없음"으로 귀결된다.

```python
# service.py — update_document_chunk
try:
    pid = parse_point_id(point_id)
except ValueError:
    raise CommonException(ErrorCode.DOCUMENT_NOT_FOUND)
```

## UUID를 먼저 시도하고 int로 넘어가는 순서

구현에서 판단이 필요했던 지점은 두 가지였다.

**순서.** UUID를 먼저 시도하고 실패하면 int로 넘어간다. 이 순서가 안전한 이유는 두
형식이 겹치지 않기 때문이다. `"3f2a...-...."` 같은 하이픈 섞인 UUID 문자열은 `int()`로
파싱되지 않고, `"12345"` 같은 순수 숫자열은 `uuid.UUID()`가 거부한다. 그래서 순서를
어떻게 두든 같은 입력은 같은 결과가 된다 — 요구했던 결정성이 여기서 나온다. UUID를
먼저 두는 건 실제 우리 포인트 ID가 대부분 UUID라 흔한 경우를 먼저 처리한다는 의미다.

**EAFP.** 정규식으로 "UUID처럼 생겼나"를 미리 검사하는 대신, `try/except`로 일단
변환을 시도하고 실패를 잡는 방식을 택했다. UUID 유효성의 판단 기준은 결국
`uuid.UUID()` 자체다. 별도 정규식을 두면 그 정규식과 표준 라이브러리의 판단이 미묘하게
어긋날 여지가 생긴다. 판단 기준을 표준 라이브러리 한 곳에 위임하는 편이 버그가 적다.

트레이드오프도 있다. 이 유틸은 문자열로 들어온 ID의 타입을 복원하는 좁은 책임만 진다.
point_id를 애초에 생성하는 일은 하지 않는다. 그건 별개 관심사라 한 함수에 욱여넣지
않았다. 또 예외를 전부 `ValueError` 하나로 수렴시키기 때문에, 호출부는 왜 실패했는지까지는
알 수 없다. 대신 "성공하면 UUID 아니면 int, 실패하면 ValueError"라는 단순한 계약을
얻는다. 이 경로에서는 원인 구분보다 그 단순함이 더 필요했다.

## 통합으로 얻은 것

열네 줄짜리 함수다. 아키텍처를 바꾼 것도 아니다. 그래도 얻은 건 분명했다.

- **규칙이 한 곳에 산다.** point_id 해석 방식이 바뀌어도 고칠 곳은 한 군데뿐이고,
  계층 간에 해석이 갈라질 여지가 사라졌다.
- **실패가 예측 가능해졌다.** "성공 시 UUID/int, 실패 시 ValueError"라는 계약이
  생기니 부르는 쪽이 방어 코드를 짜기 쉬워졌다. 잘못된 ID가 흐름을 죽이던 결함도
  이 과정에서 같이 잡혔다.
- **의도가 코드에 드러난다.** `parse_point_id(point_id)` 한 줄이 "여기서 ID를 Qdrant
  타입으로 되돌린다"를 설명한다. 인라인 `try/except` 뭉치보다 읽기 낫다.

[삭제·재생성 순서 하나에 데이터가 걸린](https://rlckdwkd55.github.io/posts/reembedding-order/)
경로에서는, 타입을 정확히 맞추는 이런 작은 유틸도 정합성의 일부였다. 중복을 없앤
것보다 규칙을 한 곳에서 책임지게 만든 게 이 작업의 핵심이었다.
