---
title: "사고다발지 시각화 프로젝트 (5) - 네이버 지도 API로 사고다발지 현황 시각화"
date: 2025-01-26 10:30:00 +0900
categories: [Project]
tags: [java, project]
description: "OpenAPI활용 경기도 사고다발지 시각화 프로젝트"
image:
  path: /assets/img/thumbnails/accident-hotspot.jpg
---

## 네이버 지도 API로 사고다발지 현황 시각화

지난 포스팅에서는 Spring 프레임워크를 이용해 MySQL과 연결을 진행했다.
이번 포스팅에서는 Spring MVC와 MyBatis를 활용하여 DB에서 사고다발지 현황 데이터를 가져와서 웹 페이지에 지도로 표시 해 보겠다.

<br>

### 프로젝트 구성

이 프로젝트는 크게 네 부분으로 구성된다.

1. **컨트롤러(Controller)**: HTTP 요청을 처리하고 비즈니스 로직을 호출.
2. **서비스(Service)**: 비즈니스 로직을 수행하는 역할.
3. **데이터 액세스 객체(DAO)**: 데이터베이스와의 통신을 담당.
4. **뷰(View)**: 사용자에게 정보를 시각적으로 표시.
   
<br>

#### 컨트롤러 구성하기

먼저, `OpenApiController` 클래스를 통해 `/accidentMap` 경로로 GET 요청이 오면 사고 데이터 목록을 가져와서 모델에 추가한다.
이 데이터는 JSON 형태로 변환되어 뷰에 전달된다.

```java
@Slf4j
@Controller
public class OpenApiController {

    @Autowired
    private OpenApiService service;

    @GetMapping("/accidentMap")
    public String getMapList(Model model) {
        List<Accident> accidentList = service.getAccidentList();
        if (accidentList == null || accidentList.isEmpty()) {
            log.error("Accident list is null or empty");
            return "error";
        }

        ObjectMapper mapper = new ObjectMapper();
        String json;
        try {
            json = mapper.writeValueAsString(accidentList);
            model.addAttribute("accidentList", json);
        } catch (JsonProcessingException e) {
            log.error("Failed to convert accident list to JSON", e);
            return "error";
        }

        return "accidentMap";
    }
}
```

#### 서비스 및 DAO 구현하기

`OpenApiService`는 DAO를 통해 데이터베이스에서 사고 목록을 가져오는 기능을 담당한다.
`OpenApiDaoImpl`에서는 MyBatis의 `SqlSessionTemplate`을 사용하여 데이터베이스 쿼리를 실행한다.

```java
@Service
@Slf4j
public class OpenApiService {

    @Autowired
    private OpenApiDao dao;

    public List<Accident> getAccidentList() {
        return dao.getAccidentList();
    }
}

@Repository
public class OpenApiDaoImpl implements OpenApiDao {

    @Autowired
    private SqlSessionTemplate sql;

    @Override
    public List<Accident> getAccidentList() {
        return sql.selectList("accidentMapper.getAccidentList");
    }
}
```

#### MyBatis 매퍼 구성하기

`accidentMapper.xml` 파일에 SQL 쿼리를 정의하여 데이터베이스에서 사고 리스트를 가져온다.

```xml
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="accidentMapper">
    <select id="getAccidentList" resultType="com.spring.web.dto.Accident">
        SELECT *
        FROM ACCIDENT;
    </select>
</mapper>
```

#### JSP 뷰 작성하기

메인 페이지에서는 "Go to Map" 버튼을 클릭하면 `/accidentMap` 경로로 리다이렉트된다.

```jsp
<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<html>
<head>
    <title>Main Page</title>
</head>
<body>
    <button onclick="location.href='/accidentMap'">Go to Map</button>
</body>
</html>
```

<br>

`accidentMap.jsp` 파일에서는 네이버 지도를 로딩하고,
서버로부터 받은 JSON 형식의 사고다발지 현황 데이터를 지도 위에 마커와 폴리곤으로 시각화한다.

