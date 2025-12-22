---
title: "Steam 게임 데이터 크롤링 프로젝트 (3)"
date: 2025-03-29
categories: [Web]
tags: [crawling, project]
description: "Steam 사이트의 게임 데이터를 수집하기 위한 크롤링 프로젝트"
image:
  path: /assets/img/thumbnails/steam-crawling-project.jpg
---

지난 포스팅에서는 Spring 프레임워크를 이용해 MySQL과 연결하고 사용하려는 Dependency를 설정하였다.
이번 포스팅에서는 Selenium을 이용하여 동적 웹 페이지에서 데이터를 크롤링하여 데이터를 DB에 저장하고, 이를 웹 페이지에 표시하는 방법에 대해 포스팅 하겠다.

## 프로젝트 구성

이 프로젝트는 크게 다섯 부분으로 구성된다.

1. **컨트롤러(Controller)**:
  - HTTP 요청을 처리하고 비즈니스 로직을 호출하여 그 결과를 보여줄 뷰를 선택한다.
  - 비지니스 로직은 서비스 객체가 담당하게 된다.
2. **서비스(Service)**:
  - 서비스는 실제 비즈니스 로직을 수행하는 역할을 한다.
  - 데이터의 조회, 수정, 삭제 등의 작업을 수행하기 위해 데이터 액세스 객체를 사용한다.
3. **데이터 액세스 객체(DAO)**:
  - 데이터베이스와의 통신을 담당하는 역할을 한다.
  - SQL 쿼리를 실행하여 데이터를 조회, 수정, 삭제하는 등의 작업을 수행하고 그 결과를 서비스에게 전달한다.
4. **데이터 전송 객체(DTO)**:
  - 계층간 데이터 교환을 위한 자바빈즈를 말한다.
  - 각 계층이나 시스템에서 사용되는 데이터를 캡슐화하여 전달하는 역할을 한다.
  - 주로 비즈니스 로직을 처리하는 서비스 계층과 사용자에게 결과를 보여주는 뷰 계층 사이에서 데이터를 전달하는 데 사용된다.
5. **뷰(View)**: 사용자에게 정보를 시각적으로 표시.
  - 사용자에게 정보를 시각적으로 표시하는 역할을 한다.
  - HTML, JSP 등을 사용하여 구현할 수 있으며, 컨트롤러는 처리 결과를 담은 모델과 함께 뷰를 선택하여 사용자에게 보여준다.

### 컨트롤러 구성하기

`CrawlingController`라는 컨트롤러 클래스를 정의한 것이다.
이 클래스는 웹 요청을 처리하고, 그에 따른 비즈니스 로직을 호출하며, 그 결과를 보여줄 뷰를 선택하는 역할을 수행한다.

```java
@Slf4j  
@Controller  
public class CrawlingController {  
  
    @Autowired  
    private CrawlingService service;  
  
    @GetMapping("/crawl")  
    public String crawl(Model model) {  
        service.crawlAndSaveGames(); // DB저장  
        List<Games> games = service.getGamesFromDb(); // DB SELECT  
  
        if (games == null || games.isEmpty()) {  
            log.error("games list is null or empty");  
            return "error";  
        }  
  
        model.addAttribute("games", games);  
        return "crawl";  
    }  
}
```
- `CrawlingController` 클래스를 통해 `/crawl` 경로로 GET 요청이 오면 `crawl` 메소드를 호출하도록 한다.
- 이 메소드는 먼저 `crawlAndSaveGames` 메소드를 호출하여 웹사이트에서 게임 정보를 크롤링하고 그 결과를 DB에 저장한다.
- 그 다음 `getGamesFromDb` 메소드를 호출하여 DB에서 게임 정보를 가져온다.
- 가져온 게임 정보가 없다면 에러 메시지를 로그에 기록하고 "error" 뷰를 반환, 게임 정보가 있다면 이를 모델에 추가하고 "crawl" 뷰를 반환한다.
- 이렇게 하면 "crawl" 뷰에서는 모델에 추가된 게임 정보를 사용하여 정보를 보여줄 수 있다.

### 서비스 구현하기

```java
@Slf4
@Service
public class CrawlingService {

  @Autowired
  private CrawlingDao dao;
}
```

- `CrawlingService` 클래스는 웹 크롤링과 관련된 비즈니스 로직을 수행하는 서비스 클래스이다.
- `@Slf4j` 어노테이션은 로그 메시지를 출력하는데 사용되며, `@Service` 어노테이션이 붙어 있어 스프링에서 서비스 클래스로 인식한다.
- `CrawlingDao`는 데이터베이스와의 통신을 담당하는 DAO 클래스로, `@Autowired` 어노테이션을 통해 자동 주입된다.
  
