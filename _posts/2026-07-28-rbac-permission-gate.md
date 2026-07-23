---
title: "RBAC 권한 게이트 구현 회고"
date: 2026-07-28
categories: [Security]
tags: [rbac, authorization, fastapi, permission]
description: "메뉴×동작 권한을 DB에서 조회해 엔드포인트마다 강제하는 RBAC 게이트를 FastAPI 의존성 require_can으로 구현하고, CRUD 4단계에 실행(Execute) 권한을 더해 5단계로 확장하기까지의 실전 회고."
image:
  path: /assets/img/thumbnails/rbac-gate.png
published: false
---

> RBAC의 개념(사용자·역할·권한, 최소 권한, 리소스×액션 매트릭스)은
> [RBAC 정리 글](https://rlckdwkd55.github.io/posts/rbac/)에서 다뤘다. 이 글은 그 개념을 실제
> FastAPI 백엔드에 어떻게 앉혔는지, 그리고 CRUD만으로는 표현되지 않던 동작에 **실행(Execute)
> 권한**을 뒤늦게 추가한 과정을 코드 근거로 정리한 회고다. 코드는 사내 서비스에서 발췌하되
> 식별 정보는 지웠다.

## 문제: 권한 검사가 엔드포인트마다 흩어져 있었다

역할과 권한 테이블은 진작 있었다. `roles`, `role_permissions`가 있고, 사용자는 역할 하나에
매달려 있다. 문제는 그 권한을 **어디서 검사하느냐**였다.

초기 코드에는 공통 규칙이 없었다. 어떤 라우터는 서비스 계층에서 `if not member.role ...`을 직접
확인했고, 어떤 라우터는 그냥 로그인만 됐으면 통과시켰고, 또 어떤 곳은 아예 아무 검사도 없었다.
같은 "생성 권한"을 확인하는데도 엔드포인트마다 코드가 조금씩 달라서, 새 API를 추가할 때 검사를
**빠뜨려도 아무도 눈치채지 못하는** 구조였다. 권한 모델이 있어도 각 진입점에서 실제로 검사하지
않으면 그냥 테이블 몇 개일 뿐이다.

그래서 목표를 하나로 잡았다. "이 사용자가, 이 메뉴에서, 이 동작을 할 수 있는가"를 **엔드포인트
진입 시점에** 판정하는 공통 게이트를 두고, 모든 보호 대상 라우트가 그걸 통과하게 강제하는 것.
FastAPI에서는 이걸 **의존성(dependency)** 으로 만들면 라우트 데코레이터 한 줄로 끝난다.

## 권한 매트릭스 설계: 메뉴 × 동작

먼저 축을 정리했다. 세로축은 **메뉴(리소스)**, 가로축은 **동작(action)** 이다.

메뉴는 화면 단위로 끊어 `MenuType` enum으로 고정했다. 모델, 임베딩 모델, 외부 DB, 문서, 컬렉션,
에이전트, 시나리오, 서비스, 스케줄러, 설정, 평가. 문자열을 여기저기 하드코딩하면 오타 한 번에
권한이 통째로 새기 때문에, 값을 enum으로 묶어 `menu_type` 컬럼과 대조하게 했다.

```python
class MenuType(str, Enum):
    MODELS = "MODELS"
    EMBEDDING_MODELS = "EMBEDDING_MODELS"
    EXTERNAL_DB = "EXTERNAL_DB"
    DOCUMENTS = "DOCUMENTS"
    COLLECTIONS = "COLLECTIONS"
    # ... SCENARIOS, SERVICES, SCHEDULER, SETTING, ASSESSMENT
```

권한 자체는 역할별로 메뉴마다 한 행씩 두는 `role_permissions` 테이블에 담았다. 처음엔 동작이
**조회/생성/수정/삭제(CRUD) 4개** 뿐이었다.

```python
class RolePermissionEntity(Base):
    __tablename__ = 'role_permissions'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_id: Mapped[int] = mapped_column(Integer, ForeignKey('roles.id'), nullable=False)
    menu_type: Mapped[str] = mapped_column(String(30), nullable=False)
    can_read:   Mapped[bool] = mapped_column(Boolean, default=True,  nullable=False)
    can_create: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_update: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_delete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # can_execute 는 나중에 추가된다 (뒤에서 설명)
```

한 가지 규칙을 DTO 검증에 박아뒀다. **조회 권한이 없으면 나머지 동작 권한은 의미가 없다.**
목록조차 못 보는 메뉴에서 생성·수정 권한만 켜 두는 건 설정 실수일 뿐이라, 권한을 저장할 때
`can_read`가 꺼져 있으면 나머지를 강제로 전부 꺼버린다.

```python
class PermissionItemReq(BaseModel):
    menu_type: str
    can_read: bool = False
    can_create: bool = False
    can_update: bool = False
    can_delete: bool = False

    @model_validator(mode='after')
    def clear_crud_when_no_read(self) -> 'PermissionItemReq':
        if not self.can_read:
            self.can_create = False
            self.can_update = False
            self.can_delete = False
        return self
```

여기에 더해, 한 역할에 같은 메뉴가 두 번 들어오면 어느 행이 이기는지 모호해지므로 요청 단에서
중복 `menu_type`을 거부하도록 했다. 매트릭스의 각 칸은 정확히 하나여야 한다.

## 게이트 구현: require_can 의존성

핵심은 `require_can(menu_type, operation)` 이다. 메뉴와 동작을 받아, 요청자의 역할 권한을
DB에서 조회해 그 칸이 켜져 있는지 검사하는 **의존성 팩토리**다.

```python
def require_can(menu_type: MenuType, operation: str) -> Callable:
    """is_admin이면 즉시 통과, 아니면 role 권한을 DB에서 조회해 검사한다."""
    async def _check(
        request: Request,
        session: AsyncSession = Depends(get_session),
    ) -> str:
        token = request.cookies.get("access_token")
        if not token:
            raise CommonException(ErrorCode.UNAUTHORIZED)
        try:
            payload = verify_token(token)
        except JWTError:
            raise CommonException(ErrorCode.UNAUTHORIZED)

        user_id: str = payload["sub"]
        if payload.get("is_admin"):
            return user_id  # 최고 관리자는 통과

        result = await session.execute(
            select(MemberEntity)
            .options(selectinload(MemberEntity.role).selectinload(RoleEntity.permissions))
            .filter(MemberEntity.id == user_id)
            .filter(MemberEntity.deleted_at.is_(None))
        )
        member = result.scalar()
        if not member or not member.role:
            raise CommonException(ErrorCode.FORBIDDEN)

        perm = next(
            (p for p in member.role.permissions if p.menu_type == menu_type.value),
            None,
        )
        if not perm:
            raise CommonException(ErrorCode.FORBIDDEN)

        allowed = {
            "read":   perm.can_read,
            "create": perm.can_create,
            "update": perm.can_update,
            "delete": perm.can_delete,
        }.get(operation, False)

        if not allowed:
            raise CommonException(ErrorCode.FORBIDDEN)

        return user_id

    return _check
```

몇 가지 짚어둘 점이 있다.

- **토큰은 쿠키(`access_token`)에서 읽고 `verify_token`으로 서명을 검증한다.** 서명 검증은
  [JWT 글](https://rlckdwkd55.github.io/posts/jwt/)에서 정리한 그대로, "이 요청을 누가 보냈는가"까지만 보증한다.
  "무엇을 해도 되는가"는 여기서부터 별도로 판정한다 — 인증(authn)과 인가(authz)는 다른 문제다.
- **역할→권한을 `selectinload`로 한 번에 로드한다.** 매 게이트마다 권한을 순회하는데 lazy 로딩이면
  N+1이 터진다. 애초에 관계를 함께 끌어와 루프는 메모리에서 돈다.
- **삭제된 계정(`deleted_at`)은 배제한다.** 토큰이 아직 안 만료됐어도 계정이 소프트 삭제됐으면
  권한이 없는 것으로 본다.
- **역할이 없거나, 그 메뉴 권한 행 자체가 없으면 즉시 `FORBIDDEN`.** 기본값은 "거부"다.

라우트에는 데코레이터 한 줄로 건다. 동작만 바꿔 재사용한다.

```python
@router.post("", dependencies=[Depends(require_can(MenuType.DOCUMENTS, "create"))])
async def create_document(...): ...

@router.post("/{seq}", dependencies=[Depends(require_can(MenuType.DOCUMENTS, "update"))])
async def update_document(...): ...

@router.post("/{seq}/delete", dependencies=[Depends(require_can(MenuType.DOCUMENTS, "delete"))])
async def delete_document(...): ...
```

이렇게 하니 "새 API에 권한 붙이는 법"이 팀 안에서 한 줄로 통일됐다. 검사를 빠뜨렸는지도 라우터만
훑으면 바로 보인다.

## 프런트에서 이미 숨겼는데 왜 서버에서 또 검사하나

이 게이트를 붙이면서 가장 많이 받은 질문이다. 화면에서 권한 없는 버튼을 안 그려주는데 서버에서
또 막을 필요가 있냐는 것. **있다. 그것도 반드시.**

프런트의 권한 처리는 UX일 뿐이다. 버튼을 숨기는 건 "실수로 누르지 않게" 도와주는 편의이지,
**요청 자체를 막지는 못한다.** 개발자 도구로 API를 직접 호출하거나, 예전 화면이 캐시돼 있거나,
프런트 조건문에 버그가 하나 있으면 그대로 서버까지 도달한다. 진짜 경계는 서버의
`require_can`이고, 화면 제어는 그 위에 얹은 보조 장치다. **판정은 서버에서, 매번, 진입 시점에.**
이게 이 게이트를 공통 의존성으로 강제한 이유 그 자체다.

`is_admin` 우회를 최소한으로 둔 것도 같은 맥락이다. 최고 관리자만 게이트를 건너뛰고, 나머지는
예외 없이 역할 권한으로 판정한다. 광역 우회 경로가 많아질수록 "이 사람이 왜 됐지"를 추적하기
어려워진다.

## CRUD로는 잡히지 않던 동작 — 실행(Execute) 권한을 추가하다

한동안 잘 돌던 매트릭스에서 구멍을 발견한 건 보안·정합성 전수 점검(커밋 `37a680b`, 2026-07-13)
때였다. 관련 회고는 [보안·정합성 전수 점검 글](https://rlckdwkd55.github.io/posts/security-integrity-audit/)에 따로 정리했다.

문제는 **데이터를 바꾸지 않는 동작**이었다. 예를 들면 이런 것들이다.

- 외부 DB **연결 테스트** — 연결이 되는지 시험만 한다.
- 스케줄러 잡 **즉시 실행(trigger)** — 예약을 기다리지 않고 지금 한 번 돌린다.
- 문서 **외부 DB 재동기화** — 원본을 다시 끌어와 다시 임베딩한다.

이것들은 리소스를 생성·수정·삭제하는 게 아니다. **부수효과가 있는 실행 동작**이다. 그런데 권한
축이 CRUD 4개뿐이라 표현할 칸이 없었다. 그 결과 코드는 두 가지 어중간한 상태로 갈라져 있었다.
연결 테스트는 아예 **게이트가 없어** 로그인만 하면 누구나 외부 DB로 연결을 시도할 수 있었고,
스케줄러 즉시 실행과 문서 재동기화는 성격이 안 맞는데도 억지로 `"update"` 권한에 얹혀 있었다.
"수정 권한"이 있으면 무거운 재동기화 작업까지 트리거되는 셈이라, 권한의 의미가 흐려져 있었다.

그래서 다섯 번째 축 **실행(Execute)** 을 추가했다. 엔티티에 컬럼 하나를 더한다.

```python
can_execute: Mapped[bool] = mapped_column(
    Boolean, default=False, nullable=False, server_default='0'
)
```

`server_default='0'`을 준 게 포인트다. 이미 저장된 역할 행들에는 `can_execute` 값이 없으므로,
서버 기본값을 0으로 박아 **기존 권한이 마이그레이션 후 자동으로 "실행 불가"가 되게** 했다.
새 권한 축은 항상 "닫힌 채로" 도입돼야 한다. 열린 채 추가하면 그게 곧 권한 상승이다.

게이트의 판정 테이블에도 한 줄을 더한다.

```python
allowed = {
    "read":    perm.can_read,
    "create":  perm.can_create,
    "update":  perm.can_update,
    "delete":  perm.can_delete,
    "execute": perm.can_execute,   # 추가
}.get(operation, False)
```

그리고 앞서 구멍 났던 3개 API를 전부 `"execute"` 게이트로 정리했다.

```python
# 게이트가 없던 API → execute 로 신규 게이팅
@router.post("/test-connection",
    dependencies=[Depends(require_can(MenuType.EXTERNAL_DB, "execute"))])

# update 로 억지로 막고 있던 API → execute 로 정정
@router.post("/jobs/{seq}/trigger",
    dependencies=[Depends(require_can(MenuType.SCHEDULER, "execute"))])
@router.post("/{seq}/refresh-external-db",
    dependencies=[Depends(require_can(MenuType.DOCUMENTS, "execute"))])
```

DTO의 `clear_crud_when_no_read` 규칙에도 `can_execute`를 포함시켜, 조회 권한이 없으면 실행 권한도
같이 꺼지게 맞췄다. 축을 늘릴 때는 기존 불변식도 같이 늘려줘야 규칙에 구멍이 안 난다.

## 배운 것

- **권한 모델이 있는 것과 강제되는 것은 다르다.** 테이블만으로는 아무것도 못 막는다. 모든 진입점이
  거쳐 가는 공통 의존성을 두고, 검사 누락이 눈에 보이게 만들어야 실제 보안이 된다.
- **프런트의 권한 제어는 UX, 서버의 게이트가 경계다.** 판정은 서버에서 매번 다시 한다. 화면이
  버튼을 숨겼다는 건 아무 보증도 아니다.
- **광역 우회(`is_admin`)는 딱 하나로, 나머지는 전부 역할 권한으로.** 예외 경로가 늘수록 감사가
  불가능해진다.
- **권한 축은 리소스가 아니라 "동작의 성격"으로 나눈다.** CRUD에 안 잡히는 실행성 동작이 나오면,
  억지로 `update`에 얹지 말고 별도 축(Execute)을 만든다. 축이 정확해야 최소 권한이 성립한다.
- **새 권한은 닫힌 채로 도입한다.** `server_default='0'` 하나가 마이그레이션 시점의 권한 상승을 막았다.
- 가장 위험한 건 "권한 검사가 아예 없던 API"였다. 그래서 새 기능에는 게이트를 **처음부터** 함께 단다.

## 정리

권한은 "어딘가에 정의돼 있는 것"이 아니라 "모든 요청 경로에서 강제되는 것"이어야 의미가 있다.
흩어진 검사를 `require_can` 의존성 하나로 모으니 규칙이 통일됐고, 검사 누락이 드러났으며,
나중에 Execute 축을 더할 때도 한 곳만 고치면 됐다. 리소스×동작 매트릭스에서 **동작의 성격을
정확히 나누는 것** — 그게 최소 권한을 실제로 지킬 수 있게 만드는 뼈대였다.
