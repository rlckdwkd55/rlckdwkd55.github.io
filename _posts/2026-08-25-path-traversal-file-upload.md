---
title: "파일 업로드 Path Traversal 취약점 방어"
date: 2026-08-25
categories: [Security, Vulnerability]
tags: [path-traversal, troubleshooting]
description: "사용자 파일명을 검증 없이 저장 경로에 쓰던 코드에서 Path Traversal 위험을 발견하고, 파일명 정규화와 경로 봉쇄 2중 방어로 수정한 과정을 실제 코드로 정리했다."
image:
  path: /assets/img/thumbnails/path-traversal.png
published: false
---

## Path Traversal이란?

**Path Traversal(경로 조작)** 은 공격자가 `../` 같은 상위 디렉터리 이동 문자를 파일명이나
경로 파라미터에 끼워 넣어, **의도한 디렉터리 밖의 파일에 접근**하게 만드는 취약점이다.
업로드 기능에서는 특히 위험하다. 서버가 사용자가 보낸 파일명을 그대로 저장 경로에
붙이면, 파일명 하나로 임의 위치에 파일을 써 버릴 수 있다.

```text
파일명: ../../../../etc/cron.d/evil
결과 경로: /app/uploads/../../../../etc/cron.d/evil  →  /etc/cron.d/evil
```

업로드 루트(`/app/uploads`)를 벗어나 시스템 파일을 덮어쓰거나, 웹에서 실행 가능한
경로에 스크립트를 심는 것까지 가능하다. OWASP에서도 오래된 단골 취약점이다.