<br>

#### 드라이버 설정

```java
public void crawlAndSaveGames() {

  System.setProperty("webdriver.chrome.driver", "chromedriver-win64/chromedriver.exe");

  ChromeOptions options = new ChromeOptions();
  options.addArguments("--remote-allow-origins=*");
  options.addArguments("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537");
}
```

- `crawlAndSaveGames` 메소드는 웹 크롤링을 수행하고 그 결과를 데이터베이스에 저장하는 기능을 수행한다.
- `System.setProperty`는 크롬 드라이버의 위치를 설정하며, `ChromeOptions`는 크롬 드라이버의 동작을 설정한다.
- `addArguments` 메소드를 사용하여 크롬 드라이버의 원격 클라이언트 연결 허용 원본과 사용자 에이전트를 설정한다.
- `--remote-allow-origins=*`:
  - 이 설정은 원격 클라이언트가 ChromeDriver에게 연결하는 것을 허용하며, 특정 IP에서 발생하는 모든 요청을 수락하도록 설정된다.
  - 이 설정이 없다면 특정 IP에서의 요청이 차단될 수 있다. 하지만 보안상의 이유로 이 설정을 사용하는 것은 권장되지 않는다.
- `user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537`:
  - 이 설정은 크롬 드라이버의 사용자 에이전트를 설정한다.
  - 사용자 에이전트는 웹 브라우저의 종류와 버전, 운영 체제 등의 정보를 담고 있다.
  - 이 설정이 없다면, 웹 사이트는 크롬 드라이버를 봇으로 인식하고 접근을 차단할 수 있지만, 이 설정을 통해 일반적인 웹 브라우저로 인식되어 웹 사이트의 봇 차단을 우회할 수 있다.

