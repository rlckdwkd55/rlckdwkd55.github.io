---
title: "상속(Inheritance)"
date: 2024-01-17 10:00:00 +0900
categories: [Java]
description: "Java 상속의 개념과 특징, 클래스·인터페이스 상속의 차이를 정리합니다."
---

# 상속이란?

> 정의

객체지향언어의 특징 중 하나이며, 기존의 클래스에 추가하거나 재정의하여 새로운 클래스를 정의하는 것을 의미한다.
부모의 것을 자식에게 물려주는 것처럼 Java에는 부모 클래스(상위 클래스)와 자식 클래스(하위 클래스)가 있다.
자식 클래스는 부모 클래스를 선택해 멤버를 상속받아 그대로 쓸 수 있게 된다.

- 기존 클래스의 변수와 메서드를 물려받아 새로운 클래스를 구성하는 것.
- 캡슐화, 추상화, 다형성 등 객체지향프로그래밍을 구성하는 특징 중 하나이다.
- 부모와 자식으로 생각하면, 자식은 어머니와 아버지의 능력들을 물려받듯이 하위 클래스는 상위 클래스의 모든 멤버를 상속받게 된다.

Java에서 상속은 단일상속만을 허용한다.
상위 클래스는 하위 클래스를 여러 개 가질 수 있지만, 그 반대는 불가능하다는 것이다.


> 주의할 점

Java에서 **제어자(Modifier)** 가 있다.

##### 접근제어자
- public : 접근 제한 없음
- protected: 동일한 패키지 내에 존재하거나 파생 클래스에서만 접근 가능
- default : 아무런 접근 제한자를 명시하지 않으면 default 값이 되며, 동일한 패키지 내에서만 접근 가능
- private: 자기 자신의 클래스 내에서만 접근 가능

##### 그 외 제어자
- static : 해당 제어자가 붙은 변수와 메서드 등은 인스턴스를 생성하지 않고도 사용할 수 있다.
- final : 상수를 구현하기 위해 final을 사용한다. 해당 변수는 재할당을 할 수 없으며 값이 변하면 안 되는 경우, 가독성을 높이고 유지보수를 쉽게 하고자 하는 경우에 사용한다.
- abstract : 컴파일러에게 추상 클래스와 추상 메서드임을 알려주게 된다.
  ...

하나의 대상에 여러 개의 제어자를 조합해서 사용할 수 있지만, 접근제어자는 단 하나만 사용할 수 있다.
그리고 접근제어자를 이용해 **캡슐화**를 할 수 있다.

접근제어자를 활용하여 패키지나 클래스별로 접근할 수 있는 범위를 지정해 줄 수 있는데 그로 인해 상속에 대해 알아야 할 부분이 있다.

1. 상위 클래스가 private로 선언돼 있다면 하위 클래스는 필드 및 메서드를 물려받을 수 없다.
2. 서로 다른 패키지에 있을 때 상위 클래스가 default로 선언돼 있다면 하위클래스는 필드 및 메서드를 물려받을 수 없다.

이 외의 경우는 모두 상속의 대상이 된다.
그리고 접근제어자를 사용함으로 인해 **캡슐화** 의 이점을 가질 수 있게 된다.


> 캡슐화

가장 핵심이자 장점은 외부에서 쉽게 접근하지 못하도록 은닉하는 것이다.
직접적인 접근을 막고 외부에서 내부의 정보에 직접 접근하거나 변경할 수 없고, 객체가 제공하는 필드와 메서드를 통해서만 접근이 가능하다.

- 자바 언어는 캡슐화된 멤버를 노출시킬 것인지 숨길 것인지를 결정하기 위해 접근 제한자(Access Modifier)를 사용한다.
- 객체의 필드(속성), 메서드를 하나로 묶고, 실제 구현 내용을 외부에 감추는 것을 말한다.
- 외부 객체는 객체 내부의 구조를 얻지 못하며 객체가 노출해서 제공하는 필드와 메서드만 이용할 수 있다.
- 필드와 메서드를 캡슐화하여 보호하는 이유는 외부의 잘못된 사용으로 인해 객체가 손상되지 않도록 하는 데 있다.
  <br>

---

# 상속의 장점

상속을 쓰는 이유가 여기에서 나온다.

- 재사용이 가능하기에 중복코드가 줄어들어 코드가 간결해진다.
- 확장성이 용이하다.(공통적인 기능을 상속받아 여러 자식 클래스에서 사용가능)

즉, 유지보수가 쉬워지고 확장성이 용이해지며 재사용이 가능해지고 코드가 간결해지기 때문에 시간을 단축할 수 있다.
<br>

---

# 사용법

>클래스 상속

