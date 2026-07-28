---
title: "고객이 등록한 외부 DB를 챗봇 지식으로: 다종 DB 커넥터 만들기"
date: 2026-08-12
categories: [Backend]
tags: [database, sqlalchemy, connector]
description: "MySQL·MariaDB·PostgreSQL·MSSQL·Oracle·CUBRID까지, 고객이 등록한 제각각의 외부 DB를 하나의 추상 커넥터로 흡수하고, introspection으로 스키마를 읽어 조회 결과를 그대로 벡터 색인에 흘려보낸 실전 회고."
image:
  path: /assets/img/thumbnails/external-db.png
published: false
---

## 배경: "우리 DB에 있는 데이터도 챗봇이 답하게 해줄 수 있나요?"

우리 제품은 원래 파일(PDF·문서)을 업로드하면 파싱·임베딩해서 챗봇 지식으로 쓰는
구조였다. 그런데 한 고객사에서 요청이 들어왔다. **"우리 사내 DB에 이미 정리돼 있는
데이터를, 파일로 다시 내보내지 말고 그대로 챗봇이 답하게 할 수 없냐"** 는 것이었다.

말은 간단한데, 막상 들여다보니 골치 아픈 지점이 있었다. 고객이 등록할 DB가 한 종류가
아니라는 것. 우리가 지원하기로 한 것만 해도 MySQL, MariaDB, PostgreSQL, MSSQL,
Oracle, CUBRID였다. 종류마다 드라이버가 다르고, 접속 방식이 다르고, 메타데이터를
읽는 방법도, SQL 방언도 다르다. 여기에 더해 **접속 정보는 고객이 화면에서 입력**하니까
런타임에 동적으로 붙어야 했고, 조회한 데이터는 결국 임베딩해서 벡터 DB(Qdrant)에
색인까지 해야 했다.

목표를 한 문장으로 정리하면 이랬다. **상위 색인 로직이 "지금 붙은 DB가 무슨 종류인지"
전혀 몰라도 되게 만들자.** DB별 차이는 전부 커넥터라는 한 겹 안에 가둬버리는 것.

## 설계: 추상 인터페이스 하나 + SQLAlchemy 구현 하나

먼저 커넥터가 밖에 노출해야 할 동작만 추상 클래스로 못박았다. 연결 테스트, 뷰 목록,
컬럼 목록, 조회, 그리고 대용량을 위한 배치 조회.

```python
class DbConnector(ABC):
    @abstractmethod
    def test(self) -> None: ...
    @abstractmethod
    def list_views(self) -> list[ViewInfo]: ...
    @abstractmethod
    def list_columns(self, view_name: str) -> list[ColumnInfo]: ...
    @abstractmethod
    def fetch_rows(self, query: str) -> tuple[list[dict[str, Any]], list[str]]: ...
    @abstractmethod
    def fetch_rows_batched(
        self, query: str, batch_size: int = 1000
    ) -> Generator[tuple[list[dict[str, Any]], list[str]], None, None]: ...
```

구현체는 결국 `SqlAlchemyConnector` 하나로 충분했다. SQLAlchemy가 대부분의 방언을
이미 흡수해 주기 때문이다. DB 타입을 드라이버 문자열로 매핑해두고, 그걸로 연결 URL만
만들어 주면 나머지는 SQLAlchemy가 알아서 한다.

```python
DRIVER_MAP = {
    DbType.MYSQL:      "mysql+pymysql",
    DbType.MARIADB:    "mariadb+pymysql",
    DbType.POSTGRESQL: "postgresql+psycopg2",
    DbType.MSSQL:      "mssql+pymssql",
    DbType.ORACLE:     "oracle+oracledb",
    DbType.CUBRID:     "cubrid+pycubrid",
}
```

## 왜 동기 드라이버였나 (본 서비스는 async인데)

