---
title: "Steam 게임 데이터 크롤링 프로젝트 (2)"
date: 2025-03-22
categories: [Web]
tags: [crawling, project]
description: "Steam 사이트의 게임 데이터를 수집하기 위한 크롤링 프로젝트"
image:
  path: /assets/img/thumbnails/steam-crawling-project.jpg
---

## Spring과 MySQL 연결하기

지난 포스트에서는 크롤링을 진행하기 전에 어떤 사이트의 데이터를 불러올 것인지, 그리고 DB 구축을 진행했다.
이번에는 그 다음 단계로, Spring 프레임워크를 이용해 MySQL과 연결하고 사용하려는 Dependency를 설정하겠다.

<br>

### 의존성 추가

Spring 프로젝트에 MySQL과 MyBatis를 연결하기 위한 의존성을 `pom.xml`에 추가한다.
크롤링을 진행하려는 페이지가 동적으로 데이터를 로드하는 페이지라서, HTML을 직접 파싱하는 JSoup보다는 웹 페이지의 동적인 요소를 처리할 수 있는 Selenium을 사용했다.

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

<dependency>  
  <groupId>org.seleniumhq.selenium</groupId>  
  <artifactId>selenium-java</artifactId>  
  <version>4.10.0</version>  
</dependency>
```

### dataSource 설정

MyBatis와의 연결을 위해`root-context.xml`에 `dataSource`를 설정한다.  
데이터베이스의 주소, 사용자 이름, 비밀번호 등을 포함한다.
나는 HikariCP를 사용했기에 아래와 같이 설정했다.

```xml
<bean id="dataSource" class="com.zaxxer.hikari.HikariDataSource">  
    <property name="driverClassName" value="com.mysql.cj.jdbc.Driver" />  
    <property name="jdbcUrl" value="jdbc:mysql://localhost/testdb" />  
    <property name="username" value="test" />  
    <property name="password" value="0000" />  
  
    <!-- HikariCP 설정 -->  
    <property name="maximumPoolSize" value="5" />  
    <property name="minimumIdle" value="5" />  
    <property name="connectionTimeout" value="30000" />  
    <property name="idleTimeout" value="600000" />  
    <property name="maxLifetime" value="1800000" />  
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

## MyBatis 설정 파일

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

다음 포스팅에서는 Spring과 DB연결을 바탕으로 크롤링을 진행 해 보겠다.
