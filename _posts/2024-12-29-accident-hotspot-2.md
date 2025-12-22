---
title: "사고다발지 시각화 프로젝트 (2) - Java와 MySQL DB 연동"
date: 2024-12-29 10:40:00 +0900
categories: [Project]
tags: [java, project]
description: "OpenAPI활용 경기도 사고다발지 시각화 프로젝트"
image:
  path: /assets/img/thumbnails/accident-hotspot.jpg
---

지난 포스팅에서는 [사고다발지 현황](https://data.gg.go.kr/portal/data/service/selectServicePage.do?page=1&rows=10&sortColumn=&sortDirection=&infId=9HJ306A05WF6RS2560PG21056899&infSeq=3&order=&loc=&ACDNT_YY=&ACDNT_DIV_NM=&JURISD_POLCSTTN_NM=&LOC_INFO=)사이트에 있는 데이터를 바탕으로 DB구축을 위해 테이블과 컬럼들을 만들어 주었다.
이번 포스팅에서는 Java에서 MySql을 연결하는 과정을 작성 해 보겠다.

## Java에서 MySQL을 활용한 DB연결

### Dependency추가

먼저, Maven 프로젝트에서 MySQL DB를 연결하기 위해 필요한 의존성(dependency)을 추가한다.
pom.xml 파일에 아래의 코드를 추가해 주면 된다.

```xml
<!-- MySql -->  
<dependency>  
    <groupId>mysql</groupId>  
    <artifactId>mysql-connector-java</artifactId>  
    <version>8.0.23</version>  
</dependency>
```

이 코드를 추가함으로써, MySQL에 포함된 JDBC를 통해 DB와의 연결이 가능해진다.

<br>

### Java에서 DB연결

다음으로, Java 코드에서 DB에 접속하는 과정을 구현해 보겠다.
아래의 DbConnection 클래스는 DB 드라이버를 로드하고, DB에 연결하며, 연결을 종료하는 메서드를 포함하고 있다.

```java
public class DbConnection {  
  
    // DB Driver  
    String dbDriver = "com.mysql.cj.jdbc.Driver";  
  
    // DB URL  
    // IP:PORT/스키마  
    String dbUrl = "jdbc:mysql://localhost/testdb";  
  
    // DB ID/PW  
    String dbUser = "test";  
    String dbPassword = "0000";  
  
    Connection dbconn = null;  
  
  
    public void dbCon() {  
        Connection connection = null;  
  
        try {  
            Class.forName(dbDriver);  
            connection = DriverManager.getConnection(dbUrl, dbUser, dbPassword);  
            dbconn = connection;  
  
            System.out.println("DB Connection [성공]");  
  
        } catch (SQLException | ClassNotFoundException e) {  
            System.out.println("DB Connection [실패]");  
            e.printStackTrace();  
        }  
    }  
  
    public void dbClose() {  
        if (dbconn != null) {  
            try {  
                dbconn.close();  
            } catch (SQLException e) {  
                e.printStackTrace();  
            }  
        }  
    }  
}
```

이 클래스를 활용하면 DB와의 연결 및 연결 종료를 손쉽게 처리할 수 있다.
다음 포스트에서는 이 DB연결을 통해 실제 제이터를 INSERT, DELETE하는 방법에 대해 소개하려 한다.
