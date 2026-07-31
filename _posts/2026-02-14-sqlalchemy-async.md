---
title: "SQLAlchemy 2.0 비동기(AsyncSession) 정리"
date: 2026-02-14
categories: [Backend, Database]
tags: [sqlalchemy, async, orm]
description: "AsyncSession으로 DB I/O를 await 가능하게 만들고, async에서 lazy loading이 터지는 이유와 eager 전략, 그 밑을 받치는 greenlet 구조까지 정리한다."
image:
  path: /assets/img/thumbnails/sqlalchemy-async.png
published: false
---

ASGI 서버는 `async def` 라우터를 쓰면서도 그 안의 DB 접근이 `session.query(...)`
같은 동기 호출로 남아 있는 경우가 흔하다. 동작은 하지만 동시 요청이 몰리면 응답이
밀린다. 비동기 서버 위에서 DB I/O만 동기로 남아 이벤트 루프를 붙잡기 때문이다.
SQLAlchemy 2.0의 `AsyncSession`은 이 DB 왕복을 `await` 가능한 지점으로 바꾸는데,
async 엔진 구성, 2.0 select() 스타일, lazy loading 함정과 그 밑의 greenlet 순으로
짚는다.

<!-- 이미지: 구글 검색 "SQLAlchemy 비동기 세션 구조" · 저장 /assets/img/posts/backend/sqlalchemy/async-arch.png -->

## 왜 비동기 ORM인가

ASGI 서버(uvicorn + FastAPI 등)는 하나의 스레드에서 이벤트 루프를 돌리며 동시
요청을 처리한다. 요청 A가 DB 응답을 기다리는 동안 그 대기 시간을 요청 B에
양보하는 식이고, 이 양보는 `await` 지점에서만 일어난다. 그 안의 DB 접근이
동기(blocking)라면, `psycopg2` 같은 드라이버로 쿼리를 던지는 순간 응답이 올 때까지
이벤트 루프 자체가 멈춘다. 양보 지점이 없으니 그 사이 다른 요청은 손도 못 댄다.

그래서 DB 왕복도 `await`로 양보 가능한 지점으로 만들어야 한다. SQLAlchemy 2.0은
`asyncio` 기반 엔진·세션을 정식으로 지원한다. 다만 async가 빛나는 건 I/O 대기가
지배적인 전형적 API 서버이고, CPU 바운드가 대부분인 서비스에서는 이점이 크지 않다.

## async 엔진과 AsyncSession

async를 지원하는 드라이버가 먼저 필요하다. PostgreSQL은 `asyncpg`, MySQL은
`aiomysql`/`asyncmy` 등이며, URL의 `+asyncpg` 부분으로 지정한다.

```python
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
)

engine = create_async_engine(
    "postgresql+asyncpg://user:pw@db-host:5432/appdb",
    pool_size=10,        # 풀에 상시 유지할 커넥션 수
    max_overflow=20,     # 순간적으로 더 열 수 있는 여유분
    pool_pre_ping=True,  # 죽은 커넥션 감지 후 재연결
)

# 세션 팩토리. 요청마다 이 팩토리로 세션을 하나씩 찍어 낸다.
SessionFactory = async_sessionmaker(engine, expire_on_commit=False)
```

`expire_on_commit=False`가 핵심이다. SQLAlchemy는 기본적으로 `commit()` 직후
세션이 들고 있던 모든 객체의 속성을 만료(expire)시킨다. 동기 코드라면 만료된
속성에 다시 접근할 때 자동으로 SELECT가 나가 값을 채우지만, async에서는 그 자동
SELECT가 `await` 없이는 못 나가므로 예외가 된다. `commit()` 후 응답을 직렬화하며
`user.name`만 읽어도 터지는 것이다. 그래서 async에서는 이 설정이 사실상 관례다.

## 2.0 스타일 쿼리 — select()와 scalars()

레거시의 `session.query(User)`는 2.0에서 완전히 `select()` 기반으로 대체됐다.
동기·비동기가 똑같은 `select()` 문법을 공유하고 실행만 `await`로 감싸는 구조라
오히려 일관적이다.

```python
from sqlalchemy import select

async def get_active_users(session: AsyncSession) -> list[User]:
    stmt = select(User).where(User.is_active.is_(True)).order_by(User.id)
    result = await session.execute(stmt)   # DB 왕복 → await
    return result.scalars().all()          # ORM 엔티티만 뽑아 리스트로
```

