---
title: "SSE(Server-Sent Events)란?"
date: 2026-02-28
categories: [Backend]
tags: [sse, streaming, http]
description: "챗봇 토큰 스트리밍에 쓰이는 SSE를 text/event-stream 포맷, WebSocket과의 비교, FastAPI 구현, 프록시 버퍼링 함정까지 정리한다."
image:
  path: /assets/img/thumbnails/sse.png
published: false
---

SSE(Server-Sent Events)는 서버가 클라이언트로 데이터를 밀어 주는 단방향 스트림 방식이다.
새 프로토콜이 아니라 평범한 HTTP 응답을 끊지 않고 계속 흘려보내는 것이며, 브라우저에는 이걸
받는 `EventSource`라는 표준 API가 들어 있다. LLM 토큰 스트리밍, 진행률 표시, 서버 알림처럼
클라이언트가 서버로 말을 걸 필요 없이 서버가 한 방향으로 데이터를 흘려보내면 되는 자리에 쓰인다.

<!-- 이미지: 구글 검색 "SSE 와 WebSocket 차이" · 저장 /assets/img/posts/backend/sse/sse-vs-ws.png -->

## HTTP 위의 단방향 스트림

일반 HTTP는 요청 하나에 응답 하나로 끝나고 연결을 닫는다. SSE는 그 응답을 닫지 않고 열어 둔
채 서버가 이벤트가 생길 때마다 조금씩 써 보낸다. 클라이언트 입장에선 응답 본문이 아주 천천히,
계속 도착하는 하나의 GET 요청이다. 핵심은 응답 헤더다.

```text
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

`text/event-stream`을 보는 순간 브라우저는 본문을 정해진 포맷으로 파싱하기 시작한다. 프로토콜
자체가 WHATWG HTML 표준에 명세돼 있어 별도 라이브러리 없이 브라우저 내장 기능만으로 돌아간다.

## 프로토콜: text/event-stream

포맷은 단순하다. `필드: 값` 형태의 텍스트 줄을 쓰고, 빈 줄 하나로 이벤트 하나가 끝났음을
알린다. 이 빈 줄이 이벤트의 구분자라는 게 SSE 포맷의 전부라고 해도 된다.

```text
data: 첫 번째 토큰

data: 두 번째 토큰

event: done
data: [완료]

```

쓸 수 있는 필드는 네 개다.

- `data:` — 실제 페이로드. 여러 줄로 나눠 보내면 개행으로 이어 붙여 하나의 메시지가 된다.
- `event:` — 이벤트 이름. 지정하면 클라이언트에서 그 이름으로 리스너를 걸 수 있다(기본값은 `message`).
- `id:` — 이벤트의 식별자. 브라우저가 마지막으로 받은 값을 기억해 둔다(재연결에 쓰인다).
- `retry:` — 연결이 끊겼을 때 재연결까지 기다릴 시간(밀리초).

`:` 로 시작하는 줄은 주석이라 무시된다. 이 주석 줄은 뒤에서 keep-alive 핑으로 쓰인다. 여러
필드를 한 이벤트에 함께 담을 수도 있다(`id: 42` / `event: message` / `data: {"token":"안녕"}`).

주의할 점은 `data:` 를 여러 개 쓰면 개행으로 합쳐져 한 메시지가 되지만, 빈 줄을 만나야 비로소
이벤트가 발행(dispatch)된다는 것이다. 서버가 빈 줄을 빼먹으면 클라이언트는 이벤트가 아직 안
끝났다고 보고 계속 기다린다. 스트림이 안 나가는 흔한 원인이 이 빈 줄 누락이다.

## 브라우저 EventSource: 자동 재연결과 Last-Event-ID

받는 쪽은 대부분 브라우저 내장 `EventSource`로 끝난다.

```javascript
const es = new EventSource("/chat/stream");

es.onmessage = (e) => {         // event 필드가 없는 기본 메시지
  appendToken(e.data);
};

es.addEventListener("done", (e) => {  // event: done 을 받는 리스너
  es.close();
});

