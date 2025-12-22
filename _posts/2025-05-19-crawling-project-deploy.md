---
title: "Docker Compose로 웹 크롤링 프로젝트 배포 + SSL 적용"
date: 2025-05-19
categories: [Project]
tags: [docker, docker-compose, ssl]
description: "웹 크롤링 프로젝트를 Docker Compose로 배포하고 OpenSSL 인증서 적용"
image:
  path: /assets/img/thumbnails/crawling-project-deploy.jpg
---

이번 포스팅에서는 Docker Compose를 활용하여 웹 크롤링 프로젝트를 배포하는 방법에 대해 알아보겠다.
이 과정에서 OpenSSL 인증서를 적용해 프로젝트의 보안성을 높이는 데 집중할 것이다.

이전에 [Docker Desktop 설치](https://rlckdwkd55.github.io/posts/docker-install/)하고, [웹 크롤링 프로젝트](https://rlckdwkd55.github.io/posts/steam-crawling-project-1/)를 진행했었다.
그리고 [OpenSSL 인증서를 발급](https://rlckdwkd55.github.io/posts/openssl/)받은 것도 추가로 활용해 오늘은 그 모든 경험을 종합하여 프로젝트를 한 단계 업그레이드 해 보겠다.

`docker-compose.yml` 과 `Dockerfile`의 문법은 [여기를 클릭](https://rlckdwkd55.github.io/posts/dockerfile-and-compose/)하면 확인할 수 있다.

## 1. docker-compose.yml 작성

```yaml
version: '3.8'  
services:  
  chrome:  
    image: selenium/node-chrome:latest  
    shm_size: 2gb  
    depends_on:  
      - selenium-hub  
    environment:  
      - SE_EVENT_BUS_HOST=selenium-hub  
      - SE_EVENT_BUS_PUBLISH_PORT=4442  
      - SE_EVENT_BUS_SUBSCRIBE_PORT=4443  
  
  selenium-hub:  
    image: selenium/hub:latest  
    container_name: selenium-hub  
    ports:  
      - "4442:4442"  
      - "4443:4443"  
      - "4444:4444"  
  
  db:  
    image: mysql:latest  
    ports:  
      - "3307:3306"  
    environment:  
      MYSQL_ROOT_PASSWORD: "0000"  
      MYSQL_DATABASE: CRAWLINGDB  
      MYSQL_USER: TEST  
      MYSQL_PASSWORD: "0000"  
  
  tomcat:  
    build:  
      context: ../  
      dockerfile: docker/tomcat/Dockerfile  
    ports:  
      - "8081:8080"  
    depends_on:  
      - db  
  
  apache:  
    build:  
      context: ../  
      dockerfile: docker/apache/Dockerfile  
    ports:  
      - "80:80"  
      - "443:443"  
    volumes:  
      - C:\Project\CrawlingPractice\httpd\logs:/usr/local/apache2/logs/  
      - C:\Project\CrawlingPractice\httpd/html/:/usr/local/apache2/htdocs/  
    depends_on:  
      - tomcat
```

이 프로젝트에서는 `chrome`, `selenium-hub`, `db`, `tomcat`, `apache` 총 5개의 서비스를 사용한다.

`chrome`:
- `Selenium/node-chrome`는 Chrome 브라우저를 가진 노드를 의미한다. 이 노드는 Selenium 허브에 등록되며, 허브로부터 테스트 요청을 받아 처리한다.
- `shm_size: 2gb`는 Shared Memory의 크기를 2GB로 설정한다. 이 설정은 크롬 브라우저의 성능을 향상시키는 데 도움이 된다.
  - Docker 컨테이너의 기본 공유 메모리 크기는 64MB로, 이는 크롬 브라우저가 원활하게 동작하기에는 부족할 수 있다.
  - 따라서 `shm_size: 2gb`와 같이 공유 메모리의 크기를 증가시키면 이러한 문제를 방지하고, 크롬 브라우저의 성능을 향상시킬 수 있다.

`selenium-hub`:
- `Selenium-hub`는 허브와 노드로 구성되어 있으며, Selenium Grid의 중심 컴포넌트로서, 테스트 요청을 받아 적절한 '노드'에 분배하는 역할을 한다. 여러 브라우저/운영체제 조합을 가진 노드를 관리하며, 필요에 따라 테스트를 해당 노드로 전송한다.
- `ports:`는 컨테이너의 포트를 호스트와 연결하는 부분이며, 여기서는 4442, 4443, 4444 포트를 연결하였다. 이 포트들은 Selenium Grid의 이벤트 버스가 사용하는 포트이다.

해당 서비스를 사용하기 위해 기존 프로젝트 코드를 아래와 같이 수정했다.
```java
WebDriver driver = null;  
try {  
    driver = new RemoteWebDriver(new URL("http://selenium-hub:4444/wd/hub"), options);  
} catch (MalformedURLException e) { // file, http, https에 : 이 붙지 않고 다른 값이 온다면 해당 예외가 발생한다.  
    e.printStackTrace();  
    return;  
}
```

`db`:
- 해당 서비스는 이 프로젝트의 데이터베이스를 정의한다.
- `image: mysql:latest`는 최신 버전의 MySQL 이미지를 사용하겠다는 것을 의미한다.
- `ports: - "3307:3306"`는 호스트의 3307 포트를 컨테이너의 3306 포트에 연결하겠다는 것을 의미한다.

해당 서비스를 사용하기 위해 아래와 같이 dataSource를 수정했다.
```xml
<bean id="dataSource" class="com.zaxxer.hikari.HikariDataSource">  
    <property name="driverClassName" value="com.mysql.cj.jdbc.Driver" />  
    <property name="jdbcUrl" value="jdbc:mysql://db:3306/CRAWLINGDB" />  
    <property name="username" value="TEST" />  
    <property name="password" value="0000" />  
  
    <!-- HikariCP 설정 -->  
    <property name="maximumPoolSize" value="5" />  
    <property name="minimumIdle" value="5" />  
    <property name="connectionTimeout" value="30000" />  
    <property name="idleTimeout" value="600000" />  
    <property name="maxLifetime" value="1800000" />  
</bean>
```

`tomcat`과 `apache`:
- 해당 서비스는 각각 Tomcat 서버와 Apache 서버를 정의한다.
- 이들은 `build:` 명령어를 통해 Dockerfile을 통해 이미지를 빌드하도록 설정되어 있다.
- `volumes:`는 호스트와 컨테이너 간의 파일 공유를 설정하는 부분이며, 이 설정을 통해 Apache의 로그 파일과 html 파일을 호스트와 공유할 수 있다.
  
<br>

## 2. Dockerfile 작성

Dockerfile은 Apache, Tomcat 총 2개를 작성했다.

### 2.1 Apache

```Dockerfile
# 기반 이미지 설정  
FROM httpd:latest  
```

- `FROM httpd:latest` 는 이 이미지의 기반(base)이 될 이미지를 지정한다.
- 여기서는 Apache HTTP 서버의 최신 버전을 기반으로 한다.


```Dockerfile
# tomcat과 연동을 위함  
RUN sed -i 's/#LoadModule proxy_module modules\/mod_proxy.so/LoadModule proxy_module modules\/mod_proxy.so/' /usr/local/apache2/conf/httpd.conf && \  
    sed -i 's/#LoadModule proxy_http_module modules\/mod_proxy_http.so/LoadModule proxy_http_module modules\/mod_proxy_http.so/' /usr/local/apache2/conf/httpd.conf && \  
    echo 'ProxyPreserveHost On' >> /usr/local/apache2/conf/httpd.conf && \  
    echo 'ProxyPass / http://tomcat:8080/ retry=1 acquire=3000 timeout=600 Keepalive=On' >> /usr/local/apache2/conf/httpd.conf && \  
    echo 'ProxyPassReverse / http://tomcat:8080/' >> /usr/local/apache2/conf/httpd.conf  
```

- 이 부분은 Apache와 Tomcat을 연동하기 위한 설정이다.
- Apache의 설정 파일인 `httpd.conf`를 수정하여, 프록시 모듈과 프록시 HTTP 모듈을 활성화하고, 프록시 설정을 추가한다.
- 이 설정을 통해, Apache는 모든 요청을 `http://tomcat:8080`으로 전달하게 된다.


```Dockerfile
# ssl 연동을 위함  
RUN sed -i 's/#LoadModule ssl_module modules\/mod_ssl.so/LoadModule ssl_module modules\/mod_ssl.so/' /usr/local/apache2/conf/httpd.conf && \  
    sed -i 's/#Include conf\/extra\/httpd-ssl.conf/Include conf\/extra\/httpd-ssl.conf/' /usr/local/apache2/conf/httpd.conf &&\  
    sed -i 's/#LoadModule socache_shmcb_module modules\/mod_socache_shmcb.so/LoadModule socache_shmcb_module modules\/mod_socache_shmcb.so/' /usr/local/apache2/conf/httpd.conf  
```

- 이 부분은 SSL 설정을 위한 것이다.
- SSL 모듈과 캐시 모듈을 활성화하고, 추가적인 SSL 설정을 포함하기 위해 `httpd-ssl.conf` 파일을 포함하도록 설정한다.


```Dockerfile
COPY docker/apache/sslkey/localhost.crt /usr/local/apache2/conf/server.crt  
COPY docker/apache/sslkey/localhost.key /usr/local/apache2/conf/server.key  
```

- SSL 인증서와 키를 Apache의 설정 디렉토리로 복사한다.
- 이 파일들은 SSL 연결을 설정하는 데 필요합니다.


```Dockerfile
RUN echo 'SSLCertificateFile "/usr/local/apache2/conf/server.crt"' >> /usr/local/apache2/conf/extra/httpd-ssl.conf && \  
    echo 'SSLCertificateKeyFile "/usr/local/apache2/conf/server.key"' >> /usr/local/apache2/conf/extra/httpd-ssl.conf
```

- 마지막으로, SSL 인증서와 키의 위치를 `httpd-ssl.conf` 파일에 추가한다.
- 이 설정을 통해 Apache는 이 파일들을 사용하여 SSL 연결을 설정하게 된다.

---

\[전체코드]
```Dockerfile
# Apache Dockerfile  
# 기반 이미지 설정  
FROM httpd:latest  
  
# tomcat과 연동을 위함  
RUN sed -i 's/#LoadModule proxy_module modules\/mod_proxy.so/LoadModule proxy_module modules\/mod_proxy.so/' /usr/local/apache2/conf/httpd.conf && \  
    sed -i 's/#LoadModule proxy_http_module modules\/mod_proxy_http.so/LoadModule proxy_http_module modules\/mod_proxy_http.so/' /usr/local/apache2/conf/httpd.conf && \  
    echo 'ProxyPreserveHost On' >> /usr/local/apache2/conf/httpd.conf && \  
    echo 'ProxyPass / http://tomcat:8080/ retry=1 acquire=3000 timeout=600 Keepalive=On' >> /usr/local/apache2/conf/httpd.conf && \  
    echo 'ProxyPassReverse / http://tomcat:8080/' >> /usr/local/apache2/conf/httpd.conf  
  
# ssl 연동을 위함  
RUN sed -i 's/#LoadModule ssl_module modules\/mod_ssl.so/LoadModule ssl_module modules\/mod_ssl.so/' /usr/local/apache2/conf/httpd.conf && \  
    sed -i 's/#Include conf\/extra\/httpd-ssl.conf/Include conf\/extra\/httpd-ssl.conf/' /usr/local/apache2/conf/httpd.conf &&\  
    sed -i 's/#LoadModule socache_shmcb_module modules\/mod_socache_shmcb.so/LoadModule socache_shmcb_module modules\/mod_socache_shmcb.so/' /usr/local/apache2/conf/httpd.conf  
  
COPY docker/apache/sslkey/localhost.crt /usr/local/apache2/conf/server.crt  
COPY docker/apache/sslkey/localhost.key /usr/local/apache2/conf/server.key  
  
RUN echo 'SSLCertificateFile "/usr/local/apache2/conf/server.crt"' >> /usr/local/apache2/conf/extra/httpd-ssl.conf && \  
    echo 'SSLCertificateKeyFile "/usr/local/apache2/conf/server.key"' >> /usr/local/apache2/conf/extra/httpd-ssl.conf
```

이렇게 Dockerfile을 작성하면, 이를 Docker가 읽어 들여 Apache 이미지를 생성한다.
이 이미지는 이후 `docker-compose.yml`에서 사용되며, 이 Dockerfile을 통해 Apache와 Tomcat을 연동하고, SSL 설정을 추가하여 보안성을 강화한 Apache 서버를 구축할 수 있다.

<br>

### 2.2 Tomcat

```Dockerfile
# 기반 이미지 설정  
FROM tomcat:8.5-jdk8-openjdk  
```

- `FROM tomcat:8.5-jdk8-openjdk`는 이 이미지의 기반(base)이 될 이미지를 지정한다.
- 여기서는 Tomcat 8.5 버전과 OpenJDK 8을 포함하는 이미지를 기반으로 한다.


```Dockerfile
# WAR 파일을 ROOT.war로 이름 변경하여 Tomcat의 webapps 디렉토리에 복사  
COPY ./target/CrawlingPractice-1.0-SNAPSHOT.war /usr/local/tomcat/webapps/ROOT.war
```

- `COPY ./target/CrawlingPractice-1.0-SNAPSHOT.war /usr/local/tomcat/webapps/ROOT.war`는 빌드한 Java 애플리케이션(WAR 파일)을 Tomcat의 `webapps` 디렉토리로 복사하는 명령이다.
- 여기서는 `CrawlingPractice-1.0-SNAPSHOT.war` 파일을 `ROOT.war`로 이름을 변경하여 복사하고 있다.
- `ROOT.war`는 특수한 이름으로, 이 파일은 Tomcat이 시작될 때 자동으로 배포가 되며, `/` (루트) 경로에서 애플리케이션에 접근 가능하게 된다.

---

\[전체코드]
```Dockerfile
# 기반 이미지 설정  
FROM tomcat:8.5-jdk8-openjdk  
  
# WAR 파일을 ROOT.war로 이름 변경하여 Tomcat의 webapps 디렉토리에 복사  
COPY ./target/CrawlingPractice-1.0-SNAPSHOT.war /usr/local/tomcat/webapps/ROOT.war
```

이렇게 Dockerfile을 작성하면, Docker는 이를 읽어 들여 Tomcat 이미지를 생성한다. 이 이미지는 이후 `docker-compose.yml`에서 사용된다. 이 Dockerfile을 통해 Java 애플리케이션을 배포하는 Tomcat 서버를 구축할 수 있다.

<br>

## 3. 배포

### 3.1 docker-compose.yml 경로 진입

![](/assets/img/posts/project/crawling-deploy/compose-path.png)

위 사진과 같이 `docker-compose.yml` 파일을 작성 한 경로로 이동한다.

- `docker-compose.yml` 파일은 프로젝트의 루트 디렉토리에 위치하는 것이 일반적이다.
- 이 파일은 여러 Docker 컨테이너의 설정을 한 곳에서 관리할 수 있도록 도와주는 YAML 형식의 파일이다.

프로젝트의 루트 디렉토리에 위치하게 되면, 프로젝트의 전반적인 서비스 구성을 한눈에 파악할 수 있고, `docker-compose` 명령을 간편하게 실행할 수 있다.

<br>

### 3.2 명령어 실행

![](/assets/img/posts/project/crawling-deploy/compose-up.png)

`docker-compose up -d --build`:
- 이 명령은 Docker Compose를 통해 여러 Docker 컨테이너를 생성하고 실행한다.
- `-d` 옵션은 컨테이너를 백그라운드에서 실행하도록 하며, `--build` 옵션은 필요한 경우 Docker 이미지를 빌드하도록 한다.


![](/assets/img/posts/project/crawling-deploy/docker-images.png)

![](/assets/img/posts/project/crawling-deploy/docker-containers.png)

작성한 `Dockerfile`과 `docker-compose.yml` 기반으로 `Images`와 `Containers`가 정상적으로 등록되었고 동작하는 것을 확인할 수 있다.

<br>

### 3.3 DB 작성

![](/assets/img/posts/project/crawling-deploy/mysql-db.png)

기존 프로젝트에 사용하던 DB와는 별도로 `CRAWLINGDB`라는 이름으로 생성 해 주었다.


![](/assets/img/posts/project/crawling-deploy/mysql-table.png)

또한 필요한 테이블도 만들어주었고 쿼리는 아래와 같이 작성했다

```sql
CREATE TABLE GAMES (
TITLE VARCHAR(255) NOT NULL,
RELEASES VARCHAR(255),
CART VARCHAR(255),
PRIMARY KEY (TITLE)
);

CREATE TABLE TAGS (
TAG VARCHAR(255) NOT NULL,
PRIMARY KEY (TAG)
);

CREATE TABLE GAME_TAGS (
TITLE VARCHAR(255) NOT NULL,
TAG VARCHAR(255) NOT NULL,
PRIMARY KEY (TITLE, TAG),
FOREIGN KEY (TITLE) REFERENCES GAMES(TITLE),
FOREIGN KEY (TAG) REFERENCES TAGS(TAG)
);

CREATE TABLE PRICE (
TITLE VARCHAR(255) NOT NULL,
DISC VARCHAR(255),
ORIGIN_PRICE VARCHAR(255),
DISC_PRICE VARCHAR(255),
PRIMARY KEY (TITLE),
FOREIGN KEY (TITLE) REFERENCES GAMES(TITLE)
);

CREATE TABLE REVIEW (
TITLE VARCHAR(255) NOT NULL,
ONE_LINE_REVIEW VARCHAR(255),
REVIEW_COUNT VARCHAR(255),
PRIMARY KEY (TITLE),
FOREIGN KEY (TITLE) REFERENCES GAMES(TITLE)
);

CREATE TABLE IMAGES (
IMAGE_ID INT AUTO_INCREMENT,
ORIGIN_NAME VARCHAR(255),
IMAGE_NAME VARCHAR(255),
TITLE VARCHAR(255),
PRIMARY KEY (IMAGE_ID),
FOREIGN KEY (TITLE) REFERENCES GAMES(TITLE)
);

```
<br>

### 3.4 결과 확인

![](/assets/img/posts/project/crawling-deploy/deploy-result.png)

`docker-compose.yml`과 `Dockerfile`을 활용해 이미지와 컨테이너를 생성하고 정상적으로 실행 된 모습을 볼 수 있다.
<br>

## 4. 만났던 에러

### 4.1 Access denied for user 'test'@'172.18.0.4' (using password: YES)

비밀번호를 입력했지만 틀렸다는 예외가 발생했다.
컨테이너 내의 환경변수 리스트를 보기 위해 `docker exec crawlingpractice-db-1 env`를 사용 해 봤고 결과는 아래와 같다.

\[결과]
```bash
MYSQL_PASSWORD=0
MYSQL_ROOT_PASSWORD=0
MYSQL_DATABASE=CRAWLINGDB
GOSU_VERSION=1.16
MYSQL_MAJOR=innovation
MYSQL_VERSION=8.3.0-1.el8
MYSQL_SHELL_VERSION=8.3.0-1.el8
```

\[이유]
**문자열 인식 문제**:
- `docker-compose.yml` 파일에서 환경 변수 값을 따옴표로 감싸지 않으면, 숫자로 인식될 수 있다.
- `0000`이라는 값이 있을 때, 앞의 `0`들이 무시되고 `0`으로 해석될 수 있다.
- 이를 방지하기 위해 환경 변수 값을 설정할 때는 따옴표를 사용하는 것이 좋다.

\[예시]
```yaml
environment:
  MYSQL_ROOT_PASSWORD: "0000"
```
<br>

### 4.2 org.apache.ibatis.exceptions.PersistenceException

```yml
  db:  
    image: mysql:latest  
    ports:  
      - "3307:3306"  
    environment:  
      MYSQL_ROOT_PASSWORD: "0000"  
      MYSQL_DATABASE: CRAWLINGDB  
      MYSQL_USER: TEST  
      MYSQL_PASSWORD: "0000"  
```

docker-compose.yml 파일에서 db 서비스의 포트 설정이 "3307:3306"으로 돼 있다.
즉, 컴퓨터의 3307 포트를 데이터베이스 컨테이너의 3306 포트에 연결하는 것을 의미하는데, `dataSource`에서 포트를 3307로 열어서 생긴 문제였다.

\[기존]
```yaml
<bean id="dataSource" class="com.zaxxer.hikari.HikariDataSource">  
    <property name="driverClassName" value="com.mysql.cj.jdbc.Driver" />  
    <property name="jdbcUrl" value="jdbc:mysql://db:3307/CRAWLINGDB" />  
    <property name="username" value="TEST" />  
    <property name="password" value="0000" />
```

\[수정]
```yaml
<bean id="dataSource" class="com.zaxxer.hikari.HikariDataSource">  
    <property name="driverClassName" value="com.mysql.cj.jdbc.Driver" />  
    <property name="jdbcUrl" value="jdbc:mysql://db:3306/CRAWLINGDB" />  
    <property name="username" value="TEST" />  
    <property name="password" value="0000" />
```
<br>

### 4.3 AH00526: Syntax error

총 에러 메세지는 아래와 같다

```bash
2024-01-30 14:55:52 AH00526: Syntax error on line 92 of /usr/local/apache2/conf/extra/httpd-ssl.conf: 2024-01-30 14:55:52 SSLSessionCache: 'shmcb' session cache not supported (known names: ). Maybe you need to load the appropriate socache module (mod_socache_shmcb?).
```

`mod_socache_shmcb` 모듈이 로드되지 않았기 때문에 Apache가 `shmcb` 세션 캐시를 지원하지 않아서 문제가 발생했다.
`httpd.conf` 파일에서 `LoadModule socache_shmcb_module modules/mod_socache_shmcb.so` 줄의 주석을 제거하여 해결하였다..

```Dockerfile
RUN sed -i 's/#LoadModule socache_shmcb_module modules\/mod_socache_shmcb.so/LoadModule socache_shmcb_module modules\/mod_socache_shmcb.so/' /usr/local/apache2/conf/httpd.conf
```
<br><br><br><br><br><br><br><br><br><br>
참고 : https://93it-serverengineer.co.kr/14
