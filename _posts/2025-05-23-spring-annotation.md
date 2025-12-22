---
title: "Spring Annotation 정리"
date: 2025-05-23
categories: [Spring]
tags: [spring, spring-annotation]
description: "Spring에서 사용하는 주요 Annotation의 역할과 사용 목적 정리"
image:
  path: /assets/img/thumbnails/spring-logo.png
---

## Annotation이란?

### 정의

Annotation은 Java5부터 새롭게 추가된 문법요소이다.

어노테이션(Annotation)이라는 용어는 원래 '주석'이라는 뜻이며, 자바 코드에 @를 이용해 주석처럼 달아 특수한 의미를 부여해 준다.

컴퓨터 과학에서는 어노테이션이 프로그래밍 언어의 일부로서, 코드의 특정 부분에 메타데이터를 추가하는 데 사용되며, 컴파일러 또는 실행 시간에 코드를 어떻게 처리할지 결정하는 데 도움을 준다.

예를 들어, 자바에서는 @Override와 같은 어노테이션을 사용해 특정 메소드가 상위 클래스의 메소드를 재정의한다는 것을 명시한다.

> **메타 데이터?**  
> 데이터에 대한 데이터 , ‘어떤 목적을 가지고 만들어진 데이터’ 라고도 정의

<br>

### 역할

1. **클래스와 메서드에 추가하여 다양한 기능을 부여:**
- 어노테이션을 사용하면 개발자는 클래스나 메서드에 추가적인 정보를 제공할 수 있다.
- 예를 들어, Spring 프레임워크에서 `@Controller`, `@Service`, `@Repository` 등의 어노테이션을 통해 해당 클래스의 역할을 명확히 할 수 있다.
- 또한 `@Autowired` 어노테이션을 통해 의존성 주입을 자동으로 처리하거나, `@Getter`/`@Setter` 어노테이션을 통해 getter, setter 메서드를 자동으로 생성할 수 있다.

2. **컴파일러에게 코드 작성 문법 에러를 체크하도록 정보를 제공:**
- 어노테이션은 컴파일러에게 코드의 문법적인 에러를 체크하도록 돕는다.
- 예를 들어, `@Override` 어노테이션은 메서드가 상위 클래스의 메서드를 올바르게 재정의하였는지 컴파일러에게 확인하게 한다.

3. **소프트웨어 개발 툴이 빌드나 배치시 코드를 자동으로 생성할 수 있도록 정보를 제공:**
- 어노테이션은 빌드 도구나 IDE와 같은 소프트웨어 개발 툴이 코드를 자동 생성하는데 도움을 준다.
- 예를 들어, Lombok 라이브러리의 `@Data` 어노테이션을 사용하면 getter, setter, toString, equals 등의 메서드를 자동으로 생성할 수 있다.

4. **실행시(런타임시) 특정 기능을 실행하도록 정보를 제공:**
- 어노테이션은 런타임에 특정 동작을 수행하도록 정보를 제공한다.
- 예를 들어, JUnit에서 `@Test` 어노테이션은 해당 메서드가 테스트를 수행하는 메서드임을 알려준다.
  <br>

### 효과

1. **코드량 감소:**
- 어노테이션을 사용하면 반복적인 코드 작성을 줄일 수 있다.
- 예를 들어, getter, setter 메서드를 자동으로 생성하는 Lombok의 `@Data` 어노테이션을 사용하면 수많은 줄의 코드를 간결하게 줄일 수 있다.

2. **유지보수 용이:**
- 어노테이션을 통해 코드의 역할을 명확히 알 수 있으므로, 코드의 유지보수가 쉬워진다.
- 또한, 코드의 변경 사항이 발생하더라도 해당 어노테이션의 동작을 변경하면 되므로 유지보수 과정이 간편해진다.

3. **생산성 증가:**
- 어노테이션을 사용하면 개발자는 복잡한 설정이나 반복적인 코드 작성을 줄이고, 핵심 비즈니스 로직에 집중할 수 있다.
- 이는 개발 과정의 생산성을 크게 향상시킨다.
  <br>

## 주요 Annotation

주요 Annotaion은 아래 표와 같다.