`execute()`가 돌려주는 `Result`는 기본적으로 `(User,)` 같은 행(튜플) 단위다. ORM
엔티티 하나만 원할 땐 `scalars()`로 첫 컬럼만 벗겨 낸다. 자주 쓰는 조합은 아래와
같다.

| 원하는 것 | 호출 |
|---|---|
| 여러 행(엔티티) | `(await session.execute(stmt)).scalars().all()` |
| 여러 행 축약형 | `(await session.scalars(stmt)).all()` |
| 단일 행(없으면 None) | `(await session.execute(stmt)).scalar_one_or_none()` |
| 단일 행(없거나 둘이면 예외) | `(await session.execute(stmt)).scalar_one()` |
| PK 직접 조회 | `await session.get(User, uid)` |

쓰기는 `session.add(obj)` 후 `await session.commit()`, 트랜잭션 경계를 명시하려면
`async with session.begin():` 블록으로 감싸면 커밋/롤백이 자동으로 처리된다.

## lazy loading 함정

async ORM의 진짜 관문은 여기다. 관계(relationship)를 나중에 자동으로 채우는
lazy loading은 async에서 그대로 쓰면 터진다.

```python
class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    posts: Mapped[list["Post"]] = relationship(back_populates="author")

# 라우터 어딘가
user = await session.get(User, 1)
for p in user.posts:          # ← 여기서 예외!
    print(p.title)
```

`user.posts`는 `get()` 시점엔 로드되지 않았고, 접근하는 순간 숨은 SELECT를
시도한다. 암묵적 동기 I/O다. async 세션에는 이 지점에 `await`가 없으니 SQLAlchemy가
예외를 던진다.

```
sqlalchemy.exc.MissingGreenlet:
  greenlet_spawn has not been called; can't call await_only() here.
```

메시지의 `greenlet`이 뒤에서 설명할 그 greenlet이다. 요지는 비동기 컨텍스트 밖에서
DB를 두드리려 했다는 것. 이 예외는 로컬에선 조용히 넘어가고 운영에서 특정 코드
경로로만 터지기도 한다. 그래서 관계 속성에 아예 지뢰를 심어 두는 방법이 있다.

```python
posts: Mapped[list["Post"]] = relationship(lazy="raise")
```

`lazy="raise"`를 걸면 lazy loading을 시도하는 순간(동기든 async든) 무조건 예외가
난다. 실수로 지연 로딩되는 경로를 개발 단계에서 강제로 드러내 주는 장치다.

## eager loading 전략

해법은 "필요한 관계는 처음 쿼리할 때 명시적으로 함께 로드한다"는 것이다. 대표
로더 두 가지를 상황에 맞게 쓴다.

```python
from sqlalchemy.orm import selectinload, joinedload

# 1) selectinload — 컬렉션(1:N)에 기본으로 권장
stmt = select(User).options(selectinload(User.posts))
# → users를 먼저 SELECT, 그 id들로 posts를 IN(...) 으로 한 번 더 SELECT (쿼리 2번)

# 2) joinedload — 다대일(N:1) / 단건 관계에 적합
stmt = select(Post).options(joinedload(Post.author))
# → LEFT OUTER JOIN 한 방으로 author까지 (쿼리 1번)
```

| | selectinload | joinedload |
|---|---|---|
| 방식 | 별도 `IN` 쿼리 추가 | JOIN으로 한 번에 |
| 쿼리 수 | 2번 | 1번 |
| 잘 맞는 관계 | 1:N 컬렉션 | N:1 단건 |
| 컬렉션에서 위험 | 없음 | 행 폭증(카테시안), 페이징 깨짐 |

컬렉션에 `joinedload`를 쓰면 부모 행이 자식 수만큼 곱해져 나오는 데다 `LIMIT`
기반 페이징이 어긋난다. 그래서 컬렉션은 `selectinload`, 단건 관계는 `joinedload`가
기본 감각이다. 항상 함께 로드하고 싶으면 relationship에 `lazy="selectin"`을 걸어
기본 전략으로 둘 수도 있다.

## 그 밑의 greenlet

SQLAlchemy의 ORM 코어는 오랜 세월 동기 코드로 쌓아 올린 방대한 로직이다. 이걸
통째로 async/await로 다시 쓰는 건 비현실적이라, 2.0의 async는 코어를 재작성하는
대신 greenlet으로 동기 코드와 async를 잇는다.