es.onerror = () => {            // 연결이 끊기면 브라우저가 알아서 재연결한다
};
```

SSE가 WebSocket 대비 편한 지점이 자동 재연결이다. 연결이 끊기면 브라우저가 알아서 다시 붙으며,
이때 서버가 보내 준 마지막 `id:` 값을 `Last-Event-ID` 요청 헤더에 실어 재연결 요청을 보낸다.

```text
GET /chat/stream HTTP/1.1
Last-Event-ID: 42
```

서버가 이 헤더를 읽어 42번 다음부터 다시 보내면 끊긴 지점부터 이어서 스트리밍할 수 있다. 다만
이건 서버가 id를 성실히 채워 주고 그 지점부터 재개하는 로직을 구현했을 때 얻는 것이지 공짜는 아니다.

한 가지 제약이 있다. `EventSource`는 GET만 가능하고 커스텀 헤더를 못 붙인다. 그래서
`Authorization` 헤더로 토큰을 실어야 하는 API에선 쿠키로 우회하거나, `fetch` + `ReadableStream`으로
응답 본문을 직접 파싱하는 쪽을 택하기도 한다(대신 자동 재연결은 직접 구현해야 한다).

## WebSocket과의 갈림길

SSE와 WebSocket을 표로 정리하면 이렇다.

| | SSE | WebSocket |
|---|---|---|
| 방향 | 단방향(서버→클라) | 양방향 |
| 프로토콜 | HTTP 그대로 | 별도 핸드셰이크로 ws/wss 업그레이드 |
| 재연결 | 브라우저 내장(자동) | 직접 구현 |
| 데이터 | 텍스트(UTF-8) | 텍스트·바이너리 |
| 인프라 | HTTP 그대로라 프록시·인증 재사용 | 업그레이드 지원 필요 |
| 구현 복잡도 | 낮음 | 높음 |

서버가 밀어 주기만 하면 되는 알림·진행률·토큰 스트리밍에는 SSE가 가볍고 인프라 친화적이다.
HTTP를 그대로 쓰니 기존 인증·프록시·로드밸런서 설정을 대부분 재사용한다. 반대로 클라이언트도
실시간으로 자주 말을 거는 양방향(채팅 협업, 게임, 커서 공유)이라면 WebSocket이 맞고, 챗봇 토큰
출력은 밀어 주는 쪽이 압도적이라 SSE 쪽이다.

## FastAPI로 SSE 내보내기

FastAPI(정확히는 Starlette)에선 `StreamingResponse`에 제너레이터를 넘긴다. 제너레이터가
`yield`하는 순간순간이 곧 클라이언트로 흘러가는 스트림 조각이 된다. FastAPI의 기본기는
[FastAPI 정리](https://rlckdwkd55.github.io/posts/fastapi/)에 적어 뒀다.

```python
import asyncio
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()

def sse_format(data: str, event: str | None = None, id: str | None = None) -> str:
    """SSE 한 이벤트를 규격에 맞게 만든다. 끝의 빈 줄(\n\n)이 이벤트 구분자다."""
    lines = []
    if id is not None:
        lines.append(f"id: {id}")
    if event is not None:
        lines.append(f"event: {event}")
    lines.append(f"data: {data}")
    return "\n".join(lines) + "\n\n"   # 이 마지막 빈 줄을 빼먹으면 이벤트가 발행되지 않는다

async def token_stream():
    tokens = ["안녕", "하세", "요", " 무엇을", " 도와드릴까요?"]
    for i, tok in enumerate(tokens):
        yield sse_format(tok, id=str(i))
        await asyncio.sleep(0.05)      # 실제로는 LLM이 토큰을 만들어 내는 시간
    yield sse_format("[DONE]", event="done")

@app.get("/chat/stream")
async def chat_stream():
    return StreamingResponse(
        token_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # nginx가 응답을 버퍼링하지 않게 하는 신호
        },
    )
