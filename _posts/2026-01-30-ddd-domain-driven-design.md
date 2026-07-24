---
title: "DDD(도메인 주도 설계) 정리"
date: 2026-01-30
categories: [Backend]
tags: [ddd, architecture, domain-driven-design]
description: "전략적 설계(유비쿼터스 언어·바운디드 컨텍스트)와 전술적 설계(엔티티·값 객체·애그리거트·리포지토리)를 FastAPI 도메인 레이어 코드와 함께 정리한다."
image:
  path: /assets/img/thumbnails/ddd.png
published: false
---

DDD(Domain-Driven Design, 도메인 주도 설계)는 소프트웨어를 비즈니스 도메인 중심으로
설계하자는 접근이다. 여기서 도메인이란 "이 소프트웨어가 해결하려는 문제 영역"으로,
쇼핑몰이면 주문·결제·배송, 챗봇 백엔드라면 대화 세션·문서·검색 같은 것들이다.

규모가 큰 업무 소프트웨어일수록 진짜 복잡한 건 기술이 아니라 업무 규칙인데, 많은 코드가
그 규칙을 DB 테이블이나 프레임워크 관점으로 번역해 버려 정작 도메인 지식이 코드 어디에도
남지 않는다. 데이터만 들고 행위는 없는 **빈약한 도메인 모델(Anemic Domain Model)** 이
대표적인 증상이다. DDD는 그 반대로 도메인 개념과 규칙을 코드의 1급 시민으로 끌어올린다.

에반스(Eric Evans)는 이 접근을 두 층위로 나눈다. **전략적 설계**는 언어와 경계라는 큰
그림을, **전술적 설계**는 그 경계 안에서 코드를 조립하는 방법을 다룬다. 흔히 DDD를
엔티티·값 객체 같은 패턴으로만 아는데, 그건 전술적 설계 절반에 불과하다.

## 전략적 설계 — 유비쿼터스 언어

전략적 설계의 출발점은 **유비쿼터스 언어(Ubiquitous Language)** 다. 기획자, 도메인 전문가,
개발자가 하나의 같은 용어 체계를 쓰고, 그 용어가 회의·문서·코드에서 동일하게 쓰이도록
하는 것이다. 회의에서는 "회원"이라 부르는데 코드에는 `UserAccount`, DB에는 `tb_customer`,
프런트에는 `member`로 흩어져 있으면 대화할 때마다 머릿속에서 번역이 일어나고, 그 비용이
곧 버그와 오해의 온상이 된다. 단순한 네이밍 규칙이 아니라는 점이 중요하다. "발주와 주문이
같은 건가요?"를 묻고 합의하는 과정 자체가 모호했던 업무 규칙을 드러낸다.

## 전략적 설계 — 바운디드 컨텍스트와 컨텍스트 맵

유비쿼터스 언어를 지키다 보면 같은 단어가 맥락에 따라 다른 뜻을 가진다는 한계에 부딪힌다.
"상품"이 판매 맥락에서는 가격·재고이지만 배송 맥락에서는 부피·무게다. 이걸 하나의 거대한
`Product` 클래스로 합치는 순간 모델이 누더기가 된다.

그래서 나온 개념이 **바운디드 컨텍스트(Bounded Context)** 다. 하나의 모델과 용어가 일관되게
통하는 경계를 명시적으로 긋고 그 안에서만 유비쿼터스 언어를 유지하며, 경계 밖에서는 같은
단어라도 다른 모델일 수 있음을 인정한다. 완벽한 전사 모델을 만들려는 욕심을 버리고 작지만
일관된 여러 모델로 나누는 것이다. 컨텍스트가 여러 개가 되면 그 사이의 관계를 정리해야
하는데, 그게 **컨텍스트 맵(Context Map)** 이고 통합에는 몇 가지 전형적인 패턴이 있다.

