---
title: "Tika 임베디드 추출기와 ParseContext의 Parser.class 함정"
date: 2025-12-04
categories: [Search]
tags: [apache-tika, parsing, embedded]
description: "커스텀 EmbeddedDocumentExtractor를 등록해 ZIP 내부 문서까지 추출하려 했는데 컨테이너 내부만 빈 텍스트로 나왔다. 원인은 ParseContext에 재귀 파싱용 Parser를 등록하지 않은 것. Parser.class 한 줄을 넣어 되살린 실전 회고."
image:
  path: /assets/img/thumbnails/tika-embedded.png
published: false
---

> Tika가 못 읽는 HWPX를 컨테이너 내부까지 붙인 이야기는 [HWPX 연동 글](https://rlckdwkd55.github.io/posts/hwpx-integration/)에
> 정리했다. 이 글은 그 과정에서 하루를 통째로 잡아먹은 **한 줄짜리 함정**을 따로 파고든 기록이다.

첨부문서 색인 파이프라인에 커스텀 `EmbeddedDocumentExtractor`를 붙이던 중이었다. ZIP 같은
컨테이너 안에 HWPX 엔트리가 있으면 hwpxlib로 직접 뽑고, 나머지는 Tika 기본 재귀에 맡기려는
`HwpxAwareEmbeddedDocumentExtractor`를 만들어 `ParseContext`에 등록했다. 단위 테스트에서 단독 파일은 잘 됐다. 그런데 **컨테이너 파일을 넣는 순간 내부가
전부 빈 값**으로 나왔다. 에러 한 줄 없었다. 이번에도 "조용한 실패"였다.

## 증상: 컨테이너는 인식되는데, 그 안이 전부 빔

양상을 정리하면 이랬다.

- **단독 문서**(docx, pdf, hwpx 등)는 텍스트가 정상적으로 추출된다.
- **ZIP 같은 컨테이너**는 파일 자체가 인식은 되는데, **내부 엔트리 텍스트가 전부 비어** 있다.
  컨테이너 안에 든 게 docx든 hwpx든 가리지 않고 똑같이 빈 값이다.
- 파싱 로그: **성공**이다. 예외도, 경고도 없다.

처음엔 내가 새로 만든 커스텀 추출기의 hwpx 분기를 의심했다. hwpxlib 호출이 빈 문자열을
돌려주나 싶어 그쪽부터 팠는데, 컨테이너 안의 **일반 docx 엔트리마저** 비어 있는 걸 보고
방향을 틀었다. hwpx 분기만의 문제가 아니었다. 컨테이너 내부를 다시 파싱하는 **재귀 추출
자체가 통째로 동작하지 않는** 것이었다.

여기서 잠깐 헷갈렸던 건, 예전에 편의 facade(`new Tika().parseToString()`)를 쓸 때는 컨테이너
내부가 멀쩡히 추출됐다는 기억이었다. 같은 Tika인데 왜 지금은 안 되나. 이 위화감이
결국 원인으로 가는 실마리였다.

## 원인: 재귀 파싱을 맡을 Parser가 ParseContext에 없었다

Tika에서 컨테이너 내부 문서를 다시 파싱하는 일은 `EmbeddedDocumentExtractor`가 맡는다. 내가
만든 커스텀 추출기는 hwpx가 아닌 엔트리를 Tika 기본 구현인
`ParsingEmbeddedDocumentExtractor`에 위임하는 구조였다.

```java
public HwpxAwareEmbeddedDocumentExtractor(ParseContext context) {
    // hwpx가 아닌 엔트리는 이 delegate가 "다시 파싱"한다
    this.delegate = new ParsingEmbeddedDocumentExtractor(context);
}
```

문제는 이 `ParsingEmbeddedDocumentExtractor`가 내부 엔트리를 실제로 파싱하려면, **어떤 파서로
다시 파싱할지**를 알아야 한다는 점이다. 그 파서를 `ParsingEmbeddedDocumentExtractor`는
자기 생성자로 받은 **`ParseContext`에서 `Parser.class`로 꺼내 온다.** 즉 재귀 파싱에 쓸
파서는 컨테이너 최상위를 파싱하는 코드가 **미리 context에 심어 둬야** 한다.

그런데 내 `extractWithTika`는 파서를 직접 조립하면서 정작 그 파서를 context에 등록하지
않았다. context에 `Parser.class`가 없으니, 재귀 추출기는 "내부를 무엇으로 파싱할지"를 몰라
**아무 일도 하지 않고 빈 결과를 돌려줬다.** 예외 대신 침묵으로.

앞서 느꼈던 위화감의 정체도 여기서 풀렸다. 편의 facade를 쓰던 시절엔 Tika가 파서를
`ParseContext`에 **알아서 심어 줬기** 때문에 재귀가 동작했던 것이다. 내가
[write limit 문제 때문에 파서를 직접 조립](https://rlckdwkd55.github.io/posts/tika-silent-truncation/)하기 시작하면서,
Tika가 뒤에서 대신 해 주던 그 배선을 **떠안게 됐다는 사실을 몰랐던** 것이다.

## before / after: `Parser.class` 한 줄

버그가 살아 있던 상태(before)는 이랬다. 커스텀 추출기와 SAX 설정은 다 넣었는데, 정작
`Parser.class` 등록만 빠져 있다.

```java
// before — 커스텀 추출기는 등록했지만 Parser.class를 빠뜨렸다
private String extractWithTika(String filePath) throws Exception {
    AutoDetectParser parser = new AutoDetectParser();
    ParseContext context = new ParseContext();

    // (Office SAX 스트리밍 설정)
    OfficeParserConfig officeParserConfig = new OfficeParserConfig();
    officeParserConfig.setUseSAXDocxExtractor(true);
    officeParserConfig.setUseSAXPptxExtractor(true);
    context.set(OfficeParserConfig.class, officeParserConfig);

    // 커스텀 추출기는 등록했지만...
    context.set(EmbeddedDocumentExtractor.class, new HwpxAwareEmbeddedDocumentExtractor(context));
    // ↑ 이 추출기 안의 ParsingEmbeddedDocumentExtractor가 context에서 Parser를 못 찾는다
    //   → 컨테이너 내부가 조용히 빈 값

    BodyContentHandler handler = new BodyContentHandler(maxContentChars);
    try (InputStream stream = new FileInputStream(filePath)) {
        parser.parse(stream, handler, new Metadata(), context);
    }
    return handler.toString();
}
```

수정(after)은 단 한 줄, **재귀 파싱용 파서를 context에 등록**하는 것이었다. 실제 커밋에
들어간 코드는 다음과 같다.

```java
// after — 재귀 파싱용 Parser를 ParseContext에 등록
private String extractWithTika(String filePath) throws Exception {
    AutoDetectParser parser = new AutoDetectParser();
    ParseContext context = new ParseContext();

    // 커스텀 EmbeddedDocumentExtractor를 등록할 때는 재귀적으로 임베디드 문서를 파싱할 Parser도
    // 함께 등록해야 한다(등록하지 않으면 zip 내부 엔트리 내용이 비어버리는 Tika의 알려진 함정).
    context.set(Parser.class, parser);

    OfficeParserConfig officeParserConfig = new OfficeParserConfig();
    officeParserConfig.setUseSAXDocxExtractor(true);
    officeParserConfig.setUseSAXPptxExtractor(true);
    context.set(OfficeParserConfig.class, officeParserConfig);

    // zip 등 컨테이너 내부의 hwpx 엔트리를 hwpxlib로 처리하기 위한 커스텀 추출기
    context.set(EmbeddedDocumentExtractor.class, new HwpxAwareEmbeddedDocumentExtractor(context));

    BodyContentHandler handler = new BodyContentHandler(maxContentChars);
    try (InputStream stream = new FileInputStream(filePath)) {
        parser.parse(stream, handler, new Metadata(), context);
    } catch (WriteLimitReachedException e) {
        log.warn("텍스트 추출이 max-content-chars({})에서 잘림: {}", maxContentChars, filePath);
    }
    return handler.toString();
}
```

`context.set(Parser.class, parser)` 이 한 줄로 컨테이너 내부 엔트리가 전부 정상 추출됐다.
최상위 파싱에 쓰는 `AutoDetectParser`를 그대로 재귀 파싱에도 넘긴 셈이라, 내부의 docx는
docx대로, hwpx는 커스텀 분기로 각자 제 파서를 타게 됐다.

한 가지 짚어 둘 점은, `HwpxAwareEmbeddedDocumentExtractor` 생성자에 넘기는 `context`가
**이 시점의 context**라는 것이다. 등록 순서상 `Parser.class`를 먼저 넣어 뒀기 때문에, 그
context를 받은 내부 delegate가 나중에 `Parser`를 꺼내 쓸 수 있다. 등록 자체가 빠지면
순서와 무관하게 소용없지만, "context에 무엇이 언제 들어 있느냐"가 재귀 동작을 좌우한다는
감각은 이 함정을 이해하는 데 도움이 됐다.

## 왜 이런 함정이 생기나

원인을 알고 나면 허무할 만큼 단순하지만, 그 단순한 함정에 왜 빠지는지가 더 중요했다.

첫째, **편의 API가 대신 해 주던 일을 떠안았다는 걸 인지하지 못했다.** `parseToString` 같은
facade는 파서·핸들러·context를 알아서 조립해 준다. 재귀 파서를 context에 심는 것도 그
"알아서" 안에 포함돼 있었다. 나는 write limit 하나 통제하려고 facade를 걷어냈을 뿐인데,
그 순간 facade가 처리하던 **모든 배선의 책임이 통째로 내 코드로 넘어왔다.** 걷어낸 편의
계층이 무엇을 대신하고 있었는지를 다 헤아리지 못한 게 근본 원인이다.

둘째, **delegate가 요구하는 전제가 코드에 드러나지 않았다.**
`ParsingEmbeddedDocumentExtractor`는 "context에 `Parser.class`가 있을 것"을 암묵적으로
전제한다. 이 전제는 생성자 시그니처에도, 컴파일 타임에도 드러나지 않는다. 전제가 깨져도
예외가 아니라 **빈 결과**로 나타나니, 계약 위반을 계약처럼 알려 주지 않는다.

셋째, 그래서 이건 우리 파이프라인에 반복해서 나타난 **"조용한 실패"의 또 다른 얼굴**이었다.
앞서 본 10만 자 침묵 절단이 성공한 얼굴로 잘린 텍스트를 돌려줬듯,
이 함정도 성공한 얼굴로 빈 텍스트를 돌려줬다. 에러가 없다는 게 정상이라는 뜻이 아니라는
걸, 또 한 번 값을 직접 찍어 보고 나서야 깨달았다.

교훈은 분명했다. **편의 계층을 벗겨 낼 때는, 그 계층이 대신하던 일의 목록을 먼저
확인하자.** 그리고 라이브러리의 확장 지점(여기선 `EmbeddedDocumentExtractor`)을
커스터마이징할 때는, 그 지점이 **context에서 무엇을 꺼내 쓰는지** — 즉 어떤 전제를 깔고
있는지 — 를 함께 봐야 한다. 확장 포인트의 계약은 대체로 문서보다 구현 코드에 적혀 있다.

## 정리

- **증상은 "컨테이너 내부만 조용히 빈 값".** 컨테이너는 인식되는데 그 안의 엔트리 텍스트가
  전부 비고, 에러도 경고도 없었다.
- **원인은 `ParseContext`에 재귀 파싱용 `Parser`를 등록하지 않은 것.** 커스텀 추출기가
  위임하는 `ParsingEmbeddedDocumentExtractor`는 context의 `Parser.class`로 내부를 다시
  파싱하는데, 그게 없으면 아무 일도 하지 않는다.
- **해결은 `context.set(Parser.class, parser)` 한 줄.** 최상위 파서를 재귀에도 그대로
  넘겨 컨테이너 내부까지 추출되게 했다.
- **함정의 뿌리는 편의 API가 대신하던 배선을 떠안았다는 인지 부족.** facade를 걷어내면
  그 안의 책임이 전부 넘어온다. 확장 포인트의 암묵적 전제는 구현 코드에서 확인하자.
- **또 하나의 "조용한 실패".** 예외가 없어도 결과를 직접 값으로 검증해야 한다.

> 이 수정은 Tika 파이프라인을 손본 한 커밋의 일부다. 같은 작업의
> [10만 자 침묵 절단](https://rlckdwkd55.github.io/posts/tika-silent-truncation/),
> [HWPX 포맷 연동](https://rlckdwkd55.github.io/posts/hwpx-integration/),
> [Tika 소개](https://rlckdwkd55.github.io/posts/apache-tika/)는 각각 따로 정리해 뒀다.
{: .prompt-info }
