---
title: "Apache Tika란?"
date: 2025-11-06
categories: [Search]
tags: [apache-tika, parsing, text-extraction]
description: "PDF·DOCX·HWPX 등 수백 종 포맷에서 텍스트와 메타데이터를 추출하는 Apache Tika의 내부 구조를 검색 색인 관점에서 정리한다."
image:
  path: /assets/img/thumbnails/apache-tika.png
published: false
---

검색 파이프라인에서 색인 대상은 결국 텍스트다. 그러나 사용자가 올리는 파일은 PDF,
Word(DOCX), 한글(HWP/HWPX), 엑셀, 스캔 이미지까지 제각각이고, 검색 엔진이 색인할 수
있는 것은 텍스트뿐이다. 이 간극을 메우는 것이 문서 추출 단계이고, 그 자리를 사실상
표준처럼 차지한 라이브러리가 **Apache Tika**다.

Tika는 수백 종의 바이너리 포맷에서 **본문 텍스트와 메타데이터**를 하나의 API로 뽑아
주는 도구다. 다만 "하나의 API"라는 표현은 오해를 부른다. `parseToString()` 한 줄이면
끝날 것 같지만, 그 뒤에는 MIME 감지·파서 위임·SAX 수집·컨텍스트 설정이라는 네 조각의
구조가 있다. 이 구조를 모른 채 facade만 쓰면 문서가 조용히 잘리거나 첨부가 통째로
누락된다. 여기서는 그 토대가 되는 뼈대에 집중하고, 개별 함정은 각각의 글로 넘긴다.

동작 설명은 실제 파이프라인에서 쓰고 있는 **Tika 2.9.2 / 3.2.2** 기준이다. 1.x와는
기본 배선이 달라진 부분이 있어, 오래된 예제를 그대로 옮기면 어긋나는 지점이 몇 군데 있다.

---

## 추출은 네 조각의 협업이다

Tika의 파싱은 네 개의 구성요소가 맞물려 돌아간다. 이 넷의 역할을 구분해 두면 이후에
나오는 거의 모든 문제를 "어느 조각의 책임인가"로 나눠 볼 수 있다.

| 구성요소 | 역할 | 대표 구현 |
| --- | --- | --- |
| **MIME 감지** | 입력이 어떤 포맷인지 판별 | `MimeTypes`, magic bytes |
| **Parser** | 포맷을 해석해 이벤트를 발생 | `AutoDetectParser`, `PDFParser` |
| **ContentHandler** | 파서가 뽑은 내용을 수집 | `BodyContentHandler` |
| **Metadata** | 부가 정보를 담는 키-값 저장소 | `Metadata` |

가장 기본적인 추출 코드는 다음과 같다.

```java
AutoDetectParser parser = new AutoDetectParser();
BodyContentHandler handler = new BodyContentHandler(-1); // -1: 길이 제한 없음
Metadata metadata = new Metadata();
ParseContext context = new ParseContext();

try (InputStream stream = Files.newInputStream(path)) {
    parser.parse(stream, handler, metadata, context);
}

String text = handler.toString();
String title = metadata.get(TikaCoreProperties.TITLE);
```

`parse()` 하나에 스트림·핸들러·메타데이터·컨텍스트가 전부 인자로 들어간다. 이
시그니처만 이해하면 Tika의 절반은 이해한 셈이다.

<!-- 이미지: 구글 검색 "Apache Tika 구조" · 저장 /assets/img/posts/search/tika/architecture.png -->

---

## MIME 감지 — 확장자를 믿지 않는다

`AutoDetectParser`의 "AutoDetect"가 하는 일이 MIME 타입 감지다. 핵심은 **파일 확장자를
1차 근거로 신뢰하지 않는다**는 점이다. 확장자는 얼마든지 바꿀 수 있고, 실제로 `.txt`로
저장된 PDF나 `.doc` 확장자를 단 DOCX가 흔하게 들어온다.

Tika는 대신 파일 앞부분의 **시그니처(magic bytes)** 를 먼저 본다. `%PDF-`로 시작하면
PDF, `PK\x03\x04`로 시작하면 ZIP 계열(DOCX·PPTX·HWPX가 전부 여기 속한다)로 판별한다.
이 magic 정의는 Tika 내장 리소스인 `tika-mimetypes.xml`에 선언되어 있다. 커스텀 포맷을
더하고 싶을 때는 이 파일을 고치는 것이 아니라, 클래스패스에
`org/apache/tika/mime/custom-mimetypes.xml`을 얹으면 내장 정의에 병합된다.