여기서 처음 발목을 잡힌 게 드라이버 선택이었다. 우리 서비스 자체는 비동기다. 메인 DB는
`asyncpg` 기반으로 async SQLAlchemy를 쓴다([관련 글](https://rlckdwkd55.github.io/posts/sqlalchemy-async/)).
그래서 처음엔 외부 DB도 당연히 async 드라이버로 통일하려고 했다.

그런데 지원 목록을 보면 답이 안 나온다. CUBRID나 Oracle처럼 async 드라이버가 없거나,
있어도 성숙도가 들쭉날쭉한 DB가 섞여 있다. 6종을 전부 async로 맞추려다 각 드라이버의
품질 편차를 떠안느니, **외부 DB만큼은 검증된 동기 드라이버로 통일하고, 대신 비동기
경계에서 스레드풀로 넘기자**고 결정했다.

```python
def _build_engine(self):
    url = _build_url(...)
    return create_engine(url, pool_size=1, max_overflow=0, pool_pre_ping=True)
```

`create_engine`(동기)을 쓰되, 서비스 계층에서 `run_in_executor`로 스레드에 실행을
떠넘긴다. 이벤트 루프는 막히지 않으면서, 드라이버는 안정적인 걸 쓴다.

```python
async def list_views(self, seq: int) -> list[ViewInfo]:
    entity = await self.get_connection(seq)
    def _fetch():
        return get_connector(entity).list_views()
    return await asyncio.get_running_loop().run_in_executor(None, _fetch)
```

풀 사이즈를 `pool_size=1, max_overflow=0`으로 좁게 잡은 것도 의도적이다. 외부 DB는
"수시로 붙어 잠깐 읽고 끊는" 용도지, 우리가 커넥션을 오래 쥐고 있어야 할 대상이 아니다.
고객 DB에 부담을 주지 않는 게 우선이었다.

## introspection: 사용자는 SQL을 몰라도 된다

고객이 SQL을 직접 쓰게 하고 싶진 않았다. 그래서 등록한 DB의 뷰/테이블 목록과 각
컬럼을 화면에서 골라 지식원을 구성하도록 했다. 이때 SQLAlchemy의 `inspect`가 방언
차이를 대부분 덮어준다.

```python
def list_views(self) -> list[ViewInfo]:
    engine = self._build_engine()
    db_type = DbType(self._entity.db_type)
    try:
        if db_type == DbType.CUBRID:
            with engine.connect() as conn:
                result = conn.execute(text(
                    "SELECT class_name FROM db_class "
                    "WHERE class_type = 'VCLASS' AND is_system_class = 'NO'"
                ))
                return [ViewInfo(name=row[0], type="VIEW") for row in result.fetchall()]
        return [ViewInfo(name=v, type="VIEW") for v in inspect(engine).get_view_names()]
    finally:
        engine.dispose()
```

대부분 `inspect(engine).get_view_names()` 한 줄로 끝난다. 문제는 CUBRID였다.
`inspect`가 기대만큼 뷰를 못 긁어와서, 결국 `db_class` 시스템 뷰를 직접 조회해
`VCLASS`(가상 클래스=뷰)만 걸러내는 분기를 하나 두게 됐다. **"추상화가 90%를 덮어주고,
나머지 10%는 손으로 분기한다"** — 다종 DB를 다룰 때 계속 마주친 패턴이다.

## Oracle이라는 특수 케이스

Oracle은 유독 예외 처리가 많았다. 우선 접속 식별자가 `SERVICE_NAME`이냐 `SID`냐로
갈린다. URL 구성 자체가 달라진다.

```python
if db_type == DbType.ORACLE:
    conn_type = oracle_conn_type or OracleConnType.SERVICE_NAME
    if conn_type == OracleConnType.SERVICE_NAME:
        return URL.create(drivername="oracle+oracledb", username=username,
                          password=password, host=host, port=port,
                          query={"service_name": database_name})
    else:
        return URL.create(drivername="oracle+oracledb", username=username,
                          password=password, host=host, port=port,
                          database=database_name)
```

연결 테스트 쿼리도 다르다. 다른 DB는 `SELECT 1`이면 되는데 Oracle은 `FROM` 절 없이는
안 되니까 `SELECT 1 FROM DUAL`을 따로 매핑해 뒀다.

```python
_TEST_QUERY = {DbType.ORACLE: "SELECT 1 FROM DUAL"}
_DEFAULT_TEST_QUERY = "SELECT 1"
```

미리보기용 페이지네이션도 마찬가지다. 다른 DB는 `LIMIT`, Oracle은 `ROWNUM`.

```python
if DbType(entity.db_type) == DbType.ORACLE:
    safe_query = f"SELECT * FROM ({query}) WHERE ROWNUM <= {limit}"
else:
    safe_query = f"SELECT * FROM ({query}) _q LIMIT {limit}"
```

접속 정보(비밀번호)는 화면에서 받은 뒤 그대로 저장하지 않고 대칭키로 암호화해 넣고,
접속 시에만 복호화한다. 이 얘기는 분량이 많아 [따로 정리했다](https://rlckdwkd55.github.io/posts/external-db-credentials/).
그리고 **등록·수정 시점에 반드시 실제 연결 테스트를 통과해야만 저장**되게 막아, 잘못된
접속 정보가 DB에 남는 걸 방지했다.

## 조회 결과를 그대로 벡터 색인으로

여기가 이 기능의 핵심이자, 파일 업로드 파이프라인과 다른 부분이다. 외부 DB는 파싱 단계가
필요 없다. 행 하나가 곧 문서 하나다. 조회한 행을 `content` 컬럼은 본문으로, 나머지 지정
컬럼은 메타데이터로 묶어 `Document`로 만든다.

```python
def _rows_to_documents(rows, columns, content_cols, meta_cols, ...):
    return [
        Document(
            page_content="\n".join(f"{col}: {row.get(col, '')}" for col in content_cols),
            metadata={
                "source_type": "external_db",
                "external_db_connection_seq": connection_seq,
                "filename": f"[외부DB] {view_name}",
                "row_index": row_offset + i,
                **{col: str(row.get(col, "")) for col in meta_cols},
            },
        )
        for i, row in enumerate(rows)
    ]
```

그리고 색인 루프. 배치 제너레이터에서 한 묶음씩 받아, 컬럼 검증 → 문서 변환 →
임베딩·업서트를 흘려보낸다. 임베딩 모델은 다국어에 강한 bge-m3를
썼다([관련 글](https://rlckdwkd55.github.io/posts/embeddings-bge-m3/)).

```python
async for rows_batch, columns in self.external_db_service.fetch_rows_batched_async(
    req.connection_seq, req.full_query, batch_size=settings.EXTERNAL_DB_BATCH_SIZE
):
    # 첫 배치에서 사용자가 고른 content/metadata 컬럼이 실제 결과에 있는지 검증
    ...
    batch_docs = _rows_to_documents(rows_batch, columns, content_cols, meta_cols, ...)
    await self.get_vector_manager.add_documents(collection_name, batch_docs)
    total_rows += len(rows_batch)
```

## 대용량: offset 페이지네이션이 아니라 커서 스트리밍

처음엔 흔한 `LIMIT/OFFSET`으로 배치를 자르려 했다. 그런데 이건 함정이다. 대부분의 DB에서
`OFFSET N`은 앞의 N행을 세어 버리고 시작하기 때문에, 뒤쪽 배치로 갈수록 느려진다(전형적인
O(N²)). 수십만 행짜리 뷰라면 뒷부분에서 급격히 느려진다.

그래서 **쿼리는 한 번만 실행하고, 결과 커서에서 `fetchmany`로 조금씩 당겨오는** 방식으로
바꿨다. 커넥션 하나를 배치가 끝날 때까지 열어두는 대신, 재조회 비용이 없다.

```python
def fetch_rows_batched(self, query, batch_size=1000):
    engine = self._build_engine()
    try:
        # stream_results=True 가 있어야 서버사이드 커서로 실제 스트리밍이 된다
        with engine.connect().execution_options(stream_results=True) as conn:
            result = conn.execute(text(query))
            columns = list(result.keys())
            while True:
                raw_batch = result.fetchmany(batch_size)
                if not raw_batch:
                    break
                yield [dict(zip(columns, row)) for row in raw_batch], columns
    finally:
        engine.dispose()
```

여기서 `stream_results=True`를 빠뜨리면 절반만 고친 셈이 된다. **OFFSET의 O(N²)를 없애는
것과 메모리를 스트리밍하는 것은 별개 문제**이기 때문이다. 이 옵션이 없으면 pymysql 같은
기본 커서는 쿼리 결과 **전량을 클라이언트 메모리로 먼저 받아 놓고**, `fetchmany`는 그렇게
쌓아 둔 것을 나눠 줄 뿐이다. 재조회 비용은 사라지지만 수십만 행이 한꺼번에 힙에 올라오는
건 그대로다. 서버사이드 커서를 세워야 비로소 "조금씩 당겨온다"가 성립한다.

이 동기 제너레이터를 비동기 쪽에서는 `run_in_executor`로 한 배치씩 당겨 감싼다. 이벤트
루프를 막지 않으면서 스트리밍을 유지하는 다리 역할이다.

```python
sync_gen = get_connector(entity).fetch_rows_batched(query, batch_size)
def _next_batch():
    try:
        return next(sync_gen)
    except StopIteration:
        return None
while True:
    result = await loop.run_in_executor(None, _next_batch)
    if result is None:
        break
    yield result
```

## 남긴 트레이드오프

- **증분 색인은 아직 없다.** 현재는 재색인 시 해당 소스의 포인트를 지우고 전량 다시
  넣는다. 변경분만 반영하려면 행의 버전·타임스탬프를 추적해야 하는데, 6종 DB에서
  "변경 감지"를 일관되게 만드는 비용이 만만치 않아 일단 미뤘다. 큰 테이블일수록 재색인
  비용이 커지는 건 알면서 남겨둔 빚이다. (재색인 순서 문제는
  [여기](https://rlckdwkd55.github.io/posts/reembedding-order/)에서 따로 다뤘다.)
- **동기 드라이버 + 스레드풀**은 이벤트 루프는 지키지만, 동시에 여러 대용량 색인이
  돌면 스레드풀이 병목이 된다. 지금 사용량에선 문제없지만 확장 시 재검토 지점이다.
- **방언 분기는 결국 늘어난다.** CUBRID 뷰 조회, Oracle DUAL·ROWNUM처럼 특수 케이스는
  DB를 추가할 때마다 하나둘 생긴다. 추상화가 다 덮어줄 거라는 기대는 접는 게 맞았다.

## 정리

고객이 등록한 6종의 외부 DB를 하나의 추상 커넥터로 흡수하고, introspection으로 스키마를
읽어, 조회 결과를 배치로 스트리밍하며 그대로 벡터 색인에 흘려보내는 파이프라인을 만들었다.
방언 차이는 커넥터가 감추고, 대용량은 커서 스트리밍으로, 자격증명은 암호화로 다뤘다.
남은 숙제는 증분 색인. "상위 로직이 DB 종류를 모르게 한다"는 원칙 하나를 끝까지 지킨 게
이 기능을 오래 유지보수 가능하게 만든 열쇠였다.
