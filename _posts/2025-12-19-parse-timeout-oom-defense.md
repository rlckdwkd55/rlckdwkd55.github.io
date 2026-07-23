---
title: "파싱 타임아웃과 메모리 상한으로 색인 워커 지키기"
date: 2025-12-19
categories: [Search]
tags: [apache-tika, timeout, oom, resilience]
description: "손상되거나 비정상적으로 거대한 문서 한 건이 색인 워커 전체를 마비시키던 문제를, 파싱 타임아웃과 메모리/크기 상한이라는 서로 다른 실패 모드를 겨냥한 이중 방어로 막은 실전 회고."
image:
  path: /assets/img/thumbnails/parse-timeout.png
published: false
---

## 정상 문서만 가정한 파이프라인의 대가

우리 색인 파이프라인은 한 고객사의 업무 시스템에 쌓인 첨부 파일을 긁어와
Tika로 텍스트를 뽑고 Elasticsearch에 밀어 넣는다. 문제는 이 파일들이
**우리가 만든 게 아니라는 것**이다. 수년치 게시물에 딸려 온 첨부에는
반쯤 깨진 워드 파일, 수백 MB짜리 프레젠테이션, 확장자만 정상이고 내부는
망가진 zip 같은 것들이 섞여 있었다.

이런 문서 한 건은 두 가지 방식으로 워커를 죽인다.

- 파싱이 **끝나지 않거나 비정상적으로 오래** 걸려 스레드를 붙잡는다.
- 파싱 도중 힙을 다 써서 **OOM**을 낸다.

초기 코드는 그냥 `new Tika().parseToString(stream)` 한 줄이었다. 정상 문서만
가정한 낙관적인 코드였고 한동안은 잘 돌았다. 그러다 특정 배치에서 색인
진행률이 한 지점에 몇 시간씩 멈추는 일이 반복됐다. 로그를 보면 특정 파일에서
Tika 호출이 리턴을 안 하고 있었고, 그 한 건이 워커 스레드를 물고 있으니
**뒤에 줄 선 정상 문서 수천 건이 통째로 대기**했다.

색인 파이프라인의 SLA는 "문서 하나를 얼마나 잘 뽑느냐"가 아니라
"악성 문서가 섞여도 전체가 계속 도느냐"라는 걸 그때 배웠다. 그래서 추출
로직을 **서로 다른 실패 모드를 각각 다른 층에서 막도록** 다시 짰다.

## 방어를 두 겹으로 나눈 이유

무한 지연과 메모리 폭발은 원인도 대응도 다르다. 하나의 장치로 둘 다
막으려 하면 어느 쪽도 제대로 못 막는다. 그래서 방어를 세 층으로 쌓되,
역할을 분명히 나눴다.

1. **파싱 타임아웃** — "오래 걸리는" 문서를 정해진 시간에 끊고 건너뛴다.
   지연 실패를 담당한다.
2. **메모리/크기 상한** — write limit으로 추출 텍스트 길이를 제한하고,
   오피스 문서는 DOM 대신 SAX 스트리밍으로 파싱해 애초에 힙을 덜 쓴다.
3. **JVM 최후 방어** — 그래도 OOM이 나면 어중간하게 살아 있지 말고
   즉시 종료해 오케스트레이터가 재시작하게 한다.

앞의 두 층은 애플리케이션 코드, 마지막은 컨테이너/JVM 레벨이다. 위에서부터
막다가 못 막으면 아래 층이 받는 구조다.

## 방어 1: ExecutorService로 추출에 타임아웃

파싱을 별도 스레드풀에 위임하고, `Future.get(timeout)`으로 정해진 시간 안에
안 끝나면 통제권을 되찾는다. 정적 유틸이던 `TikaUtil`을 `@Component`로
바꿔 설정값과 스레드풀을 주입/보관하도록 했다.

