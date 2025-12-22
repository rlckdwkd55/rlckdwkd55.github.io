---
title: "Web Server와 WAS"
date: 2025-02-19 10:30:00 +0900
categories: [Web]
tags: [webserver, was]
description: "Web Server와 WAS의 개념, 역할 차이와 분리 이유"
image:
  path: /assets/img/thumbnails/webserver-was.webp
---

## 정의

- WebServer는 정적인 데이터를 처리하며, WAS는 동적인 데이터를 처리한다.
- 둘을 분리해서 사용하면 시스템의 효율성과 안정성을 높일 수 있다.
- 예를 들면, WAS가 느려지거나 실패해도 WebServer를 통해 정적인 페이지를 제공하여 시스템의 가용성을 높일 수 있다.

### WebServer란?

![](/assets/img/posts/web/webserver-was/webserver-structure.png)

- WebServer는 클라이언트의 HTTP 요청을 받아 HTML, CSS, JavaScript, 이미지 등 정적 컨텐츠를 제공하는 서버이다.
- 클라이언트가 요청한 정보를 찾아서 반환하는 역할을 수행한다.
- 하지만, 이 정보가 동적으로 변하거나 사용자의 입력에 따라 달라지는 경우 처리할 수 없다.

예시) Apache, Nginx

<br>

### WAS(Web Application Server)란?

![](/assets/img/posts/web/webserver-was/was-structure.png)

- WAS는 DB 조회, 비즈니스 로직 처리 등 동적인 데이터를 처리하는 역할을 수행한다.
- WAS의 주요 임무는 동적인 요청을 받아 처리해 주는 서버이다.

예시) Java의 Tomcat, JBoss, Python의 Django, PHP의 Laravel

Django와 Laravel은 WAS의 한 종류인 프레임워크로 분류되는데, 이들은 웹 애플리케이션 개발을 보다 편리하게 돕는 도구를 제공하며, 내장된 서버 기능을 통해 독립적인 WAS로서도 동작할 수 있지만, 대규모 프로덕션 환경에서는 일반적으로 별도의 WAS와 함께 사용된다.

<br>

## 차이점

### WebServer

- WebServer는 정적인 데이터를 처리하는 서버이며, 이미지나 단순 html 같은 정적인 리소스들을 전달한다.
- WAS만 이용할 경우보다 빠르고 안정적으로 기능을 수행할 수 있다.

### WAS

- WAS는 동적인 데이터를 위주로 처리하는 서버이며, DB와 연결되어 사용자와 데이터를 주고받고 조작이 필요할 경우 WAS를 활용한다.

![](/assets/img/posts/web/webserver-was/was-architecture.webp)

WAS는 WebServer와 WebContainer의 역할을 모두 할 수 있지만 분리해야 한다.

1. 서버 부하 방지

WAS와 웹 서버는 분리하여 서버의 부하를 방지해야 한다. WAS는 DB 조회나 다양한 로직을 처리하고, 단순한 정적 컨텐츠는 웹 서버에서 처리해줘야 한다. 만약 정적 컨텐츠까지 WAS가 처리한다면 부하가 커지게 되고, 수행 속도가 느려질 것이다. 

2. 보안 강화

SSL에 대한 암호화, 복호화 처리에 웹 서버를 사용 가능

3. 여러 대의 WAS 연결 가능

로드 밸런싱을 위해 웹 서버를 사용할 수 있다. 여러 개의 서버를 사용하는 대용량 웹 어플리케이션의 경우 웹 서버와 WAS를 분리하여 무중단 운영을 위한 장애 극복에 쉽게 대응할 수 있다. 

4. 여러 웹 어플리케이션 서비스 가능

하나의 서버에서 PHP, JAVA 애플리케이션을 함께 사용할 수 있다. 
<br>

## Web Service Architecture

![](/assets/img/posts/web/webserver-was/webserver-architecture.webp)

웹 서비스는 아래와 같이 다양한 구조를 가질 수 있다.

1. Client -> 웹 서버 - > DB

2. Client -> WAS -> DB

3. Client -> 웹 서버 -> WAS -> DB

클라이언트가 웹 서버에 HTTP 요청을 보내면 웹 서버는 정적인 컨텐츠 요청은 바로 응답하고, 동적인 컨텐츠 요청은 WAS에게 넘겨서 처리하고 결과를 WAS에게 받아서 클라이언트에게 넘겨준다.


<br><br><br><br><br><br><br><br><br><br>
참고 : https://code-lab1.tistory.com/199
