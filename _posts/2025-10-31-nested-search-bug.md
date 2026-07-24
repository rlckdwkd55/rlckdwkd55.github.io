---
title: "nested 검색이 첫 문서 하나로만 잘리던 버그"
date: 2025-10-31
categories: [Search]
tags: [elasticsearch, nested, bug, java]
description: "매칭 문서가 여러 건인데도 nested 검색이 첫 문서의 결과만 돌려주던 버그를, for 루프 안의 성급한 return을 걷어내 실제 diff로 고친 기록."
published: false
---

## 증상: 검색은 되는데, 뒤가 잘려 나온다

한 고객사 문서 검색에 nested 필드 검색을 붙였다. 색인도 정상이고 매칭되는 문서가
여러 건인 걸 아는데, 응답 `hits`에는 **맨 앞 문서의 하위 결과만** 담겨 나왔다.
에러가 나는 것도 아니고 빈 배열이 오는 것도 아니라서, 처음엔 "쿼리를 이렇게 짜면
원래 이만큼만 나오나?" 하고 넘어갈 뻔했다.

특히 테스트로 쓰던 데이터가 대체로 매칭 문서 한 건짜리라, 첫 문서에 하위 매칭이
하나만 있을 때는 **딱 1건**이 내려왔다. 그래서 한동안은 "nested 검색은 결과가 한 건만
나온다"는 잘못된 감으로 지나갔다. 문서를 여러 건 매칭시키는 실제 케이스를 돌려 보고
나서야 뒤가 통째로 잘리고 있다는 걸 알았다.

부모 문서 두 건(A-001, A-007)이 매칭되고, 그중 A-001 안에 자식 매칭이 두 건 있는
데이터로 재현했을 때 응답은 이랬다. A-007은 아예 흔적도 없었다.

```text
// before — 매칭 부모는 2건인데 첫 문서(A-001)의 자식만 담겨 나온다
{
  "totalHits": 2,
  "hits": [
    { "docId": "A-001", "title": "설치 안내", "body": "..." },
    { "docId": "A-001", "title": "환불 규정", "body": "..." }
  ]
}
```

## 배경: nested 문서와 nested 쿼리

