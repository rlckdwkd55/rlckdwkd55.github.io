---
title: "사고다발지 시각화 프로젝트 (4) - Spring과 MySQL 연동"
date: 2025-01-16 10:40:00 +0900
categories: [Project]
tags: [java, project]
description: "OpenAPI활용 경기도 사고다발지 시각화 프로젝트"
image:
  path: /assets/img/thumbnails/accident-hotspot.jpg
---

## Spring과 MySQL 연결하기

지난 포스팅에서는 공공 데이터 포털의 [사고다발지 현황](https://data.gg.go.kr/portal/data/service/selectServicePage.do?page=1&rows=10&sortColumn=&sortDirection=&infId=9HJ306A05WF6RS2560PG21056899&infSeq=3&order=&loc=&ACDNT_YY=&ACDNT_DIV_NM=&JURISD_POLCSTTN_NM=&LOC_INFO=) 데이터를 우리DB에 삽입하고 삭제하는 과정을 진행했다.
이번엔 그 다음 단계로, Spring 프레임워크를 이용해 MySQL과 연결하고 나아가 네이버지도API에 출력까지 해 보겠다.

<br>

### 사전 준비사항

먼저, MySQL 데이터베이스가 설치되어 있어야 하며, 사용할 데이터베이스와 사용자 계정이 생성되어 있어야 한다.
또한, Spring 프로젝트가 생성되어 있어야 하며, Maven이나 Gradle을 이용해 필요한 의존성을 프로젝트에 추가해야 한다.

나는 Java 프로젝트에서 DB구축까지 완료했기 때문에 생략하도록 하겠다.

### 의존성 추가

Spring 프로젝트에 MySQL과 MyBatis를 연결하기 위한 의존성을 `pom.xml` 에 추가해준다.

```xml
<dependency>  
  <groupId>mysql</groupId>  
  <artifactId>mysql-connector-java</artifactId>  
  <version>8.0.23</version>  
</dependency>  
  
<dependency>  
  <groupId>org.mybatis</groupId>  
  <artifactId>mybatis</artifactId>  
  <version>3.5.6</version>  
</dependency>  
  
<dependency>  
  <groupId>org.mybatis</groupId>  
  <artifactId>mybatis-spring</artifactId>  
  <version>1.3.2</version>  
</dependency>
```

### dataSource 설정

MyBatis와의 연결을 위해`root-context.xml`에 `dataSource`를 설정한다.
데이터베이스의 주소, 사용자 이름, 비밀번호 등을 포함한다.

```xml
<bean id="dataSource" class="org.springframework.jdbc.datasource.DriverManagerDataSource">
    <property name="driverClassName" value="com.mysql.jdbc.Driver" />
    <property name="url" value="jdbc:mysql://localhost/testdb" />
    <property name="username" value="test" />
    <property name="password" value="0000" />
</bean>
```

### SqlSessionFactory 설정

MyBatis와의 연결을 위해`root-context.xml`에 `SqlSessionFactory`를 설정한다.
이는 MyBatis의 연결을 위한 핵심이며 이 설정을 통해 어떻게 DB와 통신할지 결정한다.
설정 파일과 매퍼 파일들을 지정하는 데 사용된다.

```xml
<bean id="sqlSessionFactory" class="org.mybatis.spring.SqlSessionFactoryBean">
    <property name="dataSource" ref="dataSource" />
    <property name="configLocation" value="classpath:mybatis-config.xml" />
    <property name="mapperLocations" value="classpath:mapper/*.xml" />
</bean>
```

### SqlSessionTemplate 설정

`SqlSession`을 직접 사용하지 않고, Spring의 트랜잭션 관리 기능을 활용하기 위해 `SqlSessionTemplate`을 빈으로 등록한다.
이 또한 `root-context.xml`에 등록

```xml
<bean id="sqlSession" class="org.mybatis.spring.SqlSessionTemplate">
    <constructor-arg index="0" ref="sqlSessionFactory" />
</bean>
```

### MyBatis 설정 파일

`mybatis-config.xml` 파일에서는 MyBatis의 세부 설정을 할 수 있다.
예를 들어, 자바 객체의 CamelCase 프로퍼티를 데이터베이스의 snake_case 컬럼과 자동으로 매핑하는 설정을 활성화할 수 있다.


```xml
<configuration>
    <settings>
        <setting name="mapUnderscoreToCamelCase" value="true" />
        <setting name="jdbcTypeForNull" value="NULL" />
    </settings>
</configuration>
```

이제 Spring 프로젝트와 MySQL 데이터베이스가 성공적으로 연결되었으며,
데이터베이스 연동이 필요한 다양한 애플리케이션을 개발할 수 있다.

다음 포스팅에서는 Spring과 DB연결을 바탕으로 네이버지도API를 연결 해 보겠다.
