---
title: "SQL Injection"
date: 2025-03-05 10:35:00 +0900
categories: [Web]
tags: [sql-injection]
description: "SQL Injection의 개념과 주요 공격 유형, 대응 방안"
image:
  path: /assets/img/thumbnails/sql-injection.png
---

## SQL Injection이란?

![](/assets/img/posts/web/sql-injection/sql-injection.png)

- SQL 인젝션은 웹 사이트 보안 취약점 중 하나로, 악의적인 SQL문을 삽입하는 공격 방법을 말한다.
- 공격자는 이 방법을 통해 데이터베이스를 조작하거나 민감한 정보를 탈취한다.
- 데이터베이스와 연동된 웹 애플리케이션에서 사용자 입력값을 충분히 검증하지 않고 SQL 쿼리에 사용할 때 발생한다.
- OWASP에서도 1순위로 분류되었던 만큼 공격이 성공할 경우 큰 피해를 입힐 수 있어 보안에 각별한 주의가 필요하다.
  
<br>

---

## SQL Injection 공격 종류

### 1. Classic SQL Injection

- 가장 기본적인 형태의 SQLInjection으로, 사용자의 입력값을 그대로 SQL 쿼리에 사용하는 경우 발생한다.
- 공격자는 입력 필드에 SQL쿼리의 일부를 입력하여 데이터베이스를 조작하게 된다.

#### 공격 예시

로그인 폼에서 사용자 이름과 비밀번호를 입력받는 경우를 가정해 보자.
일반적인 SQL 쿼리는 아래와 같다

```sql
SELECT * FROM users WHERE username = '[username]' AND password = '[password]'
```

공격자가 사용자 이름 필드에 `' OR '1'='1`를 입력하면, SQL 쿼리는 아래와 같이 변한다

```sql
SELECT * FROM users WHERE username = '' OR '1'='1' AND password = '[password]'
```

여기서 `'1'='1'`은 항상 참이므로, 공격자는 비밀번호를 모르더라도 로그인에 성공하게 된다.

<br>

### 2. Blind SQL Injection

- 공격자가 직접적인 데이터베이스 오류 메시지를 볼 수 없는 경우에 사용하는 방법이다.
- 이 방법은 TRUE/FALSE 질문을 통해 데이터베이스에서 정보를 추출한다.
- 시간은 다소 걸리지만, 성공적으로 수행되면 공격자는 데이터베이스 내의 모든 정보에 접근할 수 있게 된다.

#### 공격 예시

사용자의 아이디를 이용해 정보를 조회하는 경우를 가정해 보자.
일반적인 SQL 쿼리는 아래와 같다.

```sql
SELECT * FROM users WHERE id = [id]
```

공격자가 id 필드에
`1 AND SUBSTRING((SELECT password FROM users WHERE username = 'admin'), 1, 1) = 'a'`
를 입력하면, SQL 쿼리는 아래와 같이 변한다.

```sql
SELECT * FROM users WHERE id = 1 AND SUBSTRING((SELECT password FROM users WHERE username = 'admin'), 1, 1) = 'a'
```

이 쿼리는 관리자의 비밀번호 첫 글자가 'a'인 경우에만 결과를 반환한다.
공격자는 이를 이용해 비밀번호를 하나씩 추측해 나갈 수 있다.

<br>

### 3. Time-Based Blind SQL Injection

- 이 방법은 데이터베이스에 시간 지연 쿼리를 보내어 응답시간을 기반으로 데이터를 추출하는 방법이다.
- 즉, 공격자는 특정 질의에 대한 응답 시간을 통해 데이터베이스로부터 정보를 얻게 된다.

#### 공격 예시

Blind SQL Injection과 비슷하지만, 시간 지연 함수를 사용하여 데이터베이스의 응답 시간을 관찰한다.
만약 공격자가 id 필드에
`1 AND IF(SUBSTRING((SELECT password FROM users WHERE username = 'admin'), 1, 1) = 'a', SLEEP(10), 'false')`
를 입력하면, SQL 쿼리는 아래와 같이 변한다.

```sql
SELECT * FROM users WHERE id = 1 AND IF(SUBSTRING((SELECT password FROM users WHERE username = 'admin'), 1, 1) = 'a', SLEEP(10), 'false')
```

