---
title: "HWPX 포맷이란?"
date: 2025-12-27
categories: [Search, Parsing]
tags: [hwpx, owpml, korean]
description: "개방형 표준 HWPX(OWPML)의 ZIP 컨테이너 구조와 본문 XML을 뜯어보며, 바이너리 HWP와의 차이 및 텍스트 추출 지점을 정리한다."
image:
  path: /assets/img/thumbnails/hwpx.png
---

## 왜 한글 문서가 문제인가

문서 검색의 관문은 "이 파일에서 글자를 어떻게 뽑는가"이다. PDF·DOCX·PPTX는 성숙한 도구가
갖춰져 있다. 문제는 한글(`.hwp`)이다. 국내 공공기관·기업 문서에서 한글 파일의 비중은
압도적이라, 공고문·사업계획서·서식이 대부분 한글로 오간다. 검색 대상에서 한글 문서가
빠지면 사실상 실무에서 쓸 수 없는 검색이 된다.

그런데 `.hwp`와 `.hwpx`는 확장자만 다른 문서가 아니라 근본적으로 다른 물건이다. 이 글은
포맷 자체를 뜯어보며 그 차이와 추출 지점을 정리한 것이다.

## `.hwp` — 바이너리 복합 문서

전통적인 `.hwp`는 한컴 고유의 **바이너리 복합 문서(compound file)** 다. 마이크로소프트의
OLE 복합 파일 구조 위에, 한컴이 정의한 레코드들이 압축돼 들어앉은 형태다. 즉 **하나의 파일
안에 여러 스트림이 디렉터리처럼 담긴 바이너리 덩어리**다.

이것이 벽이 되는 이유는, 포맷 명세를 모르는 외부 도구는 이 바이너리를 해석할 방법이 없기
때문이다. 어디가 문단이고, 어느 바이트가 글자이고, 어느 부분이 서식인지 알려면 한컴이
공개한 명세를 그대로 구현해야 한다. "텍스트만 뽑고 싶다"는 요구조차 만만치 않다.

## `.hwpx` — 열어보면 ZIP이다

이를 개방형으로 푼 것이 **`.hwpx`** 다. HWPX는 **OWPML(Open Word-Processor Markup
Language)** 이라는 XML 기반 표준을 따른다. 이 표준은 국가표준(KS X 6101)으로 제정돼 명세가
공개돼 있어 누구나 구현할 수 있다.

핵심은 **`.hwpx` 파일의 확장자를 `.zip`으로 바꾸면 그대로 압축이 풀린다**는 점이다.
바이너리 벽처럼 보이던 것이, 실은 XML 파일 여러 개를 묶은 압축 파일이다.

![](/assets/img/posts/search/hwpx/zip-structure.png)

```text
sample.hwpx  (실은 ZIP 컨테이너)
├─ mimetype                    ← "application/hwp+zip" (맨 앞, 무압축 저장)
├─ version.xml                 ← 포맷 버전
├─ settings.xml                ← 문서 설정
├─ Contents/
│  ├─ content.hpf              ← 패키지 매니페스트(어떤 파일이 들었는지)
│  ├─ header.xml               ← 글꼴·글자모양·문단모양 등 공통 참조 정보
│  ├─ section0.xml             ← 본문 1구역 (문단·텍스트)
│  └─ section1.xml             ← 본문 2구역 ...
├─ BinData/                    ← 삽입된 이미지 등 바이너리
├─ Preview/                    ← 미리보기 텍스트·이미지
└─ META-INF/
   ├─ container.xml
   └─ manifest.xml
```

구조가 드러나면 텍스트 추출이 "ZIP을 풀고 본문 XML을 읽는 일"이 되는 까닭이 분명해진다.
본문 글자는 전부 **`Contents/section*.xml`** 안에 있고, 글꼴·서식 같은 참조 정보는
**`header.xml`** 이 따로 들고 있다.

> `mimetype` 엔트리는 ZIP의 **맨 앞에, 압축 없이** 저장된다. 파일을 통째로 풀지 않고
> 앞부분만 읽어도 HWPX임을 판별하게 하려는 설계로, ODF·EPUB이 쓰는 방식과 같다. 개방형
> 문서 포맷들이 닮은 관습을 공유하는 지점이다.

## 본문 XML의 구조

`section0.xml` 내부를 단순화하면 다음 뼈대다.

```text
<hs:sec ...>
  <hp:p>                        <!-- 문단(paragraph) -->
    <hp:run>                    <!-- 같은 서식이 이어지는 구간(run) -->
      <hp:t>안녕하세요. </hp:t>  <!-- 실제 텍스트 -->
    </hp:run>
    <hp:run>
      <hp:t>반갑습니다.</hp:t>
    </hp:run>
  </hp:p>
</hs:sec>
```

`hp`, `hs` 같은 접두어는 OWPML이 정의한 XML 네임스페이스(문단·구역 등)를 가리킨다. 구조는
**구역(sec) → 문단(p) → 런(run) → 텍스트(t)** 의 중첩이다. DOCX(OOXML) 역시 **문단
`<w:p>` → 런 `<w:r>` → 텍스트 `<w:t>`** 라는 사실상 같은 3단 구조를 쓴다. "서식이 바뀌는
지점마다 런으로 쪼갠다"는 관습을 두 포맷이 공유한다.

