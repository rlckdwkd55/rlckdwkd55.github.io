---
title: "JSONArray란?"
date: 2024-09-26 15:10:00 +0900
categories: [Data]
tags: [basics, json, api, data]
description: "JSONArray의 개념과 특징"
image:
  path: /assets/img/thumbnails/json.jpg
---

## JSONArray란?

### 정의

- 이름 그대로 배열 구조이며, 문자열, 숫자, 배열, 객체 등을 담을 수 있다.
- index를 통해 값을 꺼낼 수 있기 때문에 순서를 고려하여 편하게 사용할 수 있다.
- \[]를 통해 값을 담고 있는 구조이다.
  
<br>

### 사용법

JSON 라이브러리를 다운로드하여야 한다.
maven을 사용하고 있다면 pom.xml에 dependencies를 추가해 사용할 수 있다.

\[코드]
```java
JSONArray jsonArray = new JSONArray();

JSONObject jsonObject1 = new JSONObject();
jsonObject1.put("이름", "홍길동");
jsonObject1.put("국적", "대한민국");

JSONObject jsonObject2 = new JSONObject();
jsonObject2.put("이름", "김유신");
jsonObject2.put("국적", "대한민국");

jsonArray.put(jsonObject1);
jsonArray.put(jsonObject2);

String data = jsonArray.toString();

System.out.println("data : " + data);
```

\[결과]
```console
data : [{"국적":"대한민국","이름":"홍길동"},{"국적":"대한민국","이름":"김유신"}]
```

즉, 여러 개의 JSONObject를 배열 형태로 묶어서 다루기 위해 사용된다.
또한 웹 API 응답이 여러 객체를 반환하는 경우에도 JSONArray를 사용한다.