| 패턴 | 의미 |
| --- | --- |
| Shared Kernel | 두 컨텍스트가 일부 모델을 공유(강한 결합, 신중히) |
| Customer/Supplier | 하류(고객)의 요구를 상류(공급자)가 반영해 주는 관계 |
| Conformist | 하류가 상류 모델을 그대로 따름 |
| Anti-Corruption Layer | 외부 모델을 내 모델로 번역하는 방어막을 둠 |
| Open Host Service | 공개 API/프로토콜로 다수 소비자에게 통합점 제공 |

특히 유용한 건 **부패 방지 계층(Anti-Corruption Layer)** 이다. 외부 레거시나 서드파티 API의
지저분한 모델이 내 도메인으로 스며들지 않도록 경계에서 내 언어로 번역하는 어댑터를 둔다.
뒤에 나올 헥사고날 아키텍처의 어댑터로 곧바로 이어지는 개념이다.

## 전술적 설계 — 빌딩 블록

경계 안에서 실제 코드를 조립할 때 쓰이는 패턴들이 흔히 "DDD"라 불리는 것들이다.

- **엔티티(Entity)** — 고유 식별자로 구분되고, 속성이 바뀌어도 같은 것으로 취급되는 객체.
  배송지가 바뀌어도 "그 회원"은 동일하다. 동등성 기준은 식별자.
- **값 객체(Value Object)** — 식별자 없이 값 그 자체로 동등성을 판단하는 불변 객체. 금액,
  좌표, 기간, 주소 등. 불변이라 공유·재사용이 안전하다.
- **애그리거트(Aggregate)** — 함께 변경되고 함께 일관성을 지켜야 하는 묶음. 외부는
  **애그리거트 루트**를 통해서만 내부에 접근한다.
- **리포지토리(Repository)** — 애그리거트 루트 단위로 저장·조회하는 추상. 도메인이 DB
  세부에 의존하지 않게 한다.
- **도메인 서비스(Domain Service)** — 특정 엔티티 하나에 넣기 애매한, 여러 객체에 걸친
  도메인 로직을 담는다.
- **도메인 이벤트(Domain Event)** — "무언가 일어났다"는 사실을 표현하는 객체. 컨텍스트 간
  결합을 느슨하게 하는 데 쓴다.

이 중 핵심은 애그리거트다. 존재 이유는 **불변식(invariant)** 을 지키는 데 있다. "주문 총액은
항상 항목 합계와 같아야 한다"는 규칙은 주문과 항목을 아무 데서나 따로 수정할 수 있으면
깨지므로, 항목은 반드시 루트(주문)를 거쳐서만 변경하게 만든다. 여기에 자주 놓치는 규칙
두 가지가 붙는다.

1. **애그리거트는 트랜잭션 경계다.** 한 트랜잭션에서는 하나의 애그리거트만 변경하는 것을
   원칙으로 한다. 여러 애그리거트를 동시에 강하게 일관시키려 하면 경계가 무너진다.
2. **다른 애그리거트는 객체가 아니라 ID로 참조한다.** `Order`가 `Member`를 통째로 들지 않고
   `member_id`만 갖는다. 경계를 작게 유지하고 로딩 폭발을 막는다.

## 코드로 본 도메인 레이어

FastAPI 프로젝트의 도메인 레이어를 최소 예시로 정리한다. 프레임워크 색이 없는 순수 도메인
코드부터 시작한다. 먼저 **값 객체** — 불변이 핵심이라 `frozen=True`로 잠근다.

```python
# app/domain/order/entity.py  (도메인 계층: 프레임워크 의존 X)
from dataclasses import dataclass, field
from enum import Enum

@dataclass(frozen=True)
class Money:
    amount: int
    currency: str = "KRW"

    def __post_init__(self):
        if self.amount < 0:
            raise ValueError("금액은 음수가 될 수 없다")

    def add(self, other: "Money") -> "Money":
        if self.currency != other.currency:
            raise ValueError("통화가 다르면 더할 수 없다")
        return Money(self.amount + other.amount, self.currency)
```