| Spring Annotation | 설명 |
| ---- | ---- |
| @SpringBootApplication | @Configuration, @EnableAutoConfiguration, @ComponentScan 세 가지 어노테이션을 모아놓은 것으로, 스프링 부트의 주요 어노테이션이다. |
| @Configuration | 스프링 설정 클래스를 선언하는 데 사용되는 어노테이션이다. |
| @Bean | @Configuration 어노테이션과 함께 사용되며, 메소드가 생성한 객체를 Spring 컨테이너가 관리하도록 하는 데 사용되는 어노테이션이다. |
| @Component | Spring에서 빈(Bean)으로 관리할 클래스를 정의하는 데 사용된다. |
| @Autowired | Spring에서 의존성 주입을 위해 사용되는 어노테이션이다.<br>의존성 주입 대상이 되는 필드, 생성자, 메소드에 사용된다. |
| @Qualifier | 같은 타입의 여러 빈이 존재할 경우, 어떤 빈을 주입해야 하는지 명시하는 데 사용되는 어노테이션이다.<br>Autowired와 함께 사용된다. |
| @Value | 프로퍼티 값을 주입받기 위해 사용하는 어노테이션이다. |
| @Controller | @Component와 동일하게 동작하지만, 웹 요청을 처리하는 컨트롤러 계층(Controller Layer)을 나타내기 위해 사용된다. |
| @RestController | @Controller와 @ResponseBody가 합쳐진 어노테이션으로, RESTful 웹 서비스를 만드는 데 사용된다. |
| @ResponseBody | 메소드의 반환값을 HTTP 응답 본문(Response Body)으로 사용하게 한다. |
| @Service | @Component와 동일하게 동작하지만, 서비스 계층(Service Layer)을 나타내기 위해 사용된다. |
| @Repository | @Component와 동일하게 동작하지만, 데이터 액세스 계층(Data Access Layer)을 나타내기 위해 사용된다. |
| @RequestMapping | 요청 URL을 어떤 메소드가 처리할지 매핑하기 위해 사용되는 어노테이션이다. |
| @GetMapping | @RequestMapping의 한 종류로, HTTP GET 요청을 처리하는 메소드를 매핑하는 데 사용된다. |
| @PostMapping | @RequestMapping의 한 종류로, HTTP POST 요청을 처리하는 메소드를 매핑하는 데 사용된다. |
| @PutMapping | @RequestMapping의 한 종류로, HTTP PUT 요청을 처리하는 메소드를 매핑하는 데 사용된다. |
| @DeleteMapping | @RequestMapping의 한 종류로, HTTP DELETE 요청을 처리하는 메소드를 매핑하는 데 사용된다. |
| @PatchMapping | @RequestMapping의 한 종류로, HTTP PATCH 요청을 처리하는 메소드를 매핑하는 데 사용된다. |
| @PathVariable | URL 경로에 있는 변수를 메소드 매개변수로 사용하게 한다. |
| @RequestParam | 요청 파라미터를 메소드 매개변수로 사용하게 한다. |
| @Profile | 특정 프로파일에서만 유효한 빈을 정의할 때 사용되는 어노테이션이다. |

<br>

### @SpringBootApplication

- @SpringBootAppliation은 @Configuration, @EnableAutoConfiguration, @ComponentScan 세 가지 어노테이션을 모아놓은 것으로, 스프링 부트의 주요 어노테이션이다.
- 이 어노테이션 하나로 스프링 부트의 주요 기능들을 활성화할 수 있다.

```java
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

### @Configuration, @Bean

- @Configuration 어노테이션은 클래스 위에 위치하며, 해당 클래스를 스프링 설정 클래스로 선언한다.
- 이 클래스에서는 @Bean 어노테이션을 이용하여 스프링 빈을 정의하고, 이 빈들을 스프링 컨테이너가 관리하도록 할 수 있다.

- @Bean 어노테이션은 @Configuration 어노테이션과 함께 사용되며, 메소드가 생성한 객체를 Spring 컨테이너가 관리하도록 한다.
- @Bean 어노테이션이 붙은 메소드가 반환하는 객체는 스프링 빈이 되어 스프링 컨테이너에 의해 관리된다.

```java
@Configuration
public class AppConfig {
    @Bean
    public MyBean myBean() {
        return new MyBean();
    }
}
```

### @Component

- @Component 어노테이션은 클래스 위에 위치하며, 해당 클래스를 스프링 빈으로 선언한다.
- @Component 어노테이션이 붙은 클래스는 스프링 컨테이너에 의해 인스턴스화되고, 관리된다.

```java
@Component
public class MyComponent {
    // ...
}
```

### @Autowired

- @Autowired 어노테이션은 스프링의 의존성 주입 기능을 위해 사용된다.
- 의존성 주입이 필요한 곳에 이 어노테이션을 붙이면 스프링 컨테이너는 해당 타입의 빈을 찾아 주입해준다.

```java
@Component
public class MyComponent {
    private final MyBean myBean;