이렇게 사용자 입력을 그대로 신뢰해서 생기는 취약점의 전반적인 배경은
[SQL Injection 회고](https://rlckdwkd55.github.io/posts/sql-injection/)에서도 다뤘다.
그 글에서는 쿼리 문자열에 입력을 붙였고, 이번에는 파일 경로에 붙였다는 차이가 있을 뿐
"입력을 신뢰했다"는 뿌리는 같다.

<!-- 이미지: 구글 검색 "경로 탐색 공격 디렉터리 트래버설" · 저장 /assets/img/posts/security/path-traversal/overview.png -->

---

## 문제 코드 (before)

원래 업로드 로직은 사용자가 보낸 `filename`을 **아무 검증 없이** 저장 경로에 그대로
사용했다.

```python
for upload_file in files:
    filename = upload_file.filename          # ← 사용자 입력을 그대로 신뢰
    ...
    unique_filename = FileUtil.generate_unique_filename(filename)
    upload_path = upload_dir / unique_filename
    async with aiofiles.open(upload_path, "wb") as out_file:
        ...
```

`filename`에 `../`가 들어 있으면 `upload_dir / unique_filename`이 업로드 루트 밖을
가리킬 수 있다. `pathlib`의 `/` 연산은 경로를 문자적으로 이어 붙일 뿐, 상위 이동을
막아 주지 않는다. 정상 파일만 올리는 흐름에서는 드러나지 않는 결함이었다.

예를 들어 다음 파일명이 들어오면 검증 전 저장 경로는 이렇게 계산된다.

```text
요청 filename : ../../../../etc/cron.d/evil
generate_unique_filename 후 : ../../../../etc/cron.d/20260825_a1b2_evil
upload_dir / unique_filename : /app/uploads/../../../../etc/cron.d/20260825_a1b2_evil
resolve() 결과 : /etc/cron.d/20260825_a1b2_evil   ← 업로드 루트 밖
```

<!-- 이미지: 구글 검색 "파일 업로드 경로 검증 우회" · 저장 /assets/img/posts/security/path-traversal/before-escape.png -->

---

## 방어: 정규화 + 경로 봉쇄 2중 (after)

실제로 적용한 수정(커밋 메시지: *"파일명 정규화 + 저장 경로가 업로드 루트를
벗어나는지 사전 검증"*)은 두 겹의 방어를 뒀다.

```python
for upload_file in files:
    # 1) 파일명 정규화 — 디렉터리 구성요소를 버리고 마지막 이름만 사용
    filename = LibPath(upload_file.filename).name
    if not filename:
        raise CommonException(ErrorCode.FILE_UPLOAD_ERROR)
    ...
    unique_filename = FileUtil.generate_unique_filename(filename)
    upload_path = upload_dir / unique_filename

    # 2) 경로 봉쇄 — 최종 경로가 업로드 루트 안인지 재확인
    if not upload_path.resolve().is_relative_to(upload_dir.resolve()):
        raise CommonException(ErrorCode.FILE_UPLOAD_ERROR)
    ...
```

앞의 공격 파일명을 이 코드에 통과시키면 두 단계 중 어디서든 걸린다.

```text
요청 filename : ../../../../etc/cron.d/evil
LibPath(...).name : "evil"                    ← 디렉터리 부분이 사라짐
저장 경로 : /app/uploads/20260825_a1b2_evil   ← 루트 안, 정상 저장

요청 filename : ".." 또는 "../"
LibPath(...).name : ""                         ← 빈 문자열
→ CommonException(FILE_UPLOAD_ERROR) 발생 (HTTP 403)
```

### 1) 파일명 정규화 — `Path(...).name`

`Path("../../etc/passwd").name` 은 `"passwd"` 를 돌려준다. 즉 경로 구성요소를 전부
버리고 **마지막 이름만** 남긴다. `../`가 섞여 있어도 디렉터리 부분이 사라지므로
상위 이동이 원천 차단된다. 빈 문자열이 되면(예: 파일명이 `..` 뿐) 업로드를 거부한다.

### 2) 경로 봉쇄 — `resolve().is_relative_to(...)`

정규화만으로 끝내지 않고, **최종 저장 경로를 실제로 계산해 업로드 루트 안에 있는지**
한 번 더 확인한다.

- `resolve()` 는 `..`·심볼릭 링크를 모두 풀어 **정규 절대경로**로 만든다. 문자적으로
  안전해 보여도 심링크를 타고 밖으로 나가는 경우까지 잡아낸다.
- `is_relative_to()`(Python 3.9+) 는 그 경로가 업로드 루트의 하위인지 검사한다.
  아니면 예외로 막는다.

정규화가 1차 필터라면, 경로 봉쇄는 정규화에 허점이 생겨도 마지막을 지키는 검사다.

---

## 왜 2중인가

- 파일명 정규화만 두면: 정규화 규칙에 예외 케이스(인코딩 우회, 플랫폼별 구분자 등)가
  생길 때 그대로 뚫린다.
- 경로 봉쇄만 두면: 막긴 하지만, 파일명에 디렉터리가 섞인 채 로직 곳곳을 흘러다녀
  다른 부작용을 낳을 수 있다.

두 겹을 함께 두면 입력을 정규화하는 단계와 결과를 최종 검증하는 단계가 서로 독립적으로
동작한다. 보안에서 흔히 말하는 다층 방어(defense in depth)다.

---

## 함께 적용한 것들

저장 파일명은 서버가 생성한 UUID로 재명명해, 원본 파일명 자체를 경로나 실행에 쓰지
않도록 했다. 확장자 화이트리스트와 업로드 크기 제한은 이 방어와 별개지만 병행하면
좋아서 함께 뒀다.

```python
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf", ".xlsx"}
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB

ext = LibPath(filename).suffix.lower()
if ext not in ALLOWED_EXTENSIONS:
    raise CommonException(ErrorCode.FILE_UPLOAD_ERROR)

if upload_file.size and upload_file.size > MAX_UPLOAD_SIZE:
    raise CommonException(ErrorCode.FILE_UPLOAD_ERROR)
```

확장자 검사는 실행 가능한 파일이 올라오는 것을, 크기 제한은 디스크를 채우는 식의
남용을 각각 줄여 준다.

---

업로드에서 사용자 파일명은 그대로 신뢰하지 않았다. `Path(name).name` 으로 정규화하고
`resolve().is_relative_to(root)` 로 경로를 봉쇄하는 2중 검증을 넣었고, 정상 흐름이
아니라 악의적 입력이 들어온다는 가정으로 코드를 다시 봤다.

<br><br>
참고 : https://owasp.org/www-community/attacks/Path_Traversal
<br>
참고 : https://docs.python.org/3/library/pathlib.html#pathlib.PurePath.is_relative_to
