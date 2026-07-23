---
title: "Tika parseToString의 10만 자 침묵 절단, 캡처율 되살리기"
date: 2025-11-21
categories: [Search]
tags: [apache-tika, parsing, text-extraction, indexing]
description: "장문 문서가 색인에서 뒷부분만 통째로 누락되던 원인이 Tika facade의 기본 write limit(10만 자) 침묵 절단임을 밝히고, AutoDetectParser와 BodyContentHandler로 write limit을 명시적으로 다뤄 텍스트 캡처율을 되살린 실전 회고."
image:
  path: /assets/img/thumbnails/tika-truncation.png
published: false
---

첨부문서 색인 파이프라인을 다시 들여다보다가, 한동안 "그러려니" 하고 넘겼던 버그의
정체를 뒤늦게 알게 됐다. 어떤 문서는 검색에 잘 걸리는데, 유독 **길고 무거운 문서**만
뒷부분이 검색에서 사라졌다. 에러 로그 한 줄 없었다. 이 글은 그 "조용한 절단"의 원인을
파고들어 실제 코드를 고치기까지의 기록이다. Tika 자체 소개는
[Apache Tika로 첨부문서 텍스트 추출하기](https://rlckdwkd55.github.io/posts/apache-tika/)에 정리해 뒀다.

## 증상: 대용량 문서만, 그것도 뒷부분만 검색에서 빠진다

처음 제보는 애매했다. A 공공기관 담당자가 "특정 문서가 검색이 안 된다"고 했는데,
막상 그 문서 제목이나 앞부분 키워드로 검색하면 **멀쩡히 잡혔다.** 문제는 그 문서
**뒷부분에만** 나오는 단어로 검색했을 때였다. 그건 결과에 뜨지 않았다.

정리하면 이런 양상이었다.

- 짧은 문서: 전체가 정상적으로 검색된다.
- 긴 문서: 앞부분은 잡히는데 **어느 지점 이후로는 통째로 안 잡힌다.**
- 색인 배치 로그: **성공**으로 찍혀 있다. 실패도, 경고도 없다.

색인이 성공했다는데 내용 일부가 없다는 건, 색인 단계가 아니라 **그 앞 단계(텍스트
추출)에서 이미 텍스트가 잘려 들어왔다**는 뜻이었다. 색인기는 자기가 받은 문자열을
성실히 다 넣었을 뿐이고, 애초에 받은 문자열이 반쪽이었던 것이다.

가장 곤란했던 건 **아무 신호가 없다**는 점이었다. 파싱이 예외를 던졌다면 로그를 보고
바로 쫓아갔을 텐데, 조용히 성공한 얼굴로 잘린 결과를 돌려주니 "왜 이 문서만?"을
한참 헤맸다. 결국 재현이 답이었다. 문제가 된 유형의 큰 문서를 하나 받아,
추출된 텍스트의 **길이(문자 수)를 직접 찍어** 봤다.

```
extracted length = 100000
```

딱 10만. 원본은 그보다 훨씬 긴 문서였다. 이 "딱 떨어지는 100000"이 모든 걸 설명했다.

## 원인: `parseToString`의 기본 write limit과 "침묵" 절단

당시 추출 코드는 Tika의 한 줄 편의 facade를 쓰고 있었다.

```java
// before
public static String extractTextFromFile(String filePath) {
    File file = new File(filePath);
    Tika tika = new Tika();
    String text;
    try (InputStream stream = new FileInputStream(file)) {
        text = tika.parseToString(stream);
    } catch (TikaException | IOException e) {
        log.error(e.getMessage());
        throw new IllegalArgumentException(ErrorCode.FAIL_EXTRACT_TEXT_BY_TIKA);
    }
    return text;
}
```

문제는 `tika.parseToString(stream)` 이었다. 이 메서드는 편의를 위해 내부적으로
**출력 문자 수 상한(write limit)** 을 걸어 두는데, `new Tika()` 의 기본값이
**10만 자**다. Tika 입장에선 "메모리를 지켜 주는 친절한 안전장치"인 셈이다.

진짜 함정은 **한도를 넘겼을 때의 처리 방식**이었다. write limit에 도달하면 Tika
내부의 핸들러는 `WriteLimitReachedException`(SAX 계열 예외)을 던져 파싱을
중단시킨다. 그런데 `parseToString` 은 이 예외를 **자기가 삼켜 버리고**, 그
시점까지 모은 텍스트를 아무 일 없었다는 듯 **정상 반환**한다. 호출한 쪽에서 보면
성공이다. 예외도, 경고 로그도, 반환값에 "잘렸음"을 알리는 어떤 표식도 없다.

이게 바로 "침묵(silent) 절단"이다. 실패를 실패로 알려 주지 않고 **성공으로 위장**하기
때문에, 데이터가 유실돼도 한참 뒤에야, 그것도 사용자 제보로 알게 된다. 나는 이때
편의 API의 "친절한 기본값"이 오히려 가장 위험할 수 있다는 걸 배웠다. 상한 자체는
합리적이지만, 그걸 **조용히** 적용한다는 게 문제였다.

## 해결: 파서와 핸들러를 직접 잡고, write limit을 "다룬다"

방향은 분명했다. 상한을 없앨 게 아니라, **상한을 내 손으로 통제**하고 상한에
부딪혔을 때 **그 사실을 반드시 알게** 만드는 것. `AutoDetectParser` 와
`BodyContentHandler` 를 직접 구성해 아래처럼 바꿨다.

```java
// after (핵심 발췌)
@Value("${file-extract.max-content-chars:5000000}")
private int maxContentChars;

private String extractWithTika(String filePath) throws Exception {
    AutoDetectParser parser = new AutoDetectParser();
    ParseContext context = new ParseContext();

    // (임베디드 문서 재귀 파싱용 Parser 등록, Office SAX 스트리밍 설정 등은 생략)

    // 기본 facade(new Tika().parseToString())는 10만자에서 예외 없이 조용히 잘리므로,
    // write limit을 명시적으로 크게 잡고 초과 시에도 그 시점까지의 텍스트를 그대로 사용한다.
    BodyContentHandler handler = new BodyContentHandler(maxContentChars);
    try (InputStream stream = new FileInputStream(filePath)) {
        parser.parse(stream, handler, new Metadata(), context);
    } catch (WriteLimitReachedException e) {
        log.warn("텍스트 추출이 max-content-chars({})에서 잘림: {}", maxContentChars, filePath);
    }
    return handler.toString();
}
```

바뀐 지점은 세 가지다.

1. **편의 facade를 버리고 파서를 직접 구성했다.** `parseToString` 이 숨기던 조립
   과정(parser + handler + metadata + context)을 밖으로 꺼내니, 상한을 포함한
   모든 손잡이가 내 코드에 드러난다. 이 명시적 조립은 write limit뿐 아니라
   대용량 Office 문서의 [SAX 스트리밍 전환](https://rlckdwkd55.github.io/posts/sax-vs-dom-parsing/)이나
   [임베디드 문서 추출기 등록](https://rlckdwkd55.github.io/posts/tika-embedded-parser/) 같은 다른 개선의
   토대이기도 했다.
2. **상한을 눈에 보이는 설정값으로 끌어올렸다.** 숨은 10만 자 대신
   `maxContentChars`(기본 5,000,000)를 `BodyContentHandler` 에 넘긴다.
   프로퍼티라 운영 중에도 조정할 수 있다.
3. **초과해도 조용히 넘어가지 않는다.** `WriteLimitReachedException` 을 **내가
   직접 잡아** 경고 로그를 남기고, `handler.toString()` 으로 **그 시점까지의 부분
   텍스트라도 보존**한다. "전부 아니면 무(無)"가 아니라 "최대한 살리되, 잘렸다는
   사실은 반드시 남긴다"로 바꾼 셈이다.

## 왜 무제한(-1)이 아니라 "큰 유한값"인가

`BodyContentHandler` 는 `-1` 을 주면 상한을 아예 없앨 수 있다. 처음엔 이게
제일 깔끔해 보였다. 어차피 다 뽑을 거면 무제한이 맞지 않나?

하지만 무제한은 **입력 크기에 대한 방어를 스스로 버리는** 선택이기도 하다. 색인
대상은 사용자·외부 기관이 올린 파일이라 내가 크기를 통제할 수 없다. 비정상적으로
크거나 손상돼 텍스트가 폭발적으로 쏟아지는 파일 하나가 들어오면, 무제한 핸들러는
그걸 그대로 힙에 쌓다가 **OOM으로 프로세스 전체를 끌어내릴 수** 있다. 원래
10만 자 상한이 지키려던 게 바로 이 메모리였다는 점을 떠올리면, 상한을 없애는 건
문제의 반대편 극단으로 가는 일이었다.

그래서 **현실적인 문서 크기를 한참 웃도는 큰 유한값(5백만 자)** 으로 타협했다.
정상 문서라면 절대 닿지 않을 만큼 크게 잡아 캡처율 문제는 사실상 해소하되,
상한 자체는 남겨 두어 병리적인 입력에 대한 메모리 상한선은 지킨다. 그리고 그
경계에 닿는 문서가 실제로 나타나면 경고 로그가 남으니, 그때 값을 올릴지 그
문서를 따로 볼지 판단하면 된다. 무제한과 달리 이 방식은 **최악의 경우 메모리
사용량에 상한이 있다**는 게 핵심이다. (파싱이 끝나지 않고 매달리는 대용량·손상
파일에 대한 타임아웃 방어는 [별도의 최후 방어선](https://rlckdwkd55.github.io/posts/parse-timeout-oom-defense/)으로
따로 뒀다.)

## 검증: 캡처율이 실제로 회복됐는가

고쳤다는 느낌만으로는 부족했다. 실패가 조용했던 만큼, 회복도 **숫자로** 확인하고
싶었다.

먼저 문제를 재현했던 그 큰 문서로 **추출 문자 수를 직접 비교**했다. before에서
정확히 `100000` 이던 값이, after에서는 원본에 걸맞은 수십만 자로 늘었다. 딱
떨어지던 10만이 사라진 것 자체가 상한에서 잘리지 않았다는 신호였다.

다음으로 **꼬리 검색(tail search)** 을 했다. 문서 **맨 뒷부분에만** 나오는 고유한
단어를 골라 검색해, before에선 안 잡히던 그 단어가 after 재색인 뒤엔 해당 문서를
정확히 물어 오는지 봤다. 앞부분 키워드는 원래도 잡혔으니, 판별력은 오직 뒷부분
단어에 있었다.

마지막으로 표본을 넓혔다. 길이가 제각각인 문서 여러 건을 재색인하면서, before/after의
추출 길이를 나란히 로그로 남겨 **10만 근처에서 잘린 흔적이 있던 문서들이 after에서
전부 그 벽을 넘겼는지**를 확인했다. 그리고 `WriteLimitReachedException` 경고
로그가 정상 문서 범위에서는 더 이상 찍히지 않는 것으로, 5백만이라는 상한이 실무
문서에 충분한 여유임을 함께 검증했다.

세 가지가 모두 맞아떨어지고 나서야 "캡처율이 회복됐다"고 말할 수 있었다.

## 정리

- **가장 위험한 실패는 예외를 던지는 실패가 아니라, 성공으로 위장하는 실패다.**
  `parseToString` 의 침묵 절단은 로그가 없어서 오래 살아남았다.
- **편의 API의 숨은 기본값을 의심하자.** 10만 자 write limit은 합리적인 안전장치였지만,
  그걸 조용히 적용한 게 문제였다. 파서를 직접 조립해 상한을 내 손으로 통제했다.
- **극단을 피하고 경계를 남기자.** 무제한(-1)은 OOM 위험을, 기본 10만은 유실을
  부른다. 현실을 크게 웃도는 유한 상한 + 초과 시 경고가 두 위험 사이의 균형점이었다.
- **조용한 실패는 조용한 검증으로 못 잡는다.** 문자 수 비교, 꼬리 검색, 표본
  재색인처럼 눈에 보이는 지표로 회복을 확인했다.

> 이 변경은 Tika 파이프라인 전반을 손본 작업의 일부였다. 같은 커밋에서 다룬
> [대용량 Office 문서 SAX 전환](https://rlckdwkd55.github.io/posts/tika-sax-oom/),
> [HWPX 포맷 연동](https://rlckdwkd55.github.io/posts/hwpx-integration/),
> [XXE(CVE) 대응](https://rlckdwkd55.github.io/posts/tika-xxe-cve/),
> [의존성 충돌 해결](https://rlckdwkd55.github.io/posts/tika-dependency-conflict/)은 각각 따로 정리해 뒀다.
{: .prompt-info }