```

포인트는 두 가지다. `media_type="text/event-stream"`으로 Content-Type을 맞추고, `sse_format`이 매
이벤트 끝에 `\n\n`(빈 줄)을 붙인다. `async def` 제너레이터 + `await`로 두면 LLM 응답을 기다리는
동안 이벤트 루프가 다른 요청을 처리해 동시 스트림을 많이 열어도 워커가 놀지 않는다. 이벤트
페이로드를 JSON으로 실어 나를 거라면 스키마를 [Pydantic](https://rlckdwkd55.github.io/posts/pydantic/)
모델로 정의해 `model_dump_json()`으로 직렬화하면 프런트와 계약을 명확히 맞출 수 있다.

## 실무 함정: 프록시 버퍼링과 keep-alive

로컬에선 잘 되던 스트림이 운영 서버에 올라가면 토큰이 응답이 다 끝난 뒤 한 덩어리로 튀어나오는
일이 흔하다. 원인은 코드가 아니라 앞단의 nginx 리버스 프록시인 경우가 많다. nginx는 기본적으로
업스트림 응답을 버퍼에 모았다가 한꺼번에 내보내는데, 정적 응답에는 효율적이지만 SSE에는
치명적이다. 서버가 조금씩 흘려보낸 조각을 붙잡아 두니 스트리밍이 되지 않는다. 해결은 응답에
신호를 실어 버퍼링을 끄는 것이다.

```nginx
location /chat/ {
    proxy_pass http://backend;
    proxy_buffering off;          # 응답을 모으지 말고 즉시 흘려보낸다
    proxy_cache off;
    proxy_read_timeout 3600s;     # 오래 열어 두는 연결이 타임아웃으로 끊기지 않게
}
```

애플리케이션에서 `X-Accel-Buffering: no` 헤더를 실어 주면 nginx가 그 응답만 버퍼링을 끄기도
한다(위 FastAPI 코드에 넣어 둔 이유다). `gzip` 압축도 데이터를 모아 두는 성질이 있어 SSE 경로에선
빼는 편이 안전하다. 버퍼링 말고도 챙길 게 있다.

- 유휴 타임아웃 대비 keep-alive 핑 — 토큰 사이 간격이 길면 프록시나 로드밸런서가 죽은 연결로
  보고 끊는다. 주기적으로 주석 줄(`: ping\n\n`)을 흘려보내 연결을 살려 둔다. 주석이라 클라이언트는
  무시하지만 바이트가 오가니 연결은 유지된다.
- 연결 수·타임아웃 — 연결을 오래 붙잡으므로 서버의 동시 연결 한도와 워커 수를 고려해야 한다.
- HTTP/1.1 동시 연결 한계 — 브라우저는 도메인당 커넥션을 6개쯤으로 제한한다. 탭을 여러 개 열면
  SSE 연결이 이 한도를 잡아먹어 다른 요청이 막힐 수 있다. HTTP/2에선 멀티플렉싱으로 완화된다.

## LLM 토큰 스트리밍 맥락

LLM 응답은 생성에 몇 초씩 걸린다. 다 만들 때까지 기다렸다 한 번에 주면 사용자는 빈 화면을 본다.
그래서 생성되는 토큰을 그때그때 SSE로 밀어 첫 글자가 뜨는 체감 시간(TTFT, Time To First Token)을
줄인다. 실제 생성 시간은 그대로여도 반응이 빠르다는 인상은 달라진다.

토큰만 보내는 것은 아니다. 단계별 UI를 그리려면 상태 신호가 필요하므로 커스텀 `event:`로 진행
단계를 함께 흘려보낸다.

```text
event: status
data: 문서 검색 중...

event: sources
data: [{"title":"문서 A"},{"title":"문서 B"}]

data: 검색 결과에 따르면

event: done
data: [DONE]

```

프런트가 `status`로 로딩 표시를, `sources`로 출처 목록을, 기본 메시지로 토큰을 받아 각각 다른
UI에 꽂을 수 있다. [RAG](https://rlckdwkd55.github.io/posts/rag/) 파이프라인에서 검색 → 근거 →
생성의 각 단계를 실시간으로 보여 주는 방식이 이것이다. vLLM 같은 추론 엔진의 OpenAI 호환 API도
스트리밍 응답을 SSE(`data:` 청크)로 내려 주므로, 백엔드는 그 스트림을 받아 프런트로 그대로
중계(relay)하는 구조가 자연스럽다.

SSE는 HTTP 응답을 끊지 않고 흘려보내는 방식으로, `text/event-stream` + `data:`/`event:`/`id:`/`retry:`
필드 + 빈 줄로 이벤트를 구분하는 것이 전부다. 단방향이면 SSE, 양방향이면 WebSocket이 맞고, SSE는
HTTP 그대로라 기존 인프라를 재사용해 가볍다. FastAPI에선 `StreamingResponse` + `async` 제너레이터로
구현하되 이벤트 끝 빈 줄을 반드시 붙이고, 운영에서 가장 자주 데이는 프록시 버퍼링은
`proxy_buffering off`·`X-Accel-Buffering: no`·gzip 제외·keep-alive 핑으로 막는다.

<br><br>
참고 : https://html.spec.whatwg.org/multipage/server-sent-events.html
