---
title: "Tika 업그레이드와 commons-lang3 의존성 충돌 해결"
date: 2025-12-12
categories: [Problem]
tags: [gradle, dependency, spring-boot]
description: "XXE(CVE-2025-66516) 패치를 위한 Tika 메이저 업그레이드 후, zip 처리에서 터진 commons-lang3 전이 의존성 충돌(NoSuchMethodError)을 dependencyManagement로 버전을 강제해 해결한 실전 회고."
image:
  path: /assets/img/thumbnails/dependency-conflict.png
published: false
---

## 배경: 보안 패치 때문에 Tika를 올려야 했다

첨부문서 색인 파이프라인에서 텍스트 추출에 Apache Tika를 쓰고 있었다. 오래
`tika-core:2.9.2`, `tika-parsers-standard-package:2.9.2` 조합으로 별문제 없이
돌아가던 코드였다.

문제는 보안이었다. [Tika에 XXE 취약점(CVE-2025-66516, CVSS 10.0)이 공개](https://rlckdwkd55.github.io/posts/tika-xxe-cve/)되면서,
2.x 라인을 그대로 둘 수 없게 됐다. 조작된 XML이 포함된 문서를 파싱하면 외부 엔티티가
로딩될 수 있는 결함이라, 사내에 외부 유입 파일을 그대로 색인하는 우리 구조에선 그냥
넘길 수 있는 등급이 아니었다.

패치가 들어간 최소 안전 버전이 `3.x`대여서, 결국 **`2.9.2 → 3.2.2` 메이저
업그레이드**를 결정했다. build.gradle의 버전 문자열 두 줄만 바꾸면 끝나는 일로 봤다.

```groovy
implementation 'org.apache.tika:tika-core:3.2.2'
implementation 'org.apache.tika:tika-parsers-standard-package:3.2.2'
```

컴파일은 깔끔하게 통과했다. 그래서 다 됐다고 생각했다.

## 증상: 컴파일은 되는데 런타임에 NoSuchMethodError

문제는 실제 파일을 흘려보내면서 드러났다. 일반 문서(pdf, docx)는 멀쩡히 추출됐는데,
**zip으로 묶인 첨부를 처리하는 순간** 예외가 터졌다.

```text
java.lang.NoSuchMethodError:
'java.lang.String org.apache.commons.lang3.SystemProperties.getUserName(java.lang.String)'
    at org.apache.commons.compress.archivers.zip.ZipFile...
    at org.apache.tika.parser.pkg.PackageParser.parse...
```

`NoSuchMethodError`는 처음 보면 당황스럽다. 컴파일러가 통과시킨 코드인데 런타임에
"그런 메서드 없다"고 하니, 코드 버그처럼 보이지 않는다. 실제로도 코드 버그가 아니었다.

핵심은 **컴파일 시점과 런타임 시점의 클래스가 다르다**는 것이다.

- `NoClassDefFoundError`는 클래스 자체가 클래스패스에 없을 때,
- `NoSuchMethodError`는 클래스는 있는데 **기대한 시그니처의 메서드가 그 버전엔 없을 때**

난다. 후자는 거의 항상 **버전 충돌**의 신호다. 컴파일할 땐 A라이브러리 최신 버전
헤더를 보고 빌드했는데, 런타임 클래스패스엔 그보다 낮은 버전이 올라가 있는 상황.

## 원인 추적: 누가 어떤 버전을 끌어오는가

에러 메시지가 이미 범인을 반쯤 지목하고 있었다. `commons-lang3`의
`SystemProperties.getUserName(String)`을 호출하는 쪽은 `commons-compress`의 zip
처리 코드였다. 의존성 트리를 떠서 관계를 확인했다.

```bash
./gradlew dependencies --configuration runtimeClasspath
```

정리하면 이런 구도였다.

- **Tika 3.2.2**가 zip/office 포맷 처리를 위해 **`commons-compress:1.28.0`** 을 끌어온다.
- 그 `commons-compress:1.28.0`은 최신 `commons-lang3` API —
  `SystemProperties.getUserName(String)` — 를 호출한다. 이 메서드는 비교적 최근
  버전에서 추가된 것이다.
- 그런데 우리 프로젝트의 `commons-lang3` 유효 버전은 **`3.14.0`** 이었다.
  Spring Boot BOM(우린 `org.springframework.boot` 3.3.2를 쓴다)이 관리하는 버전이
  3.14.0이었고, `io.spring.dependency-management` 플러그인이 이 값으로 전체 트리를
  **수렴**시키고 있었다.

즉 Tika를 3.2.2로 올리면서 `commons-compress`는 1.28.0으로 딸려 올라갔는데,
`commons-lang3`는 BOM이 3.14.0에 붙잡아 두고 있으니, **새 라이브러리가 요구하는 API가
클래스패스의 실제 버전에 존재하지 않는** 어긋남이 생긴 것이다. 컴파일 타임엔
`commons-compress`가 자기 API로 빌드되니 문제없이 통과하고, 런타임에 3.14.0짜리
`SystemProperties`를 만나는 순간 터진다.

> BOM은 "이 스택에서 검증된 버전 조합"을 강제해 주는 편리한 장치지만, 반대로 말하면
> **전이 의존성 버전을 내 의도와 무관하게 고정**한다. 새 라이브러리를 얹을 때 BOM이
> 붙잡아 둔 버전과 새 라이브러리가 요구하는 버전이 어긋나면, 바로 이런 함정에 빠진다.
{: .prompt-warning }

## build.gradle: before / after

**before** — Tika 버전만 올린 상태. `dependencyManagement`에는 Spring Cloud BOM
import만 있고, `commons-lang3`는 Spring Boot BOM이 관리하는 3.14.0에 방치돼 있었다.

```groovy
dependencyManagement {
    imports {
        mavenBom("org.springframework.cloud:spring-cloud-dependencies:2023.0.3")
    }
}

dependencies {
    // ...
    // Tika
    implementation 'org.apache.tika:tika-core:2.9.2'
    implementation 'org.apache.tika:tika-parsers-standard-package:2.9.2'
}
```

**after** — Tika를 3.2.2로 올리고, 충돌하는 `commons-lang3`를 요구 API가 들어 있는
버전으로 **명시적으로 상향 고정**했다.

```groovy
dependencyManagement {
    imports {
        mavenBom("org.springframework.cloud:spring-cloud-dependencies:2023.0.3")
    }
    dependencies {
        // Spring Boot BOM이 강제하는 3.14.0은 Tika 3.2.2가 끌어오는 commons-compress:1.28.0이
        // 요구하는 SystemProperties.getUserName(String)이 없어 zip 처리 시 NoSuchMethodError 발생.
        dependency 'org.apache.commons:commons-lang3:3.18.0'
    }
}

dependencies {
    // ...
    // Tika (CVE-2025-66516 XXE 수정을 위해 3.2.2 이상으로 업그레이드)
    implementation 'org.apache.tika:tika-core:3.2.2'
    implementation 'org.apache.tika:tika-parsers-standard-package:3.2.2'

    // HWPX (Tika가 지원하지 않는 한글 HWPX 포맷 보강)
    implementation 'kr.dogfoot:hwpxlib:1.0.5'
}
```

포인트는 `dependencyManagement`의 `dependencies` 블록이다. 여기서 버전을 선언하면
BOM이 관리하던 기본값(3.14.0)을 **덮어써서**, 트리 전체가 3.18.0으로 수렴한다.
개별 `implementation`에 버전을 박는 것과 달리, 전이 의존성으로 딸려 오는 것까지
한 곳에서 일괄 고정할 수 있어서 이런 충돌엔 이 방식이 깔끔하다.

3.18.0을 고른 기준은 단순하다. `commons-compress:1.28.0`이 요구하는 API가 들어 있고,
동시에 Spring Boot 스택의 다른 라이브러리와도 호환되는 하위 호환 버전 중 하나였다.
버전을 올릴 땐 무작정 최신이 아니라, **"요구 API를 만족하는 가장 보수적인 버전"** 을
고른다.

> 참고로 위 커밋에는 이 충돌 수정 외에도 [침묵 절단 결함 교체](https://rlckdwkd55.github.io/posts/tika-silent-truncation/),
> SAX 스트리밍 전환, HWPX 포맷 지원 등 Tika 3.x 이관에 따른 후속 작업이 함께 들어갔다.
> 여기선 의존성 충돌 부분만 떼어 정리한다.

## 다시 검증

버전 고정 후 다시 zip 첨부를 흘려보냈다. `NoSuchMethodError`는 사라졌고, zip 내부
엔트리까지 정상적으로 텍스트가 추출됐다. 마지막으로 의존성 트리를 다시 떠서
`commons-lang3`가 3.18.0 단일 버전으로 수렴했는지, 다른 라이브러리가 3.14.0을
요구하며 downgrade 경고를 내지 않는지 확인하고 마무리했다.

## 배운 것

- **`NoSuchMethodError`는 코드 버그가 아니라 버전 충돌의 신호다.** "분명 있는
  메서드가 없다"면 코드를 노려보기 전에 런타임 클래스패스에 실제로 올라간 버전을
  의심한다. `NoClassDefFoundError`(클래스 없음)와 구분해서 읽으면 진단이 빨라진다.
- **BOM은 전이 의존성 버전을 내 의도와 무관하게 강제한다.** 편리함의 대가다.
  라이브러리를 메이저 업그레이드할 땐 그 라이브러리가 새로 끌어오는 전이 의존성과
  BOM이 고정한 버전이 어긋나지 않는지 반드시 확인한다.
- **의존성 트리는 추측하지 말고 뜬다.** `gradle dependencies`로 "누가 무엇을 어떤
  버전으로 끌어오는지"를 눈으로 봐야 범인이 잡힌다. 에러 메시지의 클래스/메서드
  이름이 이미 절반을 알려 준다.
- **버전 충돌은 `dependencyManagement`에서 한 곳으로 고정한다.** 개별 모듈에
  버전을 흩뿌리는 것보다, 전이 의존성까지 일괄 수렴시키는 편이 나중에 읽기 쉽고
  재발도 줄인다.
- **업그레이드는 "빌드 성공"이 아니라 "실제 동작"까지가 완결이다.** 보안 패치 한 줄이
  이렇게 곁가지 런타임 충돌을 부른다. 컴파일 통과에서 멈추지 않고, 문제되는 입력
  (여기선 zip)까지 태워 봐야 끝난 것이다.

## 정리

XXE 패치를 위한 Tika `2.9.2 → 3.2.2` 업그레이드가, 전이 의존성으로 딸려 온
`commons-compress:1.28.0`과 BOM이 붙잡아 둔 `commons-lang3:3.14.0` 사이의 어긋남으로
런타임 `NoSuchMethodError`를 불렀다. 원인은 코드가 아니라 **버전 수렴의 실패**였고,
해결은 `dependencyManagement`에서 `commons-lang3:3.18.0`을 명시해 트리 전체를 요구
API가 있는 버전으로 강제하는 것이었다. 메이저 업그레이드에선 버전 문자열 한 줄이
아니라 그 라이브러리가 끌고 오는 의존성 그래프 전체를 본다는 것을, 이 한 번으로
확실히 새겼다.
