---
title: "SAX와 DOM, 문서 파싱의 두 모델"
date: 2025-11-13
categories: [Search]
tags: [parsing, sax, dom, xml]
description: "문서를 트리로 통째로 올리는 DOM과 이벤트로 흘려보내는 SAX가 메모리·속도·구현 난이도에서 갈리는 지점을, 대용량에서 OOM이 나는 원인과 함께 코드로 정리한다."
image:
  path: /assets/img/thumbnails/sax-vs-dom.png
---

문서 색인 파이프라인에서 어떤 문서는 문제없이 처리되고 어떤 문서는 서버 전체를
무너뜨린다. 그 차이의 뿌리는 대개 **파싱 모델의 선택**에 있다. XML이나 오피스
문서(내부는 결국 XML이다) 같은 구조화 문서를 읽는 방식은 크게 두 갈래이고, 이
갈림길에서 메모리 특성이 사실상 결정된다.

- **DOM**: 문서 전체를 파싱해 트리 객체로 메모리에 통째로 적재한다.
- **SAX**: 문서를 앞에서부터 훑으며 이벤트를 콜백으로 흘려보낸다.

같은 문서를 읽어도 한쪽은 힙을 다 태우고 한쪽은 상수에 가까운 메모리로 버틴다.
그 차이가 어디서 오는지 코드 수준에서 짚는다.

## DOM — 트리를 통째로 적재한다

DOM(Document Object Model)은 문서를 끝까지 읽어 **노드 트리 전체를 메모리에 올린다.**
루트 아래로 자식 엘리먼트, 텍스트 노드, 속성이 전부 객체로 생성되고 포인터로 연결된다.
파싱이 끝나면 트리를 자유롭게 왕복하며 탐색하거나 수정할 수 있다.

```java
DocumentBuilderFactory f = DocumentBuilderFactory.newInstance();
DocumentBuilder builder = f.newDocumentBuilder();
Document doc = builder.parse(new File("big.xml")); // 이 순간 트리 전체가 힙에 올라간다

// 임의 접근이 자유롭다 — 뒤로 돌아가든, 특정 노드를 집든
NodeList items = doc.getElementsByTagName("item");
```

XPath로 임의 위치를 바로 집을 수 있고, 노드를 지웠다 추가했다 재배치할 수도 있다.
문제는 **비용**이다. 트리는 "문서 크기만큼"이 아니라 그보다 훨씬 크게 힙을 먹는다.
텍스트 1바이트가 그대로 1바이트로 저장되지 않고, 노드 객체 헤더·부모/자식/형제
포인터·타입 정보까지 딸린 자바 객체 하나로 부풀기 때문이다. 원본의 몇 배에서 열 배
가까이까지 뛴다. 50MB짜리 XML이 힙에서 수백 MB가 되는 것은 예삿일이다.

그래서 DOM은 **크기를 아는 작은 문서**, 그리고 **트리를 조작해야 하는 작업**에 맞는다.
설정 파일을 읽어 값 몇 개를 고치는 정도라면 DOM이 압도적으로 편하다.

## SAX — 이벤트를 흘려보낸다

SAX(Simple API for XML)는 접근이 정반대다. 트리를 만들지 않는다. 파서가 문서를
앞에서부터 스트리밍하면서, **의미 있는 지점을 만날 때마다 등록된 콜백을 호출**한다.

- 엘리먼트 시작 → `startElement`
- 텍스트 → `characters`
- 엘리먼트 끝 → `endElement`

파서가 흐름을 주도하고 애플리케이션은 이벤트를 받아 처리만 한다. 이것을 **push(밀어주는)
방식**이라 부른다. 문서 전체가 아니라 "지금 지나가는 조각"만 순간순간 손에 쥐므로,
메모리 사용량이 문서 크기와 **거의 무관**하다. 유지되는 것은 현재 파싱 깊이와,
콜백에서 직접 쌓아 둔 상태뿐이다.