    @Autowired
    public MyComponent(MyBean myBean) {
        this.myBean = myBean;
    }
    // ...
}
```

#### 필드 주입

- 필드 주입은 스프링 어플리케이션에서 가장 간단하게 의존성을 주입할 수 있는 방법이다.
- 단, 필드 주입은 추후에 변경이 어렵고, 테스트가 어려운 단점이 있어서 권장되지 않는다.

```java
@Component
public class MyComponent {
    @Autowired
    private MyBean myBean;
    
    // ...
}
```

#### 생성자 주입

- **생성자 주입은 의존성 주입 방법 중 가장 권장되는 방법**이다.
- 생성자 주입은 불변성을 보장하며, 필요한 의존성이 누락되지 않도록 한다.
- 스프링 4.3부터는 생성자가 하나만 있는 경우 `@Autowired` 어노테이션을 생략할 수 있다.

```java
@Component
public class MyComponent {
    private final MyBean myBean;

    @Autowired
    public MyComponent(MyBean myBean) {
        this.myBean = myBean;
    }
    
    // ...
}
```

#### 수정자(setter) 주입

- 수정자(setter) 주입은 선택적인 의존성을 주입할 때 유용하다.
- `@Autowired` 어노테이션과 함께 setter 메소드를 사용하여 구현된다.

```java
@Component
public class MyComponent {
    private MyBean myBean;

    @Autowired
    public void setMyBean(MyBean myBean) {
        this.myBean = myBean;
    }
    
    // ...
}
```

### @Qualifier

- @Qualifier 어노테이션은 같은 타입의 여러 빈이 존재할 경우, 어떤 빈을 주입해야 하는지 명시하며, @Autowired와 함께 사용된다.

```java
@Component
public class MyComponent {
    private final MyBean myBean;

    @Autowired
    public MyComponent(@Qualifier("myBean1") MyBean myBean) {
        this.myBean = myBean;
    }
    // ...
}
```

### @Value

- @Value 어노테이션은 프로퍼티 값을 주입받기 위해 사용한다.
- 이 어노테이션을 통해 외부 설정 파일의 값을 주입받을 수 있다.

```java
@Component
public class MyComponent {
    @Value("${my.property}")
    private String myProperty;

