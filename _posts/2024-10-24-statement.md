---
title: "Statement와 PreparedStatement란?"
date: 2024-10-24 16:20:00 +0900
categories: [Java]
tags: [basics, java, jdbc, database]
description: "JDBC에서 Statement와 PreparedStatement의 차이, 사용 목적과 보안·성능 특성 비교"
image:
  path: /assets/img/thumbnails/jdbc.jpg
---

## Statement란?

### 정의

- Statement는 Connection 객체로부터 sql문을 DB에 전달하여 실행하고 결과를 리턴 받는 객체이다.
- **DDL(CREATE, ALTER, DROP) 구문을 처리**할 때 적합하다.
- 매 실행 시 Query를 다시 파싱 하기 때문에 속도가 느리며, SQL Injection공격에 취약하다.

**※SQL Injection: 악의적인 사용자가 보안상 취약점을 이용하여, 데이터베이스가 비정상적인 동작을 하도록 조작하는 행위.**

### 사용 예시

```java
Statement stmt = null;
String query = "select * from employees";

try {
    stmt = conn.createStatement();
    ResultSet rs = stmt.executeQuery(query);
    while (rs.next()) {
        String name = rs.getString("name");
        int age = rs.getInt("age");
        //... 
    }
} catch (SQLException e ) {
    // 예외 처리
} finally {
    if (stmt != null) { stmt.close(); }
}
```

- 직접 SQL 쿼리를 문자열로 작성하여 파라미터 값을 포함시킨다.
  
<br>

---

## PreparedStatement란?

### 정의

- SQL 쿼리를 미리 컴파일해 두고, 실행 시점에 파라미터 값을 넣어서 실행하는 방식이다.
- SQL Injection 공격에 대한 보안성이 높으며, 코드의 가독성도 높아진다.
- **DML(SELECT, INSERT, UPDATE, DELETE) 구문 처리**에 적합하다.
- 동일한 SQL 쿼리를 여러 번 실행하는 경우에는 이미 컴파일된 쿼리를 재사용할 수 있으므로 효율적이다.
- 쿼리가 복잡하거나 실행 횟수가 적은 경우에는 Statement가 더 효율적일 수 있다.

### 사용 예시
```java
PreparedStatement pstmt = null;
String query = "select * from employees where age = ?";

try {
    pstmt = conn.prepareStatement(query);
    pstmt.setInt(1, 30);  // 첫번째 ?에 30을 설정
    ResultSet rs = pstmt.executeQuery();
    while (rs.next()) {
        String name = rs.getString("name");
        int age = rs.getInt("age");
        //... 
    }
} catch (SQLException e ) {
    // 예외 처리
} finally {
    if (pstmt != null) { pstmt.close(); }
}

```

- '?'를 이용해 파라미터를 표시하고, setXXX() 메서드를 사용하여 파라미터 값을 설정한다.