```java
Tika tika = new Tika();
try (InputStream is = Files.newInputStream(path)) {
    String mimeType = tika.detect(is, path.getFileName().toString());
    // 예: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document
}
```

감지 결과는 단순히 "무슨 파일인가"에 그치지 않는다. `AutoDetectParser`는 이 MIME 타입을
키로 삼아 **어떤 하위 파서에게 일을 넘길지**를 결정한다. 감지가 틀리면 그 뒤 파싱이
통째로 어긋나므로, 추출 결과가 이상할 때는 감지된 MIME 타입부터 로그로 확인하는 것이
빠르다.

---

## Parser SPI — 포맷마다 다른 파서를 갈아 끼운다

Tika가 수백 종 포맷을 다루는 비결은 특별한 마법이 아니라 자바의 **SPI(Service Provider
Interface)** 다. `org.apache.tika.parser.Parser` 인터페이스를 구현한 클래스들이 각 포맷
전용 파서(PDFParser, OOXMLParser 등 `tika-parsers` 계열의 수많은 구현체)로 존재하고,
클래스패스의 `META-INF/services/org.apache.tika.parser.Parser` 파일에 그 목록이 등록된다.

`AutoDetectParser`는 이 SPI로 발견된 파서들을 MIME 타입별로 매핑해 둔 **디스패처**다.
감지된 타입이 `application/pdf`면 PDFParser에게, DOCX면 OOXMLParser에게 위임한다. 따라서
새 포맷을 지원하려면 `Parser`를 구현하고 SPI에 등록만 하면 되고, 반대로 어떤 포맷이
지원되지 않는 이유는 대개 "해당 파서 JAR이 클래스패스에 없다"로 귀결된다.

이 구조에는 그림자도 있다. 파서가 SPI로 자동 발견되다 보니, 의존성으로 딸려 온 파서들이
서로 다른 버전의 라이브러리(POI, PDFBox 등)를 요구하며 충돌하는 일이 잦다. 클래스패스에
어떤 파서가 올라와 있는지가 곧 동작을 좌우한다. 이 의존성 충돌은
[Tika 업그레이드가 부른 의존성 지옥](https://rlckdwkd55.github.io/posts/tika-dependency-conflict/)에서
따로 다룬다.

---

## ContentHandler — 왜 SAX 방식인가

`parse()`에 넘기는 `ContentHandler`는 XML 파싱에서 쓰던 그 **SAX**의
`org.xml.sax.ContentHandler`다. PDF를 파싱하는데 왜 XML용 인터페이스가 나오는지는
Tika의 설계 철학에서 답이 나온다.

Tika는 모든 문서를 내부적으로 **XHTML 이벤트 스트림**으로 정규화한다. 파서가 문단을
만나면 `<p>` 시작·끝 이벤트를, 표를 만나면 `<table>` 이벤트를 발생시키는 식이다. 그러면
포맷이 PDF든 DOCX든 HWPX든, 그것을 받아 처리하는 쪽은 동일한 SAX 이벤트만 상대하면
된다. 포맷별 차이를 파서 안쪽으로 가두고, 소비자 쪽은 통일된 인터페이스로 노출하는
구조다.

이 방식이 중요한 이유는 **메모리**다. 문서 전체를 한 번에 객체 트리로 올리는 대신,
이벤트가 발생할 때마다 흘려보내며 처리할 수 있다. 대용량 문서에서 이 차이가 OOM이냐
아니냐를 가른다. SAX와 DOM이 메모리에서 갈리는 원리는
[SAX vs DOM](https://rlckdwkd55.github.io/posts/sax-vs-dom-parsing/)에 정리해 두었다.

가장 흔히 쓰는 핸들러는 세 가지다.

- **`BodyContentHandler`** — 본문 텍스트만 모은다. 검색 색인에는 대개 이것으로 충분하다.
- **`ToXMLContentHandler`** — 구조를 살린 XHTML로 뽑는다. 표·제목 구조가 필요할 때.
- **`LinkContentHandler`** — 문서 안의 링크만 수집한다.

`BodyContentHandler`의 생성자 인자는 나중에 큰 함정이 된다. 인자 없이 만들면 내부의
`WriteOutContentHandler`가 **기본 10만 자(`100 * 1000`)** 로 잡힌다. 주의할 점은 이 한도에
닿았을 때 조용히 잘리는 게 아니라 `WriteLimitReachedException`(`SAXException`의 하위)이
**던져진다**는 것이다. 그래서 핸들러를 직접 조립해 쓰면 절단은 최소한 예외로 드러난다.
문제는 이 예외를 누가 삼키느냐이고, 그 이야기는 아래에서 이어진다.

---

## Metadata와 ParseContext — 결과와 설정의 분리

나머지 두 조각은 짧게 짚는다. **`Metadata`** 는 제목·작성자·생성일·페이지 수 같은 부가
정보를 담는 키-값 저장소다. 특이한 점은 이것이 **입력이자 출력**이라는 것이다. 파싱 전에
파일명·Content-Type 힌트를 넣어 주면 감지 정확도가 올라가고, 파싱 후에는 문서에서
읽어낸 메타데이터가 같은 객체에 채워져 나온다.

```java
Metadata metadata = new Metadata();
metadata.set(TikaCoreProperties.RESOURCE_NAME_KEY, "report.pdf"); // 감지 힌트
// parse() 이후
String author = metadata.get(TikaCoreProperties.CREATOR);
String pages  = metadata.get(PagedText.N_PAGES);
```

키 상수는 2.x로 넘어오며 자리를 옮겼다. 1.x 예제에 자주 보이는
`Metadata.RESOURCE_NAME_KEY`는 지금 `TikaCoreProperties`에 있고, 페이지 수도
`Office.PAGE_COUNT`는 OOXML 계열에서만 채워지므로 포맷을 가리지 않으려면
`PagedText.N_PAGES`(`xmpTPg:NPages`)를 보는 편이 낫다.

**`ParseContext`** 는 "파싱 동작을 어떻게 할지"를 담는 설정 주머니다. 어떤 타입에 어떤
파서를 쓸지, 재귀 파싱을 어떻게 처리할지, 이미지에 OCR을 적용할지 같은 옵션을 여기에
등록한다. 기본 코드에서는 빈 `new ParseContext()`를 넘기지만, 실무의 세밀한 제어는
대부분 이 객체를 채우는 일로 이루어진다. 아래의 재귀 파싱도 여기에 파서를 등록하는
문제다.

---

## 편의 facade의 함정 — `parseToString()`

Tika에는 위의 네 조각을 몰라도 되는 한 줄짜리 편의 API가 있다.

```java
String text = new Tika().parseToString(stream);
```

간단해서 예제마다 이것을 쓰지만, 실무에 그대로 올리면 조용히 무너지는 지점이 있다.

이 facade는 내부적으로 `BodyContentHandler`를 **기본 10만 자(write limit)** 로 만든다.
그보다 긴 문서는 **예외도 로그도 없이 뒷부분이 잘린다.** "왜 이 문서는 앞부분만
검색되지?"의 범인이 대개 이것이다. 앞에서 본 `WriteLimitReachedException`이 여기서도
똑같이 던져지지만, `parseToString()`이 `WriteLimitReachedException.isWriteLimitReached()`로
걸러 삼키고 잘린 문자열을 정상 반환값처럼 돌려주기 때문이다. 이 침묵 절단은
[Tika가 문서를 조용히 자를 때](https://rlckdwkd55.github.io/posts/tika-silent-truncation/)에서
원인과 해법을 다룬다.

한 가지 오해하기 쉬운 점은, facade가 일을 덜 한다는 뜻이 아니라는 것이다. 오히려
`parseToString()`은 파서·핸들러·컨텍스트를 알아서 조립하고 **재귀 파싱에 쓸 `Parser`까지
`ParseContext`에 심어 준다.** 그래서 write limit 하나를 통제하려고 facade를 걷어내는
순간, 그동안 대신 처리되던 배선의 책임이 통째로 내 코드로 넘어온다. 그 배선을 놓쳐
첨부가 빈 값으로 나왔던 사례는 아래 재귀 파싱 절에서 이어 다룬다.

색인 파이프라인에서는 facade 대신 `AutoDetectParser` + `BodyContentHandler(-1)`(또는
의도한 상한값) 조합으로 **한계를 코드에 드러내는** 편이 안전하다. 편의 API는 스크립트나
탐색용으로만 쓴다.

---

## 컨테이너 문서와 재귀 파싱

DOCX·PPTX·HWPX·ZIP처럼 **내부에 다른 파일을 품은 컨테이너** 포맷이 있다. 워드 문서 안에
엑셀 표가 개체로 박혀 있거나, 메일(.eml)에 PDF가 첨부된 경우다. 이때 겉껍데기만 파싱하면
안쪽 문서의 텍스트는 하나도 나오지 않는다.

Tika는 이것을 **재귀 추출**로 해결한다. 컨테이너를 파싱하다 임베디드 리소스를 만나면
`EmbeddedDocumentExtractor`가 그것을 꺼내 **다시 파서에게 넘긴다.**

순정 `AutoDetectParser`만 쓰는 동안에는 이 배선을 신경 쓸 일이 없다. `parse()` 안에서
`ParseContext`에 `EmbeddedDocumentExtractor`가 아직 없으면, Tika가 스스로를
`Parser.class`로 심고 기본 추출기까지 만들어 넣어 주기 때문이다.

넘어지는 지점은 **커스텀 `EmbeddedDocumentExtractor`를 직접 등록할 때**다. context에
추출기가 이미 들어 있으면 Tika는 위의 자동 배선을 통째로 건너뛴다. 그래서
`Parser.class`를 함께 넣어 주지 않으면 재귀 추출기는 안쪽 문서를 무엇으로 파싱할지 몰라
**첨부가 빈 값으로 나온다.** 감지·본문 추출은 멀쩡한데 첨부만 사라지니 원인을 찾기가
은근히 까다롭다.

```java
AutoDetectParser parser = new AutoDetectParser();
ParseContext context = new ParseContext();

// 커스텀 추출기를 등록하는 순간 Tika의 자동 배선이 꺼진다.
// → 재귀에 쓸 파서를 직접 넣어 줘야 한다.
context.set(Parser.class, parser);
context.set(EmbeddedDocumentExtractor.class, new MyEmbeddedDocumentExtractor(context));
```

전체 구조를 보존하며 임베디드 문서까지 훑고 싶다면 `RecursiveParserWrapper`를 쓰는
방법도 있다. 재귀 파서 등록과 임베디드 추출기 커스터마이징은
[Tika 임베디드 파서](https://rlckdwkd55.github.io/posts/tika-embedded-parser/)에서 실제
사례로 다룬다.

---

## 실무에서 미리 각오할 것들

구조를 이해한 뒤에도 현장에서 계속 신경 쓰게 되는 지점이 있다.

- **대용량 메모리.** 오피스 포맷 기본 파서는 문서를 상당 부분 메모리에 올린다. 수백 MB
  문서가 들어오면 OOM 위험이 있어, 오피스 계열에는 SAX 스트리밍 추출 옵션을 켜서
  이벤트 단위로 흘려보내는 편이 안전하다.
- **포맷 미지원.** 해당 파서 JAR이 없으면 텍스트가 안 나온다. 조용히 빈 문자열이
  돌아오므로, 감지된 MIME 타입과 실제 매칭된 파서를 로그로 남겨 두는 것이 좋다.
- **스캔 이미지 PDF.** 텍스트 레이어가 없는 스캔본은 Tika만으로는 못 뽑는다. OCR
  (Tesseract 연동)이 필요하고, 이것은 별개의 무게를 가진 주제다.
- **한글 포맷.** HWP/HWPX는 국내 문서 검색에서 비중이 큰데 표준 파서 지원이 포맷별로
  들쭉날쭉하다. 구조는
  [HWPX 포맷 뜯어보기](https://rlckdwkd55.github.io/posts/hwpx-format/)에 정리했다.

이렇게 뽑아낸 텍스트가 결국 검색 엔진의
[역색인](https://rlckdwkd55.github.io/posts/elasticsearch-inverted-index/)으로 들어가
색인된다. Tika는 그 파이프라인의 가장 앞 관문이다.

---

정리하면 Tika는 magic bytes 기반 **MIME 감지 → SPI로 발견한 Parser에 위임 → SAX
ContentHandler로 수집 → Metadata에 부가정보 채우기**로 동작하고, 모든 문서를 내부적으로
XHTML 이벤트 스트림으로 정규화해 소비자가 포맷과 무관하게 동일한 SAX 인터페이스만
다루게 한다. 실무에서는 `parseToString()` facade 대신 `AutoDetectParser` + 명시적 핸들러
조합으로 침묵 절단을 막고, 커스텀 임베디드 추출기를 붙일 때는 `ParseContext`에 재귀
파서까지 함께 등록해 첨부를 살리며, 대용량은 SAX 스트리밍으로, 스캔본은 OCR로 대비한다.

<br><br><br><br><br><br><br><br><br><br>
참고 : https://tika.apache.org/