```java
@Value("${file-extract.timeout-seconds:60}")
private int timeoutSeconds;

private final ExecutorService extractionExecutor = Executors.newFixedThreadPool(2, r -> {
    Thread thread = new Thread(r, "file-text-extract");
    thread.setDaemon(true);   // 종료 시 매달리지 않도록 데몬으로
    return thread;
});

private String extractWithTikaTimeout(String filePath) {
    Future<String> future = extractionExecutor.submit(() -> extractWithTika(filePath));
    try {
        return future.get(timeoutSeconds, TimeUnit.SECONDS);
    } catch (TimeoutException e) {
        future.cancel(true);
        log.warn("텍스트 추출 타임아웃({}초): {}", timeoutSeconds, filePath);
        return "";   // 이 문서는 포기하고 파이프라인은 계속
    } catch (Exception e) {
        log.error("텍스트 추출 실패: {} / {}", filePath, e.getMessage());
        return "";
    }
}

@PreDestroy
public void shutdown() {
    extractionExecutor.shutdownNow();
}
```

타임아웃 값(`file-extract.timeout-seconds`, 기본 60초)은 설정으로 빼서 운영 중
조정할 수 있게 했다. 추출이 실패하거나 시간을 넘겨도 **예외를 위로 던지지 않고
빈 문자열을 반환**하는 게 핵심이다. 그 문서는 내용 없이 색인되고 파이프라인은
멈추지 않는다.

## 방어 2: write limit과 SAX 스트리밍으로 메모리 상한

타임아웃으로도 못 막는 게 메모리다. 스레드를 끊어도 이미 할당된 힙은
남고, 애초에 추출 결과 문자열 자체가 수십 MB로 부풀 수도 있다. 그래서
`extractWithTika` 안에서 두 가지를 손봤다.

```java
private String extractWithTika(String filePath) throws Exception {
    AutoDetectParser parser = new AutoDetectParser();
    ParseContext context = new ParseContext();
    context.set(Parser.class, parser);

    // 대용량 docx/pptx의 DOM 파싱은 OOM을 유발 → 공식 SAX 스트리밍으로 전환
    OfficeParserConfig officeParserConfig = new OfficeParserConfig();
    officeParserConfig.setUseSAXDocxExtractor(true);
    officeParserConfig.setUseSAXPptxExtractor(true);
    context.set(OfficeParserConfig.class, officeParserConfig);

    // 기본 facade(parseToString)는 10만 자에서 조용히 잘린다.
    // write limit을 명시적으로 크게 잡고, 초과 시에도 그 시점까지의 텍스트를 보존.
    BodyContentHandler handler = new BodyContentHandler(maxContentChars);
    try (InputStream stream = new FileInputStream(filePath)) {
        parser.parse(stream, handler, new Metadata(), context);
    } catch (WriteLimitReachedException e) {
        log.warn("텍스트 추출이 max-content-chars({})에서 잘림: {}", maxContentChars, filePath);
    }
    return handler.toString();
}
```

