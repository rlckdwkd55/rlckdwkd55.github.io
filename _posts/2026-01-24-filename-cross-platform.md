---
title: "Linux 서버에서 첨부파일명 자리에 서버 절대경로가 색인된 버그"
date: 2026-01-24
categories: [Search, Parsing]
tags: [apache-tika, linux, indexing, troubleshooting]
description: "백슬래시만 구분자로 가정한 파일명 추출이 Linux 서버에서 절대경로를 그대로 색인하던 버그의 원인과 수정."
image:
  path: /assets/img/thumbnails/filename-path.png
published: false
---

## 증상: 첨부파일명 자리에 서버 경로가 통째로

문서 색인 기능을 운영에 올리고 얼마 뒤, 검색 결과의 첨부파일 이름이 이상하다는 이야기를
들었다. 원래 `report.pdf` 처럼 파일명만 보여야 할 자리에
`/data/upload/2026/07/report.pdf` 같은 **서버의 전체 절대경로**가 그대로
들어가 있었다.

더 이상했던 건 내 로컬(Windows)에서는 멀쩡했다는 점이다. 개발 중엔 한 번도 못 봤는데
운영(Linux)에서만 재현됐다. "환경 타는 버그"라는 감이 왔고, 실제로도 그랬다.

색인 파이프라인은 외부 DB의 테이블을 읽어 각 row를 문서(JSON)로 변환하고,
`filepath` 컬럼이 있으면 그 파일을 Tika로 파싱해 `attachments` 배열에 붙이는 구조다.
문제가 된 건 이 `attachments`에 들어가는 `name` 필드였다.

```java
// filepath 컬럼을 만나면 첨부 메타를 구성한다
Map<String, Object> attachmentsJson = new HashMap<>();
String filepath = String.valueOf(row);
String filename = filepath.substring(filepath.lastIndexOf("\\") + 1); // 문제의 라인
String content = tikaUtil.extractTextFromFile(filepath);

attachmentsJson.put("content", content); // Tika로 뽑은 본문
attachmentsJson.put("name", filename);   // 사용자에게 보이는 파일명
attachmentsJson.put("path", filepath);   // 원본 경로(내부용)
```

`path`에는 원래 경로를 그대로 넣는 게 의도였고, `name`에는 경로에서 파일명만 잘라
넣어야 했다. 그런데 이 "잘라내기"가 플랫폼을 탔다.

## 원인: 백슬래시 하나만 구분자로 가정했다