```jsp
<%@ page contentType="text/html;charset=UTF-8" language="java" %>  
<!DOCTYPE html>  
<html>  
<head>  
    <meta http-equiv="X-UA-Compatible" content="IE=edge">  
    <meta name="viewport"  
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no">  
    <title>simple map</title>  
    <script type="text/javascript"  
            src="https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=userId"></script>  
    <link rel="stylesheet" href="../../resources/css/common.css"/>  
</head>  
<body>  
<div id="map" style="width:100%;height:930px;"></div>  
  
<script>  
    // 지도api 중심지  
    var mapOptions = {  
        center: new naver.maps.LatLng(37.3595704, 127.105399), // 지도의 초기 중심 좌표 설정  
        zoom: 12, // 지도의 초기 줌 레벨 설정  
  
        zoomControl: true, // 줌 컨트롤러  
        zoomControlOptions: {  
            position: naver.maps.Position.TOP_RIGHT  
        },  
        mapTypeControl: true, // 위성, 일반  
        mapTypeControlOptions: {  
            style: naver.maps.MapTypeControlStyle.BUTTON,  
            position: naver.maps.Position.TOP_RIGHT  
        }  
    };  
  
    // map 객체 생성  
    var map = new naver.maps.Map(document.getElementById('map'), mapOptions);  
  
    // 마우스 오버 시 정보표시를 위한 인포윈도우 생성, 아직은 내용이 없음  
    var infoWindow = new naver.maps.InfoWindow({  
        content: ''  
    });  
  
    // 마커와 인포윈도우를 연결하는 함수  
    function attachInfoWindow(marker, accident) {  
        // 마우스 오버 이벤트 리스너  
        naver.maps.Event.addListener(marker, 'mouseover', function (e) {  
            var content = [  
                '<div class="infoWindow">',  
                '   <p><b>사고유형구분:</b> ' + accident.acdntDivNm + '</p>',  
                '   <p><b>시도시군구명:</b> ' + accident.jurisdPolcsttnNm + '</p>',  
                '   <p><b>사고지역위치명:</b> ' + accident.locInfo + '</p>',  
                '   <p><b>사고년도:</b> ' + accident.acdntYy + '</p>',  
                '   <p><b>발생건수:</b> ' + accident.occurCnt + '</p>',  
                '</div>'  
            ].join('');  
  
            infoWindow.setContent(content);  
            infoWindow.open(map, marker); // 인포윈도우를 지도에 표시  
        });  
  
        // 마우스 아웃 이벤트리스너  
        naver.maps.Event.addListener(marker, 'mouseout', function (e) {  
            infoWindow.close();  
        });  
    }  
  
    <%-- <%= ... %> 내에 작성 된 코드는 서버에서 실행되고 문자열로 변환되어 JSP페이지에 직접 삽입된다.--%>  
    // 서버에서 JSON파싱을 한 데이터가 accidentList에 할당되고 사용할 수 있게 된다.  
    var accidentList = <%= request.getAttribute("accidentList") %>;  
  
    // JSP에서 받은 accidentList를 순회하면서 지도에 마커를 표시  
    for (var i = 0; i < accidentList.length; i++) {  
        var accident = accidentList[i];  
  
  
        console.log('lat: ', accident.lat);  
        console.log('logt: ', accident.logt);  
  
  
        // 마커 객체 생성  
        var marker = new naver.maps.Marker({  
            position: new naver.maps.LatLng(accident.lat, accident.logt),  
            map: map // 마커를 표시할 지도 객체  
        });  
  
        // 마커에 인포윈도우 연결  
        attachInfoWindow(marker, accident);  
  
        // multiRegionInfo 데이터가 GeoJSON 형식의 문자열로 제공될 경우  
        var multiRegionInfo = JSON.parse(accident.multiRegionInfo);  
  
        // Polygon 좌표 배열을 생성합니다.  
        var paths = multiRegionInfo.coordinates[0].map(function(coord) {  
            return new naver.maps.LatLng(coord[1], coord[0]); // GeoJSON은 [경도, 위도] 순으로 좌표를 가지므로 순서를 바꿔준다.  
        });  
  
        // 폴리곤 생성  
        var polygon = new naver.maps.Polygon({  
            map: map,  
            paths: [paths], // 폴리곤 경로 (LatLng 객체의 배열)  
            fillColor: '#ff0000',  
            fillOpacity: 0.3,  
            strokeColor: '#ff0000',  
            strokeOpacity: 0.6,  
            strokeWeight: 3  
        });  
  
    }  
</script>  
</body>  
</html>
```

링크 : [네이버지도API](https://www.ncloud.com/product/applicationService/maps)
위 링크에서 지도API 키를 발급받을 수 있다.

### 결과

![](/assets/img/posts/project/accident-hotspot/result-map.png)

### 마무리

이제 사용자들은 사고다발지 현황을 지도에서 직접 확인할 수 있다.
이를 통해 특정 지역의 사고 위험성을 미리 인지하고 주의하여 안전한 운전이나 보행을 할 수 있다.



