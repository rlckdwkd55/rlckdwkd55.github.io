---
title: "Spring Security 기본 구조"
date: 2025-05-22
categories: [Spring]
tags: [spring-security, authentication, authorization]
description: "Spring Security의 인증·인가 개념과 Filter Chain"
image:
  path: /assets/img/thumbnails/spring-security.png
---

#### **보안관련 용어**

>- 접근 주체(Principal) : 보호된 대상에 접근하는 유저
>- 인증(Authenticate) : 현재 유저가 누구인지 확인(ex. 로그인)
   >   - 애플리케이션의 작업을 수행할 수 있는 주체임을 증명
>- 인가(Authorize) : 현재 유저가 어떤 서비스, 페이지에 접근할 수 있는 권한이 있는지 검사
>- 권한 : 인증된 주체가 애플리케이션의 동작을 수행할 수 있도록 허락되있는지를 결정
   >   - 권한 승인이 필요한 부분으로 접근하려면 인증 과정을 통해 주체가 증명 되어야만 한다
>   - 권한 부여에도 두가지 영역이 존재하는데 웹 요청 권한, 메소드 호출 및 도메인 인스턴스에 대한 접근 권한 부여

## Spring Security란?

- Spring Security는 스프링 기반의 애플리케이션의 보안(인증과 권한, 인가 등)을 담당하는 스프링 하위 프레임워크다.
- Spring Security는 필터(Filter) 기반으로 동작하기 때문에 스프링 MVC와 분리되어 관리 및 동작한다.
- 애플리케이션의 보안을 위한 강력하고 매우 유연한 솔루션을 제공한다.

**필터(Filter)** 는 Dispatcher Servlet으로 가기 전에 적용되므로 가장 먼저 URL 요청을 받지만, Interceptor는 Dispatcher와 Controller사이에 위치한다.

> Client(request) -> Filter -> DispatcherServlet -> Interceptor -> Controller
> (실제로 Interceptor가 Controller로 요청을 위임하는 것이 아니라 Interceptor를 거쳐서 가는 것)

**※Dispatcher Servlet: HTTP 프로토콜로 들어오는 모든 요청을 가장 먼저 받아 적합한 컨트롤러에 위임해주는 프론트 컨트롤러(Front Controller)**

![](/assets/img/posts/java/spring/spring-security/filter-vs-interceptor.png)

**Spring-Security 3.2**부터는 XML로 설정하지 않고 **Java config 설정**으로 간단하게 설정할 수 있다.

<br>

## Spring Security Filter

![](/assets/img/posts/java/spring/spring-security/spring-security-filter.png)

- 위에서 대략 말 했듯 스프링 시큐리티의 핵심 컴포넌트 중 하나는 필터(Filter)이다.
- 필터는 일련의 서블릿 필터로 구성되며, 인증 및 권한 부여와 같은 보안 관련 작업을 수행하는 데 사용된다.
- Spring MVC에서는 요청을 가장 먼저 받는 것이 DispatcherServlet이며, 이 DispatcherServlet이 요청을 받기 전 다양한 필터가 있을 수 있다.

즉, 클라이언트와 자원 사이에서 요청과 응답 정보를 이용해 다양한 처리를 하는데 목적이 있다.

### Spring Security Filter Chain

![](/assets/img/posts/java/spring/spring-security/spring-security-filter-chain.jpg)

- Spring Security Filter Chain은 여러 개의 필터로 구성되어 있으며, 각 필터는 특정한 보안 작업을 담당한다.
- Filter Chain은 **보통 HTTP 요청이 들어올 때 동작**하며, 각각의 필터는 순차적으로 실행된다.

#### Spring Security Filter Chain 주요 필터

1. **SecurityContextPersistenceFilter**: SecurityContext 정보를 HTTP Session에 저장하고 복원한다.

2. **LogoutFilter**: 로그아웃 요청을 처리한다.

3. **UsernamePasswordAuthenticationFilter**: 폼 로그인을 처리한다.

4. **DefaultLoginPageGeneratingFilter**: 로그인 페이지를 자동으로 생성한다.

5. **BasicAuthenticationFilter**: HTTP Basic 인증을 처리한다.

6. **RequestCacheAwareFilter**: 리다이렉트 전의 요청을 임시 저장하고 복원한다.

7. **SecurityContextHolderAwareRequestFilter**: SecurityContext와 관련된 정보를 요청 객체에 추가한다.

8. **AnonymousAuthenticationFilter**: 인증되지 않은 사용자를 위한 기본 인증을 처리한다.

9. **SessionManagementFilter**: 세션 관리를 처리힌다.