파일명을 뽑는 코드는 **Windows 경로 구분자(`\`)만** 기준으로 잘라내고 있었다.

```java
// before
String filename = filepath.substring(filepath.lastIndexOf("\\") + 1);
```

한 줄짜리라 무해해 보이지만, `lastIndexOf`가 못 찾았을 때 `-1`을 돌려준다는 사실과
맞물리면서 문제가 생겼다.

- Windows 경로 `C:\upload\report.pdf`
  → `lastIndexOf("\\")` 가 마지막 백슬래시 위치를 반환
  → `substring(그 위치 + 1)` → `report.pdf` (정상)
- Linux 경로 `/data/upload/report.pdf`
  → 백슬래시가 아예 없으니 `lastIndexOf("\\")` 는 `-1`
  → `substring(-1 + 1)` = `substring(0)` → **경로 문자열 전체가 그대로** (버그)

즉 `substring(0)`은 자기 자신을 통째로 돌려주기 때문에, "구분자를 못 찾았다"는 실패가
예외로 터지지도 않고 조용히 **전체 경로 = 파일명** 이라는 잘못된 결과로 흘러갔다.
개발은 Windows, 배포는 Linux라는 흔한 조합에서 정확히 갈리는 지점이었다.

한 가지 다행이었던 건, 검색 매칭 자체는 영향이 없었다는 점이다. 본문 검색은
`content`(Tika 추출 텍스트)에 걸린 ngram 분석기로 동작했고, 깨진 건 결과를 보여줄 때의
`name` 표시 값뿐이었다. 그래서 "검색은 되는데 파일명만 이상한" 형태로 나타났고,
초기에 원인을 좁히는 데 시간이 조금 걸렸다.

## 해결: 두 구분자 중 더 뒤에 있는 것을 기준으로

수정은 단순하다. `\` 와 `/` 의 위치를 둘 다 구한 뒤, **더 뒤에 있는 구분자**를
기준으로 자른다.

```java
// after
int lastSeparator = Math.max(filepath.lastIndexOf("\\"), filepath.lastIndexOf("/"));
String filename = filepath.substring(lastSeparator + 1);
```

`Math.max` 로 두 위치 중 큰 값을 취하는 게 핵심이다.

- Linux 경로: `\` 는 `-1`, `/` 는 마지막 슬래시 위치 → 큰 값은 슬래시 위치 → 정상
- Windows 경로: `/` 는 `-1`, `\` 는 마지막 백슬래시 위치 → 큰 값은 백슬래시 위치 → 정상
- 구분자가 아예 없는 순수 파일명(`report.pdf`): 둘 다 `-1` → `max` 도 `-1`
  → `substring(0)` → 파일명 그대로 (이 경우엔 전체가 곧 파일명이라 결과가 맞다)

한쪽만 없으면 그쪽이 `-1`이 되고, `max`가 자연스럽게 실제 구분자 위치를 골라준다.
경로에 두 종류가 섞여 있더라도 가장 마지막 구분자를 잡으므로 안전하다.

자바에는 플랫폼 독립적으로 마지막 경로 요소를 얻는
`Paths.get(filepath).getFileName().toString()` 같은 방법도 있다. 다만 이 값은 외부 DB에
문자열로 저장돼 넘어온 "다른 서버 기준" 경로일 수 있어서, 실행 중인 JVM의 파일시스템
규칙(`Path`가 따르는)에 맡기기보다 두 구분자를 명시적으로 다루는 쪽이 의도가 더 분명하다고
판단했다. 그래서 `Math.max` 방식을 택했다.

## 왜 놓치기 쉬웠나

이 버그가 코드리뷰나 개발 단계에서 안 걸린 이유를 되짚어보면 몇 가지가 겹친다.

- **개발 환경 하나만으로 검증했다.** Windows 로컬에서는 입력 경로에 항상 백슬래시가
  있으니 코드가 완벽하게 동작했다. 문제가 되는 입력(슬래시 경로)을 개발 중엔 만들
  일이 없었다.
- **실패가 예외가 아니라 "그럴듯한 값"으로 나타났다.** `lastIndexOf`가 `-1`을
  던지지 않고 정수를 돌려주고, `substring(0)`도 예외 없이 통과한다. 로그에 에러 한 줄
  안 남기고 조용히 틀린 값이 저장되는, 가장 잡기 번거로운 유형이었다.
- **경로 파싱을 직접 문자열로 처리했다.** 라이브러리 API 대신 `substring` 한 줄로
  끝낸 탓에, 플랫폼 가정이 코드에 그대로 박제됐다.

## 크로스플랫폼 교훈

- **"내 개발 환경"의 암묵적 가정을 의심한다.** 경로 구분자만이 아니라 줄바꿈 문자,
  파일명 대소문자, 기본 인코딩, 시간대 같은 것들이 Windows 개발 → Linux 배포 조합에서
  조용히 어긋난다. "로컬에서 되니까"는 검증이 아니다.
- **`-1`을 돌려주는 API의 실패 경로를 항상 챙긴다.** `indexOf`/`lastIndexOf`가
  `-1`일 때 뒤따르는 계산이 무엇을 만드는지(`substring(0)`처럼) 확인하는 습관이 필요하다.
- **사소한 파싱 실수가 정보 노출로 번질 수 있다.** 이번엔 서버 내부 디렉터리 구조가
  검색 결과에 그대로 드러났다. 기능 버그이자 정보 노출이었다. 파일 관련 입력을 다룰 때
  경로가 어디까지 외부로 나가는지 늘 신경 써야 한다는 점은
  [경로 조작(path traversal) 파일 업로드 회고](https://rlckdwkd55.github.io/posts/path-traversal-file-upload/)에서도
  같은 결의 문제였다.

## 마무리

Windows 백슬래시 하나만 구분자로 가정한 파일명 추출이, Linux 서버에서
`substring(0)`으로 흘러 전체 절대경로를 첨부파일명으로 색인하고 있었다.
`Math.max(lastIndexOf("\\"), lastIndexOf("/"))`로 두 구분자를 모두 고려하도록 바꿔
양쪽 OS에서 파일명만 남게 했다. 한 줄짜리 문자열 처리에 박힌 플랫폼 가정과, `-1`을
돌려주는 API의 실패값 하나가 운영에서 어떻게 드러나는지 확인한 버그였다.