이 쿼리는 관리자의 비밀번호 첫 글자가 'a'인 경우에만 10초 동안 지연된다.
공격자는 이를 이용해 비밀번호를 하나씩 추측해 나갈 수 있다.

<br>

### 4. Union-Based SQL Injection

- SQL의 'UNION' 연산자를 이용하는 방법이다.
- 'UNION' 연산자는 두 개의 SQL 쿼리 결과를 합치는 데 사용되며, 공격자는 이를 활용하여 원하는 정보를 가져오게 된다.

#### 공격 예시

사용자의 아이디를 이용해 정보를 조회하는 경우를 가정해 보자.
공격자가 id 필드에
`1 UNION SELECT username, password FROM users`
를 입력하면, SQL 쿼리는 아래와 같이 변한다.

```sql
SELECT * FROM users WHERE id = 1 UNION SELECT username, password FROM users
```

이 쿼리는 사용자의 아이디와 비밀번호를 모두 반환한다.

<br>

### 5. Error-Based SQL Injection

- 이 방법은 데이터베이스에 잘못된 SQL 쿼리를 보내어 발생하는 오류 메시지로 정보를 얻는 방법이다.
- 오류 메시지는 보통 데이터베이스의 구조나 유용한 정보를 포함하고 있다.

#### 공격 예시

사용자의 아이디를 이용해 정보를 조회하는 경우를 가정해 보자.
공격자가 id 필드에
`1 AND (SELECT COUNT(*), CONCAT((SELECT (SELECT CONCAT(username, 0x7e, password)) FROM users WHERE id = 1), FLOOR(RAND(0)*2))x FROM INFORMATION_SCHEMA.CHARACTER_SETS GROUP BY x)a`
를 입력하면, SQL 쿼리는 아래와 같이 변한다.

```sql
SELECT * FROM users WHERE id = 1 AND (SELECT COUNT(*), CONCAT((SELECT (SELECT CONCAT(username, 0x7e, password)) FROM users WHERE id = 1), FLOOR(RAND(0)*2))x FROM INFORMATION_SCHEMA.CHARACTER_SETS GROUP BY x)a
```

이 쿼리는 오류 메시지를 발생시키며, 이 메시지에는 사용자의 아이디와 비밀번호가 포함되어 있다.

<br>

---

## 대응 방안

### 1. 사용자 입력값 검증

- 모든 사용자 입력값에 대해 철저한 검증이 필요하다.
- 사용자가 입력한 데이터가 예상한 데이터 형식과 일치하는지 확인하고, 대응할 수 있도록 해야 한다.
- 예를 들어, 숫자를 입력해야 하는 곳에 문자가 들어가지 않도록 검증하는 것이다.

<br>

### 2. 특수문자, SQL키워드 필터링

- 사용자 입력값 중 SQL 쿼리의 실행을 변조할 수 있는 특수문자나 SQL 키워드를 필터링하는 것이 중요하다.
- 이를 통해 공격자가 임의의 SQL 쿼리를 실행하는 것을 방지할 수 있다.
- 예를 들어, 입력값 중에 'AND', 'OR', ';' 등의 SQL 키워드나 특수문자를 찾아 필터링하거나 대처하는 방법이 있다.

<br>

### 3. 파라미터화 쿼리 사용

- SQL 쿼리에 사용자 입력값을 직접 삽입하는 것이 아니라, 파라미터화된 쿼리를 사용하는 것이 바람직하다.
- 이 방법은 SQL 쿼리의 구조를 미리 정의하고, 사용자 입력값을 이 구조에 맞게 삽입함으로써 SQL 인젝션을 방지할 수 있다.

<br>

### 4. 최소 권한 원칙

- 데이터베이스에 접근하는 계정은 가능한 최소한의 권한만 가지도록 설정하는 것이 좋다.
- 이를 통해 공격자가 SQL 인젝으로 데이터베이스에 접근하더라도, 큰 피해를 방지할 수 있다.

<br>

### 5. 웹 방화벽 사용

- 웹 애플리케이션 방화벽(Web Application Firewall, WAF) 등의 보안 솔루션을 사용하여 방어할 수 있다.
- WAF는 HTTP 트래픽을 모니터링하고, 알려진 공격 패턴을 차단하여 SQL 인젝션을 방지한다.
