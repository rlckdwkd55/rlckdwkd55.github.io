---
title: "재임베딩 순서를 뒤집어 데이터 유실을 막은 과정 (build-then-swap)"
date: 2026-03-22
categories: [Problem]
tags: [qdrant, embedding, data-integrity]
description: "문서 재임베딩 시 '삭제 후 생성' 순서가 부른 데이터 유실 위험을, 벡터 DB의 비트랜잭션성·멱등성 관점에서 분석하고 build-then-swap으로 바꾼 과정을 실제 코드로 정리한다."
image:
  path: /assets/img/thumbnails/reembedding-order.png
published: false
---

## 배경: 벡터 DB의 "포인트"와 재임베딩

RAG에서 문서는 여러 청크로 나뉘어 벡터 DB에 저장된다. [Qdrant](https://rlckdwkd55.github.io/posts/qdrant/) 기준으로 각 청크는
**포인트(point)** — `id + 벡터 + payload(원문/메타)` 한 덩어리 — 로 저장된다.
문서 내용이 바뀌면 그 청크에 해당하는 **기존 포인트를 새 임베딩으로 교체**해야 하는데,
이 "교체"는 결국 두 개의 독립적인 연산으로 이루어진다.

- **저장(upsert)**: 새 내용을 임베딩해 포인트로 넣기
- **삭제(delete)**: 기존 포인트 지우기

문제의 씨앗은 여기 있었다. **이 두 연산을 어떤 순서로, 실패까지 고려해서 하느냐.**

---

## 문제: 삭제가 먼저였다 (before)

초기 구현은 이름 그대로였다. docstring도 *"기존 포인트 삭제 후 재임베딩하여 저장"*.

```python
async def update_chunk(self, collection_name, point_id, new_content, metadata):
    """단일 청크 수정 (기존 포인트 삭제 후 재임베딩하여 저장)"""
    pid = parse_point_id(point_id)

    # 1) 기존 포인트 먼저 삭제
    await self.client.delete(
        collection_name=collection_name,
        points_selector=PointIdsList(points=[pid]),
    )

    # 2) 재임베딩 후 저장 — 여기서 실패하면?
    new_doc = Document(page_content=new_content, metadata=metadata)
    await self.add_documents(collection_name, [new_doc])
```

정상 흐름에서는 완벽하다. 그러나 2번 `add_documents`는 **임베딩 모델 호출 + 벡터
저장**을 포함하는, 외부 의존성이 있는 작업이다.

### 실패 모드 분석

2번이 실패하는 경로는 생각보다 많다.

- 임베딩 서버(vLLM/로컬 모델) 다운, 타임아웃
- 외부 임베딩 API의 rate limit·네트워크 오류
- 저장 시 벡터 차원 불일치·디스크 문제
- 그 사이 프로세스 크래시

이 중 하나라도 걸리면, **1번에서 이미 지운 기존 포인트는 복구할 수 없다.** 사용자는
"수정"을 눌렀을 뿐인데 원본이 통째로 사라진다. 정상 흐름 테스트로는 절대 안 잡히고,
오직 실패 경로(fail path)에만 숨어 있던 결함이었다.

<!-- 이미지: 구글 검색 "blue green reindex build then swap" · 저장 /assets/img/posts/ai/reembedding/<name>.png -->

---

## 왜 그냥 트랜잭션으로 못 묶나?

"두 연산을 트랜잭션으로 묶어 원자적으로 처리하면 되지 않나?" 싶지만, 그럴 수 없었다.

- **벡터 DB는 다중 연산 ACID 트랜잭션을 (일반적으로) 제공하지 않는다.** Qdrant의
  delete·upsert는 각각 독립 요청이고, 둘을 하나의 롤백 단위로 묶을 방법이 없다.
- 설령 DB 트랜잭션이 있어도 **2번의 임베딩 호출은 외부 네트워크 I/O**라 트랜잭션
  경계 밖이다. 외부 호출은 롤백되지 않는다.

즉 "원자성"을 DB에 기댈 수 없으니, **연산 순서와 실패 시 상태 설계로 안전성을 확보**해야
했다. 이것이 build-then-swap의 출발점이다.

---

## 해결: build-then-swap (after, 실제 변경)

순서를 뒤집었다. **먼저 새로 만들고(build), 성공을 확인한 뒤 기존 것을 정리(swap)** 한다.
docstring부터 의도를 명확히 바꿨다.

```python
async def update_chunk(self, collection_name, point_id, new_content, metadata):
    """단일 청크 수정 (재임베딩한 새 포인트를 먼저 저장한 뒤 기존 포인트를 삭제).
    재임베딩/저장이 실패해도 기존 청크가 보존되도록 삭제보다 먼저 수행한다."""
    pid = parse_point_id(point_id)

    # 1) 새 청크(재임베딩 포함) 먼저 저장
    new_doc = Document(page_content=new_content, metadata=metadata)
    await self.add_documents(collection_name, [new_doc])
    logger.info("[update_chunk] 새 청크 저장 완료")

    # 2) 저장 성공을 확인한 뒤에야 기존 포인트 삭제
    await self.client.delete(
        collection_name=collection_name,
        points_selector=PointIdsList(points=[pid]),
    )
    logger.info(f"[update_chunk] 기존 청크 삭제: {point_id}")
```

이제 1~2번 사이에서 무엇이 실패해도 기존 데이터는 남는다. 최악의 경우도 "업데이트가
안 된 예전 상태"에 머무를 뿐, **유실은 없다.** 되돌릴 수 없는 삭제를 맨 뒤로 미룬
것뿐인데, 실패의 결과가 "데이터 소실"에서 "무변화"로 바뀐다.

---

## 포인트 ID 설계와 멱등성

build-then-swap에는 한 가지 고려가 따라온다. **새 포인트와 기존 포인트가 잠깐 공존할
수 있다는 점.**

- **새 ID로 저장하는 경우**: 저장 후 삭제 전까지 새/구 포인트가 함께 존재한다. 삭제가
  실패하면 "중복"이 남지만, 이는 검색에 잠깐 중복이 보이는 정도라 **유실보다 훨씬 가벼운**
  트레이드오프다. (필요하면 정리 작업으로 고아 포인트를 회수한다.)
- **내용 기반 [결정적 ID(deterministic id)](https://rlckdwkd55.github.io/posts/point-id-utility/)** 를 쓰면 upsert가 **멱등(idempotent)** 해져,
  같은 청크를 다시 넣어도 같은 포인트를 덮어쓴다. 재시도·중복 실행에 강해진다.

"실패해도 안전"과 "재시도해도 안전(멱등)"은 분산 환경에서 늘 함께 설계해야 하는 짝이다.

---

## 대안 비교

같은 문제를 푸는 다른 방법들과 견줘 보면 선택 이유가 분명해진다.

| 방법 | 원리 | 장점 | 한계 |
|---|---|---|---|
| 삭제-먼저 (before) | 지우고 새로 만들기 | 단순 | 실패 시 **유실** |
| DB 트랜잭션 | 원자적 커밋/롤백 | 이상적 | 벡터 DB·외부 임베딩엔 **적용 불가** |
| **build-then-swap** | 만들고 확인 후 정리 | 유실 0, 구현 단순 | 잠깐 중복 가능 |
| 소프트 삭제 | 지우지 않고 플래그 | 즉시 롤백 | 저장소·검색 필터 복잡 |
| Alias/컬렉션 스왑 | 새 컬렉션 만들고 alias 교체 | **전체 재색인**에 원자적 | 단건 수정엔 과함 |

단건 청크 수정에는 build-then-swap이, 전체 재색인에는 alias 스왑(블루-그린)이 맞는다.
문제 규모에 맞는 도구를 고르는 게 핵심이다.

---

## 사실은 아주 오래된 패턴이다

build-then-swap은 새로운 발명이 아니라, 안전한 교체가 필요한 곳이라면 어디서나 보이는
패턴이다.

- **원자적 파일 쓰기**: 임시 파일에 다 쓰고 `fsync` 후 `rename` 으로 교체. 중간에 죽어도
  원본은 온전하다.
- **블루-그린 배포**: 새 버전을 띄워 헬스체크 통과 후 트래픽을 전환.
- **ES 인덱스 alias 스왑**: 새 인덱스에 색인 완료 후 alias만 원자적으로 바꾼다.

전부 "새 것을 완성해 검증한 뒤, 마지막에 전환한다"는 같은 뼈대다. 재임베딩도 그 한
사례일 뿐이다.

---

## 확장: 임베딩 모델 교체 가드

같은 원칙을 [임베딩 모델](https://rlckdwkd55.github.io/posts/embeddings-bge-m3/) 자체를 바꾸는 상황에도 적용했다. 임베딩 모델이 달라지면 벡터의
**차원·좌표계가 달라져**, 기존 벡터와 새 벡터를 한 컬렉션에 섞으면 검색 결과가 **에러도
없이 조용히 망가진다(silent corruption).** 그래서 **이미 데이터가 있는 컬렉션은 모델
교체를 막고(guard)**, 비어 있거나 전체 재색인이 전제된 경우에만 허용하도록 했다.
"실수로 바꿀 수 있는 경로"를 코드 레벨에서 닫아 둔 것이다.

---

이번 일로 데이터가 걸린 작업은 "성공했을 때"가 아니라 "중간에 실패했을 때"를 기준으로
설계해야 한다는 걸 다시 확인했다. 비가역적인 삭제는 맨 뒤로 미루고, 원자성을 DB가 보장하지
못하는 상황이면 연산 순서와 실패 시 상태로 안전성을 대신 확보한다. 이때 "실패해도 안전"과
"재시도해도 안전(멱등)"은 함께 설계해야 하고, 이런 결함은 정상 흐름 테스트로는 드러나지
않아서 실패 경로를 일부러 재현해봐야 보인다.

혼자 보면 지나치기 쉬운 결함이었는데, 코드 리뷰에서 "재생성이 중간에 실패하면 이미 지운
데이터는?"이라는 질문을 함께 짚은 덕분에 배포 전에 잡을 수 있었다.

<br><br>
참고 : https://qdrant.tech/documentation/concepts/points/
<br>
참고 : https://en.wikipedia.org/wiki/Atomicity_(database_systems)
