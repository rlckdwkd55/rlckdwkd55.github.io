---
title: "색인 파이프라인의 XXE(CVE-2025-66516)를 Tika 업그레이드로 막다"
date: 2026-01-17
categories: [Security]
tags: [xxe, apache-tika, cve, dependency]
description: "첨부문서 파싱에 쓰던 Apache Tika 2.9.2의 XXE(CVE-2025-66516, CVSS 10.0)를 3.2.2로 올려 막은 과정과, 이 경우 왜 입력 검증이 아니라 버전 업그레이드가 정답이었는지 정리한다."
image:
  path: /assets/img/thumbnails/tika-xxe.png
published: false
---

XXE가 왜 취약점이 되는지, 그 원리 자체는 [XXE — XML의 편의 기능이 어쩌다 공격 표면이 되는가](https://rlckdwkd55.github.io/posts/xxe-vulnerability/)에 따로 정리해 뒀다. 이 글은 그 개념을 실제 색인 파이프라인에서 마주치고 코드로 막은 회고다. 개념부터 보고 싶다면 위 글을 먼저 읽는 편이 낫다.

## 첨부문서 파서는 그대로 공격 표면이다

내가 맡은 서비스는 검색 색인 파이프라인이다. 사용자와 외부 시스템에서 들어온 첨부문서를 파싱해 본문 텍스트를 뽑고, 그 텍스트를 색인한다. 파싱은 [Apache Tika](https://rlckdwkd55.github.io/posts/apache-tika/)에 맡기고 있었다. 여기까지는 평범한 구조다.

문제는 이 구조를 보안 관점에서 다시 보면 달라진다. 색인 대상 문서는 우리가 만든 게 아니다. 누가 무엇을 올릴지 알 수 없는 신뢰할 수 없는 입력이고, 그 입력을 그대로 Tika에 넘겨 파싱시킨다. 색인 파이프라인은 태생적으로 "신뢰할 수 없는 문서를 파서에게 먹이는 일"을 상시로 반복한다.

여기에 한 가지를 더 짚어야 한다. 요즘 문서 포맷 대부분은 겉보기와 달리 속이 XML이다. docx·pptx·xlsx는 zip으로 묶인 XML 묶음이고, HWPX도 마찬가지다. 문서를 파싱한다는 건 결국 그 안의 XML을 파서에 넘긴다는 뜻이다. 그리고 XML 파서에는 외부 엔티티·DTD처럼 신뢰할 수 없는 입력 앞에서 위험해지는 기능이 딸려 있다. 첨부문서 파싱 경로가 곧 XXE의 입구가 되는 이유가 여기 있다.

## Tika 2.9.2의 XXE (CVE-2025-66516)

의존성을 점검하다가, 쓰고 있던 Tika 2.9.2에 XXE 취약점(CVE-2025-66516)이 걸려 있는 걸 확인했다. 등급은 CVSS 10.0, 최고 위험도였다.

원리만 짧게 짚으면 이렇다. 공격자가 외부 엔티티 선언을 심어 둔 문서를 파싱시키면, 취약한 파서는 그 엔티티가 가리키는 서버 로컬 파일이나 내부 리소스를 읽어 치환 결과에 채워 넣는다. 그 결과가 색인 텍스트나 응답·로그에 섞여 나가면 서버 내부 파일이 바깥으로 새고, 엔티티를 계단식으로 부풀리면 메모리를 삼켜 DoS로도 이어진다. 피해가 어떤 갈래로 번지는지는 [XXE 정리 글](https://rlckdwkd55.github.io/posts/xxe-vulnerability/)에 적어 뒀으니 재현 절차까지 늘어놓지는 않겠다. 중요한 건 문서 하나를 올리는 것만으로, 인증 없이 트리거된다는 점이다.

색인 파이프라인처럼 외부 문서를 종일 받아 파싱하는 서비스에서, 인증 없이 문서 한 장으로 터지는 CVSS 10.0은 우선순위를 따질 것도 없이 지금 막아야 하는 등급이었다.

<!-- 이미지: 구글 검색 "XXE xml external entity file disclosure" · 저장 /assets/img/posts/security/tika-xxe/attack-path.png -->

## 어떻게 막았나

XXE 대응에서 가장 먼저 확인한 건 "이 파서를 우리가 직접 설정으로 잠글 수 있는가"였다. 결론부터 말하면 이 경우엔 아니었고, 그 이유가 이 글의 핵심이라 뒤에서 따로 짚는다. 실제 방어는 두 갈래로 들어갔다.

### 1) XXE 자체를 막은 것 — Tika 버전 업그레이드

XXE 구멍을 실제로 닫은 변경은 `build.gradle`의 의존성 버전이었다.

```diff
- // Tika
- implementation 'org.apache.tika:tika-core:2.9.2'
- implementation 'org.apache.tika:tika-parsers-standard-package:2.9.2'
+ // Tika (CVE-2025-66516 XXE 수정을 위해 3.2.2 이상으로 업그레이드)
+ implementation 'org.apache.tika:tika-core:3.2.2'
+ implementation 'org.apache.tika:tika-parsers-standard-package:3.2.2'
```

한 줄짜리 버전 변경이지만, 이게 XXE에 대한 본질적인 방어다. 이유는 잠시 뒤에 설명한다.

### 2) 파서 호출 방식을 "설정 가능한" 형태로 바꾼 것

같은 커밋에서 `TikaUtil`도 손봤다. 기존 코드는 Tika의 최상위 편의 API를 그대로 쓰고 있었다.

```java
// Before — new Tika()의 facade에 그냥 던진다. 내부 파서 설정에 개입할 여지가 없다.
Tika tika = new Tika();
try (InputStream stream = new FileInputStream(file)) {
    text = tika.parseToString(stream);
}
```

`new Tika().parseToString()`은 편하지만, 파서를 어떻게 구성할지 손댈 손잡이가 없는 블랙박스다. 파싱 동작을 통제하려면 한 단계 내려가 파서와 컨텍스트를 직접 들고 있어야 한다. 그래서 `AutoDetectParser`와 `ParseContext`를 명시적으로 잡는 형태로 바꿨다.

```java
// After — 파서와 ParseContext를 직접 쥐고, 파싱 동작을 명시적으로 구성한다.
AutoDetectParser parser = new AutoDetectParser();
ParseContext context = new ParseContext();
// ... (파싱 동작 세부 설정) ...
BodyContentHandler handler = new BodyContentHandler(maxContentChars);
try (InputStream stream = new FileInputStream(filePath)) {
    parser.parse(stream, handler, new Metadata(), context);
}
```

이 리팩터링 자체가 XXE를 막는 건 아니다. 다만 파서를 facade 뒤에 숨겨 두지 않고 명시적으로 소유하게 됐다는 점이 중요하다. 파싱 길이 상한, SAX 스트리밍, 타임아웃 같은 안정성 방어를 이 `ParseContext`에 얹을 수 있게 된 것도 이 구조 덕분이다. 그 세부 방어들은 이 글의 주제(XXE)와 결이 달라 각각 다른 글로 나눠 뒀다. 길이 초과 절단, [대용량 문서의 SAX 스트리밍](https://rlckdwkd55.github.io/posts/sax-vs-dom-parsing/), 파싱 타임아웃 같은 것들이다.

## 왜 입력 검증이 아니라 버전 업그레이드였나

XXE를 처음 마주하면 대개 "위험한 문자열을 걸러내면 되지 않나?" 하는 생각이 먼저 든다. 나도 그랬다. 하지만 `<!DOCTYPE`나 `<!ENTITY` 같은 토큰을 블랙리스트로 막는 접근은 인코딩·공백·대소문자 우회에 취약해서 근본이 약하다. 입력을 검사하는 게 아니라, 파서에게서 외부 엔티티·DTD 처리 능력 자체를 빼앗는 "기능 차단"이 정답이다. 이 논리는 [XXE 정리](https://rlckdwkd55.github.io/posts/xxe-vulnerability/)에서 자세히 다뤘다. (블랙리스트 필터링이 왜 근본 대책이 못 되는지는 [SQL 인젝션](https://rlckdwkd55.github.io/posts/sql-injection/) 쪽에서도 같은 결론이 나온다. 문자열을 거르는 대신 위험한 해석 자체를 끊는 것이 정석이다.)

그런데 여기서 한 겹이 더 있다. 기능 차단이 정답인 건 맞는데, 누가 그 기능을 끄느냐가 상황마다 다르다.

- 내가 직접 XML 파서를 다룰 때는 내 손으로 끈다. `DocumentBuilderFactory`나 `SAXParserFactory`에 `disallow-doctype-decl`, `external-general-entities=false`, `FEATURE_SECURE_PROCESSING` 같은 표준 플래그를 세워 위험한 기능을 잠근다.
- 파싱 주체가 Tika 같은 라이브러리일 때는 사정이 다르다. XML을 실제로 파싱하는 건 내 코드가 아니라 Tika 내부다. 그 안에서 어떤 팩토리로 어떻게 파서를 만드는지는 라이브러리가 쥐고 있고, 나는 그 내부 파서에 위 플래그를 손쉽게 꽂을 손잡이가 없다.

그래서 라이브러리가 파싱을 대신하는 경우, "기능 차단"을 실현하는 현실적인 레버는 곧 라이브러리 버전이다. XXE 방어를 파서 내부에 제대로 적용해 둔 버전으로 올리는 것, 그게 남의 파서에 대해 기능 차단을 행사하는 방법이다. Tika 3.2.2로 올린 건 단순히 "패치된 최신 버전"이라서가 아니라, 취약했던 2.9.2에는 없던 안전한 XML 처리 기본값을 파서 안쪽에 들여오기 위해서였다. 겉보기엔 `build.gradle` 한 줄이지만, 실제로는 "파서 기능 차단"이라는 원칙을 라이브러리 경계 너머에 적용한 셈이다.

정리하면 XXE 방어는 두 축이다. 내가 만지는 파서는 플래그로 잠그고, 남이 만든 파서는 패치가 반영된 버전으로 올린다. 이번 건은 후자였다.

## 업그레이드는 그 자체로 끝이 아니었다

메이저 버전을 건너뛰자(2.9 → 3.2) 컴파일은 되는데 런타임에 `NoSuchMethodError`가 났다. 보안 패치 하나가 전이 의존성 충돌이라는 곁가지 문제를 불러온 것이다. 이 이야기는 [Tika 업그레이드가 부른 의존성 지옥](https://rlckdwkd55.github.io/posts/tika-dependency-conflict/)에서 이어 다뤘다. 여기서 강조하고 싶은 한 가지는, 보안 업그레이드는 "버전을 올렸다"가 아니라 "올린 뒤에도 실제로 동작한다"까지 확인해야 완결된다는 점이다.

## 남은 것

- 파서는 곧 공격 표면이다. 신뢰할 수 없는 문서를 다루는 라이브러리는 기능이 아니라 보안 관점에서 주기적으로 점검해야 한다. 특히 docx·hwpx처럼 속이 XML인 포맷은 XXE의 잠재 입구다.
- 라이브러리 취약점은 대개 "우리 코드"가 아니라 "우리가 쓰는 코드"에 있다. 지금 어떤 버전을 쓰고 거기 어떤 CVE가 걸려 있는지 아는 의존성 가시성이 방어의 절반이다.
- XXE의 정답은 입력 검증이 아니라 기능 차단이고, 라이브러리가 파싱을 대신할 때 그 기능 차단은 버전 업그레이드의 형태로 실현된다. 내가 직접 잠글 수 없는 파서라면 그게 가장 확실한 레버다.
- 파서 호출을 facade에서 명시적 구성 형태로 내려 두면, 이후의 안정성·보안 방어를 얹을 자리가 생긴다. 통제할 수 없는 편의 API보다, 통제할 수 있는 명시적 구성이 낫다.

<br>
참고 : https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html
