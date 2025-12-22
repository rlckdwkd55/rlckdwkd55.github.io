---
title: "사고다발지 시각화 프로젝트 (1) - 개요 및 DB 설계"
date: 2024-12-19 11:30:00 +0900
categories: [Project]
tags: [java, project]
description: "OpenAPI활용 경기도 사고다발지 시각화 프로젝트"
image:
  path: /assets/img/thumbnails/accident-hotspot.jpg
---

지금까지 해 왔던 이론을 바탕으로 OpenAPI를 활용하여 경기도 내의 시군별 사고 다발지 현황 DB를 구축하고,
지도API를 활용하여 시각적으로 표현하고자 한다.

아래 링크에서 사고 다발지 현황 데이터를 확인할 수 있다.
링크 : [사고다발지 현황](https://data.gg.go.kr/portal/data/service/selectServicePage.do?page=1&rows=10&sortColumn=&sortDirection=&infId=9HJ306A05WF6RS2560PG21056899&infSeq=3&order=&loc=&ACDNT_YY=&ACDNT_DIV_NM=&JURISD_POLCSTTN_NM=&LOC_INFO=)

## 개발 환경

- 운영 체제: Windows 11
- 데이터베이스: MySQL
- 개발 도구: IntelliJ
- 프로그래밍 언어: Java JDK 1.8
- Spring 및 MyBatis 사용
  
<br>

## Table 생성

```sql
CREATE TABLE ACCIDENT (
  SIGUN_NM VARCHAR(255), -- 시군명 --
  SIGUN_CD VARCHAR(255), -- 시군코드 --
  ACDNT_YY INT, -- 사고년도 --
  ACDNT_DIV_NM VARCHAR(255), -- 사고유형구분 --
  MULTI_KNOWLG_DIV_NO VARCHAR(255) PRIMARY KEY, -- 다발지식별자 --
  MULTI_KNOWLG_DIV_GROUP_NO VARCHAR(255), -- 다발지역그룹식별자 --
  LEGALDONG_CD_NO VARCHAR(255), -- 법정동코드 --
  SPOT_NO VARCHAR(255), -- 위치코드 --
  JURISD_POLCSTTN_NM VARCHAR(255), -- 시도시군구명 --
  LOC_INFO VARCHAR(255), -- 사고지역위치명 --
  OCCUR_CNT INT, -- 발생건수 --
  CASLT_CNT INT, -- 사상자수 --
  DPRS_CNT INT, -- 사망자수 --
  SERINJRY_INDVDL_CNT INT, -- 중상자수 --
  SLTINJRY_INDVDL_CNT INT, -- 경상자수 --
  INJURY_APLCNT_CNT INT, -- 부상자수 --
  LAT DOUBLE, -- 위도 --
  LOGT DOUBLE, -- 경도 --
  MULTI_REGION_INFO VARCHAR(2000) -- 사고다발지역폴리곤정보 --
);
```
<br>

![](/assets/img/posts/project/accident-hotspot/table-design.png)

OpenAPI 사이트를 참고해서 Table을 만들어주었다.
중복데이터 조회를 위해 다발지식별자를 기본키로 설정 해 주었다.

다음 포스트에서는 Java와 DB를 연결하는 방법에 대해 소개 할 예정이다.

