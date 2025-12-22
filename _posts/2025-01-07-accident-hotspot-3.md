---
title: "사고다발지 시각화 프로젝트 (3) - OpenAPI 연동 및 DB INSERT/DELETE"
date: 2025-01-07 11:10:00 +0900
categories: [Project]
tags: [java, project]
description: "OpenAPI활용 경기도 사고다발지 시각화 프로젝트"
image:
  path: /assets/img/thumbnails/accident-hotspot.jpg
---

지난 포스팅에서는 Java에서 MySql을 연결하는 과정을 작성 했다.
이번 포스팅에서는 [사고다발지 현황](https://data.gg.go.kr/portal/data/service/selectServicePage.do?page=1&rows=10&sortColumn=&sortDirection=&infId=9HJ306A05WF6RS2560PG21056899&infSeq=3&order=&loc=&ACDNT_YY=&ACDNT_DIV_NM=&JURISD_POLCSTTN_NM=&LOC_INFO=)사이트에 있는 데이터를 INSERT, DELETE하기 위해 인증키 신청을 하고 DB구축을 진행 해 보겠다.

## 인증키 신청

![](/assets/img/posts/project/accident-hotspot/openapi-key-request.png)

사이트 접속을 하면 해당 페이지에서 인증키 신청을 클릭하여 로그인을 진행 해 준다.

로그인을 하면 위와 같은 화면을 볼 수 있는데
활용용도, 활용(사용)URL, 내용을 입력하여 발급요청을 한다.

![](/assets/img/posts/project/accident-hotspot/openapi-key-issued.png)

발급요청이 완료되면 위와 같은 화면에서 인증키를 확인할 수 있다
해당 인증키가 있어야 OpenAPI데이터를 가지고 올 수 있다.

<br>

---

## DB 구축

### 클래스와 변수 선언

```java
public class Accident {
  private final String KEY = "userKey"; // 인증키
  private Integer pIndex = 1; // 페이지 위치, 기본값 1
  private Integer pSize = 100; // 페이지 당 요청 숫자, 기본값 100
  private String result = "";
  DbConnection dbConnection = new DbConnection();
}
```

위 코드에서는 필요한 변수(인증키, 페이지 위치, 페이지당 요청 숫자)를 셋팅하였다.
pIndex는 데이터를 요청할 페이지 위치를 저장하는 변수이고, 기본값은 1이다.
pSize는 한페이지 당 요청할 데이터 수를 저장하는 변수이며
결과를 저장할 String변수와 데이터베이스 연결을 위한 DbConnection 객체를 선언하였다.

<br>

### 데이터 가져오기

```java
public void fetchData() {
  PreparedStatement pstmt = null;
  try {
    dbConnection.dbCon();
    while (true) {
      URL url = new URL("https://openapi.gg.go.kr/TfcacdarM" + "?KEY=" + KEY + "&pIndex=" + pIndex + "&pSize=" + pSize);
      HttpURLConnection con = (HttpURLConnection) url.openConnection();
      con.setRequestMethod("GET");
      con.setRequestProperty("Content-type", "application/json");
      int code = con.getResponseCode();
    }
  } catch (ProtocolException e) {
      throw new RuntimeException(e);
  } catch (MalformedURLException e) {
      throw new RuntimeException(e);
  } catch (IOException e) {
      throw new RuntimeException(e);
  }
}
```

fetchData() 메소드에서는 데이터를 가지고 오는 작업이 이루어진다.
경기도 공공데이터의 API를 사용하여 데이터를 가져오고, 이를 HttpURLConnection 객체를 이용하여 GET요청을 보낸다.
여기서 GET 요청은 서버에게 특정 데이터를 요청하는 방식이다.

<br>

### 데이터 처리와 JSON 파싱

```java
if (code == HttpURLConnection.HTTP_OK) {
  BufferedReader br = new BufferedReader(new InputStreamReader(con.getInputStream()));
  String data;
  StringBuilder response = new StringBuilder();
  while ((data = br.readLine()) != null) {
    response.append(data);
  }
  br.close();
  
  result = response.toString();
  
  JSONObject jsonObject = new JSONObject(result);
  JSONArray jsonArray = jsonObject.getJSONArray("TfcacdarM");
  
  JSONObject head = jsonArray.getJSONObject(0);
  JSONArray headIn = head.getJSONArray("head");
  
  JSONObject row = jsonArray.getJSONObject(1);
  JSONArray rowIn = row.getJSONArray("row");
  
  JSONObject listTotal = headIn.getJSONObject(0);
  int listTotalCount = listTotal.getInt("list_total_count");
```

서버로부터 응답이 정상적으로 왔을 때, BufferedReader를 사용하여 응답데이터를 읽어온다.
읽어온 데이터는 StringBuilder를 이용하여 문자열로 만들고, 다시 JSONObject로 변환하여 JSON데이터를 파싱한다.
중접된 구조를 해석하기 위해 여러 번 파싱을 수행했다.

<br>

### DELETE

```java
for (int i = 0; i < rowIn.length(); i++) {
  JSONObject rowInner = rowIn.getJSONObject(i);
  String sql1 = "DELETE FROM ACCIDENT WHERE MULTI_KNOWLG_DIV_NO = ?";
  pstmt = dbConnection.dbconn.prepareStatement(sql1);
  pstmt.setInt(1, rowInner.optInt("MULTI_KNOWLG_DIV_NO"));
  int r1 = pstmt.executeUpdate();
  if (r1 > 0) {
      System.out.println("데이터 삭제 성공");
  }
```

이 부분은 중복된 값을 방지하기 위해 기존에 테이블에 존재하는 데이터를 삭제하는 로직이다.
'MULTI_KNOWLG_DKV_NO'라는 기본키를 이용하여 동일값이 있는지 확인한다.
만약 같은 값이 있다면 PreparedStatement를 이용하여 SQL 쿼리를 실행하고 성공 여부를 확인한다.

<br>

### INSERT

#### 쿼리문 작성 및 PreparedStatement 설정

```java
String sql2 = "INSERT INTO ACCIDENT " +
    "(SIGUN_NM, SIGUN_CD, ACDNT_DIV_NM, MULTI_KNOWLG_DIV_NO, MULTI_KNOWLG_DIV_GROUP_NO, " +
    "LEGALDONG_CD_NO, SPOT_NO, JURISD_POLCSTTN_NM, LOC_INFO, OCCUR_CNT, CASLT_CNT, " +
    "DPRS_CNT, SERINJRY_INDVDL_CNT, SLTINJRY_INDVDL_CNT, INJURY_APLCNT_CNT, LOGT, LAT, " +
    "MULTI_REGION_INFO, ACDNT_YY) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

pstmt = dbConnection.dbconn.prepareStatement(sql2);
```

이 부분에서는 SQL INSERT 쿼리문을 작성하고, PreparedStatement 객체를 생성한다.
SQL 쿼리문에서는 ?를 사용하여 각 필드에 대한 값을 설정할 수 있다.

<br>

#### 값 설정 및 쿼리 실행
```java
pstmt.setString(1, rowInner.optString("SIGUN_NM"));  
    pstmt.setString(2, rowInner.optString("SIGUN_CD"));  
    pstmt.setString(3, rowInner.optString("ACDNT_DIV_NM"));  
    pstmt.setInt(4, rowInner.optInt("MULTI_KNOWLG_DIV_NO"));  
    pstmt.setInt(5, rowInner.optInt("MULTI_KNOWLG_DIV_GROUP_NO"));  
    pstmt.setInt(6, rowInner.optInt("LEGALDONG_CD_NO"));  
    pstmt.setString(7, rowInner.optString("SPOT_NO"));  
    pstmt.setString(8, rowInner.optString("JURISD_POLCSTTN_NM"));  
    pstmt.setString(9, rowInner.optString("LOC_INFO"));  
    pstmt.setInt(10, rowInner.optInt("OCCUR_CNT"));  
    pstmt.setInt(11, rowInner.optInt("CASLT_CNT"));  
    pstmt.setInt(12, rowInner.optInt("DPRS_CNT"));  
    pstmt.setInt(13, rowInner.optInt("SERINJRY_INDVDL_CNT"));  
    pstmt.setInt(14, rowInner.optInt("SLTINJRY_INDVDL_CNT"));  
    pstmt.setInt(15, rowInner.optInt("INJURY_APLCNT_CNT"));  
    pstmt.setString(16, rowInner.optString("LOGT"));  
    pstmt.setString(17, rowInner.optString("LAT"));  
    pstmt.setString(18, rowInner.optString("MULTI_REGION_INFO"));  
    pstmt.setInt(19, rowInner.optInt("ACDNT_YY"));  
  
    int r2 = pstmt.executeUpdate();  
    if (r2 > 0) {  
        System.out.println("데이터 삽입 성공");  
    }  
}
```

각 set 메소드를 사용하여 SQL 쿼리의 ? 위치에 값을 설정한다.
설정이 완료되면 executeUpdate()를 호출하여 쿼리를 실행하고, 성공하면 "데이터 삽입 성공"을 출력한다.

<br>

### 페이지 인덱스 관리

```java
// 페이지를 증가시킵니다.
pIndex++;

int pageCount = (int) Math.ceil((double) listTotalCount / pSize);

if (pIndex > pageCount) {
    System.out.println("출력이 완료되었습니다.");
    break;
}
```

공공데이터에서 한 번에 최대 1000개의 데이터만 제공하므로
데이터가 그보다 많을 때 모두 가져오기 위해서는 여러 번 요청을 보내야 한다.
이를 위해 페이지 인덱스를 사용하여 현재 요청해야 하는 페이지를 추적하고, 총 페이지수를 계산하여 모든 데이터를 가지고 왔는지 확인한다.

<br>

---

## 전체 코드

### 코드

```java
public class Accident {  

    private final String KEY = "userKey"; // 인증키
    private Integer pIndex = 1; // 페이지 위치, 기본값 1
    private Integer pSize = 100; // 페이지 당 요청 숫자, 기본값 100
    private String result = "";
    DbConnection dbConnection = new DbConnection();
  
    public void fetchData() {  
        PreparedStatement pstmt = null;  
        try {  
            dbConnection.dbCon();  
            while (true) {  
                // URL 객체 생성  
                URL url = new URL("https://openapi.gg.go.kr/TfcacdarM" + "?KEY=" + KEY + "&pIndex=" + pIndex + "&pSize=" + pSize);  
  
                // HttpURLConnection 생성 및 설정  
                HttpURLConnection con = (HttpURLConnection) url.openConnection();  
                con.setRequestMethod("GET");  
                con.setRequestProperty("Content-type", "application/json");  
  
                // 응답 코드 확인  
                int code = con.getResponseCode();  
  
                // 응답 데이터 받기  
                if (code == HttpURLConnection.HTTP_OK) {  
                    BufferedReader br = new BufferedReader(new InputStreamReader(con.getInputStream()));  
                    String data;  
                    StringBuilder response = new StringBuilder();  
                    while ((data = br.readLine()) != null) {  
                        response.append(data);  
                    }  
                    br.close();  
  
                    // 받은 데이터 처리  
                    result = response.toString();  
  
                    // Json 파싱  
                    JSONObject jsonObject = new JSONObject(result);  
                    JSONArray jsonArray = jsonObject.getJSONArray("TfcacdarM");  
  
                    JSONObject head = jsonArray.getJSONObject(0);  
                    JSONArray headIn = head.getJSONArray("head");  
  
                    JSONObject row = jsonArray.getJSONObject(1);  
                    JSONArray rowIn = row.getJSONArray("row");  
  
                    JSONObject listTotal = headIn.getJSONObject(0);  
                    int listTotalCount = listTotal.getInt("list_total_count");  
  
                    for (int i = 0; i < rowIn.length(); i++) {  
                        JSONObject rowInner = rowIn.getJSONObject(i);  
  
                        // DB DELETE  
                        String sql1 = "DELETE FROM ACCIDENT WHERE MULTI_KNOWLG_DIV_NO = ?";  
  
                        pstmt = dbConnection.dbconn.prepareStatement(sql1);  
                        pstmt.setInt(1, rowInner.optInt("MULTI_KNOWLG_DIV_NO"));  
                        int r1 = pstmt.executeUpdate();  
                        if (r1 > 0) {  
                            System.out.println("데이터 삭제 성공");  
                        }  
  
  
                        // DB INSERT  
                        String sql2 = "INSERT INTO ACCIDENT " +  
                                "(SIGUN_NM, SIGUN_CD, ACDNT_DIV_NM, MULTI_KNOWLG_DIV_NO, MULTI_KNOWLG_DIV_GROUP_NO, " +  
                                "LEGALDONG_CD_NO, SPOT_NO, JURISD_POLCSTTN_NM, LOC_INFO, OCCUR_CNT, CASLT_CNT, " +  
                                "DPRS_CNT, SERINJRY_INDVDL_CNT, SLTINJRY_INDVDL_CNT, INJURY_APLCNT_CNT, LOGT, LAT, " +  
                                "MULTI_REGION_INFO, ACDNT_YY) " +  
                                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";  
  
                        pstmt = dbConnection.dbconn.prepareStatement(sql2);  
                        pstmt.setString(1, rowInner.optString("SIGUN_NM"));  
                        pstmt.setString(2, rowInner.optString("SIGUN_CD"));  
                        pstmt.setString(3, rowInner.optString("ACDNT_DIV_NM"));  
                        pstmt.setInt(4, rowInner.optInt("MULTI_KNOWLG_DIV_NO"));  
                        pstmt.setInt(5, rowInner.optInt("MULTI_KNOWLG_DIV_GROUP_NO"));  
                        pstmt.setInt(6, rowInner.optInt("LEGALDONG_CD_NO"));  
                        pstmt.setString(7, rowInner.optString("SPOT_NO"));  
                        pstmt.setString(8, rowInner.optString("JURISD_POLCSTTN_NM"));  
                        pstmt.setString(9, rowInner.optString("LOC_INFO"));  
                        pstmt.setInt(10, rowInner.optInt("OCCUR_CNT"));  
                        pstmt.setInt(11, rowInner.optInt("CASLT_CNT"));  
                        pstmt.setInt(12, rowInner.optInt("DPRS_CNT"));  
                        pstmt.setInt(13, rowInner.optInt("SERINJRY_INDVDL_CNT"));  
                        pstmt.setInt(14, rowInner.optInt("SLTINJRY_INDVDL_CNT"));  
                        pstmt.setInt(15, rowInner.optInt("INJURY_APLCNT_CNT"));  
                        pstmt.setString(16, rowInner.optString("LOGT"));  
                        pstmt.setString(17, rowInner.optString("LAT"));  
                        pstmt.setString(18, rowInner.optString("MULTI_REGION_INFO"));  
                        pstmt.setInt(19, rowInner.optInt("ACDNT_YY"));  
  
                        int r2 = pstmt.executeUpdate();  
                        if (r2 > 0) {  
                            System.out.println("데이터 삽입 성공");  
                        }  
                    }  
  
                    // 페이지를 증가시킵니다.  
                    pIndex++;  
  
                    int pageCount = (int) Math.ceil((double) listTotalCount / pSize);  
  
                    if (pIndex > pageCount) {  
                        System.out.println("출력이 완료되었습니다.");  
                        break;  
                    }  
                } else {  
                    // 응답이 실패한 경우  
                    System.out.println("HTTP 요청 실패: " + code);  
                    break;  
                }  
  
                // 연결 종료  
                con.disconnect();  
                Thread.sleep(5000); // sleep은 별도의 구현없이 바로 호출하여 사용하면 된다(static 메소드임)  
            }  
        } catch (IOException e) {  
            e.printStackTrace();  
        } catch (SQLException e) {  
            throw new RuntimeException(e);  
        } catch (InterruptedException e) {  
            throw new RuntimeException(e);  
        } finally {  
            if (pstmt != null) {  
                try {  
                    pstmt.close();  
                } catch (SQLException e) {  
                    e.printStackTrace();  
                }  
            }  
            dbConnection.dbClose();  
        }  
    }  
}
```

<br>

### Main

```java
public class Main {  
    public static void main(String[] args) {  
        try {  
            // JobDetail 생성  
            JobDetail job = JobBuilder.newJob(MyJob.class)  
                    .withIdentity("myJob", "group1")  
                    .build();  
  
            // Trigger 생성 (Cron 표현식 사용)  
            Trigger trigger = TriggerBuilder.newTrigger()  
                    .withIdentity("myTrigger", "group1")  
                    .withSchedule(CronScheduleBuilder.cronSchedule("0 0 * * * ?")) // 매 시 정각에 실행  
                    .build();  
  
            // 스케줄러 생성 및 작업 스케줄링  
            Scheduler scheduler = new StdSchedulerFactory().getScheduler();  
            scheduler.start();  
            scheduler.scheduleJob(job, trigger);  
        } catch (SchedulerException se) {  
            se.printStackTrace();  
        }  
    }  
  
    public static class MyJob implements Job {  
        public void execute(JobExecutionContext context) throws JobExecutionException {  
            Accident accident = new Accident();  
            accident.fetchData();  
        }  
    }  
}
```

그리고 cron표현식을 사용하여 일정 주기마다 자동으로 실행될 수 있도록 Quartz 라이브러리를 사용하여 구현하였다.

<br>

### 결과

![](/assets/img/posts/project/accident-hotspot/db-insert-result.png)

