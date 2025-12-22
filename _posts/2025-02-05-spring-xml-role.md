---
title: "Spring 각 xml별 역할"
date: 2025-02-05 10:30:00 +0900
categories: [Spring]
tags: [spring, java]
description: "Spring Legacy Project에서 xml의 역할"
image:
  path: /assets/img/thumbnails/spring.jpg
---

Spring Legacy Project를 생성하면 스프링의 기본 설정파일이 생성된다.
root-context.xml, servlet-context.xml, web.xml이 그렇다.

이렇게 세 가지의 설정 파일을 통해 Spring Legacy Project를 구성하고, 각각의 역할을 적절히 정리하는 것은 Spring을 더 깊게 이해하고 웹 개발을 진행하는 데 도움이 될 것이라 생각 해 각 xml별 역할을 정리하려 한다.

## root-context.xml

```xml
<!-- 데이터베이스 연결 설정 -->
<bean id="dataSource" class="org.apache.commons.dbcp.BasicDataSource">
    <property name="driverClassName" value="com.mysql.jdbc.Driver" />
    <property name="url" value="jdbc:mysql://localhost:3306/testdb" />
    <property name="username" value="name" />
    <property name="password" value="pw" />
</bean>

<!-- 서비스 빈 등록 -->
<context:component-scan base-package="com.example.service" />
```

- 역할: 애플리케이션의 전반적인 설정을 담당한다.
- 주요 내용:
  - 데이터베이스 연결 설정: 데이터베이스와의 연결 정보를 설정하고 데이터베이스 관련 빈을 정의.
  - 트랜잭션 관리 설정: 트랜잭션 처리를 위한 설정을 정의.
  - 서비스 빈 등록: 애플리케이션 전역에서 공유되는 서비스 빈들을 정의.
  - 보안 설정: 인증, 권한 부여 등의 보안 관련 설정을 정의.

<br>

## servlet-context.xml

```xml
<!-- 컨트롤러 설정 -->
<context:component-scan base-package="com.example.controller" />

<!-- 뷰 리졸버 설정 -->
<bean id="viewResolver" class="org.springframework.web.servlet.view.InternalResourceViewResolver">
    <property name="prefix" value="/WEB-INF/views/" />
    <property name="suffix" value=".jsp" />
</bean>
```

- 역할: 웹 애플리케이션과 관련된 설정을 담당한다.
- 주요 내용:
  - 컨트롤러 설정: **\<bean>** 요소를 사용하여 웹 요청을 처리하는 컨트롤러를 등록합니다. **@Controller** 어노테이션을 사용하여 컨트롤러 클래스를 정의.
  - 뷰 리졸버 설정: **\<bean>** 요소를 사용하여 뷰 리졸버를 등록합니다. 컨트롤러에서 반환된 뷰 이름을 실제 뷰 객체로 변환하여 클라이언트에게 응답.
  - 리소스 핸들러 설정: **\<mvc:resources>** 요소를 사용하여 정적 리소스(이미지, CSS 파일 등)의 요청을 처리.
  - 폼 처리 설정: **\<form:...>** 네임스페이스를 사용하여 폼 데이터 바인딩, 검증, 처리를 위한 설정을 정의.
  - 인터셉터 설정: **\<mvc:interceptors>** 요소를 사용하여 요청 전후에 실행되는 인터셉터를 정의하여 공통 로직을 처리.

<br>

## web.xml

```xml
<!-- 서블릿 매핑 -->
<servlet>
    <servlet-name>dispatcher</servlet-name>
    <servlet-class>org.springframework.web.servlet.DispatcherServlet</servlet-class>
    <init-param>
        <param-name>contextConfigLocation</param-name>
        <param-value>/WEB-INF/spring/appServlet/servlet-context.xml</param-value>
    </init-param>
    <load-on-startup>1</load-on-startup>
</servlet>

<servlet-mapping>
    <servlet-name>dispatcher</servlet-name>
    <url-pattern>/</url-pattern>
</servlet-mapping>
```

- 역할: 웹 애플리케이션의 배포 서술자로, 웹 애플리케이션의 설정과 동작을 제어한다.
- 주요 내용:
  - 서블릿 매핑: **\<servlet-mapping>** 요소를 사용하여 웹 요청을 처리하기 위한 서블릿과 URL 매핑을 설정합니다. 대부분의 Spring MVC 프로젝트에서는 **\DispatcherServlet**을 사용하여 웹 요청을 처리.
  - 필터 설정: **\<filter>** 와 **\<filter-mapping>** 요소를 사용하여 웹 요청에 대한 전처리나 후처리 작업을 처리하는 필터를 설정합니다. 예를 들어, 인코딩 필터를 등록하여 요청 데이터의 인코딩을 처리할 수 있다.
  - 리스너 설정: **\<listener>** 요소를 사용하여 웹 애플리케이션의 생명주기 이벤트에 대한 리스너를 설정합니다. 예를 들어, 애플리케이션 시작 또는 종료 시 특정 작업을 수행하는 리스너를 등록할 수 있다.
  - 에러 페이지 설정: **\<error-page>** 요소를 사용하여 예외 발생 시 처리할 에러 페이지를 설정합니다. 예를 들어, 404 에러 페이지를 설정하여 존재하지 않는 URL에 대한 요청을 처리할 수 있다.
  - 세션 설정: **\<session-config>** 요소를 사용하여 세션 관리와 관련된 설정을 정의합니다. 예를 들어, 세션 타임아웃 시간을 설정할 수 있다.