```java
public class TextExtractHandler extends DefaultHandler {

    private final StringBuilder text = new StringBuilder();
    private boolean inTitle = false;

    @Override
    public void startElement(String uri, String localName, String qName, Attributes attr) {
        if ("title".equals(qName)) inTitle = true;
    }

    @Override
    public void characters(char[] ch, int start, int length) {
        // 주의: 하나의 텍스트 노드가 여러 번에 나눠 전달될 수 있다.
        // 한 번에 다 온다고 가정하면 텍스트가 잘린다. 반드시 누적해야 한다.
        if (inTitle) text.append(ch, start, length);
    }

    @Override
    public void endElement(String uri, String localName, String qName) {
        if ("title".equals(qName)) inTitle = false;
    }
}
```

```java
SAXParser parser = SAXParserFactory.newInstance().newSAXParser();
parser.parse(new File("big.xml"), new TextExtractHandler()); // 스트리밍하며 콜백 호출
```

가장 흔히 걸려 넘어지는 지점이 `characters` 콜백이다. 텍스트 한 덩어리가 콜백 한 번으로
온전히 온다고 착각하기 쉽지만, 실제로는 파서 버퍼 경계에서 **여러 번에 쪼개져** 들어온다.
`String`으로 덮어쓰면 텍스트가 잘리므로 `StringBuilder`에 **누적**해야 한다. 이런 상태
관리를 전부 애플리케이션이 짊어지는 것이 SAX의 대가다.

대신 얻는 것이 분명하다. "필요한 텍스트만 뽑아내면 되는" 색인·추출 작업에서는 트리를
통째로 만들 이유가 없다. 흘려보내면서 원하는 조각만 집으면 된다.

## 대용량에서 무엇이 OOM을 내는가

두 모델의 메모리 곡선이 갈리는 이유는 이렇다.

- **DOM**: 파서가 트리를 다 지을 때까지 노드 객체가 계속 쌓인다. 힙 사용량이 문서 크기에
  **선형(사실상 그 이상)으로 증가**하고, 파싱이 끝나기 전에는 아무것도 해제되지 않는다.
  문서 하나가 임계치를 넘으면 그 자리에서 `OutOfMemoryError`가 난다.
- **SAX**: 콜백이 끝난 조각은 참조가 사라져 곧 GC 대상이 된다. 힙에 남는 것은 현재 깊이와
  누적 상태뿐이라 곡선이 **평탄하게(상수에 가깝게)** 유지된다.

