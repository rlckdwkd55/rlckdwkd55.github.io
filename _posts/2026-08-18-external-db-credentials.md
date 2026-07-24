---
title: "외부 DB 접속 비밀번호를 Fernet으로 암호화하기"
date: 2026-08-18
categories: [Security]
tags: [encryption, fernet, credentials]
description: "사용자가 등록한 외부 DB의 접속 비밀번호를 평문으로 두지 않으려고, JWT 시크릿에서 파생한 키로 Fernet 대칭 암호화해 저장하고 접속 시 복호화한 실전 구현 회고."
image:
  path: /assets/img/thumbnails/db-credentials.png
published: false
---

사내 검색 서비스에 [외부 DB 연동](https://rlckdwkd55.github.io/posts/external-db-connector/) 기능을 붙이면서, 생각보다
오래 붙잡았던 건 쿼리도 커넥션 풀도 아니고 **"접속 비밀번호를 어떻게 저장하지"** 였다.
사용자가 화면에서 MySQL·Oracle 같은 DB의 접속 정보를 등록하면, 우리 쪽 DB에 그 정보를
보관해 뒀다가 나중에 조회·동기화할 때 다시 꺼내 접속해야 한다. 이 글은 그 비밀번호를
Fernet 대칭 암호화로 다룬 과정을 정리한 회고다.

## 문제: 이 비밀번호는 "복원"해야 한다

평소 인증에서 다루는 비밀번호와 성격이 완전히 다르다는 점부터 짚어야 했다.

로그인 비밀번호라면 답은 정해져 있다. bcrypt 같은 해시로 저장하고, 로그인할 때 입력값을
같은 방식으로 해시해서 비교하면 끝이다. **원문을 되살릴 필요가 없기 때문에** 단방향 해시가
정답이다.

그런데 외부 DB 접속 비밀번호는 상황이 반대다. 실제로 그 DB에 붙으려면 드라이버에게
**원문 그대로의 비밀번호**를 넘겨야 한다. SQLAlchemy로 접속 URL을 만드는 코드가 이렇게
생겼는데, `password` 자리에는 반드시 평문이 들어가야 한다.

```python
url = _build_url(
    db_type=db_type,
    username=self._entity.username,
    password=decrypt_password(self._entity),   # 여기엔 원문이 필요하다
    host=self._entity.host,
    port=self._entity.port,
    database_name=self._entity.database_name,
    oracle_conn_type=oracle_conn_type,
)
return create_engine(url, pool_size=1, max_overflow=0, pool_pre_ping=True)
```

해시로 저장하면 이 자리에 넣을 원문을 영원히 잃는다. 즉 **되돌릴 수 있는 방식**,
곧 대칭 암호화가 필요하다는 결론이었다.

## 그렇다고 평문으로 둘 수는 없다

가장 쉬운 길은 `password` 컬럼에 그냥 평문으로 넣는 것이다. 하지만 접속 비밀번호는
성격상 위험이 크다.

- 우리 DB가 유출되면 그 순간 **연동된 모든 외부 DB의 접속 정보가 통째로 노출**된다.
  우리 서비스 하나의 사고가 남의 DB 사고로 번진다.
- 백업 파일, 로그, 운영자의 DB 조회 화면 등 **평문이 스쳐 지나갈 접점**이 생각보다 많다.
- 무엇보다 "사용자가 맡긴 자격증명을 우리가 평문으로 들고 있다"는 사실 자체가 부담이었다.
  최소한 저장 계층에서는 원문이 보이지 않아야 한다고 봤다.

그래서 목표는 명확했다. **DB에는 암호문만 저장하고, 접속하는 그 순간에만 메모리에서
복호화**한다.

## 왜 Fernet인가

대칭 암호화를 직접 조립하는 건 사고 위험이 크다. AES 모드 선택, IV 관리, 패딩, 그리고
무결성 검증(MAC)까지 하나라도 어긋나면 조용히 취약해진다. 그래서 이 조각들을 안전한
기본값으로 묶어 주는 고수준 레시피가 필요했고, 파이썬 `cryptography` 라이브러리의
**Fernet**이 딱 그 역할이었다. (Fernet 자체의 개념과 구조는 [별도 글](https://rlckdwkd55.github.io/posts/fernet-encryption/)에
정리해 뒀다.)

Fernet을 고른 결정적인 이유는 두 가지다.

1. **API가 `encrypt` / `decrypt` 두 개로 끝난다.** 우리가 IV나 모드를 신경 쓸 여지 자체가
   없다. 잘못 쓸 여지가 적다는 게 보안 코드에선 큰 장점이다.
2. **무결성이 기본 내장이다.** Fernet 토큰에는 HMAC 인증이 포함돼 있어서, 저장된 암호문이
   한 바이트라도 변조되면 복호화 단계에서 예외가 난다. 기밀성뿐 아니라 **변조 감지**까지
   공짜로 따라온다.

## 키를 어디서 가져올까 — 이미 있는 시크릿에서 파생

대칭 암호화의 진짜 난제는 알고리즘이 아니라 **키를 어디에 두고 어떻게 관리하느냐**다.
암호화 키를 새로 하나 만들면, 그 키를 또 어딘가에 안전하게 보관·주입·로테이션해야 하는
관리 대상이 하나 더 늘어난다.

지금 서비스 규모에서 전용 KMS를 붙이는 건 과했다. 대신 이미 안전하게 주입·관리되고 있는
비밀이 하나 있었다. [JWT](https://rlckdwkd55.github.io/posts/jwt/) 서명에 쓰는 시크릿이다. 이 값은 하드코딩 없이
설정으로 주입되고, 코드/저장소에는 들어 있지 않다. 그래서 **이 시크릿에서 Fernet 키를
파생(derive)** 하기로 했다.

문제는 형식이다. Fernet 키는 32바이트를 base64로 인코딩한 형태여야 하는데, 시크릿 문자열은
길이가 제각각이다. 그래서 시크릿을 SHA-256으로 해시해 **항상 32바이트로 고정**한 뒤 그
형식에 맞췄다. 실제 코드는 이게 전부다.

```python
from cryptography.fernet import Fernet
import base64, hashlib

settings = get_settings()          # 시크릿은 환경설정으로 주입, 코드/저장소엔 없음

def get_fernet() -> Fernet:
    raw = settings.JWT_SECRET_KEY.encode()
    key = base64.urlsafe_b64encode(hashlib.sha256(raw).digest())  # 32바이트 → Fernet 키 형식
    return Fernet(key)
```

- `settings`는 환경변수/`.env`로 주입되는 설정 객체다. 시크릿 **원본값은 코드에 없고**,
  당연히 이 글에도 없다. 여기서 중요한 건 "무엇을 넣느냐"가 아니라 "어떤 원리로 키
  형식을 맞추느냐"뿐이다.
- SHA-256을 쓴 이유는 암호학적 강도라기보다 **길이·형식 정규화**에 가깝다. 어떤 시크릿이
  와도 항상 같은 규격의 Fernet 키가 나온다.
- 별도 키 저장소 없이, 이미 잘 관리되던 비밀 하나를 재활용해 **관리 대상을 늘리지 않았다.**

## 저장과 복호화 — 실제 흐름

암호화가 일어나는 지점은 등록/수정 서비스 안이다. 등록할 때 요청으로 들어온 평문
비밀번호를 암호화해서 엔티티에 담는다.

```python
async def create_connection(self, req: CreateConnectionReq) -> ExternalDbConnectionRes:
    # 1) 연결 테스트를 먼저 통과시켜, 틀린 접속정보가 저장되는 것을 막는다
    await self._verify_connectable(
        req.db_type, req.host, req.port, req.database_name,
        req.username, req.password, req.oracle_conn_type,
    )
    # 2) 통과한 비밀번호만 암호화해서 저장
    encrypted = get_fernet().encrypt(req.password.encode()).decode()
    entity = ExternalDbConnectionEntity(
        ...,
        password_encrypted=encrypted,   # DB에는 암호문만 들어간다
        ...,
    )
    await self.conn_repo.save(entity)
    return ExternalDbConnectionRes.model_validate(entity)
```

엔티티 쪽에서도 컬럼 이름을 `password`가 아니라 `password_encrypted`로 두어, 이 값이
**평문이 아님을 스키마 수준에서 드러냈다.**

```python
class ExternalDbConnectionEntity(Base):
    ...
    password_encrypted: Mapped[str] = mapped_column(Text)
```

복호화는 접속이 필요한 그 순간에만 일어난다. 앞서 커넥션 URL을 만들 때 봤던
`decrypt_password`가 바로 그 지점이다.

```python
def decrypt_password(entity: ExternalDbConnectionEntity) -> str:
    return get_fernet().decrypt(entity.password_encrypted.encode()).decode()
```

`decrypt`는 토큰의 HMAC을 먼저 검증하기 때문에, DB에 저장된 암호문이 손상되거나
변조됐다면 여기서 예외가 터진다. 잘못된 원문을 조용히 반환하는 일이 구조적으로 없다.

한 가지 신경 쓴 디테일은 **수정 시나리오**다. 사용자가 비밀번호는 그대로 두고 host나
port만 고치고 싶을 때, 화면에서 비밀번호 칸을 비워 보낸다. 이때 빈 값으로 덮어쓰면
비밀번호가 날아가므로, 요청에 비밀번호가 없으면 **기존 암호문을 복호화해 재사용**한다.

```python
password = req.password or decrypt_password(entity)   # 비면 기존 값을 복원해 사용
...
if req.password:                                       # 실제로 바꿀 때만 다시 암호화
    entity.password_encrypted = get_fernet().encrypt(req.password.encode()).decode()
```

정리하면 원문은 **등록·수정 요청 처리와 실제 접속의 찰나에만** 메모리에 존재하고,
저장 계층에는 언제나 암호문만 남는다.

## 운영에서 신경 쓴 것들

구현보다 오래 고민한 건 운영 쪽이었다.

**키 로테이션과의 결합.** 시크릿에서 키를 파생하는 방식의 대가는 명확하다. **JWT 시크릿을
교체하면 파생 키도 바뀌어서 기존 암호문을 못 푼다.** JWT 시크릿은 원래 서명용이라 언젠가
돌릴 수 있는 값인데, 그 순간 저장된 접속 비밀번호가 전부 복호화 불능이 된다. 그래서 시크릿
로테이션은 "자격증명 재암호화(옛 키로 복호화 → 새 키로 암호화)"와 세트로 다뤄야 하는
운영 절차로 못 박아 뒀다. 이 결합이야말로 이 설계에서 가장 조심해야 할 지점이다.

**유출 시 영향 범위.** 만약 시크릿이 새면 저장된 암호문도 함께 노출됐을 때 모두 복호화된다.
바꿔 말하면 이 방식의 안전성은 전적으로 **시크릿 주입 경로의 안전성**에 달려 있다. 그래서
시크릿을 로그·에러 메시지·응답 어디에도 흘리지 않는 것, 응답 DTO에 `password_encrypted`를
절대 싣지 않는 것을 기본 원칙으로 잡았다.

**언제 KMS로 갈 것인가.** 지금은 "관리 대상을 늘리지 않는다"는 이점이 크지만, 연동 대상이
많아지고 규모가 커지면 서명 시크릿과 암호화 키를 분리하고 전용 시크릿 매니저/KMS로
키 수명주기를 따로 관리하는 편이 낫다. 그때는 로테이션과 재암호화도 도구가 대신 해 준다.
지금 규모에서는 "단순하지만 안전한" 이 선택이 맞았다고 본다.

## 정리

- 외부 DB 접속 비밀번호는 원문을 되살려 써야 하므로 **해시가 아니라 대칭 암호화**가 정답이다.
- 직접 조립하는 대신 **Fernet**을 써서, IV·모드 실수 여지를 없애고 HMAC 기반 **변조 감지**를
  기본으로 얻었다.
- 키는 새로 만들지 않고 **이미 안전하게 관리되던 JWT 시크릿에서 SHA-256으로 파생**해
  관리 대상을 늘리지 않았다. 시크릿 원본은 코드에 없다.
- DB에는 언제나 암호문만, 원문은 등록·수정·접속의 찰나에만 메모리에 둔다.
- 대가는 **시크릿 교체 시 재암호화가 필요한 결합**이며, 규모가 커지면 KMS로 키를 분리하는
  게 다음 단계다.