10. **ExceptionTranslationFilter**: 보안 관련 예외를 처리한다.

11. **FilterSecurityInterceptor**: 접근 제어 결정을 위한 인터셉터 필터이다.
    
<br>

필터 체인은 가장 일반적인 경우부터 가장 구체적인 경우 순으로 정의되어야 한다.
그래야만 가장 적절한 필터가 적용될 수 있다.

필터 체인과 각 필터는 스프링 시큐리티 설정을 통해 커스터마이징할 수 있고, 이를 통해 애플리케이션의 특정 요구 사항에 맞게 보안을 구성할 수 있다.

<br>

## Spring Security Architecture

다음으로 Spring Security의 인증 처리 과정이다.

![](/assets/img/posts/java/spring/spring-security/spring-security-architecture.png)

1. **HTTP 요청**:
  - 사용자가 자신의 자격 증명 (일반적으로 사용자 이름과 비밀번호)을 사용하여 로그인을 시도하면 HTTP 요청이 생성된다.

2. **AuthenticationFilter**:
  - 스프링 시큐리티는 여러 인증 필터 중 적절한 필터를 선택하여 HTTP 요청을 처리한다.
  - 가장 흔히 사용되는 필터는 `UsernamePasswordAuthenticationFilter`다.
  - 이 필터는 HTTP 요청에서 사용자 이름과 비밀번호를 가져와 `UsernamePasswordAuthenticationToken`을 생성한다.
  - 이 토큰은 인증 요청을 나타내며, 아직 인증되지 않은 상태이다.

3. **AuthenticationManager**:
  - 생성된 `UsernamePasswordAuthenticationToken`은 `AuthenticationManager`에게 전달되며, 인증을 처리하는 역할을 수행한다.
  - 스프링 시큐리티에서는 일반적으로 `ProviderManager`를 사용하는데, 이는 여러 `AuthenticationProvider`를 관리하며 인증 요청을 적절한 `AuthenticationProvider`에게 위임한다.

4. **AuthenticationProvider**:
  - `AuthenticationProvider`는 실제 인증 작업을 수행한다.
  - `AuthenticationProvider`는 `UserDetailsService`를 사용하여 사용자의 세부 정보를 DB나 LDAP 등에서 불러옵니다.

5. **UserDetailsService**: `
  - UserDetailsService`는 사용자 이름을 인자로 받아 `UserDetails` 객체를 반환한다.
  - `UserDetails` 객체는 사용자의 이름, 암호, 권한 등의 정보를 포함하고 있다.

6. **AuthenticationProvider**:
  - `UserDetailsService`가 반환한 `UserDetails`를 받은 `AuthenticationProvider`는 이 정보를 사용하여 인증을 수행한다.
  - 사용자가 입력한 비밀번호와 `UserDetails`에 저장된 비밀번호를 비교, 일치하면 인증이 성공한 것이다.

7. **AuthenticationManager**:
  -  `AuthenticationProvider`가 인증에 성공하면, `AuthenticationProvider`는 새로운 `UsernamePasswordAuthenticationToken`을 생성하고 이를 `AuthenticationManager`에게 반환한다.
  - 이 새로운 토큰은 인증된 사용자의 정보와 권한 정보를 담고 있으며, 인증이 성공했음을 나타낸다.

8. **AuthenticationFilter**:
  - `AuthenticationManager`는 인증된 `UsernamePasswordAuthenticationToken`를 다시 `AuthenticationFilter`에게 반환한다.
  - `AuthenticationFilter`는 이 토큰을 `SecurityContextHolder`에 저장, 인증 과정이 완료된다.

9. **SecurityContextHolder**:
  - `SecurityContextHolder`는 보안 컨텍스트를 저장하는 데 사용된다.
  - 이 컨텍스트는 인증된 사용자의 정보를 담고 있으며, 애플리케이션의 어디에서든 접근할 수 있다.
  - 이후의 요청에서는 `SecurityContextHolder`를 통해 사용자의 인증 정보를 확인하고 언제든지 참조, 사용할 수 있다.
    <br><br><br><br><br><br><br><br><br><br>
    참고 : https://hello-judy-world.tistory.com/216<br>
    참고 : https://www.boostcourse.org/web326/lecture/58997?isDesc=false<br>
    참고 : https://nahwasa.com/entry/%EC%8A%A4%ED%94%84%EB%A7%81%EB%B6%80%ED%8A%B8-Spring-Security-%EA%B8%B0%EB%B3%B8-%EC%84%B8%ED%8C%85-%EC%8A%A4%ED%94%84%EB%A7%81-%EC%8B%9C%ED%81%90%EB%A6%AC%ED%8B%B0