greenlet은 스택을 통째로 저장·전환할 수 있는 경량 코루틴이다. `AsyncSession`이
쿼리를 실행하면 내부의 동기 ORM 로직을 greenlet 안에서 돌린다. 그 로직이 실제
네트워크 I/O(DBAPI 호출)에 다다르면 greenlet은 그 지점에서 멈추고 제어권을 바깥
async 세계로 넘긴다(`await_only`). 바깥에서 진짜 `await`로 asyncpg의 I/O를 처리한
뒤, 결과를 들고 다시 greenlet 안으로 돌아와 동기 로직을 이어 간다.

```
[async 라우터]  await session.execute(stmt)
      │
      ▼  greenlet_spawn — 동기 ORM 로직을 greenlet에서 실행
[동기 ORM 코어]  ... 쿼리 컴파일 ...
      │  DBAPI I/O 지점
      ▼  await_only — 여기서 바깥으로 제어권 양보
[async 드라이버]  await (asyncpg가 실제 네트워크 I/O)
      ▲  결과 들고 greenlet으로 복귀
[동기 ORM 코어]  ... 결과 매핑 ...
```

이 구조를 알면 `MissingGreenlet` 예외가 명확해진다. lazy loading은 `greenlet_spawn`
으로 시작된 컨텍스트 바깥에서 갑자기 DB I/O를 하려 든다. 제어권을 넘길 greenlet
자체가 없으니 "greenlet_spawn has not been called"이라 정확히 짚는 것이고, 에러
메시지가 곧 구조 설명인 셈이다.

## 세션 수명과 커넥션 풀

운영에서 자주 사고 나는 부분은 세션을 어느 범위로 쓸 것인가다. 원칙은 요청 하나당
세션 하나다. FastAPI라면 의존성으로 주입해 요청이 끝날 때 확실히 닫는다.

```python
from collections.abc import AsyncGenerator

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionFactory() as session:   # 끝나면 자동 close → 커넥션 반납
        yield session

@app.get("/users/{uid}")
async def read_user(uid: int, session: AsyncSession = Depends(get_session)):
    user = await session.get(User, uid)
    ...
```

두 가지를 특히 조심한다.

- **세션을 동시에 공유하지 말 것** — `AsyncSession`은 동시 사용에 안전하지 않다.
  하나의 세션을 여러 코루틴에서 `asyncio.gather`로 동시에 두드리면
  `InvalidRequestError`가 난다. 병렬 쿼리는 태스크마다 별도 세션을 열어야 한다.
- **세션을 전역/장수명으로 두지 말 것** — 세션은 열려 있는 동안 풀의 커넥션을
  붙잡는다. 요청 밖까지 살아 있으면 그만큼 커넥션이 새어 결국 풀이 마른다.

풀 크기(`pool_size + max_overflow`)는 DB가 감당할 최대 동시 커넥션을 넘지 않게
잡는다. async라 요청이 폭발적으로 몰릴 수 있어 오히려 DB 쪽 `max_connections`가
병목이 되기 쉽다. 애플리케이션 인스턴스 수 × 풀 상한이 DB 한도 안에 들어오는지
계산해 두는 게 안전하다.

이 async 데이터 계층은 [FastAPI](https://rlckdwkd55.github.io/posts/fastapi/) 위에
얹힌다. 요청/응답 스키마를 담당하는
[Pydantic](https://rlckdwkd55.github.io/posts/pydantic/), 스키마 변경 이력을 코드로
관리하는 [Alembic](https://rlckdwkd55.github.io/posts/alembic/)까지 더하면
FastAPI + async 스택의 데이터 계층 뼈대가 대략 갖춰진다.

`AsyncSession`은 ASGI 서버의 동시성을 DB I/O까지 확장하는 도구다. async 드라이버와
`await session.execute(select(...))`, `expire_on_commit=False`가 기본 셋업이고,
관계는 `selectinload`(컬렉션)/`joinedload`(단건)로 eager 로드하며 `lazy="raise"`로
실수 경로를 드러낸다. 그 밑은 greenlet이 동기 ORM 코어와 async I/O를 잇고, 세션은
요청당 하나로 공유·장수명을 피한다.

<br><br>
참고 : https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html