색인 파이프라인처럼 **크기를 예측할 수 없는 사용자 업로드 문서**를 다룰 때 이 차이가
치명적이다. 평소엔 멀쩡하다가 초대형 문서 한 건이 들어오는 순간 힙을 다 태우고, 그 한
건이 색인 프로세스 전체를 끌어내린다. DOM에서 SAX 스트리밍으로 바꾸면 메모리 상한이
안정되고, 트리 빌드 단계가 없으니 단일 패스로 처리량도 대체로 올라간다. 이 전환으로 OOM을
잡은 과정은 [대용량 오피스 문서 OOM을 SAX로 잡기](https://rlckdwkd55.github.io/posts/tika-sax-oom/)에
따로 정리했다.

![](/assets/img/posts/search/parsing/sax-vs-dom.png)

## 중간 지대 — StAX (pull 방식)

둘 사이에 **StAX**(Streaming API for XML)가 있다. SAX처럼 스트리밍이라 메모리는 낮게
유지되지만, 제어의 방향이 반대다. SAX가 파서가 콜백을 **밀어주는(push)** 방식이라면,
StAX는 애플리케이션이 `next()`로 다음 이벤트를 **당겨오는(pull)** 방식이다.

```java
XMLInputFactory f = XMLInputFactory.newInstance();
XMLStreamReader reader = f.createXMLStreamReader(new FileInputStream("big.xml"));
while (reader.hasNext()) {
    int event = reader.next(); // 애플리케이션이 흐름을 제어한다
    if (event == XMLStreamConstants.START_ELEMENT && "title".equals(reader.getLocalName())) {
        // 원하는 시점에 원하는 만큼만 읽고 빠져나올 수도 있다
    }
}
```

콜백으로 상태 플래그를 관리하는 SAX보다 흐름을 눈으로 따라가기 쉽고, 원하는 지점에서
루프를 멈추기도 편하다. "낮은 메모리 + 읽기 쉬운 제어"가 필요하면 StAX가 좋은 절충이다.

## 세 모델 비교

| | DOM | SAX | StAX |
|---|---|---|---|
| 메모리 | 문서 크기에 비례(큼) | 거의 상수(작음) | 거의 상수(작음) |
| 방식 | 트리 적재 | push(콜백) | pull(당겨오기) |
| 탐색 | 양방향·임의 접근 | 단방향·순차 | 단방향·순차 |
| 수정 | 가능 | 불가(읽기 전용) | 제자리 수정 불가 |
| 구현 난이도 | 낮음(직관적) | 높음(상태 관리) | 중간 |
| 속도 | 트리 빌드 부담 | 단일 패스로 빠름 | 단일 패스로 빠름 |
| 적합 | 작은 문서·조작 | **대용량 텍스트 추출** | 대용량·제어 필요 |

"수정" 행은 읽어들인 문서를 되돌아가 고칠 수 있느냐를 말한다. SAX는 파싱 전용이라 쓰기 API가
아예 없지만, StAX는 제자리 수정만 불가할 뿐 `XMLStreamWriter`로 XML을 새로 만들어 내보내는
것은 지원한다. 스트리밍이라 "이미 지나간 지점"을 되돌릴 수 없을 뿐이다.

## Tika가 SAX를 쓰는 이유

이 개념이 실무에서 어떻게 쓰이는지는 [Apache Tika](https://rlckdwkd55.github.io/posts/apache-tika/)를
보면 분명하다. Tika의 추출 API는 처음부터 SAX의 `org.xml.sax.ContentHandler`를 축으로
설계돼 있다. `parser.parse(stream, handler, metadata, context)`에 `ContentHandler`를
넘기면, Tika가 문서를 스트리밍하며 텍스트 이벤트를 그 핸들러로 흘려보낸다.

이유는 명확하다. Tika의 주 용도는 "문서에서 본문 텍스트를 뽑아 색인하기"이고, 이는 트리를
통째로 만들 이유가 없는 **전형적인 추출 작업**이다. 크기를 모르는 문서를 받아들여야 하는
도구가 DOM을 기본으로 삼았다면 대용량 한 건에 무너졌을 것이다. SAX 기반으로 짜여 있기에
메모리 상한을 지키며 임의 크기 문서를 흘려보낼 수 있다.

한 가지 덧붙이면, DOM이든 SAX든 **외부 엔티티를 어떻게 다루느냐**는 별개의 보안 문제다.
스트리밍이라고 안전한 것이 아니라, 파서 팩토리에서 외부 엔티티 해석을 꺼야 XXE를 막을 수
있다. 이는 [XXE 취약점](https://rlckdwkd55.github.io/posts/xxe-vulnerability/)에서 따로 다뤘다.

## 선택 기준

- **DOM**은 문서를 트리로 통째로 적재한다. 조작이 자유롭지만 메모리가 크기에 비례해 커져
  대용량에서 OOM을 낸다. 크기를 아는 작은 문서·수정 작업에 맞는다.
- **SAX**는 이벤트를 콜백으로 흘려보내는 push 스트리밍이다. 메모리가 거의 상수라 대용량
  텍스트 추출에 최적이지만, 단방향·읽기 전용이라 상태 관리를 직접 해야 한다. 제어가 편한
  pull 방식이 필요하면 StAX가 절충안이다.
- **크기를 모르는 문서**를 다룬다면 SAX 스트리밍이 안전한 기본값이고, Tika가 바로 그 선택
  위에 서 있다.

<br><br><br><br><br><br><br><br><br><br>
참고 : https://docs.oracle.com/javase/tutorial/jaxp/sax/index.html
