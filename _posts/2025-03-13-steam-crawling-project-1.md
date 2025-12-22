---
title: "Steam 게임 데이터 크롤링 프로젝트 (1)"
date: 2025-03-13
categories: [Web]
tags: [crawling, project]
description: "Steam 사이트의 게임 데이터를 수집하기 위한 크롤링 프로젝트"
image:
  path: /assets/img/thumbnails/steam-crawling-project.jpg
---

이번에는 웹 크롤링에 대해 이야기하려고 한다.
웹 크롤링이란 웹 페이지를 방문하여 원하는 정보를 자동으로 수집하는 기술을 의미한다.
이번 포스트에서는 지금까지 배운 이론을 바탕으로, Steam 사이트에서 게임 데이터를 크롤링하는 프로젝트를 시작하려고 한다.

## Steam 사이트와 크롤링하려는 데이터

Steam은 전세계 게이머들에게 잘 알려진 디지털 배급 플랫폼이다.
수많은 게임들이 있으며, 게임에 대한 다양한 정보가 제공된다.
이번 프로젝트에서는 Steam 사이트에서 게임의 이름, 할인율, 원래 가격, 할인된 가격, 장바구니 추가 여부, 게임 이미지, 출시일, 평가, 태그 등의 정보를 크롤링할 계획이다.

내가 크롤링 할 사이트는 아래 링크에서 해당 부분이다.
링크 : [스팀](https://store.steampowered.com/category/action_fps/?flavor=contenthub_all)

![](/assets/img/posts/project/steam-crawling-project/steam-crawling-target.png)

<br>

## 개발 환경

- 운영 체제: Windows 11
- 데이터베이스: MySQL
- 개발 도구: IntelliJ
- 프로그래밍 언어: Java JDK 1.8
- Spring 및 MyBatis 사용
  
<br>

## 데이터베이스 테이블 설계

### 사전 준비사항

크롤링한 데이터를 저장하기 위해 MySQL 데이터베이스를 사용하려고 한다.

1. **MySQL 데이터베이스 설치:** MySQL 데이터베이스가 설치되어 있어야 한다. MySQL 공식 사이트에서 설치 파일을 다운로드 받을 수 있다.

2. **데이터베이스와 사용자 계정 생성:** MySQL에서 사용할 데이터베이스와 사용자 계정을 생성해야 한다. 아래는 예시 SQL 코드다.

```sql
CREATE DATABASE TESTDB; -- database 생성 --
CREATE USER 'test'@'localhost' IDENTIFIED BY '0000'; -- 사용자 생성 --
GRANT ALL PRIVILEGES ON testdb.* TO 'test'@'localhost'; -- 특정 DB의 모든 테이블에 권한 부여 --
FLUSH privileges; -- 설정 적용 --
```

3. **Spring 프로젝트 생성:** Spring 프로젝트가 생성되어 있어야 한다.

4. **Maven이나 Gradle을 이용한 의존성 추가:** Maven이나 Gradle을 이용해 필요한 의존성을 프로젝트에 추가해야 한다.

<br>

아래는 게임 데이터를 저장하기 위해 만들 계획인 테이블의 구조이다.

```sql
CREATE TABLE GAMES (
TITLE VARCHAR(255) NOT NULL,
RELEASES VARCHAR(255),
CART VARCHAR(255),
PRIMARY KEY (TITLE)
);

CREATE TABLE TAGS (
TAG VARCHAR(255) NOT NULL,
PRIMARY KEY (TAG)
);

CREATE TABLE GAME_TAGS (
TITLE VARCHAR(255) NOT NULL,
TAG VARCHAR(255) NOT NULL,
PRIMARY KEY (TITLE, TAG),
FOREIGN KEY (TITLE) REFERENCES GAMES(TITLE),
FOREIGN KEY (TAG) REFERENCES TAGS(TAG)
);

CREATE TABLE PRICE (
TITLE VARCHAR(255) NOT NULL,
DISC VARCHAR(255),
ORIGIN_PRICE VARCHAR(255),
DISC_PRICE VARCHAR(255),
PRIMARY KEY (TITLE),
FOREIGN KEY (TITLE) REFERENCES GAMES(TITLE)
);

CREATE TABLE REVIEW (
TITLE VARCHAR(255) NOT NULL,
ONE_LINE_REVIEW VARCHAR(255),
REVIEW_COUNT VARCHAR(255),
PRIMARY KEY (TITLE),
FOREIGN KEY (TITLE) REFERENCES GAMES(TITLE)
);

CREATE TABLE IMAGES (
IMAGE_ID INT AUTO INCREMENT,
ORIGIN_NAME VARCHAR(255),
IMAGE_NAME VARCHAR(255),
TITLE VARCHAR(255),
PRIMARY KEY (IMAGE_ID),
FOREIGN KEY (TITLE) REFERENCES GAMES(TITLE)
);
```

총 6개의 테이블을 구성했으며 ERD다이어그램은 아래 사진과 같다.
![](/assets/img/posts/project/steam-crawling-project/steam-crawling-erd.png)

<br>

다음 포스트에서 Spring과 MySQL을 연결하고, 필요한 Dependency를 추가하는 과정에 대해 다룰 예정이다.
