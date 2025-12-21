---
title: "JDK 설치 및 환경변수 설정"
date: 2024-11-02 15:40:00 +0900
categories: [Java]
tags: [basics, java, jdk, environment]
description: "JDK 설치 과정 및 환경변수 설정"
image:
  path: /assets/img/thumbnails/java.png
---

## 1. JDK 설치

Java는 여러 버전이 있지만 나는 JDK8을 설치하려 한다.

### 1. 오라클 다운로드 센터에 접속
- https://www.oracle.com/java/technologies/

![](/assets/img/posts/java/jdk/java1.png)

<br>

### 2. 해당하는 운영체제 다운로드

![](/assets/img/posts/java/jdk/java2.png)

<br>

### 3. 동의 후 다운로드

![](/assets/img/posts/java/jdk/java3.png)

<br>

### 4. 로그인

![](/assets/img/posts/java/jdk/java4.png)

- 로그인 시 다운로드 시작된다.
- 압축해제 후 원하는 위치에 저장한다. (나는 2개의 버전을 사용중이라 따로 폴더를 만들어서 관리한다.)

![](/assets/img/posts/java/jdk/java5.png)

<br>

## 2. 환경변수 설정

### 1. 시스템 속성 -> 환경변수

![](/assets/img/posts/java/jdk/java6.png)

<br>

### 2. 새로만들기

![](/assets/img/posts/java/jdk/java7.png)

![](/assets/img/posts/java/jdk/java8.png)

- 변수 이름 : JAVA_HOME
- 변수 값 : 설치 된 경로
  
<br>

### 3. Path 편집

![](/assets/img/posts/java/jdk/java9.png)

![](/assets/img/posts/java/jdk/java10.png)

- 새로만들기 클릭 후 **%JAVA_HOME%\bin** 입력
- 모든 창 확인하며 닫아준다.
  
<br>

## 3. 실행 테스트

![](/assets/img/posts/java/jdk/java11.png)

![](/assets/img/posts/java/jdk/java12.png)

- java -version /  javac -version 입력했을 때 값이 출력되면 완료