값 객체가 스스로 "음수 금액 금지", "통화 불일치 금지" 규칙을 들고 있다. 검증이 도메인 안에
있다. 다음은 **엔티티**와 **애그리거트 루트**. `OrderItem`은 루트인 `Order`를 통해서만
다뤄지고, 불변식은 루트가 지킨다.

```python
class OrderStatus(str, Enum):
    DRAFT = "DRAFT"
    PLACED = "PLACED"
    CANCELLED = "CANCELLED"

@dataclass
class OrderItem:              # 애그리거트 내부 엔티티
    product_id: int
    quantity: int
    unit_price: Money

@dataclass
class Order:                  # 애그리거트 루트
    id: int | None
    member_id: int            # 다른 애그리거트는 ID로만 참조
    status: OrderStatus = OrderStatus.DRAFT
    items: list[OrderItem] = field(default_factory=list)

    def add_item(self, item: OrderItem) -> None:
        if self.status != OrderStatus.DRAFT:
            raise ValueError("확정된 주문은 항목을 바꿀 수 없다")
        self.items.append(item)

    def place(self) -> None:
        if not self.items:
            raise ValueError("빈 주문은 확정할 수 없다")
        self.status = OrderStatus.PLACED
```

`add_item`, `place` 같은 행위가 규칙과 함께 엔티티 안에 있다. 이게 빈약한 모델과의 결정적
차이다. "빈 주문 확정 금지" 규칙이 서비스 여기저기 흩어지지 않고 한곳에 모인다.

**리포지토리**는 도메인 계층에 인터페이스(추상)만 둔다. 도메인이 DB를 모르게 하기 위해서다.

```python
# app/domain/order/repository.py  (인터페이스는 도메인 소유)
from abc import ABC, abstractmethod

class OrderRepository(ABC):
    @abstractmethod
    async def get(self, order_id: int) -> Order | None: ...

    @abstractmethod
    async def save(self, order: Order) -> Order: ...
```