    // ...
}
```

### @Controller

- @Controller 어노테이션은 @Component와 동일하게 동작하지만, 웹 요청을 처리하는 컨트롤러 계층(Controller Layer)을 나타내기 위해 사용된다.

**주로 View를 반환하기 위해 사용**

```java
@Controller
public class MyController {
    @RequestMapping("/")
    public String index() {
        return "index";
    }
}
```

### @RestController

- @RestController 어노테이션은 @Controller와 @ResponseBody가 합쳐진 어노테이션으로, RESTful 웹 서비스를 만드는 데 사용된다.
- 이 어노테이션을 사용하면 메소드의 반환값이 HTTP 응답 본문(Response Body)으로 사용된다.

**Json 형태로 객체 데이터를 반환하기 위해 사용**

```java
@RestController
public class MyRestController {
    @RequestMapping("/")
    public String index() {
        return "Hello, World!";
    }
}
```

### @ResponseBody

@ResponseBody 어노테이션은 메소드의 반환값을 HTTP 응답 본문(Response Body)으로 사용하게 한다.
이 어노테이션을 사용하면 웹 클라이언트에게 직접 응답을 보낼 수 있다.

```java
@Controller
public class MyController {
    @ResponseBody
    @RequestMapping("/hello")
    public String hello() {
        return "Hello, World!";
    }
}
```

### @Service

- @Service 어노테이션은 @Component와 동일하게 동작하지만, 서비스 계층(Service Layer)을 나타내기 위해 사용된다.
- 이 어노테이션을 사용하면 비즈니스 로직을 처리하는 서비스 클래스를 정의할 수 있다.

```java
@Service
public class MyService {
    // ...
}
```

### @Repository

- @Repository 어노테이션은 @Component와 동일하게 동작하지만, 데이터 액세스 계층(Data Access Layer)을 나타내기 위해 사용된다.
- 이 어노테이션을 사용하면 데이터베이스 연동을 처리하는 DAO 클래스를 정의할 수 있다.

```java
@Repository
public class MyRepository {
    // ...
}
```

### @RequestMapping

- @RequestMapping 어노테이션은 요청 URL을 어떤 메소드가 처리할지 매핑하기 위해 사용된다.
- 이 어노테이션을 사용하면 특정 URL에 대한 요청을 처리하는 메소드를 정의할 수 있다.

```java
@Controller
public class MyController {
    @RequestMapping("/hello")
    public String hello() {
        return "Hello, World!";
    }
}
```

### @GetMapping

- @GetMapping 어노테이션은 @RequestMapping의 한 종류로, HTTP GET 요청을 처리하는 메소드를 매핑하는 데 사용된다.

```java
@RestController
public class MyRestController {
    @GetMapping("/hello")
    public String hello() {
        return "Hello, World!";
    }
}
```

### @PostMapping

- @PostMapping 어노테이션은 @RequestMapping의 한 종류로, HTTP POST 요청을 처리하는 메소드를 매핑하는 데 사용된다.

```java
@RestController
public class MyRestController {
    @PostMapping("/users")
    public User addUser(User user) {
        // 사용자 추가 로직
        return user;
    }
}
```

### @PutMapping

- @PutMapping 어노테이션은 @RequestMapping의 한 종류로, HTTP PUT 요청을 처리하는 메소드를 매핑하는 데 사용된다.

```java
@RestController
public class MyRestController {
    @PutMapping("/users/{id}")
    public User updateUser(@PathVariable Long id, User user) {
        // 사용자 업데이트 로직
        return user;
    }
}
```

### @DeleteMapping

- @DeleteMapping 어노테이션은 @RequestMapping의 한 종류로, HTTP DELETE 요청을 처리하는 메소드를 매핑하는 데 사용된다.

```java
@RestController
public class MyRestController {
    @DeleteMapping("/users/{id}")
    public String deleteUser(@PathVariable Long id) {
        // 사용자 삭제 로직
        return "User is deleted.";
    }
}
```

### @PatchMapping

- @PatchMapping 어노테이션은 @RequestMapping의 한 종류로, HTTP PATCH 요청을 처리하는 메소드를 매핑하는 데 사용된다.

```java
@RestController
public class MyRestController {
    @PatchMapping("/users/{id}")
    public User updateUser(@PathVariable Long id, User user) {
        // 사용자 부분 업데이트 로직
        return user;
    }
}
```

### @PathVariable

- @PathVariable 어노테이션은 URL 경로에 있는 변수를 메소드 매개변수로 사용하게 한다.
- 이 어노테이션을 사용하면 동적인 URL 경로를 처리할 수 있다.

```java
@RestController
public class MyRestController {
    @GetMapping("/users/{id}")
    public User getUser(@PathVariable Long id) {
        // 사용자 조회 로직
    }
}
```

### @RequestParam

- @RequestParam 어노테이션은 요청 파라미터를 메소드 매개변수로 사용하게 한다.
- 이 어노테이션을 사용하면 웹 클라이언트가 보낸 요청 파라미터를 쉽게 처리할 수 있다.

```java
@RestController
public class MyRestController {
    @GetMapping("/search")
    public List<User> searchUsers(@RequestParam String keyword) {
        // 사용자 검색 로직
    }
}
```

### @Profile

- @Profile 어노테이션은 특정 프로파일에서만 유효한 빈을 정의할 때 사용되는 어노테이션이다.
- 이 어노테이션을 사용하면 환경에 따라 다른 빈을 사용하도록 설정할 수 있다.

```java
@Configuration
public class AppConfig {
    @Bean
    @Profile("dev")
    public MyBean devMyBean() {
        return new DevMyBean();
    }

    @Bean
    @Profile("prod")
    public MyBean prodMyBean() {
        return new ProdMyBean();
    }
}
```
<br><br><br><br><br><br><br><br><br><br>
참고: https://seungh1024.tistory.com/47<br>
참고: https://mangkyu.tistory.com/49
