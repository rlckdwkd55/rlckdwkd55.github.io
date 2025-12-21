---
title: "BufferedReader와 BufferedWriter란?"
date: 2024-10-14 15:40:00 +0900
categories: [Java]
tags: [basics, java, io]
description: "BufferedReader와 BufferedWriter의 개념, 사용법, 공통점과 주의사항"
image:
  path: /assets/img/thumbnails/java.png
---

BufferedReader와 BufferedWriter는 모두 java.io 패키지의 클래스들로,
입출력(I/O) 작업을 보다 효율적으로 수행하기 위해 버퍼를 사용하는 것이다.

## BufferedReader

### 정의

- java.io 패키지에 속해 있으며, 파일을 읽거나 콘솔 입력을 받는 데 주로 사용된다.
- 대량의 데이터를 처리하는 경우, Scanner에 비해 빠른 성능을 보인다.
- 하지만 문자열(String)만 처리할 수 있으며, 다른 자료형을 처리하려면 추가적인 변환 작업이 필요하다.
  
<br>

### 예제

\[코드]
```java
import java.io.BufferedReader;  
import java.io.IOException;  
import java.io.InputStreamReader;  
  
public class Main {  
    public static void main(String[] args) throws IOException {  
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));  
        System.out.print("문자열을 입력하세요: ");  
        String input = reader.readLine();  
        System.out.println("입력하신 문자열은: " + input);  
        reader.close();  
    }  
}
```

\[결과]
```console
문자열을 입력하세요: HelloWorld
입력하신 문자열은: HelloWorld
```

<br>

---

## BufferedWriter

### 정의

- java.io 패키지에 속해 있으며, 텍스트 파일을 작성하거나 콘솔에 출력하는 데 주로 사용된다.
- 대량의 데이터를 처리하는 경우 빠른 성능을 보인다.
- 반드시 flush()나 close() 메서드를 호출하여 버퍼에 남아 있는 데이터를 모두 출력해야 한다.
  
<br>

### 예제

\[코드]
```java
import java.io.BufferedWriter;  
import java.io.IOException;  
import java.io.OutputStreamWriter;  
  
public class Main {  
    public static void main(String[] args) throws IOException {  
        BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(System.out));  
        String output = "HelloWorld.";  
        writer.write(output);  
        writer.flush();  
        writer.close();  
    }  
}
```

\[결과]
```console
HelloWorld.
```

<br>

---

## 공통점

1. 버퍼의 사용:
  - 두 클래스 모두 내부적으로 버퍼를 사용하여 데이터를 임시로 저장한 후에 한 번에 입출력을 수행한다.
  - 대량의 데이터를 처리할 때 효율적인 성능을 낼 수 있다.

2. 문자열 처리:
  - 모두 문자열 데이터를 처리하는 데 사용한다.
  - BufferedReader는 문자열 데이터를 읽어 들이는 데 사용하며
  - BufferedWriter는 문자열 데이터를 출력하는 데 사용한다.

3. 스트림 연결:
  - BufferedReader와 BufferedWriter는 각각 InputStream과 OutputStream에 연결되어 동작한다.
  - 이를 통해 파일, 네트워크, 키보드 입력 등 다양한 데이터 소스로부터 데이터를 읽거나 쓸 수 있다.

4. 자원 해제:
  - 사용이 끝난 후에 close() 메서드를 호출하여 사용한 시스템 자원을 반드시 해제해야 한다.
  - 메모리 누수를 방지하기 위해 필요한 작업이다.
    <br>

## 주의할 점

- Java에서 입출력(I/O) 작업을 수행하는 대부분의 메서드들은 IOException을 발생시킬 수 있다.
- 프로그램이 갑작스럽게 종료되는 것을 방지하기 위해, IOException을 처리하는 코드를 작성해야 한다.
- checked exception에 속하므로, 메서드를 호출할 때는 반드시 try-catch 문을 사용하거나, throws 키워드를 이용하여 해당 예외를 호출한 곳으로 던져야 한다.