`BodyContentHandler(maxContentChars)`가 크기 상한이다. `maxContentChars`는
설정값(`file-extract.max-content-chars`, 기본 500만 자)이고, 이 한계를 넘으면
Tika가 `WriteLimitReachedException`을 던진다. 여기서 예외를 잡되 다시 던지지
않고 **그 시점까지 뽑힌 부분 텍스트를 그대로 반환**한다. 뒷부분을 잃더라도
문서 대부분은 색인되고, 무엇보다 무한정 커지는 문자열로 힙을 밀어내지 않는다.
(과거 `parseToString`이 10만 자에서 아무 신호 없이 잘리던 문제는
[따로 정리했다](https://rlckdwkd55.github.io/posts/tika-silent-truncation/).)

SAX 전환은 메모리 곡선 자체를 낮춘다. 기본 오피스 파서는 문서 전체를
DOM으로 메모리에 올리는데, 대용량 docx/pptx에서 이게 OOM의 주범이었다.
`OfficeParserConfig`로 SAX 스트리밍 추출을 켜면 문서를 흘려보내며 처리해
힙 사용이 문서 크기에 비례해 폭증하지 않는다. 이 전환 과정은
[SAX OOM 회고](https://rlckdwkd55.github.io/posts/tika-sax-oom/)에 자세히 적었다.

## 방어 3: 그래도 터지면 깨끗이 죽는다

두 층을 통과한 뒤에도 예측 못 한 문서가 힙을 넘길 수 있다. 이때 JVM이
반쯤 죽은 채로 이상 동작하는 게 최악이다. 그래서 컨테이너에 최후의 방어선을 뒀다.

```dockerfile
ENV JAVA_TOOL_OPTIONS="-Xms512m -Xmx2048m -XX:+ExitOnOutOfMemoryError"
```

힙 상한을 명시하고, OOM이 나는 순간 프로세스를 **즉시 종료**시킨다.
어중간하게 살아 GC만 돌며 응답 없는 좀비가 되느니, 깨끗이 죽고
오케스트레이터가 새 인스턴스를 띄우는 편이 훨씬 예측 가능하다.

여기에 더해 배치 루프의 예외 경계도 옮겼다. 원래는 페이지 전체를 하나의
`try` 블록으로 감싸서, 중간 한 row에서 예외가 나면 그 페이지의 나머지 row가
통째로 유실됐다. 이걸 **row 단위로 격리**했다.

```java
for (Map<String, Object> queryRow : queryRows) {
    try {
        // ... 한 row를 문서로 변환, 첨부는 tikaUtil.extractTextFromFile(...) ...
        documents.add(documentJson);
    } catch (Exception e) {
        log.error("row 변환 실패, 해당 row skip: {}", e.getMessage(), e);
        // 다음 row로 계속 — 같은 페이지의 나머지 row는 보존
    }
}
```

## 왜 이렇게까지 방어적으로 짰나 — 그리고 트레이드오프

이 설계의 밑바탕에는 "**일부 문서를 포기하더라도 전체는 계속 돈다**"는
선택이 깔려 있다. 정상 문서 수천 건의 색인을 지키기 위해, 문제 있는 한 건은
내용 없이 넘긴다. 검색 관점에서 그 한 건은 본문 검색이 안 되지만 최소한
메타데이터로는 잡히고, 무엇보다 나머지가 멀쩡히 색인된다.

정직하게 짚어 둘 한계도 있다.

- **`future.cancel(true)`는 만능이 아니다.** 인터럽트는 작업이 인터럽트를
  확인하는 지점에서만 실제로 멈춘다. Tika 파싱 내부가 협조적이지 않으면
  백그라운드 스레드는 한동안 계속 돌 수 있다. 그래서 `get`의 타임아웃으로
  **호출자 쪽은 즉시 통제권을 되찾되**, 실제 파싱 스레드는 데몬 + 고정 크기
  풀(2개)로 묶어 최악의 경우에도 물릴 수 있는 스레드 수를 제한했다.
- **write limit은 뒷부분을 버린다.** 500만 자를 넘는 문서는 꼬리가 잘린다.
  캡처율과 안정성을 맞바꾼 값이고, 설정으로 뺐으니 운영에서 조정한다.
- **`ExitOnOutOfMemoryError`는 진행 중 배치를 함께 죽인다.** 프로세스를
  통째로 재시작하는 거친 방어라, row 단위 격리 같은 세밀한 방어와 함께
  써야 피해 범위가 통제된다.

층마다 잡는 실패 모드가 다르고, 층마다 포기하는 것도 다르다. 그 포기를
명시적으로 정한 게 이 작업의 핵심이었다.

## 정리

- 신뢰할 수 없는 문서는 **무한 지연·OOM**을 유발한다고 가정한다.
- **파싱 타임아웃**(`ExecutorService` + `Future.get(timeout)`)으로 지연 문서를
  격리하고, 실패해도 빈 문자열을 반환해 파이프라인을 이어 간다.
- **메모리/크기 상한**(`BodyContentHandler` write limit + `OfficeParserConfig`
  SAX 스트리밍)으로 힙과 결과 크기를 눌러 애초에 덜 터지게 한다.
- **`-XX:+ExitOnOutOfMemoryError`**로 최악의 경우 깨끗이 종료·재시작하고,
  **row 단위 예외 격리**로 재시작 전까지의 피해 범위를 줄인다.
- 층마다 다른 실패 모드를 맡는 **다층 방어**, 그리고 각 층이 포기하는 것을
  명시적으로 정하는 것 — 이 둘이 "한 문서가 전체를 무너뜨리지 못하게"의 실체다.
