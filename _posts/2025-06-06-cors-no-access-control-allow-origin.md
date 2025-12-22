---
title: "(CORS) No 'Access-Control-Allow-Origin' header is present in the requested resource"
date: 2025-06-06
categories: [Problem]
tags: [cors]
description: "외부 API 및 RSS 크롤링 과정에서 발생한 CORS 에러와 프록시를 통한 해결 과정"
---

## CORS 에러: No 'Access-Control-Allow-Origin' Header

**CORS 에러**는 브라우저가 외부 서버로의 **Ajax 요청**을 차단할 때 발생하는 문제로, **SOP(Same-Origin Policy)** 가 그 원인으로, 출처가 다를 경우 요청을 차단하는 보안 정책이다.

필자는 RSS, API, Web 크롤링을 테스트하면서 이 문제를 만났고, 다양한 방법을 시도했다.

[CORS 링크](https://rlckdwkd55.github.io/posts/cors/)<br>
[Proxy링크](https://rlckdwkd55.github.io/posts/proxy/)

---

### 해결을 위한 시도 방법

#### 1. **web.xml**에서의 CORS 설정 **(실패)**

Spring 프로젝트에서는 **web.xml**에 필터를 추가하여 CORS 허용을 시도할 수 있으며, 다음과 같이 설정했다:

```xml
<filter>
    <filter-name>CorsFilter</filter-name>
    <filter-class>org.apache.catalina.filters.CorsFilter</filter-class>
    <init-param>
        <param-name>cors.allowed.origins</param-name>
        <param-value>*</param-value>
    </init-param>
</filter>

<filter-mapping>
    <filter-name>CorsFilter</filter-name>
    <url-pattern>*</url-pattern>
</filter-mapping>

```

**Tomcat CORS 필터** 설정을 해 보았지만, 외부 API 요청의 CORS 문제는 해결되지 않았다.

---

#### 2. **Spring Security**에서의 CORS 설정 **(실패)**

##### 1. **SecurityConfig.java**에서의 설정

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins("http://localhost:8080")
                .allowedMethods("GET", "POST", "PUT", "DELETE")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}
```

##### 2. **security-context.xml**에 CORS 설정 추가

```xml
<http>
    <cors />
    <!-- 기타 보안 설정 -->
</http>
```

Spring Security의 CORS 필터를 사용해 시도했지만, 외부 서버와의 통신에서 여전히 CORS 문제가 발생했다.

---

#### 3. **Custom CORS Filter** 사용 **(실패)**

##### 1. **CORSFilter.java** 파일

```java
public class CORSFilter implements Filter {
    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) throws IOException, ServletException {
        HttpServletResponse response = (HttpServletResponse) res;
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE, PUT");
        response.setHeader("Access-Control-Max-Age", "3600");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type, x-requested-with, Authorization");
        chain.doFilter(req, res);
    }
}

```

##### 2. **web.xml**에 필터 추가

```xml
<filter>
    <filter-name>CORSFilter</filter-name>
    <filter-class>com.example.CORSFilter</filter-class>
</filter>
<filter-mapping>
    <filter-name>CORSFilter</filter-name>
    <url-pattern>/*</url-pattern>
</filter-mapping>
```

이 방법으로도 외부 서버와의 CORS 문제를 해결할 수 없었다.

---

#### 4. **프록시 서버 사용** **(성공)**

최종적으로, **프록시 서버**를 사용하여 CORS 문제를 해결했다.
**프록시 서버**가 클라이언트의 요청을 받아 외부 서버로 요청을 보내는 방식

##### 1. **ProxyController.java** 생성

```java
@Controller
public class ProxyController {
    @GetMapping("/proxy/crawl")
    public ResponseEntity<String> proxyCrawlRequest(@RequestParam String url) {
        RestTemplate restTemplate = new RestTemplate();
        try {
            ResponseEntity<byte[]> response = restTemplate.getForEntity(url, byte[].class);
            String body = new String(response.getBody(), StandardCharsets.UTF_8);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(new MediaType("application", "rss+xml", StandardCharsets.UTF_8));
            return new ResponseEntity<>(body, headers, HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body("데이터를 가져오지 못했습니다: " + e.getMessage());
        }
    }
}
```

##### 2. **JavaScript에서 프록시를 통한 요청**

```javascript
async function parseRSSFeed(feedUrl) {
    let response;
    try {
        response = await fetch(`http://localhost:8080/proxy/crawl?url=${encodeURIComponent(feedUrl)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/rss+xml, application/xml',
                'Accept-Charset': 'UTF-8'
            }
        });
        if (!response.ok) {
            console.error(`프록시를 통한 HTTP 에러: ${response.status}`);
            return null;
        }
    } catch (error) {
        console.error("프록시 요청 중 오류 발생:", error);
        return null;
    }
    const text = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "application/xml");
    console.log('RSS Feed:', xml);
    return xml;
}
```

이 방식으로 **프록시 서버**를 통해 외부 서버로 요청을 보내 CORS 문제를 해결했다.
**Spring Controller**가 프록시 역할을 하여 클라이언트의 CORS 제한을 우회할 수 있었다.

---

#### 결론

CORS 문제는 출처가 다른 클라이언트와 외부 서버 간의 보안 정책으로 인해 발생하며, 여러 방법을 시도했지만, **서버 설정만으로는 해결되지 않았다**.
프록시 서버를 통해 요청을 우회하는 방식이 가장 효과적이었으며, Spring과 JavaScript의 연동으로 이 문제를 해결할 수 있었다.

**프록시 방식**을 선택한 이유는, 동일한 출처의 **localhost:8080**에서 **http://localhost:3000**으로 요청할 때**는 web.xml 또는 security-context.xml 설정으로 해결할 수 있겠지만 **localhost:8080**에서 **https://www.naver.com** 처럼 **외부 URL로 요청하는 경우**, 해당 서버의 CORS 정책을 우회할 수 없으므로 **프록시 서버**를 통해 해결했다.
