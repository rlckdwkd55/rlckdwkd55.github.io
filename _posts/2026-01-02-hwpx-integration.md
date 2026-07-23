---
title: "Tika가 못 읽는 HWPX, hwpxlib로 붙이기"
date: 2026-01-02
categories: [Search]
tags: [hwpx, hwpxlib, apache-tika, indexing]
description: "Tika가 기본 지원하지 않는 HWPX를 hwpxlib로 분기하고, ZIP 컨테이너 내부의 HWPX 엔트리는 커스텀 EmbeddedDocumentExtractor로 위임해 색인 사각지대를 메운 기록."
image:
  path: /assets/img/thumbnails/hwpx-integration.png
published: false
---

HWPX 포맷 자체(OWPML · ZIP+XML 구조)는 [HWPX 포맷 글](https://rlckdwkd55.github.io/posts/hwpx-format/)에서 정리했다. 이 글은 그 포맷을 실제 색인 파이프라인에 붙인 기록이다.

## 문제: 한글 문서가 통째로 색인에서 빠진다

검색 관리자 서비스에서 문서 텍스트 추출은 전부 [Apache Tika](https://rlckdwkd55.github.io/posts/apache-tika/)에
맡기고 있었다. 업로드된 파일을 `AutoDetectParser`가 포맷을 판별해서 본문을 뽑고, 그 텍스트가
색인으로 들어가는 구조다. docx, pptx, pdf, xlsx 대부분은 이 한 줄기로 잘 흘렀다.

문제는 한글(HWPX)이었다. 한 공공기관 프로젝트에서 "특정 문서들이 검색에 안 걸린다"는
제보가 들어왔는데, 공통점을 추려 보니 전부 HWPX 파일이었다. **Tika는 HWPX를 기본 지원하지 않는다.**
`AutoDetectParser`는 HWPX를 그냥 ZIP으로 인식하거나 알 수 없는 포맷으로 흘려버렸고,
결과적으로 본문이 빈 문자열로 색인됐다.

색인은 성공했는데 내용이 없으니, 목록에는 보이지만 어떤 키워드로도 검색되지 않는 문서가
쌓였다. 공공기관·기업 문서는 한글 비중이 커서, 포맷 하나가 통째로 빠지면 색인 커버리지에
그만큼 큰 공백이 생긴다.

## 최상위 HWPX는 hwpxlib로 분기한다

HWPX는 개방형 표준이고, 이를 파싱하는 오픈소스 라이브러리 `hwpxlib`가 있다. 방향은
간단했다. 파일이 HWPX면 Tika를 건너뛰고 hwpxlib로 직접 텍스트를 뽑는다.

```gradle
// build.gradle — HWPX (Tika가 지원하지 않는 한글 HWPX 포맷 보강)
implementation 'kr.dogfoot:hwpxlib:1.0.5'
```

추출 진입점인 `TikaUtil.extractTextFromFile()`에서 확장자를 먼저 본다. `hwpx`면 전용 유틸로,
그 외에는 기존 Tika 경로로 보낸다.

```java
public String extractTextFromFile(String filePath) {
    if (extensionOf(filePath).equals("hwpx")) {
        return HwpxUtil.extract(filePath);      // 전용 파서로 분기
    }
    return extractWithTikaTimeout(filePath);    // 기존 Tika 경로
}
```

`HwpxUtil.extract()`는 hwpxlib의 `HWPXReader`로 파일을 읽고 `TextExtractor`로 본문을 뽑는다.
문단 텍스트 뒤에 컨트롤(표·도형 등) 텍스트를 이어 붙이는 `AppendControlTextAfterParagraphText`
모드를 써서, 표 안에 든 내용까지 놓치지 않게 했다.

```java
public static String extract(String filePath) {
    try {
        HWPXFile hwpxFile = HWPXReader.fromFilepath(filePath);
        return extractText(hwpxFile);
    } catch (Exception e) {
        log.error("hwpx 텍스트 추출 실패: {} / {}", filePath, e.getMessage());
        return "";   // 색인 파이프라인이 문서 하나 때문에 멈추지 않도록
    }
}

private static String extractText(HWPXFile hwpxFile) throws Exception {
    return TextExtractor.extract(
            hwpxFile,
            TextExtractMethod.AppendControlTextAfterParagraphText,
            true,
            new TextMarks()
    );
}
```

여기서 신경 쓴 건 실패를 예외로 던지지 않는다는 점이다. 배치성 색인에서는 문서 한 건이
깨져도 나머지는 계속 흘러야 한다. 그래서 추출 실패 시 예외를 전파하는 대신 빈 문자열을
돌려주고 로그만 남긴다.

## 컨테이너 내부의 HWPX까지 (커스텀 추출기)

남은 문제는 ZIP 같은 컨테이너 안에 HWPX가 들어 있는 경우였다. 한글 문서 여러 개를 압축해
올리는 업무 관행이 흔했는데, Tika는 컨테이너를 풀며 내부 엔트리를 재귀적으로 추출한다.
그 내부 엔트리가 HWPX면, 최상위 분기는 이미 지나갔고 재귀 추출은 다시 Tika 손에 있으니
또 빈 값이 됐다. 확장자 분기 하나로는 컨테이너 안쪽까지 닿지 못한 것이다.

Tika에는 이 재귀 추출 지점에 끼어들 수 있는 확장점이 있다. `EmbeddedDocumentExtractor`다.
컨테이너 내부 엔트리를 만날 때마다 Tika가 이 인터페이스를 호출하므로, 여기에 커스텀 구현을
꽂아 "엔트리가 HWPX면 hwpxlib로, 아니면 원래 Tika 처리로" 갈라주면 된다.

핵심은 위임(delegate) 구조다. 직접 처리할 케이스(HWPX)만 가로채고, 나머지는 Tika 기본
추출기인 `ParsingEmbeddedDocumentExtractor`에 그대로 넘긴다. HWPX 지원만 얹고 기존 동작은
건드리지 않으려는 의도였다.

```java
public class HwpxAwareEmbeddedDocumentExtractor implements EmbeddedDocumentExtractor {

    private final EmbeddedDocumentExtractor delegate;

    public HwpxAwareEmbeddedDocumentExtractor(ParseContext context) {
        this.delegate = new ParsingEmbeddedDocumentExtractor(context);
    }

    @Override
    public boolean shouldParseEmbedded(Metadata metadata) {
        return delegate.shouldParseEmbedded(metadata);
    }

    @Override
    public void parseEmbedded(InputStream stream, ContentHandler handler,
                              Metadata metadata, boolean outputHtml)
            throws SAXException, IOException {
        String resourceName = metadata.get(TikaCoreProperties.RESOURCE_NAME_KEY);
        if (resourceName != null && resourceName.toLowerCase().endsWith(".hwpx")) {
            String content = HwpxUtil.extractFromStream(stream);   // 전용 파서로 위임
            if (!content.isEmpty()) {
                char[] chars = content.toCharArray();
                handler.characters(chars, 0, chars.length);        // Tika 핸들러에 직접 주입
            }
            return;
        }
        delegate.parseEmbedded(stream, handler, metadata, outputHtml);   // 나머지는 기본 처리
    }
}
```

내부 엔트리 이름은 `TikaCoreProperties.RESOURCE_NAME_KEY` 메타데이터로 얻는다. `.hwpx`로
끝나면 hwpxlib로 뽑은 텍스트를 `handler.characters(...)`로 Tika의 SAX 핸들러에 직접 써넣는다.
이렇게 하면 컨테이너에서 나온 다른 엔트리들의 텍스트와 한 덩어리로 합쳐져, 최종 본문에 HWPX
내용이 섞여 들어간다.

여기서 hwpxlib 쪽에 작은 인터페이스 불일치가 하나 있었다. Tika 확장점은 `InputStream`을
넘겨주는데, hwpxlib의 `HWPXReader`는 파일 경로/`File` 기반으로 읽는다. 그래서
`extractFromStream()`은 스트림을 임시 파일로 떨어뜨린 뒤 읽고, 끝나면 지운다.

```java
public static String extractFromStream(InputStream inputStream) {
    File tempFile = null;
    try {
        tempFile = File.createTempFile("hwpx-embedded-", ".hwpx");
        try (OutputStream out = new FileOutputStream(tempFile)) {
            inputStream.transferTo(out);
        }
        HWPXFile hwpxFile = HWPXReader.fromFile(tempFile);
        return extractText(hwpxFile);
    } catch (Exception e) {
        log.error("임베디드 hwpx 텍스트 추출 실패: {}", e.getMessage());
        return "";
    } finally {
        if (tempFile != null) {
            tempFile.delete();   // 임시 파일 누수 방지
        }
    }
}
```

### 커스텀 추출기를 등록할 때의 함정

만든 추출기는 `ParseContext`에 등록해야 동작한다. 그런데 커스텀 `EmbeddedDocumentExtractor`만
등록하고 돌리면, 컨테이너 내부가 여전히 빈 값으로 나왔다. 원인은 `Parser.class`를 함께
등록하지 않으면 Tika가 임베디드 문서를 재귀 파싱할 파서를 못 찾는 데 있었다.

```java
private String extractWithTika(String filePath) throws Exception {
    AutoDetectParser parser = new AutoDetectParser();
    ParseContext context = new ParseContext();

    // 커스텀 추출기를 쓸 땐 재귀 파싱용 Parser도 반드시 함께 등록해야 한다
    context.set(Parser.class, parser);

    // 컨테이너 내부 hwpx 엔트리를 hwpxlib로 처리할 커스텀 추출기 등록
    context.set(EmbeddedDocumentExtractor.class,
                new HwpxAwareEmbeddedDocumentExtractor(context));
    // ... (SAX 스트리밍 설정, write limit 핸들러 등)
}
```

이 `Parser.class` 등록 함정은 [Tika 임베디드 파서 글](https://rlckdwkd55.github.io/posts/tika-embedded-parser/)에서
따로 자세히 다뤘다.

## 효과

배포 후 한글 HWPX 문서는 단독이든 ZIP 컨테이너 내부든 정상적으로 본문이 추출돼 색인됐다.
목록에는 있지만 검색되지 않던 문서가 사라졌고, 색인 가능한 문서 범위가 눈에 띄게 넓어졌다.
포맷 하나가 통째로 빠지던 사각지대를 확장자 분기와 위임 추출기 두 겹으로 메운 셈이다.

## 배운 것

- 범용 추출기(Tika)의 미지원 포맷은 억지로 우회하기보다 전용 라이브러리로 분기해 메우는 편이 깔끔하다.
- 최상위 분기만으로는 컨테이너 내부의 재귀 추출까지 닿지 못한다. 확장점(`EmbeddedDocumentExtractor`)에서 필요한 케이스만 가로채고 나머지는 위임하면, 기존 동작을 지키면서 커버리지만 넓힐 수 있다.
- 라이브러리 간 인터페이스 불일치(스트림 ↔ 파일)는 임시 파일 같은 현실적 접착제로 메우되, 정리(`finally`)까지 챙긴다.
- 색인 파이프라인에서 개별 문서 실패는 예외가 아니라 빈 값 + 로그로 흡수해야 전체가 멈추지 않는다.

<br><br>
참고 : https://github.com/neolord0/hwpxlib
