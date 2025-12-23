---
title: "Flask vs FastAPI"
date: 2025-06-10
categories: [Python]
tags: [flask, fastapi, python, web-framework]
description: "Flask와 FastAPI의 역할 차이와 선택 기준"
image:
  path: /assets/img/thumbnails/flask-vs-fastapi.png
---

## Flask vs FastAPI

### 역할과 선택 기준

Flask와 FastAPI는 모두 Python 기반의 웹 프레임워크이지만,  
**지향하는 역할과 사용 목적은 명확히 다르다.**

두 프레임워크는 경쟁 관계라기보다는  
**서로 다른 문제를 해결하기 위해 등장한 도구**에 가깝다.

---

### 두 프레임워크의 공통점

먼저 Flask와 FastAPI는 다음과 같은 공통점을 가진다.

- Python 기반의 웹 프레임워크
- 코드가 간결하고 비교적 이해하기 쉬움
- REST API 서버 구현 가능
- 마이크로 프레임워크 철학(필수 요소만 제공)

즉, 두 프레임워크는 비슷한 범주에 속하지만  
**확장 방향은 서로 다르다.**

---

### 두 프레임워크의 핵심 역할 차이

#### Flask의 역할

Flask는 **범용 웹 프레임워크**이다.

- 웹 애플리케이션 전반을 구성할 수 있다.
- HTML 템플릿 렌더링, 세션 관리, 폼 처리에 적합하다.
- API 서버 구현도 가능하지만, 목적이 API에만 한정되지는 않는다.

즉, Flask는

> **웹 애플리케이션 전체를 유연하게 구성하고 싶을 때**

선택되는 프레임워크이다.

---

#### FastAPI의 역할

FastAPI는 **API 서버 구축에 특화된 웹 프레임워크**이다.

- REST API 설계를 주 목적으로 한다.
- JSON 기반 통신을 전제로 한다.
- 비동기 처리와 자동 API 문서화를 기본 제공한다.

즉, FastAPI는

> **API 서버를 빠르고 명확하게 만들고 싶을 때**

선택되는 프레임워크이다.

---

### WSGI와 ASGI란?

Flask와 FastAPI의 가장 큰 기술적 차이는  
**WSGI와 ASGI라는 애플리케이션 인터페이스 규격의 차이**에서 시작된다.

WSGI와 ASGI는 모두  
**웹 서버와 Python 웹 애플리케이션 사이의 표준 인터페이스**를 정의한다.

---

#### WSGI (Web Server Gateway Interface)

WSGI는 Python 웹 애플리케이션을 위한  
**전통적인 인터페이스 규격**이다.

- 동기(Synchronous) 처리 모델 기반
- 요청 하나를 처리하는 동안 해당 워커는 다른 요청을 처리하지 못함
- Flask, Django와 같은 전통적인 프레임워크에서 사용

Flask 애플리케이션은 일반적으로  
Gunicorn, uWSGI와 같은 **WSGI 서버** 위에서 실행된다.

```
Client
  ↓
WSGI Server (Gunicorn, uWSGI)
  ↓
Flask Application
```

WSGI는 요청 단위로 워커를 점유하기 때문에 I/O 바운드 작업이 많은 환경에서는 비효율적일 수 있다.

---

#### ASGI (Asynchronous Server Gateway Interface)

ASGI는 WSGI의 한계를 보완하기 위해 등장한  
**비동기 인터페이스 규격**이다.

- 비동기(Asynchronous) 처리 모델 지원
- 하나의 프로세스에서 여러 요청을 동시에 처리 가능
- WebSocket, Server-Sent Events 같은 실시간 통신 지원

FastAPI는 ASGI를 기반으로 설계된 프레임워크이다.

```
Client
  ↓
ASGI Server (Uvicorn, Hypercorn)
  ↓
FastAPI Application
```

ASGI는 구조적으로  
**동시 요청 처리와 I/O 작업이 많은 서비스에 유리하다.**

---

#### 정리

- Flask는 **WSGI 기반의 범용 웹 프레임워크**
- FastAPI는 **ASGI 기반의 API 중심 웹 프레임워크**

참고로 Flask 역시 비동기 형태로 실행할 수는 있지만,
프레임워크의 기본 설계는 여전히 WSGI 중심이다.

반면 FastAPI는 ASGI를 전제로 설계된  
대표적인 ASGI 네이티브 프레임워크이다.

두 프레임워크의 차이는 기능의 많고 적음이 아니라,  
**역할과 실행 모델의 차이**에서 비롯된다.

즉, 웹 애플리케이션 중심이냐, API 중심이냐의 선택 문제다.
<br><br><br><br><br><br><br><br><br><br>
참고: https://jerrykim91.tistory.com/62<br>
참고: https://deokkku.tistory.com/15