구현체는 **인프라 계층**에 둔다. 여기서 비로소 SQLAlchemy 같은 기술이 등장하고, 도메인
객체와 ORM 모델을 서로 매핑하는 것도 이 계층의 책임이다(영속성 세부는
[SQLAlchemy 비동기](https://rlckdwkd55.github.io/posts/sqlalchemy-async/)에서 다뤘다).

```python
# app/infra/order/repository_impl.py  (인프라 계층)
class SqlAlchemyOrderRepository(OrderRepository):
    def __init__(self, session):
        self._session = session

    async def get(self, order_id: int) -> Order | None:
        row = await self._session.get(OrderModel, order_id)   # ORM 모델
        return _to_domain(row) if row else None               # 도메인으로 번역
```

표현 계층의 라우트는 요청을 받아 응용 계층에 위임할 뿐이다. 요청/응답 경계의 검증·직렬화는
[Pydantic](https://rlckdwkd55.github.io/posts/pydantic/) 모델로 처리하고, 도메인 모델을 API
스키마로 그대로 노출하지 않는다.

## 계층/헥사고날 아키텍처와 의존성 방향

위 코드가 어느 계층에 속하는지 정리하면 이렇다.

```text
표현(route)        ← 요청/응답, HTTP 관심사
   │
응용(service)      ← 유스케이스 흐름 조립, 트랜잭션 경계
   │
도메인(entity)     ← 핵심 규칙 (프레임워크/DB 의존 X)
   ↑
인프라(repository impl) ── 도메인이 정의한 인터페이스를 구현
```

핵심 원칙은 **의존성이 도메인을 향하게** 하는 것이다. 도메인은 웹이나 DB를 몰라야 하고
바깥 계층이 도메인을 참조한다. 리포지토리 인터페이스는 도메인이 소유하고 구현은 인프라가
제공하는 구조가 곧 **의존성 역전(DIP)** 이며, 그래야 DB나 웹 프레임워크를 바꿔도 핵심
로직이 흔들리지 않는다. **헥사고날(포트-어댑터) 아키텍처** 도 같은 지향으로, 도메인이 정의한
인터페이스가 "포트", 인프라의 구현이 "어댑터"다. 앞서 본 부패 방지 계층도 하나의 어댑터다.

<!-- 이미지: 구글 검색 "ddd layered hexagonal architecture dependency" · 저장 /assets/img/posts/backend/ddd/layers.png -->

이름이 같아 헷갈리는 두 서비스는 역할이 다르다.

| 구분 | 응용 서비스(Application Service) | 도메인 서비스(Domain Service) |
| --- | --- | --- |
| 위치 | 응용 계층 | 도메인 계층 |
| 책임 | 유스케이스 조립, 트랜잭션 조율 | 순수 도메인 규칙(여러 객체 걸침) |
| 규칙 포함? | 규칙을 도메인에 위임 | 규칙 자체를 담음 |

응용 서비스가 규칙을 직접 판단하기 시작하면 다시 빈약한 모델로 돌아간다. 응용 서비스는
"누구를 불러서 무슨 순서로 시킬지"만 알아야 한다.

이 구조는 폴더 배치에도 드러난다. 기술 계층(`controllers/`, `services/`, `models/`)을
최상위로 두면 하나의 기능 변경이 여러 폴더에 흩어지지만, 도메인을 최상위로 두고
(`domain/order/`, `domain/member/`) 그 안에 `entity·repository·service·route·dto`를 두면
"주문" 관련 변경은 대체로 `domain/order/` 안에서 끝난다. 함께 바뀌는 것을 함께 두는 높은
응집이며, 바운디드 컨텍스트를 코드 구조에 얕게 반영한 형태이기도 하다.

## 흔한 오해들

**DDD는 폴더 구조가 아니다.** 도메인별로 폴더를 나누고 `entity`, `repository`를 만들었다고
DDD가 되는 게 아니다. 폴더는 껍데기일 뿐이고, 핵심은 그 안에 진짜 도메인 규칙과 언어가
담겼느냐다. 규칙이 전부 서비스에 있고 엔티티는 데이터 가방이라면 폴더 이름만 DDD인 빈약한
모델이다.

**모든 프로젝트에 DDD가 필요한 것도 아니다.** 단순한 CRUD 도메인에서 애그리거트·리포지토리
추상은 보일러플레이트 비용일 뿐이고, 진짜 가치는 복잡한 **핵심 도메인(Core Domain)** 에서
나온다. 에반스도 도메인을 핵심/지원/일반으로 나눠 역량을 핵심에 집중하라고 말한다.

**전술적 패턴만 DDD가 아니다.** 엔티티·값 객체만 도입하고 유비쿼터스 언어와 바운디드
컨텍스트를 무시하면, 큰 그림이 없어 결국 하나의 거대한 모델로 회귀한다.

## 트레이드오프

| 얻는 것 | 치르는 비용 |
| --- | --- |
| 도메인 규칙이 한곳에 모여 이해·변경이 쉬움 | 초기 설계·추상화 비용이 큼 |
| 기술(웹/DB) 교체에 강함(의존성 역전) | 계층·매핑 코드(도메인↔ORM) 증가 |
| 도메인별 높은 응집, 변경 국소화 | 단순 CRUD에는 과설계 |
| 유비쿼터스 언어로 협업 오해 감소 | 도메인 전문가와의 지속적 대화 필요 |

DDD는 켜고 끄는 스위치가 아니라 정도(degree)의 문제다. 복잡한 핵심 도메인엔 애그리거트·도메인
서비스까지 깊게, 단순 도메인엔 얕게 적용한다. 폴더 구조를 그대로 두더라도 규칙을 도메인 안으로
밀어 넣는 것만으로 얻는 게 있다.

<br><br>
참고 : https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf
