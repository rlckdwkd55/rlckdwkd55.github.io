---
title: "다형성(Polymorphism)"
date: 2024-01-27 21:40:00 +0900
categories: [Java]
tags: [basics, polymorphism, oop, overriding, overloading]
description: "객체 지향 프로그래밍에서 다형성의 개념과 오버로딩, 오버라이딩, 함수형 인터페이스를 통해 구현하는 방법을 정리합니다."
image:
  path: /assets/img/thumbnails/java.png
---

객체 지향에서 “캡슐화”, “추상화”, “다형성”, “상속”.
한번쯤은 들어보았을 내용이다.

객체 지향에서 의미하는 다형성의 의미는 무엇인지 알아보자.

# 다형성이란?

>정의

하나의 객체가 여러 가지 형태를 가질 수 있는 것을 의미한다.
다형성을 활용하면, 부모 클래스가 자식 클래스의 동작 방식을 알 수 없어도 오버라이딩을 통해 자식 클래스에 접근할 수 있다.

> 조건

- 상위 클래스와 하위 클래스는 상속 관계여야 한다.
- 오버라이딩이 반드시 필요하다.
- 자식 클래스의 객체가 부모 클래스의 타입으로 형변환(업캐스팅) 해야 한다.
  <br>

---

# 장단점

>장점

- 유지보수 : 여러 객체를 하나의 타입으로 관리할 수 있어 유지보수가 용이하다.
- 재사용성 : 객체의 재사용이 쉬워 재사용성이 높아진다.
- 느슨한 결합 : 클래스 간의 의존성을 줄여 확장성은 높아지고 의존성은 낮아진다.


>단점

- 프로그램의 가독성이 낮아진다.
- 개발자의 능력에 따라 코드의 품질차이가 크다.
- 디버깅이 어렵다.
  <br>

---

# 구현법

### 오버로딩(Overloading)

> 정의

같은 이름의 메서드 여러 개를 가지면서 매개변수의 유형과 개수가 다르도록 하는 기술

>예제

\[코드]
```java
public class Calculator {  
  
    public int add(int a, int b) {  
        return a + b;  
    }  
  
    public double add(double a, double b) {  
        return a + b;  
    }  
  
    public int add(int a, int b, int c) {  
        return a + b + c;  
    }  
  
  
    public static void main(String[] args) {  
        Calculator calculator = new Calculator();  
  
        int sum1 = calculator.add(5, 10);   
        double sum2 = calculator.add(2.5, 3.7);   
        int sum3 = calculator.add(1, 2, 3);   
  
        System.out.println("sum1: " + sum1); // 15
        System.out.println("sum2: " + sum2); // 6.2 
        System.out.println("sum3: " + sum3); // 6 
    }  
}
```

\[결과]
```console
sum1: 15
sum2: 6.2
sum3: 6
```

Calculator 클래스는 add라는 메서드 하나만 사용하고 있지만 매개변수의 타입과 개수가 다르기 때문에 컴파일러는 호출하는 메서드를 구별할 수 있다.
이를 통해 다양한 타입의 매개변수를 전달하여 다양한 연산을 수행할 수 있다
오버로딩을 통해 메서드의 이름을 일관성 있게 유지하며 다양한 상황에 대응할 수 있으며, 이 또한 다형성의 예시 중 하나이다.
<br>

---

### 오버라이딩(Overriding)

> 정의

상위 클래스가 가지고 있는 메서드를 하위 클래스가 재정의 해서 사용

>예제

\[코드]
```java
public class Animal {  
    public static void main(String[] args) {  
  
        Animal a1 = new Animal();  
        Animal a2 = new Tiger();  
        Animal a3 = new Rabbit();  
  
        a1.printX();  
        a2.printX();  
        a3.printX();    
    }  
  
    public void printX(){  
        System.out.println("printX - Animal");  
    }  
  
    private static class Tiger extends Animal {  
  
        @Override  
        public void printX() {  
            System.out.println("printX - Tiger");  
        }  
    }  
  
    private static class Rabbit extends Animal {  
    }
}
```

\[결과]
```console
printX - Animal
printX - Tiger
printX - Animal
```

메서드의 이름이 동일하지만 하위 클래스에서 구현내용을 재정의 하여 사용한 경우이다.
모두 Animal이라는 클래스 타입을 가지고 있지만 각각 다른 클래스의 생성자를 호출하고 있다.

위 코드가 다형성이 맞는지 확인해 보기 위해 추가적인 코드를 작성해 봤다

\[코드]
```java
public class Animal {  
    public static void main(String[] args) {  
  
        Animal a1 = new Animal();  
        Animal a2 = new Tiger();  
        Animal a3 = new Rabbit();  
  
        a1.printX();  
        a2.printX();  
        a3.printX();  
  
        Animal[] arr = {a1, a2, a3};  
  
        for (Animal item : arr){  
            System.out.println("----------------");  
            if (item instanceof Animal){  
                System.out.println("Type Is Animal");  
            }  
            if (item instanceof Tiger){  
                System.out.println("Type Is Tiger");  
            }  
            if (item instanceof Rabbit){  
                System.out.println("Type Is Rabbit");  
            }  
        }  
  
    }  
  
    public void printX(){  
        System.out.println("printX - Animal");  
    }  
  
    private static class Tiger extends Animal {  
  
        @Override  
        public void printX() {  
            System.out.println("printX - Tiger");  
        }  
    }  
  
    private static class Rabbit extends Animal {  
    }
}
```

\[결과]
```console
----------------
Type Is Animal
----------------
Type Is Animal
Type Is Tiger
----------------
Type Is Animal
Type Is Rabbit
```

코드 중앙부에 배열을 담아 ==instanceOf== 를 사용하여 비교하는 반복문을 작성했고
결과로 받은 값에는 부모 클래스를 제외한 자식 클래스는 두 가지 클래스 타입을 가진 것을 확인할 수 있었다.
<br>

--- 

### 함수형 인터페이스(Funtional Interface)

> 정의

추상 메서드가 1개만 정의된 인터페이스를 의미한다.
Java의 람다 표현식은 함수형 인터페이스로만 사용 가능하다.

>예제

\[코드]
```java
public interface Calculator {  
    int calculate(int a, int b);  
}
```

``` java
public class Main {  
    public static void main(String[] args) {  
        Calculator add = (a, b) -> a + b;  
        Calculator sub = (a, b) -> a - b;  
        Calculator times = (a, b) -> a * b;  
  
        int result1 = go(6, 3, add);  
        int result2 = go(3, 4, sub);  
        int result3 = go(7, 2, times);  
  
        System.out.println("result1: " + result1); // 9  
        System.out.println("result2: " + result2); // -1  
        System.out.println("result3: " + result3); // 14  
    }  
  
    public static int go(int a, int b, Calculator calculator) {  
        return calculator.calculate(a, b);  
    }  
}
```

\[결과]
```console
result1: 9
result2: -1
result3: 14
```

Java에서 함수형 인터페이스는 단 하나의 추상 메서드를 가지는 인터페이스를 의미한다.
이 때, 인터페이스에는 abstract 키워드를 명시하지 않아도 자동으로 추상 메서드로 간주한다.

Java 8부터는 람다식을 이용하여 함수형 인터페이스를 구현할 수 있게 되었으며, 람다식을 통해 추상 메서드의 구현을 간결하게 표현할 수 있게 되었고 이를 활용하여 인터페이스의 메서드를 통해 다형성을 구현할 수 있다.



<br><br><br><br><br><br><br><br>
참고 : https://haileyjpark.tistory.com/m/16