- 자식 클래스 이름 앞에 **extends** 키워드를 붙이고 상속할 부모 클래스 이름을 적는다.
- 자바는 다중 상속을 허용하지 않는다 하지만 여러 자식 클래스에서 상속이 가능하다.
- extends 키워드 뒤에는 하나의 부모 클래스만 와야 한다.
- 클래스 상속은 고양이는 동물"이다" 처럼 is-a 관계를 나타낸다.

**예제**

\[부모 클래스]
``` java
public class Animal {  
  
    String name; // 이름  
    int age; // 나이  
  
    public void information() {  
        System.out.println(name + " 은(는) " + age + "살 입니다.");  
  
    }  
}
```

\[자식 클래스]
```java
public class Cat extends Animal {  
  
    // Cat 클래스가 Animal을 상속받아 사용
    public Cat(String name, int age) {  
        this.name = name;  
        this.age = age;  
    }  
}
```

\[Main]
```java
public class Main {  
    public static void main(String[] args) {  
  
        Cat cat = new Cat("김애옹", 2);  
  
        cat.information();  
    }  
}
```

\[출력결과]
```console
김애옹 은(는) 2살 입니다.

종료 코드 0(으)로 완료된 프로세스
```
<br>

---

>인터페이스 상속

- 인터페이스는 **implements** 키워드를 통해 상속받을 수 있다.
- 클래스 상속과는 다르게 인터페이스 상속은 다중 상속이 가능하다.
- 따라서, 클래스와 다르게 implements 뒤에 여러 개의 인터페이스가 올 수 있다.
- 인터페이스를 상속받은 자식 클래스는 상속받은 인터페이스의 메서드를 반드시 오버라이딩(재정의) 해야 한다.
- 인터페이스 상속은 Has a 즉, 자동차는 바퀴를 "가지고 있다" 처럼 말이 이어져야한다.

**예제**

\[인터페이스 1]
```java
public interface Employee {  
  
    public void printEmp();  
}
```

\[인터페이스 2]
```java
public interface Information {  
  
    public void printInformation();  
}
```

\[인터페이스를 상속받은 클래스]
```java
public class Company implements Employee, Information {  
  
    String emp;  
    int empAge;  
    String rank;  
    String team;  
  
    public Company(String emp, int empAge, String rank, String team){  
        this.emp = emp;  
        this.empAge = empAge;  
        this.rank = rank;  
        this.team = team;  
    }  
  
    @Override  
    public void printEmp() {  
        System.out.println(emp + "사원은 " + empAge + " 세 입니다.");  
    }  
  
    @Override  
    public void printInformation() {  
        System.out.println(emp + " 사원은 " + team + rank + " 입니다.");  
  
    }  
}
```

\[Main]
```java
public class Main {  
    public static void main(String[] args) {  
  
        Company emp1 = new Company("홍길동", 37, "부장", "개발팀");  
        Company emp2 = new Company("김유신", 25, "사원", "개발팀");  
  
        emp1.printEmp();  
        emp1.printInformation();  
        System.out.println("---------------------");  
        emp2.printEmp();  
        emp2.printInformation();  
    }  
}
```

\[출력결과]
```console
홍길동사원은 37 세 입니다.
홍길동 사원은 개발팀부장 입니다.
---------------------
김유신사원은 25 세 입니다.
김유신 사원은 개발팀사원 입니다.

종료 코드 0(으)로 완료된 프로세스
```

<br>

---

# 정리

- 유지보수가 쉬워짐
- 확장성이 용이해짐
- 재사용이 가능해짐
- 코드가 간결해짐
- 개발 시간을 단축할 수 있음
- 이러한 이유에서 상속을 사용한다.

그리고 상속에서 클래스 상속과 인터페이스 상속이 있다.

- 클래스 상속은 extends 키워드
- 인터페이스 상속은 implements 키워드
- 클래스 상속은 다중 상속이 안 됨
- 인터페이스 상속은 다중 상속이 가능
- 인터페이스 상속은 설계 목적으로 구현이 가능
- 인터페이스를 상속받은 클래스는 인터페이스의 메서드를 오버라이딩을 통해 재정의

클래스 상속은 **클래스를 확장하는 것**이고 인터페이스 상속은 **인터페이스를 구현하는 것**이다.



<br><br><br><br><br><br>
참고 : [https://jaynamm.tistory.com/entry/JAVA-상속Inheritance-기본-개념-정리](https://jaynamm.tistory.com/entry/JAVA-%EC%83%81%EC%86%8DInheritance-%EA%B8%B0%EB%B3%B8-%EA%B0%9C%EB%85%90-%EC%A0%95%EB%A6%AC) [제이로그:티스토리]
