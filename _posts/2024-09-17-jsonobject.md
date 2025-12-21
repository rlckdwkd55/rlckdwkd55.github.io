---
title: "JSONObject란?"
date: 2024-09-17 14:05:00 +0900
categories: [Data]
tags: [basics, json, api, data]
description: "JSONObject의 개념과 특징"
image:
  path: /assets/img/thumbnails/json.jpg
---

## JSONObject란?

### 정의

- json 형태의 데이터를 관리해 주는 메서드이다.
- 0개 이상의 key/value 쌍으로 {}을 이용하여 담고 있는 객체 구조이다.
- 순서가 구분되지 않은 집합체이다.
  
<br>

### 사용법

JSON 라이브러리를 다운로드하여야 한다.
maven을 사용하고 있다면 pom.xml에 dependencies를 추가해 사용할 수 있다.

\[코드]
```java
JSONObject jsonObject = new JSONObject();
jsonObject.put("이름", "홍길동");
jsonObject.put("국적", "대한민국");

String data = jsonObject.toString();
String key = (String) jsonObject.get("이름");

System.out.println("data : " + data);
System.out.println("key : " + key);
```

\[결과]
```console
data : {"국적":"대한민국","이름":"홍길동"}
key : 홍길동
```

즉, 하나의 키에 하나의 값을 넣은 값을 뜻한다.
key-value 형태의 데이터를 다루기 위해 사용하며, 웹 API 응답이 단일 객체를 반환하는 경우에도 JSONObject를 사용한다.
