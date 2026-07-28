---
title: "임베딩 provider를 설정만으로 바꾸는 팩토리"
date: 2026-03-28
categories: [AI]
tags: [embedding, factory, rag]
description: "로컬 bge-m3에 고정돼 있던 임베딩 계층을, DB 설정만으로 로컬과 외부 API를 오가는 팩토리로 재설계한 기록. provider enum 없는 설계, OpenAI 호환의 함정, 모델 전환 가드를 정리한다."
image:
  path: /assets/img/thumbnails/embedding-factory.png
published: false
---

임베딩과 bge-m3가 무엇인지는 [벡터 임베딩과 bge-m3](https://rlckdwkd55.github.io/posts/embeddings-bge-m3/)에서
먼저 다뤘다. 이 글은 그 임베딩을 "누가 만드느냐"를 런타임에 갈아 끼우도록 바꾼 과정을 정리한 것이다.

## 임베딩이 로컬 모델에 고정돼 있었다

처음 RAG 파이프라인을 만들 때 임베딩은 **로컬 HuggingFace 모델(bge-m3)** 하나로 고정돼 있었다. 서버가 뜨면 모델 가중치를 GPU에 올리고, 문서를 색인하거나 질문을 검색할 때 그 모델로 벡터를 뽑는다. 사내 GPU 서버 한 대만 상대할 때는 이걸로 충분했다.

배포 환경이 늘면서 전제가 깨졌다. 어떤 사이트는 **GPU가 아예 없는 CPU 전용 장비**였다. 거기서 bge-m3를 CPU로 돌리면 임베딩 한 번에 수백 ms씩 잡아먹어 실사용이 어려웠다. 그런 환경에서는 **클라우드 임베딩 API**(DeepInfra·Gemini·Jina 같은 외부 provider)를 붙여야 했다.

가장 손쉬운 해법은 임베딩 생성 지점마다 `if provider == ...` 분기를 덧대는 것이다. 하지만 그렇게 하면 provider가 늘 때마다 색인 코드, 검색 코드, 부트스트랩 코드 곳곳에 분기가 번식한다. provider를 하나 추가하는 데 여러 파일을 건드려야 한다면 유지비만 늘어난다.

## provider enum을 두지 않는 설계

핵심 결정은 **provider별 분기 코드를 두지 않는 것**이었다. `DeepInfra`, `Gemini`, `Jina` 같은 enum을 만들고 각각의 `base_url`을 코드에 매핑하는 순간, 새 provider는 곧 코드 수정이 된다. 대신 임베딩 설정을 **DB 행(row)** 으로 두고, 그 행이 접속에 필요한 값을 전부 들고 있게 했다.

```python
class AiEmbeddingModelEntity(Base):
    __tablename__ = 'ai_embedding_models'

    name: Mapped[str] = mapped_column(String(100), primary_key=True)
    hosting_type: Mapped[str] = mapped_column(String(10), default=HostingType.API)
    base_url: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    api_key: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    provider_model_id: Mapped[Optional[str]] = mapped_column(String(100), default=None)
    provider_label: Mapped[Optional[str]] = mapped_column(String(100), default=None)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
```

`hosting_type`은 `LOCAL`과 `API` 둘뿐이다. API 행은 `base_url + api_key + provider_model_id` 세 값만 채우면 된다. provider가 무엇인지 코드는 알 필요가 없다. `provider_label`은 관리 화면에 "DeepInfra"라고 표시해 주기 위한 라벨일 뿐, 분기에는 쓰이지 않는다.

이게 가능한 이유는 대부분의 임베딩 제공자가 **OpenAI 호환 엔드포인트**를 노출하기 때문이다. 그래서 로컬이든 클라우드든 팩토리는 두 갈래로만 갈린다.

<!-- 이미지: 구글 검색 "팩토리 패턴 구조" · 저장 /assets/img/posts/ai/embedding-provider/factory-branches.png -->

```python
def create_dense_embeddings(ai_embedding_model: Optional[AiEmbeddingModelEntity]):
    # 설정이 없거나 LOCAL이면 로컬 HuggingFace 모델(bge-m3)
    if ai_embedding_model is None or ai_embedding_model.hosting_type == HostingType.LOCAL:
        return _build_local_dense_embeddings()

    # API면 OpenAI 호환 클라이언트로 통일 — provider마다 base_url/model만 다르다
    return OpenAIEmbeddings(
        model=ai_embedding_model.provider_model_id,
        api_key=ai_embedding_model.api_key or "none",
        base_url=ai_embedding_model.base_url,
        check_embedding_ctx_length=False,
    )
```

신규 provider 추가는 **DB에 행 하나 등록**으로 끝나고, 코드 커밋은 필요 없다. 이번 재설계의 무게중심은 이 지점에 있다.

로컬 쪽은 별도 함수로 떼어 놓았는데 이유가 있다. bge-m3 가중치 로딩은 무겁다. 이걸 모듈 임포트 시점에 자동 실행되게 두면, **API 임베딩만 쓰는 CPU 사이트조차 기동할 때마다 쓰지도 않을 로컬 모델을 먼저 로딩**하게 된다. 그래서 `_build_local_dense_embeddings()`는 실제로 LOCAL이 선택됐을 때만 호출되도록 함수 안으로 격리했다.

```python
def _build_local_dense_embeddings() -> HuggingFaceEmbeddings:
    model_path = settings.AI_MODEL_PATH + settings.EMBEDDING_MODEL_NAME
    # ... (개발 환경에선 없으면 snapshot_download로 받아옴) ...
    dense_model = HuggingFaceEmbeddings(
        model_name=model_path,
        model_kwargs={
            'device': settings.DEVICE,
            "local_files_only": True,   # 운영에선 인터넷 없이 로컬 파일만
            "trust_remote_code": True,
        },
        encode_kwargs={"batch_size": settings.EMBEDDING_ENCODE_BATCH_SIZE},
    )
    dense_model._client.max_seq_length = settings.EMBEDDING_MAX_SEQ_LENGTH
    return dense_model
```

## OpenAI 호환의 함정: check_embedding_ctx_length=False

여기서 가장 오래 헤맸다. `OpenAIEmbeddings`를 base_url만 바꿔 붙이면 실제 OpenAI가 아닌 provider에서 **입력 스키마 에러**가 터졌다.

원인은 라이브러리의 기본 동작이었다. `OpenAIEmbeddings`는 기본적으로 입력 텍스트를 `tiktoken`으로 **미리 토큰화해서, 문자열이 아니라 정수 토큰 ID 배열을 서버로 보낸다.** 이건 진짜 OpenAI 서버가 그 형식을 받아 주기 때문에 성립하는 최적화다. 그런데 Cohere를 비롯한 다른 OpenAI 호환 provider는 **문자열 입력을 기대하기 때문에**, 정수 배열이 오면 스키마가 안 맞아 요청을 거부한다.

`check_embedding_ctx_length=False`가 이 선토큰화를 끄고 **원문 문자열을 그대로 전송**하게 만드는 스위치다. "호환"이라는 단어와 달리 클라이언트 기본값은 특정 서버 전용 최적화였다. 한 줄이지만 이게 없으면 로컬 외 provider는 전부 등록 단계에서 실패했다.

또 하나. `base_url`이 비어 있으면 라이브러리는 조용히 **진짜 OpenAI 엔드포인트로 폴백**한다. 다른 provider용으로 넣은 키가 엉뚱한 곳으로 나가면 실패는 물론 자격증명 노출 위험까지 있다. 그래서 API 모드 등록 시 `base_url`은 필수값으로 검증한다.

## sparse는 provider 대상이 아니다

하이브리드 검색에는 dense 벡터 말고 **sparse(BM25류) 임베딩**도 쓴다. 이건 provider 선택에서 아예 제외했다.

```python
class SparseEmbeddings:
    """Sparse(BM25) 임베딩은 신경망이 아닌 경량 lexical 알고리즘이라 CPU 부담이
    없어 항상 로컬로 즉시 로드한다 (Dense와 달리 provider 선택 대상이 아님)."""
```

sparse는 신경망이 아니라 어휘 통계 기반이라 CPU에서도 부담이 없다. 클라우드로 뺄 이유가 없다. 그래서 **dense만 로컬↔API를 오가고, sparse는 언제나 로컬 고정**으로 뒀다.

## 차원은 런타임에 발견한다

provider마다 임베딩 차원이 다르다(bge-m3는 1024, 외부 모델은 768·1536 등 제각각). 이걸 설정에 하드코딩하면 provider를 바꿀 때마다 또 사람 손이 필요하다. 그래서 컬렉션을 만들기 직전에 **실제로 한 번 임베딩해 보고 그 길이를 차원으로 삼는다.**

```python
async def get_dimension(self) -> int:
    test_embedding = await loop.run_in_executor(
        self.executor, self.dense_embeddings.embed_query, "dimension check"
    )
    return len(test_embedding)   # 이 값이 Qdrant VectorParams.size가 된다
```

[Qdrant](https://rlckdwkd55.github.io/posts/qdrant/) 컬렉션은 이 차원과 `Distance.COSINE`으로 생성한다. 코사인 거리를 쓰므로 정규화 여부에 덜 민감하지만, 컬렉션을 만든 모델과 검색하는 모델이 같아야 좌표계가 일치한다는 점은 그대로 남는다. 그 전제가 다음 문제로 이어진다.

## provider 교체가 부르는 조용한 검색 오류

설정만으로 provider를 바꿀 수 있게 되자 새로운 사고 유형이 생겼다. **이미 로컬 bge-m3로 색인해 둔 데이터가 있는데 임베딩을 API 모델로 바꿔 버리는 것.**

차원이 우연히 같아도 안전하지 않다. 모델이 다르면 벡터 공간의 좌표계 자체가 다르다. 기존 문서 벡터는 A 모델 좌표계에, 새 질문 벡터는 B 모델 좌표계에 찍히니 코사인 유사도가 **의미 없는 값**이 된다. 에러도 나지 않는다. 검색이 조용히 엉터리가 될 뿐이라 뒤늦게 발견하기 쉽다. (재임베딩을 왜 순서 있게 해야 하는지는 [재임베딩 순서](https://rlckdwkd55.github.io/posts/reembedding-order/)에서 따로 다뤘다.)

그래서 모델을 실제로 바꾸는 경로에는 **데이터가 있으면 차단하는 가드**를 뒀다.

```python
async def reload_dense_embeddings(self, new_embeddings, *, bypass_guard: bool = False):
    async with self._dense_embeddings_lock:
        if not bypass_guard:
            populated = await self._get_populated_collection_names()
            if populated:
                raise CommonException(
                    ErrorCode.EMBEDDING_ACTIVATION_BLOCKED_EXISTING_DATA,
                    message=f"이미 색인된 데이터가 있어 임베딩 모델을 전환할 수 없습니다: "
                            f"{', '.join(populated)}",
                )
        self.dense_embeddings = new_embeddings
```

경로를 셋으로 나눈 게 이 설계에서 가장 신경 쓴 부분이다.

- **`activate()`** — admin이 API 모델을 새로 활성화. 항상 가드 적용. 데이터가 있으면 거부.
- **`activate_local()`** — 아직 한 번도 활성화된 적이 없을 때만 로컬을 확정. "기존 데이터가 애초에 로컬로 임베딩돼 있었다"는 사실을 인정하는 것뿐이라 실제 전환이 아니다. 이 경우에만 `bypass_guard=True`.
- **부트스트랩(`set_dense_embeddings`)** — 서버 재기동 시 이미 활성인 모델을 그대로 복원. 여기에 가드를 걸면 **데이터가 있는(=정상 운영 중인) 사이트가 재시작마다 복원에 실패**한다. 그래서 가드 없는 전용 경로로 뒀다.

같은 "임베딩 교체"처럼 보여도 셋의 의미가 다르다. 이걸 하나로 뭉쳤다면 "재시작하면 서버가 안 뜬다"거나 "데이터가 있는데도 전환이 된다" 중 하나로 터졌을 것이다.

## build-then-swap, 그리고 살아있는 클라이언트

활성화 순서에도 규칙을 뒀다. **먼저 임베딩 객체를 만들어 검증하고, VectorStoreManager에 스왑에 성공한 뒤에야 DB의 `is_active`를 갱신한다.** 가드가 거부하면 DB는 아예 건드리지 않는다. "DB엔 활성이라 적혀 있는데 실제로는 안 붙은" 어긋난 상태를 막기 위해서다.

반대 방향의 함정도 있었다. 활성 모델의 키/URL을 수정하면 DB만 바뀌고 **메모리에 살아 있는 클라이언트는 옛 키를 그대로 들고 있다.** 그래서 활성 모델을 수정할 때는 새 클라이언트로 즉시 교체한다(같은 모델을 다시 확정하는 것뿐이라 이때만 가드를 우회). 활성 모델 삭제도 막았는데, 지우면 다음 재시작 때 `get_active()`가 `None`을 반환해 **임베딩 미설정 상태로 되돌아가기** 때문이다. 재시작 전까지 증상이 없어 뒤늦게 발견하는 종류의 사고다.

## 등록 시 실제 호출로 검증한다

API 모델을 등록·수정할 때, 저장 전에 실제로 한 번 임베딩을 호출해 본다.

```python
async def _validate_api_embedding_model(self, entity):
    test_embeddings = create_dense_embeddings(entity)
    try:
        await test_embeddings.aembed_query("안녕")
    except Exception as e:
        raise map_openai_error(e, context="[AiEmbeddingModelService]")
```

키 오타·잘못된 base_url·죽은 엔드포인트를 **등록 시점에** 걸러 낸다. 나중에 검색하다 터지는 것보다 낫다. 그리고 provider가 뱉는 raw 예외를 그대로 노출하지 않고 `map_openai_error`로 감싸, `AuthenticationError → 인증 실패`, `RateLimitError → 일시적 사용 불가`처럼 **provider 중립적인 에러 코드**로 정규화한다. 응답 DTO에서는 `api_key`를 마스킹해 관리 화면에도 원문 키가 노출되지 않게 했다.

## 트레이드오프

- **provider enum을 안 둔 대가**: 코드가 provider별 특수 규칙을 모른다. 그래서 `check_embedding_ctx_length` 같은 provider 특성은 "모든 호환 provider에 안전한 쪽"으로 일괄 고정해야 했다. 특정 provider만의 최적화는 포기한 셈이다.
- **DB에 키를 저장**: `.env` 대신 DB에 자격증명을 두면 관리 화면에서 다룰 수 있어 편하지만, 저장·마스킹·접근 통제를 직접 책임져야 한다.
- **차원 런타임 발견**: 설정이 줄어드는 대신, 컬렉션 생성 직전 임베딩 호출 한 번이 추가된다. 빈도가 낮은 경로라 비용은 무시할 만했다.

돌아보면 이번 작업의 핵심은 provider를 코드가 모르게 만든 것 하나다. `hosting_type`으로 LOCAL/API 두 갈래만 남기고 나머지는 DB 행으로 밀어내니, 새 provider는 코드 커밋이 아니라 행 등록으로 끝났다. 대신 provider별 특수 최적화를 포기하고, OpenAI 호환의 기본값 함정(`check_embedding_ctx_length`·`base_url` 폴백)과 모델 교체 시의 좌표계 불일치를 각각 검증과 가드로 막아야 했다. 확장성을 얻는 대가로 이 두 가지를 코드 레벨에서 책임지기로 한 셈이다.

<br><br>
참고 : https://python.langchain.com/api_reference/openai/embeddings/langchain_openai.embeddings.base.OpenAIEmbeddings.html