Elasticsearch에서 배열 안의 객체를 독립된 하위 문서로 다루고 싶을 때 `nested` 타입을
쓴다. (Elasticsearch가 문서를 어떻게 색인하고 찾는지는 [역색인 정리](https://rlckdwkd55.github.io/posts/elasticsearch-inverted-index/)에
따로 적어 뒀다.) 하나의 상위 문서(부모)가 여러 개의 항목(자식)을 배열로 갖고, 각
항목의 필드끼리 짝을 맞춰 검색해야 하는 구조다. 대략 이런 모양이다.

```json
{
  "docId": "A-001",
  "sections": [
    { "title": "설치 안내", "body": "..." },
    { "title": "환불 규정", "body": "..." }
  ]
}
```

`sections`를 nested로 매핑하면 `sections.title`과 `sections.body`가 **같은 항목**
안에서 매칭되는지 따질 수 있다. 그리고 nested 쿼리에 `inner_hits`를 켜 두면, 부모 문서
안에서 **실제로 매칭된 자식 항목들**이 따로 딸려 온다. 우리 검색 로직은 이 `inner_hits`를
꺼내 평평한 리스트로 변환해서 내려주는 방식이었다.

여기서 핵심은 계층이 두 겹이라는 점이다. **매칭되는 부모 문서가 여러 건**일 수 있고, 각
부모 문서 안에 **매칭되는 자식 항목이 여러 건**일 수 있다. 버그는 이 바깥쪽 계층,
그러니까 "부모 문서 여러 건"을 처리하는 데서 났다.

## 원인: 루프 첫 회차에서 함수가 끝나 버렸다

검색 응답의 hits(부모 문서들)를 순회하는 `for` 루프가 있었는데, nested 분기가 그
**루프 안에** 들어가 있었다. 그리고 조건을 만족하면 그 자리에서 바로 `return` 했다.

```java
// before — 루프 안에서 첫 hit을 처리하자마자 return
for (Hit<Map<String, Object>> hit : hits) {
    if (searchDTO.getWhere() != null
            && searchDTO.getWhere().getSearchType().equals(SearchType.NESTED)) {
        return this.nestedQueryHit(result, hit, searchDTO.getWhere().getNestedQuery().getPath());
    }
    // ... nested가 아닐 때의 일반 hit 처리
}
```

`nestedQueryHit`는 넘겨받은 **hit 하나**의 `inner_hits`만 꺼내 `result`에 담고 돌려줬다.

```java
// before — 넘겨받은 부모 문서 1건의 inner_hits만 처리
private Map<String, Object> nestedQueryHit(Map<String, Object> result,
                                           Hit<Map<String, Object>> hit, String path) {
    List<Hit<JsonData>> innerHits = hit.innerHits().get(path).hits().hits();
    List<Map<String, Object>> hitMaps = new ArrayList<>();
    for (Hit<JsonData> innerHit : innerHits) {
        // ... innerHit → Map 변환
        hitMaps.add(hitMap);
    }
    result.put("totalHits", hitMaps.size());
    result.put("hits", hitMaps);
    return result;
}
```

즉 부모 문서가 몇 건이 매칭되든, 루프는 **0번째 부모 문서에서 곧장 return**되어 함수
자체가 끝났다. 두 번째 이후의 부모 문서는 순회조차 되지 않았다. 반환된 건 첫 부모 문서
안의 자식 매칭이 전부였고, 앞의 응답에서 A-007이 사라진 이유가 이것이다.

한 가지 더 눈에 걸린 건 저 `if` 조건이 **hit과 아무 상관이 없다**는 점이었다.
`searchDTO.getWhere().getSearchType()`는 요청 한 건 안에서 절대 안 변하는, 루프 불변
(loop-invariant) 값이다. 매 회차 똑같은 판정을 반복할 뿐인 조건을 루프 안에 둔 것 자체가
설계가 어긋났다는 신호였다. 검색 종류는 루프에 들어가기 전에 한 번만 갈라도 됐다.

## 해결: 분기를 루프 밖으로 빼고, 전부 모아서 반환

고친 방향은 단순하다. nested 판정을 루프 밖으로 끌어내고, nested면 **모든 부모 문서를
끝까지 돌면서** 각 문서의 자식 매칭을 리스트에 누적한 뒤, 루프가 끝나고 한 번에 반환한다.

```java
// after — nested 분기를 루프 밖으로, 전 문서를 순회해 누적
if (searchDTO.getWhere() != null
        && searchDTO.getWhere().getSearchType().equals(SearchType.NESTED)) {
    String path = searchDTO.getWhere().getNestedQuery().getPath();
    List<Map<String, Object>> nestedHitMaps = new ArrayList<>();
    for (Hit<Map<String, Object>> hit : hits) {
        nestedHitMaps.addAll(extractNestedHits(hit, path));   // 각 부모의 자식들을 누적
    }
    result.put("totalCount", hitsMetadata.total().value());
    result.put("totalHits", nestedHitMaps.size());
    result.put("hits", nestedHitMaps);
    return result;
}

// nested가 아니면 기존 일반 검색 처리로
for (Hit<Map<String, Object>> hit : hits) {
    // ...
}
```

보조 함수도 손봤다. `result`를 받아 옆에서 변형하고 돌려주던 구조 대신, **자식 매칭
리스트만** 반환하도록 시그니처를 바꿨다. 이름도 역할에 맞게 `extractNestedHits`로 고쳤다.

```java
// after — result를 건드리지 않고 리스트만 반환
private List<Map<String, Object>> extractNestedHits(Hit<Map<String, Object>> hit, String path) {
    List<Hit<JsonData>> innerHits = hit.innerHits().get(path).hits().hits();
    List<Map<String, Object>> hitMaps = new ArrayList<>();
    for (Hit<JsonData> innerHit : innerHits) {
        // ... innerHit → Map 변환
        hitMaps.add(hitMap);
    }
    return hitMaps;   // 누가 어떻게 모을지는 호출부가 결정
}
```

반환 타입을 `Map`(결과 통짜 하나)에서 `List`(자식 매칭들)로 바꾼 게 의외로 컸다.
`extractNestedHits`는 이제 "부모 하나에서 자식들을 뽑는다"는 한 가지 일만 하고, 여러
부모의 결과를 어떻게 합쳐 `totalHits`를 매길지는 호출부가 책임진다. 책임이 갈리니 "왜
이 함수가 남의 `result`를 고치지?" 같은 애매함도 사라졌다.

같은 데이터로 다시 돌리니 A-007까지 담겨 나왔다. 부모 문서 수(`totalCount`)와 자식
매칭 총합(`totalHits`)이 이제 서로 다른 값으로, 두 겹 계층을 각각 드러낸다.

```text
// after — 매칭 부모 2건의 자식이 모두 담긴다
{
  "totalCount": 2,
  "totalHits": 3,
  "hits": [
    { "docId": "A-001", "title": "설치 안내", "body": "..." },
    { "docId": "A-001", "title": "환불 규정", "body": "..." },
    { "docId": "A-007", "title": "배송 정책", "body": "..." }
  ]
}
```

## 왜 이 버그가 오래 숨어 있었나

이건 "결과가 아예 안 나오는" 버그가 아니라 **"나오긴 하는데 뒤가 잘리는"** 버그였다.
후자가 훨씬 늦게 잡힌다.

- 완전히 비면 바로 알아챈다. 하지만 첫 문서 결과가 멀쩡히 내려오면, 화면에도 뭔가 뜨고
  200도 떨어지니 "정상"으로 보인다.
- 개발·테스트에서 쓰던 표본이 매칭 부모 문서 한 건짜리인 경우가 많았다. 부모가 하나뿐이면
  "첫 문서만 반환"과 "전부 반환"의 결과가 **완전히 똑같다**. 버그가 데이터에 가려졌다.
- 게다가 그 한 건 안의 자식 매칭이 하나일 때는 정확히 1건이 떨어져서, "원래 이런 API인가"
  하는 잘못된 상식까지 만들어졌다.

정상 데이터에서 우연히 정답과 같아지는 버그는, 표본을 일부러 어긋나게 만들기 전까지는
드러나지 않는다.

## 재발 방지: 테스트를 경계 조건으로 몬다

수정 자체는 몇 줄이지만, 다시 안 새게 만드는 건 테스트 쪽이었다. 회귀를 잡는 최소 조건은
**부모 다건 × 자식 다건**이다. "부모 2건 이상, 그중 하나는 자식 2건 이상"을 픽스처로
고정하고, 개수를 단언한다.

```java
@Test
void nested검색은_매칭된_모든_부모문서의_자식을_반환한다() {
    // given: 부모 2건, 그중 A-001만 자식 2건이 매칭되도록 색인
    index("A-001", section("설치 안내", "..."), section("환불 규정", "..."));
    index("A-007", section("배송 정책", "..."));

    // when
    Map<String, Object> result = searchService.search(nestedSearchDTO(path));

    // then: 첫 부모에서 끊기면 totalHits=2, hits.size()=2로 깨진다
    assertThat(result.get("totalCount")).isEqualTo(2L);   // 매칭 부모 문서 수
    assertThat(result.get("totalHits")).isEqualTo(3);     // 자식 매칭 총합
    assertThat((List<?>) result.get("hits")).hasSize(3);
}
```

`hits`가 비었는지만 보면 이 버그는 절대 안 잡힌다. "0인가 아닌가"가 아니라 "N인가 1인가"로만
드러나기 때문이다. `totalHits`와 실제 `hits.size()`가 기대값과 맞는지, 그리고 서로
일치하는지까지 확인해야 한다. 여기에 더해, 회차마다 결과가 같은 루프 불변 조건이 루프
안에 있으면 리뷰에서 걸러 낸다. 검색 종류처럼 요청 단위로 고정된 값은 진입점에서 한 번만
가르는 게 맞다.

## 남는 것

원인은 nested 분기가 hits 루프 안에 있었고, 첫 회차에서 `return`해 함수가 끝나 버린
것이었다. 분기를 루프 밖으로 빼고 전 문서를 순회하며 자식 매칭을 리스트에 모아 한 번에
반환하도록 고쳤고, 보조 함수는 `result`를 변형하는 대신 리스트만 돌려주도록 시그니처를
바꿔 "부모 하나에서 뽑기"와 "여러 부모를 합치기"의 책임을 갈랐다.

돌아보면 반환 타입이 의도를 먼저 말해 줬다. 단건을 돌려주는 함수는 "찾으면 끝"에 가깝고,
리스트를 돌려주는 함수는 "다 모은다"에 가깝다. 이번 함수는 후자여야 했는데 전자처럼
`return`하고 있었다. 그리고 정상 데이터에서 정답과 같아지는 버그는, 표본을 경계로
몰기 전까지는 이렇게 조용히 살아남는다.
