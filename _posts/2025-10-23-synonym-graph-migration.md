---
title: "다중어 동의어 오작동과 하드코딩된 동의어 사전 경로 정리하기"
date: 2025-10-23
categories: [Search, Elasticsearch]
tags: [elasticsearch, synonym-graph, experience]
description: "색인 분석기만 옛 synonym 필터에 남아 다중어 동의어가 어긋나던 문제를 synonym_graph로 통일하고, 템플릿에 하드코딩돼 있던 동의어 사전 경로를 인덱스별 변수로 걷어낸 기록."
---

내가 맡은 시스템은 여러 검색 서비스의 Elasticsearch 인덱스를 만들고 관리하는
어드민 도구다. 인덱스는 공용 `settings.json` 템플릿 한 벌을 읽어, 동의어·불용어·
신조어 사전 경로 같은 값을 인덱스별로 치환해서 생성한다. 그래서 이 템플릿의
설정 하나가 틀어지면 그 이후 만들어지는 모든 인덱스가 같은 방식으로 틀어진다.

동의어의 개념, `synonym`과 `synonym_graph`의 차이, 필터 순서 같은 기초는
[동의어 검색 깊게 파기](https://rlckdwkd55.github.io/posts/synonym-graph/)에
정리해 뒀다. 이 글은 그 도구에서 실제로 부딪힌 두 가지 설정 문제와, 그걸
커밋 두 개로 정리한 기록이다.

## 문제 1: 색인 분석기만 옛 `synonym` 필터에 남아 있었다

증상은 익숙한 형태였다. 단일어 동의어는 잘 매칭되는데, 2어절짜리 다중어 동의어에서
구(phrase) 매칭이 됐다 안 됐다 했다. 분석 단계에 원인이 있을 가능성이 높아,
애플리케이션 코드 대신 분석기 설정부터 열었다.

`settings.json`에는 한국어 본문을 처리하는 Nori 기반 분석기가 색인용과 검색용으로
나뉘어 있었다.

- `custom_nori_analyzer` — 색인 시점(index-time)
- `custom_nori_search_analyzer` — 검색 시점(search-time)

검색용 분석기는 이미 `synonym_graph`를 쓰고 있었는데, 색인용 분석기만 옛날 `synonym`
필터에 그대로 남아 있었다. 동의어를 확장하는 필터가 색인과 검색에서 서로 다른
알고리즘이었던 것이다.

```text
// custom_nori_search_analyzer (검색용) — 이미 synonym_graph
"filter": [ "lowercase", "synonym_graph", "newword", "stopword", "trim" ]

// custom_nori_analyzer (색인용) — 아직 옛 synonym
"filter": [ "trim", "lowercase", "stopword", "newword", "synonym" ]
```

`synonym`과 `synonym_graph`의 결정적 차이는 다중어 동의어의 위치(position) 처리다.
원본이 1토큰인데 동의어가 2토큰이면, 옛 `synonym` 필터는 뒤따르는 토큰의 위치를
어긋나게 만든다. `synonym_graph`는 동의어를 여러 경로를 가진 그래프로 표현해
길이가 다른 동의어의 위치를 올바르게 유지한다.

가공한 예시로 감을 잡자면 이런 사전이 있다고 하자.

```text
# synonym 사전 (가공 예시)
무선청소기, 무선 청소기
블루투스이어폰, 블루투스 이어폰
```

색인은 `synonym`으로, 검색은 `synonym_graph`로 서로 다르게 확장하면, 같은
"무선 청소기"라는 표현이라도 색인에 박힌 토큰의 위치와 검색이 기대하는 위치가
어긋난다. 정확 일치처럼 보이는 검색이 실패하던 원인이 여기 있었다.

## 해결 1: 색인 분석기도 `synonym_graph`로 통일

변경 자체는 색인용 분석기 필터 목록에서 필터 이름 한 줄이었다.

```diff
  "custom_nori_analyzer": {
    ...
    "filter": [
      "trim",
      "lowercase",
      "stopword",
      "newword",
-     "synonym"
+     "synonym_graph"
    ]
  }
```

이렇게 색인용과 검색용이 같은 `synonym_graph` 필터 정의를 참조하게 되면서,
설정이 두 벌이라 생기던 다중어 동의어의 위치 불일치가 사라졌다.

여기엔 짚고 넘어갈 트레이드오프가 있다. `synonym_graph`가 만드는 토큰 그래프는
본래 검색 시점에서 진가를 발휘한다. 색인 시점에는 Lucene이 그래프를 평탄화(flatten)해
역색인에 넣기 때문에, 그래프 구조 자체가 그대로 보존되지는 않는다. 그래서 다중어
동의어 처리의 결정적 이득은 여전히 검색 분석기 쪽에 있다. 그럼에도 색인 분석기를
맞춘 이유는 동의어 필터 정의를 한 벌로 통일해, 색인·검색이 서로 다른 필터를
참조하다 어긋나는 종류의 버그를 없애기 위해서였다.

바꾸면서 필터 체인의 순서도 다시 확인했다. 동의어 확장이 소문자화·불용어·
신조어 필터와 어떤 순서로 놓이느냐에 따라 무엇을 확장 대상으로 볼지가 달라지기
때문이다(자세한 건
[필터 순서](https://rlckdwkd55.github.io/posts/synonym-graph/) 글에 정리해 뒀다).
한 줄 교체처럼 보여도 그 줄이 놓인 위치와 앞뒤 필터까지 확인해야 결과가 의도대로
나온다.

## 문제 2: `synonym_graph` 필터가 특정 인덱스 사전을 하드코딩하고 있었다

첫 번째 문제를 정리하다 필터 정의를 들여다보니 더 근본적인 게 눈에 걸렸다.
`settings.json`의 필터들은 사전 경로를 인덱스별로 치환할 수 있게 변수로 빼 두는
게 원칙이었다. 실제로 `synonym`·`newword`·`stopword`는 모두 그랬다.

```text
"synonym":  { "type": "synonym",  "synonyms_path": "${synonymPath}",  "lenient": true },
"newword":  { "type": "synonym",  "synonyms_path": "${newwordPath}",  "lenient": true },
"stopword": { "type": "stop",     "stopwords_path": "${stopwordPath}" }
```

그런데 `synonym_graph` 필터 하나만 특정 인덱스의 사전 파일 경로를 그대로 박아
놓고 있었다(경로는 가공 예시).

```text
"synonym_graph": {
  "type": "synonym_graph",
  "synonyms_path": "dictionary/synonym/synonym_acme_product.txt",
  "lenient": true
}
```

앞서 말했듯 이 파일은 모든 인덱스가 공유하는 템플릿이다. 즉 어떤 서비스의 인덱스를
새로 만들든, 그 인덱스의 `synonym_graph` 필터는 전부 이 한 인덱스의 동의어 사전을
바라보게 된다. 자기 사전이 아니라 남의 사전으로 동의어를 확장하는 셈이다.
`synonym_graph`를 나중에 추가하면서 다른 필터의 변수화 패턴을 따라가지 못한,
복사-붙여넣기의 잔재였다.

## 해결 2: 사전 경로를 인덱스별 변수로

고친 건 역시 한 줄이다. 하드코딩된 경로를 나머지 필터와 같은 `${synonymPath}`
플레이스홀더로 바꿨다.

```diff
  "synonym_graph": {
    "type": "synonym_graph",
-   "synonyms_path": "dictionary/synonym/synonym_acme_product.txt",
+   "synonyms_path": "${synonymPath}",
    "lenient": true
  }
```

이 `${synonymPath}`는 인덱스를 생성하는 서비스 코드에서, 그 인덱스 이름에 맞는
경로로 치환된다. 대략 이런 흐름이다.

```java
// 템플릿을 읽어 인덱스별 경로로 치환
String synonymsPath = "dictionary/synonym/synonym_" + newIndex + ".txt";
String settings = settingsTemplate
        .replace("${synonymPath}",  synonymsPath)
        .replace("${newwordPath}",  newwordPath)
        .replace("${stopwordPath}", stopwordPath);
```

이제 각 인덱스는 자기 이름에 대응하는 동의어 사전을 바라본다. `synonym_graph`도
다른 필터와 같은 규칙 위에 놓이게 됐다.

## 검증

- 다중어 동의어를 몇 개 골라 `_analyze` API로 색인용·검색용 분석기의 토큰과
  position을 나란히 찍어, 두 분석기의 확장 결과가 일치하는지 확인했다.
- 인덱스를 새로 만들어, 생성된 설정의 `synonym_graph` 경로가 그 인덱스의
  사전(`synonym_<인덱스>.txt`)을 가리키는지 확인했다.

두 커밋 모두 diff는 한 줄이었지만, 남은 건 몇 가지다. 됐다 안 됐다 하는 검색
버그는 분석 단계에 숨어 있는 경우가 많고, 색인용과 검색용 분석기가 서로 다른
필터를 쓰고 있으면 그 불일치 자체가 원인이 된다. 다중어 동의어에는 `synonym_graph`가
맞지만 그래프의 이득은 검색 시점에서 나온다는 점을 알고 써야 한다. 그리고 공용
템플릿에서는 형제 필터들이 이미 지키고 있는 변수화 규칙을 새 설정도 따르는지
확인하는 것만으로 이런 문제를 예방할 수 있다.

<br><br><br><br><br><br><br><br><br><br>
참고 : https://www.elastic.co/guide/en/elasticsearch/reference/current/analysis-synonym-graph-tokenfilter.html
