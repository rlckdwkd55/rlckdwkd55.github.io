---
title: "예외 처리(Exception Handling)"
date: 2024-02-05 11:25:00 +0900
categories: [Java]
tags: [basics, exception, try-catch, throw, throws]
description: "Java에서 예외와 오류의 차이, 예외 처리 방법과 주요 예외 유형을 예제와 함께 정리합니다."
image:
  path: /assets/img/thumbnails/java.png
---

# 예외 처리란?

>정의

프로그램을 실행하다 보면 어떤 원인 때문에 프로그램이 종료되는 현상이 생길 수 있다.
예외는 오류 없는 애플리케이션을 만들기 위해서 꼭 필요한 기능이다.

- 에러(Error) :  프로그램이 코드로 복구될 수 없는 오류
- 예외(Exception) : 프로그래머가 직접 예측하여 막을 수 있는 처리가능한 오류
  - 체크 예외 : 는 복구 가능성이 있는 예외이므로 반드시 예외를 처리하는 코드를 함께 작성.
  - 언체크 예외 : 복구 가능성이 없는 예외들이므로 컴파일러가 예외처리를 강제하지 않는다.

try, catch, finally라는 키워드로 예외처리를 하거나 throws 할 수 있는데,
중요한 점은 모든 예외는 아래 사진과 같이 Exception클래스를 상속받는다라는 것이다.

![](/assets/img/posts/java/exception-hierarchy.png)


<br>

---

# 예외 처리

### Try

해당 블록에는 예외가 발생할만한 코드가 작성된다.

### Catch

만약 예외가 발생한다면 어떤 동작을 처리하는지 명시한다.
여러 블록이 올 수 있으며 Catch와 같이 사용되는 ()에 발생할 예외를 작성해 준다.

### Final

예외와 상관없이 try 내의 구문이 실행되면 무조건 수행된다.
즉, 예외와는 상관없이 반드시 끝내줘야 하는 작업을 해야 할 때 Final을 사용한다.

### throw

throw는 의도적으로 예외를 발생시키는 명령이다.
비지니스 로직이 의도한 대로 통과하지 못했을 경우 try ~ catch를 유도하기 위함이다.

### throws

예외처리를 호출한 상위 메서드가 처리한다.
예외가 발생했다면 이에 대한 처리를 생성자의 사용자에게 위임하겠다는 의미이다.
<br>
\[예제]
```java
try{
	// 예외가 발생될만한 코드
} catch(FileNotFoundException e) {
	// FileNotFoundException이 발생했다면
} catch(IOException e){
	// IOException 이 발생했다면
} catch(Exception e){
	// Exception이 발생했다면
} finally{
	// 예외에 상관없이 무조건 실행
	// 또한 printStackTrace() 라는 메드로 어느 부분에서 예외가 발생했는지 추적로그를 볼 수 있다.
}
```

<br>

---

# 주요 메서드

|**메서드**|**설명**|
|---|---|
|**getMessage();**|오류에 대한 기본적인 내용을 출력해준다. 상세하지 않다.|
|**toString();**|toString()은 getMessage()보다 더 자세한 예외 정보를 제공한다.|
|**printStackTrace();**|메소드 getMessage, toString과는 다르게 printStackTrace는 리턴값이 없다. 이 메소드를 호출하면 메소드가 내부적으로 예외 결과를 화면에 출력한다. printStackTrace는 가장 자세한 예외 정보를 제공한다.|

<br>

# 주요 예외

|예외|사용해야 할 상황|
|---|---|
|IllegalArgumentException|매개변수가 의도하지 않은 상황을 유발시킬 때|
|IllegalStateException|메소드를 호출하기 위한 상태가 아닐 때|
|NullPointerException|매개 변수 값이 null 일 때|
|IndexOutOfBoundsException|인덱스 매개 변수 값이 범위를 벗어날 때|
|ArithmeticException|산술적인 연산에 오류가 있을 때|

<br>

---

# 예제

\[코드]
```java
public class ExceptionExample {  
    public static void main(String[] args) {  
  
        try {  
            divideNumbers(10, 0);  
        } catch (ArithmeticException e) {  
            System.out.println("getMessage() : " + e.getMessage());  
            System.out.println("toString() : " + e.toString());  
            e.printStackTrace();  
        } finally {  
            System.out.println("예외 처리가 완료되었습니다.");  
        }  
    }  
  
    public static void divideNumbers(int num1, int num2) {  
        if (num2 == 0) {  
            throw new ArithmeticException("0으로 나눌 수 없습니다.");  
        }  
        int result = num1 / num2;  
        System.out.println("나눗셈 결과: " + result);  
    }  
}

```

\[결과]
```console
getMessage() : 0으로 나눌 수 없습니다.
toString() : java.lang.ArithmeticException: 0으로 나눌 수 없습니다.
예외 처리가 완료되었습니다.
java.lang.ArithmeticException: 0으로 나눌 수 없습니다.
	at week2.exceptionTest.ExceptionExample.divideNumbers(ExceptionExample.java:21)
	at week2.exceptionTest.ExceptionExample.main(ExceptionExample.java:9)

종료 코드 0(으)로 완료된 프로세스
```

<br>
`divideNumbers` 메서드에서 0으로 나누려고 할 때 `ArithmeticException`을 발생시키는 예외 처리를 포함하고 있다.
`try` 블록에서 예외가 발생하면 `catch` 블록에서 해당 예외를 잡아서 처리하고, `finally` 블록은 예외 발생 여부와 상관없이 항상 실행된다.

- getMessage() : 메서드는 예외 메시지를 반환
- toString() : 메서드는 예외 정보를 문자열로 반환.
- printStackTrace() : 메서드는 예외의 발생 경로를 출력.

예제 코드를 실행하면 0으로 나눌 수 없는 상황에서 `ArithmeticException`이 발생하고, 예외 메시지와 예외 정보가 출력된다.
그리고 `finally` 블록이 실행되어 "예외 처리가 완료되었습니다."라는 메시지가 출력된다.

<br><br><br><br><br><br><br><br><br><br>

참고 : https://reakwon.tistory.com/155
참고 : https://opentutorials.org/course/1223/6226