**※ selenium은 사용하는 브라우저의 Driver를 다운받아야 한다. ※**
(https://chromedriver.chromium.org/downloads)

<br>

```java
WebDriver driver = new ChromeDriver(options);  

WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));  

String baseUrl = "https://store.steampowered.com/category/action_fps/?flavor=contenthub_all";  
driver.get(baseUrl);  

wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".salepreviewwidgets_SaleItemBrowserRow_y9MSd")));  
  
List<WebElement> gameElements = driver.findElements(By.cssSelector(".salepreviewwidgets_SaleItemBrowserRow_y9MSd"));  
  
for (WebElement gameElement : gameElements) {
```

- `WebDriver` 객체를 생성하여 크롬 브라우저를 제어하고, `WebDriverWait` 객체를 생성하여 웹 요청의 응답을 기다리는 최대 시간을 설정한다.
- `driver.get` 메소드를 사용하여 웹 페이지에 접속하고, `wait.until` 메소드로 웹 페이지의 특정 요소가 보일 때까지 기다린다.
- `driver.findElements` 메소드는 웹 페이지의 특정 요소들을 찾아 리스트로 반환한다.
  <br>

```java
String title = gameElement.findElement(By.cssSelector(".salepreviewwidgets_StoreSaleWidgetTitle_3jI46.StoreSaleWidgetTitle")).getText();
```

- `findElement` 메소드는 웹 요소 중에서 CSS 선택자에 해당하는 첫 번째 요소를 찾아 반환하며, `getText` 메소드는 해당 웹 요소의 텍스트를 가져온다.

<br>

```java
Games games = new Games();  
games.setTitle(title);  
games.setReleases(releases);  
games.setCart(cart);
```

- 게임 정보 객체를 생성하고 데이터를 담아준다.

<br>

```java 
if (dao.getGameByTitle(title) == null) {  
    dao.setGameList(games);  
    dao.setPriceList(price);  
    dao.setReviewList(review);  
}
```

- `dao.getGameByTitle` 메소드를 호출하여 동일한 제목의 게임이 데이터베이스에 있는지 확인하고, 없는 경우 게임 정보를 데이터베이스에 저장한다.

<br>

#### 이미지 다운로드 및 저장

해당 부분은 크게 세 단계로 이루어진다.
프로젝트 디렉토리 설정, 이미지 다운로드 및 저장, 그리고 DB에 이미지 정보 저장.

```java
File projectDir = new File(System.getProperty("user.dir"));  

File dir = new File(projectDir, "/src/main/webapp/resources/images");  
```

- 먼저, 프로젝트의 루트 디렉토리를 가져온다.
- 이를 기반으로 이미지를 저장할 디렉토리를 설정, 저장할 디렉토리가 존재하지 않다면 새로 생성한다.

<br>

```java
try {  
    URL imageUrl = new URL(img);  
    BufferedImage image = ImageIO.read(imageUrl);  
    String safeTitle = title;  
    if (title.contains(":")) {  
        safeTitle = title.replaceAll(":", "-");  
    }  
```

- 다음으로, 이미지를 다운로드한다.
- 이미지의 URL을 이용해 `BufferedImage` 객체를 생성한다.
- 이때, 이미지의 제목에서 콜론(`:`)이 포함되어 있다면 이를 대쉬(`-`)로 변환한다. 이는 파일 이름에 콜론이 포함되어 있으면 문제를 일으킬 수 있기 때문이다.

<br>

```java
    Images images = new Images();  
    images.setOriginName(safeTitle + ".jpg");  
    images.setTitle(title);  
  
    String imageName = DigestUtils.sha256Hex(title).substring(0, 20) + ".jpg";  
    images.setImageName(imageName);  
```

- 이미지 정보를 저장할 `Images` 객체를 생성하고, 이 객체에 원본 이름과 제목을 설정한다.
- 그리고 이미지의 제목을 SHA2 알고리즘으로 해싱하고, 그 결과의 첫 20자리와 '.jpg'를 연결한 문자열을 생성한다.
- 이 문자열은 이미지의 고유한 이름으로 사용한다.

<br>

```java
    File outputfile = new File(dir, images.getImageName());
    ImageIO.write(image, "jpg", outputfile);  
    System.out.println(safeTitle + " 이미지 저장 완료");  
```

- 이미지를 파일로 저장 한다.
- 파일 이름은 앞서 생성한 고유한 이름을 사용하며, 저장이 완료되면 이를 콘솔에 출력한다.

<br>

```java
    if (dao.getImageByName(imageName) == null) {  
        dao.setImage(images);  
    }  
} catch (IOException e) {  
    e.printStackTrace();  
}
```

- 마지막으로, 데이터베이스에 이미지 정보를 저장한다.
- 이미 같은 이름의 이미지가 데이터베이스에 존재하지 않는다면 `Images` 객체를 저장한다.

<br>

#### 게임 태그 정보 추출 및 저장

```java
List<WebElement> tagElements = gameElement.findElements(By.cssSelector(".salepreviewwidgets_StoreSaleWidgetTags_3OSJs a"));

List<String> tag = new ArrayList<>();
for (WebElement tagElement : tagElements) {
    tag.add(tagElement.getText());
}
```

- 먼저, 웹 페이지에서 태그 정보를 추출한다.
- CSS 선택자를 이용해 태그 정보가 있는 요소를 찾아내고, 이 요소의 텍스트를 가져와서 태그 리스트에 추가한다.

<br>

```java
for (String singleTag : tag) {  
    if (!singleTag.isEmpty()) {  
        Tags tags = new Tags();
        tags.setTag(singleTag);  
```

- 추출한 각 태그에 대해 반복문을 실행한다.
- 만약 태그가 비어있지 않다면, 새로운 `Tags` 객체를 생성하고, 이 객체에 태그를 설정한다.

<br>

```java
        Tags existingTag = dao.getTagByTag(singleTag);
        if (existingTag == null) {  
            dao.setTags(tags);  
            
            existingTag = dao.getTagByTag(singleTag);
        }
```

- 이어서, 데이터베이스에 이미 같은 태그가 존재하는지 확인한다.
- 만약 존재하지 않는다면, 새로운 태그를 데이터베이스에 추가한다.

<br>

```java
        if (existingTag != null) {  
            GameTags gameTag = new GameTags();  
            gameTag.setTitle(title); 
            gameTag.setTag(singleTag); 
```

- 태그가 데이터베이스에 정상적으로 추가되면, 새로운 `GameTags` 객체를 생성하고, 이 객체에 게임의 제목과 태그를 설정다.

<br>

```java
           
            GameTags existingGameTag = dao.getGameTagByTitleAndTag(title, singleTag);
            if (existingGameTag == null) {  
                dao.setGameTagList(gameTag); 
            }
        }
    }
}
```

- 마지막으로, 같은 게임 제목과 태그를 가진 데이터가 이미 데이터베이스에 존재하는지 확인한다.
- 만약 존재하지 않는다면, 새로운 게임 태그를 데이터베이스에 추가한다.

<br>

#### 게임 정보 가져오기

```java
public List<Game> getGamesFromDb() {
    List<Games> games = dao.getAllGames();  
	for (Games game : games) {  
	    List<String> tags = dao.getTagsByTitle(game.getTitle());  
	    game.setTag(tags);  
	}  
	return games;
}
```

- `getGamesFromDb` 메소드는 `dao.getAllGames`를 호출하여 데이터베이스에 저장된 모든 게임 데이터를 가져온다.
- 그리고 각 게임에 대해 해당 게임의 태그를 가져와서 게임 객체에 설정한다.

<br>

#### 첫 번째 웹 요소의 텍스트 가져오기

```java
private String getWebElementText(WebElement element, String cssSelector) {
    List<WebElement> elements = element.findElements(By.cssSelector(cssSelector));
    return elements.isEmpty() ? "" : elements.get(0).getText();
}
```

- `getWebElementText` 메소드는 주어진 웹 요소에 대해 CSS 선택자에 해당하는 웹 요소들을 찾고, 그 중 첫 번째 웹 요소의 텍스트를 가져와 반환한다.
- 해당하는 웹 요소가 없는 경우 빈 문자열을 반환한다.
  <br>

#### 전체 코드

```java
@Slf4j  
@Service  
public class CrawlingService {  
    @Autowired  
    private CrawlingDao dao;  
  
    public void crawlAndSaveGames() {  
        // 크롬 드라이버 경로 설정  
        System.setProperty("webdriver.chrome.driver", "chromedriver-win64/chromedriver.exe");  
        ChromeOptions options = new ChromeOptions();  
        options.addArguments("--remote-allow-origins=*");  
        options.addArguments("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537");  
  
        // 크롬 드라이버 인스턴스 생성  
        WebDriver driver = new ChromeDriver(options);  
  
        // 웹 드라이버 대기 시간 설정  
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));  
  
        // 크롤링할 사이트 주소  
        String baseUrl = "https://store.steampowered.com/category/action_fps/?flavor=contenthub_all";  
        driver.get(baseUrl);  
  
        // 페이지 로딩 대기  
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".salepreviewwidgets_SaleItemBrowserRow_y9MSd")));  
  
        // 게임 정보를 담을 WebElement List        List<WebElement> gameElements = driver.findElements(By.cssSelector(".salepreviewwidgets_SaleItemBrowserRow_y9MSd"));  
  
        for (WebElement gameElement : gameElements) {  
  
            // 각 게임 정보 추출  
            String title = gameElement.findElement(By.cssSelector(".salepreviewwidgets_StoreSaleWidgetTitle_3jI46.StoreSaleWidgetTitle")).getText();  
            String disc = getWebElementText(gameElement, ".salepreviewwidgets_StoreSaleDiscountBox_2fpFv");  
            String originPrice = getWebElementText(gameElement, ".salepreviewwidgets_StoreOriginalPrice_1EKGZ");  
            String discPrice = getWebElementText(gameElement, ".salepreviewwidgets_StoreSalePriceBox_Wh0L8");  
            String cart = gameElement.findElement(By.cssSelector(".addtocartbutton_Action_2ECxA.CartBtn")).getText();  
            String img = gameElement.findElement(By.cssSelector(".salepreviewwidgets_CapsuleImage_cODQh")).getAttribute("src");  
            String releases = gameElement.findElement(By.cssSelector(".salepreviewwidgets_WidgetReleaseDateAndPlatformCtn_2vdJg")).getText();  
            String oneLineReview = gameElement.findElement(By.cssSelector(".gamehover_ReviewScore_24NyY.ReviewScore.Focusable > div > div:nth-child(1)")).getText();  
            String reviewCount = gameElement.findElement(By.cssSelector(".gamehover_ReviewScore_24NyY.ReviewScore.Focusable > div > div:nth-child(2)")).getText();  
  
            // 게임 정보 객체 생성  
            Games games = new Games();  
            games.setTitle(title);  
            games.setReleases(releases);  
            games.setCart(cart);  
            // 가격 정보 객체 생성  
            Price price = new Price();  
            price.setTitle(title);  
            price.setDisc(disc);  
            price.setOriginPrice(originPrice);  
            price.setDiscPrice(discPrice);  
            // 리뷰 정보 객체 생성  
            Review review = new Review();  
            review.setTitle(title);  
            review.setOneLineReview(oneLineReview);  
            review.setReviewCount(reviewCount);  
  
            // 기존에 없는 게임 정보라면 DB에 저장  
            if (dao.getGameByTitle(title) == null) {  
                dao.setGameList(games);  
                dao.setPriceList(price);  
                dao.setReviewList(review);  
            }  
  
            // 프로젝트의 루트 디렉토리를 가져옵니다.  
            File projectDir = new File(System.getProperty("user.dir"));  
            // 이미지를 저장할 디렉토리를 설정합니다.  
            File dir = new File(projectDir, "/src/main/webapp/resources/images");  
  
            // 폴더가 없으면 생성  
            if (!dir.exists()) {  
                dir.mkdirs();  
            }  
  
            // 이미지 다운로드 및 저장  
            try {  
                URL imageUrl = new URL(img);  
                BufferedImage image = ImageIO.read(imageUrl);  
                String safeTitle = title;  
                if (title.contains(":")) {  
                    safeTitle = title.replaceAll(":", "-");  
                }  
  
                // 이미지 객체 생성  
                Images images = new Images();  
                images.setOriginName(safeTitle + ".jpg");  
                images.setTitle(title);  
  
                // title을 SHA2 알고리즘으로 해싱한 후, 그 결과의 첫 20자리와 '.jpg'를 연결한 문자열을 생성  
                String imageName = DigestUtils.sha256Hex(title).substring(0, 20) + ".jpg";  
                // 생성한 문자열로 Images 객체의 IMAGE_NAME 필드 설정  
                images.setImageName(imageName);  
  
                File outputfile = new File(dir, images.getImageName()); // 파일 이름을 게임 제목으로 설정  
                ImageIO.write(image, "jpg", outputfile);  
                System.out.println(safeTitle + " 이미지 저장 완료");  
  
                // 기존에 없는 이미지라면 DB에 저장  
                if (dao.getImageByName(imageName) == null) {  
                    dao.setImage(images);  
                }  
  
            } catch (IOException e) {  
                e.printStackTrace();  
            }  
  
            // 태그 정보 추출  
            List<WebElement> tagElements = gameElement.findElements(By.cssSelector(".salepreviewwidgets_StoreSaleWidgetTags_3OSJs a"));  
  
            // [FPS, PvP, eSports, Tactical, Multiplayer]  
            List<String> tag = new ArrayList<>();  
            for (WebElement tagElement : tagElements) {  
                tag.add(tagElement.getText());  
            }  
  
            for (String singleTag : tag) {  // tag 배열의 각 요소(singleTag)에 대해 반복 한다.  
                if (!singleTag.isEmpty()) {  // singleTag가 비어있지 않은 경우에만 아래의 처리를 실행.  
                    Tags tags = new Tags();  // 새로운 Tags 객체를 생성.  
                    tags.setTag(singleTag);  // 생성한 Tags 객체에 singleTag를 설정.  
  
                    // dao를 통해 singleTag와 일치하는 태그가 이미 데이터베이스에 존재하는지 확인.  
                    Tags existingTag = dao.getTagByTag(singleTag);  
                    if (existingTag == null) {  // 해당 태그가 존재하지 않는 경우,  
                        dao.setTags(tags);  // 새로운 태그를 데이터베이스에 추가.  
                        // 태그가 정상적으로 추가된 후, 다시 한번 해당 태그가 존재하는지 확인.  
                        existingTag = dao.getTagByTag(singleTag);  
                    }  
  
                    if (existingTag != null) {  // 해당 태그가 데이터베이스에 존재하는 경우,  
                        GameTags gameTag = new GameTags();  // 새로운 GameTags 객체를 생성.  
                        gameTag.setTitle(title);  // 게임의 제목을 설정.  
                        gameTag.setTag(singleTag);  // 게임의 태그를 설정.  
  
                        // dao를 통해 같은 게임 제목과 태그를 가진 데이터가 이미 데이터베이스에 존재하는지 확인.  
                        GameTags existingGameTag = dao.getGameTagByTitleAndTag(title, singleTag);  
                        if (existingGameTag == null) {  // 같은 데이터가 존재하지 않는 경우,  
                            dao.setGameTagList(gameTag);  // 새로운 게임 태그를 데이터베이스에 추가.  
                        }  
                    }  
                }  
            }  
        }  
        // 크롬 드라이버 종료  
        driver.quit();  
    }  
  
  
    // DB SELECT 메서드  
    public List<Games> getGamesFromDb() {  
        List<Games> games = dao.getAllGames();  
        for (Games game : games) {  
            List<String> tags = dao.getTagsByTitle(game.getTitle());  
            game.setTag(tags);  
        }  
        return games;  
    }  
  
    // 첫 번째 웹 요소의 텍스트를 가져와 반환한다.  
    // 해당하는 웹 요소가 없는 경우 빈 문자열을 반환한다.  
    private String getWebElementText(WebElement element, String cssSelector) {  
        List<WebElement> elements = element.findElements(By.cssSelector(cssSelector));  
        return elements.isEmpty() ? "" : elements.get(0).getText();  
    }  
}
```
<br>

### 웹 크롤링 및 DB 저장 구현하기

```java
public interface CrawlingDao {  
    int setGameList(Games game);  
    int setPriceList(Price price);  
    int setReviewList(Review review);  
    int setGameTagList(GameTags gameTags);  
    int setTags(Tags tags);  
    int setImage(Images images);  
  

    Tags getTagByTag(String singleTag);  
    
    Games getGameByTitle(String title);  
  
    Images getImageByName(String imageName);  
  
    List<String> getTagsByTitle(String title);  
    
    List<Games> getAllGames();  
  
    GameTags getGameTagByTitleAndTag(String title, String tag);  
  
}
```

- `setGameList`, `setPriceList`, `setReviewList`, `setGameTagList`, `setTags`, `setImage` 등의 메서드들은 각각 게임, 가격, 리뷰, 게임 태그, 태그, 이미지 정보를 데이터베이스에 저장한다.
- `getTagByTag`는 특정 태그에 해당하는 정보를 데이터베이스에서 조회하는 메서드이다.
- `getGameByTitle` 는 중복된 게임 정보를 검색하는 기능을 수행한다.
- 이미지명을 이용해 이미지 정보를 데이터베이스에서 조회하는`getImageByName`, 메서드와 게임 제목을 이용해 태그 목록을 데이터베이스에서 조회하는 `getTagsByTitle` 가 있다.
- 데이터베이스에 저장된 모든 게임 정보를 가져오는 `getAllGames` 메서드가 있다.
- 그리고, 게임 제목과 태그를 이용해 게임 태그 정보를 데이터베이스에서 조회하는 `getGameTagByTitleAndTag` 메서드이다.

<br>

### DAO 구현체

```java
@Repository  
public class CrawlingDaoImpl implements CrawlingDao{  
  
    @Autowired  
    private SqlSessionTemplate sql;  
  
    // DB INSERT  
    @Override  
    public int setGameList(Games game) {  
        return sql.insert("gameMapper.setGameList", game);  
    }  
    @Override  
    public int setPriceList(Price price) {  
        return sql.insert("gameMapper.setPriceList", price);  
    }  
    @Override  
    public int setReviewList(Review review) {  
        return sql.insert("gameMapper.setReviewList", review);  
    }  
    @Override  
    public int setGameTagList(GameTags gameTags) {  
        return sql.insert("gameMapper.setGameTagList", gameTags);  
    }  
    @Override  
    public int setTags(Tags tags) {  
        return sql.insert("gameMapper.setTags", tags);  
    }  
    @Override  
    public int setImage(Images images) {  
        return sql.insert("gameMapper.setImage", images);  
    }  
  
    @Override  
    public Tags getTagByTag(String singleTag) {  
        return sql.selectOne("gameMapper.getTagByTag", singleTag);  
    }  
  
    @Override  
    public Games getGameByTitle(String title) {  
        return sql.selectOne("gameMapper.getGameByTitle", title);  
    }  
  
    @Override  
    public Images getImageByName(String imageName) {  
        return sql.selectOne("gameMapper.getImageByName", imageName);  
    }  
  
    @Override  
    public List<String> getTagsByTitle(String title) {  
        return sql.selectList("gameMapper.getTagsByTitle", title);  
    }  
  
    @Override  
    public List<Games> getAllGames() {  
        return sql.selectList("gameMapper.getAllGames");  
    }  
  
    @Override  
    public GameTags getGameTagByTitleAndTag(String title, String tag) {  
        Map<String, Object> paramMap = new HashMap<>();  
        paramMap.put("title", title);  
        paramMap.put("tag", tag);  
        return sql.selectOne("gameMapper.getGameTagByTitleAndTag", paramMap);  
    }  
}
```

- `CrawlingDaoImpl` 클래스는 `CrawlingDao` 인터페이스의 메소드를 구현하고 있다.
- `@Autowired` 어노테이션을 이용해 `SqlSessionTemplate` 인스턴스를 주입받아 MyBatis를 통해 데이터베이스와의 통신을 수행할 수 있다.

<br>

### DTO

Lombok 라이브러리의 `@Getter`와 `@Setter` 어노테이션을 이용해 게터와 세터 메소드를 자동으로 생성해준다.
#### Games

```java
@Getter  
@Setter  
public class Games {  
    private String title; // 게임명  
    private String releases; // 출시일  
    private String cart; // 장바구니 추가  
    private String oneLineReview;  
    private String reviewCount;  
    private List<String> tag;  
    private String disc;  
    private String originPrice;  
    private String discPrice;  
    private String imageName;  
}
}
```
<br>

#### GameTags

```java
@Getter  
@Setter  
public class GameTags {  
    private String title;  // 게임명  
    private String tag;    // 태그  
}
```
<br>

#### Images

```java
@Getter  
@Setter  
public class Images {  
    private int imageId;  
    private String originName;  
    private String imageName;  
    private String title;  
}
```
<br>

#### Price

```java
@Getter  
@Setter  
public class Price {  
    private String title;  // 게임명  
    private String disc;   // 할인율  
    private String originPrice;  // 할인 전 가격  
    private String discPrice;    // 할인 후 가격  
}
```
<br>

#### Review

```java
@Getter  
@Setter  
public class Review {  
    private String title;  // 게임명  
    private String oneLineReview;  // 한 줄 평가  
    private String reviewCount;    // 리뷰 수  
}
```
<br>

#### Tags

```java
@Getter  
@Setter  
public class Tags {  
    private String tag;  // 태그  
}
```
<br>

### MyBatis 매퍼 구성

```xml
<?xml version="1.0" encoding="UTF-8"?>  
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">  
<mapper namespace="gameMapper">  
  
    <insert id="setGameList" parameterType="com.spring.web.dto.Games">  
        INSERT INTO GAMES(TITLE, RELEASES, CART)  
        VALUES (#{title}, #{releases}, #{cart})  
    </insert>  
  
    <insert id="setPriceList" parameterType="com.spring.web.dto.Price">  
        INSERT INTO PRICE(TITLE, DISC, ORIGIN_PRICE, DISC_PRICE)  
        VALUES (#{title}, #{disc}, #{originPrice}, #{discPrice})    
    </insert>  
  
    <insert id="setReviewList" parameterType="com.spring.web.dto.Review">  
        INSERT INTO REVIEW(TITLE, ONE_LINE_REVIEW, REVIEW_COUNT)  
        VALUES (#{title}, #{oneLineReview}, #{reviewCount})    
    </insert>  
  
    <insert id="setGameTagList" parameterType="com.spring.web.dto.GameTags">  
        INSERT INTO GAME_TAGS(TITLE, TAG)  
        VALUES (#{title}, #{tag})    
    </insert>  
  
    <insert id="setTags" parameterType="com.spring.web.dto.Tags">  
        INSERT INTO TAGS(TAG)  
        VALUES (#{tag})    
    </insert>  
  
    <insert id="setImage" parameterType="com.spring.web.dto.Images">  
        INSERT INTO IMAGES(TITLE, ORIGIN_NAME, IMAGE_NAME)  
        VALUES (#{title}, #{originName}, #{imageName})    
    </insert>  
  
    <select id="getTagByTag" parameterType="string" resultType="com.spring.web.dto.Tags">  
        SELECT * FROM TAGS       
        WHERE TAG = #{singleTag}    
    </select>  
  
    <select id="getGameByTitle" parameterType="string" resultType="com.spring.web.dto.Games">  
        SELECT * FROM GAMES        
        WHERE TITLE = #{title}    
    </select>  
  
    <select id="getImageByName" parameterType="string" resultType="com.spring.web.dto.Images">  
        SELECT * FROM IMAGES        
        WHERE IMAGE_NAME = #{imageName}   
    </select>  
  
    <select id="getAllGames" resultType="com.spring.web.dto.Games">  
        SELECT  
            GAMES.*,            
            PRICE.DISC, PRICE.ORIGIN_PRICE, PRICE.DISC_PRICE, 
            REVIEW.ONE_LINE_REVIEW, REVIEW.REVIEW_COUNT,
            IMAGES.ORIGIN_NAME, IMAGES.IMAGE_NAME        
        FROM GAMES            
	        INNER JOIN PRICE           
	        ON GAMES.TITLE = PRICE.TITLE            
	        INNER JOIN REVIEW            
	        ON GAMES.TITLE = REVIEW.TITLE            
	        INNER JOIN IMAGES            
	        ON GAMES.TITLE = IMAGES.TITLE    
	    </select>  
  
    <select id="getTagsByTitle" parameterType="string" resultType="string">  
        SELECT TAG FROM GAME_TAGS 
        WHERE TITLE = #{title}    
    </select>  
  
    <select id="getGameTagByTitleAndTag" parameterType="map" resultType="com.spring.web.dto.GameTags">  
        SELECT * FROM GAME_TAGS 
        WHERE TITLE = #{title} AND TAG = #{tag}  
    </select>  
</mapper>
```

- 위의 XML 파일은 `gameMapper`라는 네임스페이스로 매핑 정보를 정의하고 있다.
- `setGameList`는 `Games` 객체를 받아 데이터베이스의 `GAMES` 테이블에 새로운 게임 정보를 삽입하는 쿼리문을 정의한다.
- `setPriceList`는 `Price` 객체를 받아 `PRICE` 테이블에 새로운 가격 정보를 삽입하는 쿼리문을 정의한다.
- `setReviewList`는 `Review` 객체를 받아 `REVIEW` 테이블에 새로운 리뷰 정보를 삽입하는 쿼리문을 정의한다.
- `setGameTagList`는 `GameTags` 객체를 받아 `GAME_TAGS` 테이블에 새로운 게임 태그 정보를 삽입하는 쿼리문을 정의한다.
- `setTags`는 `Tags` 객체를 받아 `TAGS` 테이블에 새로운 태그 정보를 삽입하는 쿼리문을 정의한다.
- `setImage`는 `Images` 객체를 받아 `IMAGES` 테이블에 새로운 이미지 정보를 삽입하는 쿼리문을 정의한다.
- `getTagByTag`는 태그를 파라미터로 받아 `TAGS` 테이블에서 해당하는 태그 정보를 검색하는 쿼리문을 정의한다.
- `getGameByTitle`은 게임 제목을 파라미터로 받아 `GAMES` 테이블에서 해당하는 게임 정보를 검색하는 쿼리문을 정의하고 있다. 이 메서드는 중복된 게임 정보를 검색하는 기능을 수행한다.
- `getImageByName`은 이미지 이름을 파라미터로 받아 `IMAGES` 테이블에서 해당하는 이미지 정보를 검색하는 쿼리문을 정의한다.
- `getAllGames`는 `GAMES`, `PRICE`, `REVIEW`, `IMAGES` 테이블에서 모든 게임 정보를 가져오는 쿼리문을 정의한다.
- `getTagsByTitle`은 게임 제목을 파라미터로 받아 `GAME_TAGS` 테이블에서 해당하는 게임의 태그 정보를 검색하는 쿼리문을 정의한다.
- 마지막으로, `getGameTagByTitleAndTag`는 게임 제목과 태그를 파라미터로 받아 `GAME_TAGS` 테이블에서 해당하는 게임 태그 정보를 검색하는 쿼리문을 정의한다.

<br>

### View

```jsp
<!DOCTYPE html>  
<html>  
<head>  
    <title>Games</title>  
    <link rel="stylesheet" href="../../resources/css/common.css">  
</head>  
<body>  
<h1 style="color: white; text-align: center; padding: 20px 0;">Games</h1>  
<div class="facetedbrowse_FacetedBrowseItems_NO-IP">  
    <c:forEach var="game" items="${games}">  
        <div class="game-item">  
            <img src="/resources/images/${game.imageName}" alt="Game Image">  
            <div class="game-item-info">  
                <h2>${game.title}</h2>  
                <div class="tags">  
                    <c:forEach var="tag" items="${game.tag}">  
                        <p>${tag}</p>  
                    </c:forEach>  
                </div>  
                <p>${game.releases}</p>  
  
                <div class="reviews">  
                    <p>${game.oneLineReview}</p>  
                    <p>${game.reviewCount}</p>  
                </div>  
  
            </div>  
            <div class="price-info">  
                <div class="discount">  
                    <p>${game.disc}</p>  
                </div>  
                <div class="prices">  
                    <p class="origin-price">${game.originPrice}</p>  
                    <p class="Price">${game.discPrice}</p>  
                </div>  
                <button>${game.cart}</button>  
            </div>  
        </div>  
    </c:forEach>  
</div>  
</body>  
</html>
```

- 위의 코드는 JSP 페이지로, 서버에서 전달받은 게임 정보를 화면에 표시해준다.
- 게임 정보는 각 게임의 이미지, 제목, 태그, 출시일, 평가, 가격 등을 사용자에게 보여준다.

css파일은 별도로 경로 지정해 주었다.

<br>

### 결과

#### DB INSERT

`localhost:8080/crawl` 로 접속하면 스팀 사이트에 있는 게임정보들이 잘 들어가는 것을 볼 수 있다.
![](/assets/img/posts/project/steam-crawling-project/steam-crawling-insert.png)

<br>

#### DB SELECT

그리고 DB INSERT 한 데이터들이 local화면에 다시 출력되는 것 까지 확인 해 보았다.
![](/assets/img/posts/project/steam-crawling-project/steam-crawling-view.png)

<br>

---

이상으로, 웹 크롤링 및 데이터베이스 저장을 구현하는 방법에 대해 알아보았다.
이를 통해 웹 사이트의 정보를 자동으로 수집하고, 이를 데이터베이스에 저장하는 등의 작업을 할 수 있다.