## HWP vs HWPX vs DOCX

세 포맷을 나란히 놓으면 지형이 정리된다.

| | HWP | HWPX | DOCX |
|---|---|---|---|
| 성격 | 바이너리 복합 문서 | 개방형 표준 | 개방형 표준 |
| 표준 | 한컴 고유(비공개 관행) | OWPML(KS X 6101) | OOXML(ISO/IEC 29500) |
| 컨테이너 | OLE 복합 파일 | **ZIP** | **ZIP** |
| 본문 형식 | 바이너리 레코드 | **XML** | **XML** |
| 본문 위치 | 내부 스트림 | `Contents/section*.xml` | `word/document.xml` |
| 텍스트 3단 구조 | (자체 레코드) | sec → p → run → t | body → p → r → t |
| 외부 파싱 | 어려움(명세 구현 필요) | 쉬움(압축+XML) | 쉬움(압축+XML) |

정리하면 **HWPX는 "한글판 DOCX"에 가깝다**. 컨테이너가 ZIP이고 본문이 XML이라는 큰 그림이
동일하고, 다른 것은 네임스페이스·엘리먼트 이름·세부 스키마뿐이다.

## 왜 범용 파서는 HWPX를 못 읽나

구조가 DOCX와 닮았는데도
[Apache Tika](https://rlckdwkd55.github.io/posts/apache-tika/) 같은 범용 추출기는
DOCX·PPTX는 읽으면서 HWPX는 빈 텍스트로 뱉는다. 이유는 "구조가 비슷한 것과 그 구조를 아는
것은 다른 문제"라는 데 있다. Tika가 DOCX를 읽는 것은 OOXML **스키마에 맞춘 전용 파서**를
내장했기 때문이지, ZIP+XML이면 자동으로 읽어서가 아니다. HWPX 본문 XML을 의미 있게 읽으려면
**OWPML 스키마(어떤 엘리먼트가 문단이고 텍스트인지)를 아는 파서**가 필요하다. 그것이 없으면
압축을 풀어 XML을 봐도 파서 입장에서는 "정체 모를 XML"일 뿐이다.

국내 위주로 쓰이는 포맷이라 글로벌 범용 도구가 기본 지원하지 않는 사정도 겹친다. 그래서
실무에서는 HWPX 전용 오픈소스 라이브러리(예: `hwpxlib`)를 따로 붙인다. 파일 종류를 먼저
판별해 **HWPX면 전용 파서로, 그 외는 기존 추출기로 보내는 분기**를 두는 방식이다.

```text
isHwpx(file)  →  hwpxlib 로 추출   (OWPML 스키마를 아는 전용 파서)
   else        →  Tika 로 추출     (PDF·DOCX·PPTX ...)
```

## 텍스트 추출의 함정

"글자만 이어붙이면 된다"는 순진한 접근이다. 본문 XML에서 텍스트를 뽑을 때 몇 가지 함정이
있다.

- **런 경계**: 한 문장이 서식 때문에 여러 `<hp:run>`/`<hp:t>` 로 잘려 있다. 이어붙이면
  되지만, 문단(`<hp:p>`)이 끝나는 지점에 **줄바꿈을 넣지 않으면** 앞뒤 문단 글자가 들러붙어
  엉뚱한 단어가 만들어진다. 검색 색인에서는 조용한 품질 저하로 이어진다.
- **표(table)**: 표는 별도 엘리먼트(셀 안에 다시 문단이 중첩)로 들어 있어, 읽는 순서를
  신경 쓰지 않으면 셀 텍스트가 뒤섞인다.
- **각주·머리말 등**: 본문 흐름 밖의 텍스트가 별도 구조로 있어, 필요에 따라 포함·제외를
  판단해야 한다.

이 지점에서 **DOM으로 트리를 통째로 올릴지, SAX로 이벤트만 흘려보낼지**의 선택도 따라온다.
크기를 예측할 수 없는 업로드 문서라면 스트리밍이 안전한데, 이 파싱 방식의 차이는
[SAX vs DOM](https://rlckdwkd55.github.io/posts/sax-vs-dom-parsing/) 에서 따로 다룬다.

---

`.hwp`는 명세를 구현하지 않으면 외부 도구가 열기 어렵고, `.hwpx`는 **OWPML(KS X 6101) 기반
개방형 표준**으로 열어보면 **ZIP 컨테이너 + XML**이다. 본문은 `Contents/section*.xml`에
**구역→문단→런→텍스트**로 담기며, 이는 DOCX(OOXML)의 3단 구조와 동형이다. 다만 구조가
닮았어도 범용 파서는 OWPML 스키마를 몰라 읽지 못하므로 전용 라이브러리로 분기해야 하고,
추출은 단순 이어붙이기가 아니라 문단 경계·표·각주 구조를 존중해야 한다.

포맷을 뜯어본 뒤라야 실제 색인 파이프라인에 붙이는 작업이 또렷해진다. 그 연동 과정은
[Tika에 HWPX 붙이기](https://rlckdwkd55.github.io/posts/hwpx-integration/) 에서 이어 다룬다.

<br><br><br><br><br><br><br><br><br><br>
참고 : https://github.com/neolord0/hwpxlib <br>
참고 : https://tech.hancom.com/hwpxformat/
