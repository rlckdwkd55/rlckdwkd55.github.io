---
title: "슈도코드(Pseudo Code)"
date: 2024-02-14 22:10:00 +0900
categories: [Web]
tags: [basics, pseudocode, 사고과정, 설계]
description: "슈도코드의 개념과 필요성"
image:
  path: /assets/img/thumbnails/pseudo-code.png
---

# 슈도코드란?
>정의

Pseudo Code 수도 코드란 의사(가짜) 코드라는 의미를 가진,  
프로그램이나 알고리즘이 수행해야 할 내용을 **언어**로 간략하게 서술한 것을 말한다.  
여기서 **언어**란 자바스크립트나 파이썬 같은 프로그래밍 언어가 아니고,  
**실제 세계에서 사용하는 사람의 언어**를 말한다.
<br>

---

# 슈도코드를 쓰는 이유

- 실제 코딩하기 전 사고를 더 명확하게 할 수 있다.
- 코드의 검토와 수정이 더 용이하다.
- 프로그램 또는 알고리즘이 어떻게 실행되어야 하는지 쉽게 파악할 수 있다.
- 미리 오류를 수정할 수 있기 때문에 경제적이다.
- **문제 해결을 위한 도구로,  다른 사람과 프로그램의 흐름에 대해 소통하기 쉽게 도와준다**
  <br>

---

# 실제 슈도코드에서 많이 쓰이는 키워드

- 입력 Input : READ, OBTAIN, GET
- 출력 Output : PRINT, DISPLAY, SHOW
- 계산 Compute : COMPUTE, CALCULATE, DETERMINE
- 초기화 Initialize : SET, INIT
- 요소를 추가 Add one : INCREMENT, BUMP
- 선형 증가 Linear progression : SEQUENCE
- 반복문 : WHILE, FOR
- 조건문 : IF-THEN-ELSE
- 마지막에 조건문이 있는 반복문 : REPEAT-UNTIL
- 대신 조건 분기 처리 IF-THEN-ELSE : CASE
- 불 Bool : TRUE / FALSE
- 그 외 : REPEAT-UNTIL RETURN BEGIN / EXCEPTION / END
  <br>

---

# 슈도코드 예제

```java
// 1. 만약 나이가 60살 이상이면
// 2. 'passed'를 출력하고
// 3. 아니면
// 4. 'failed'를 출력한다.
```

```java
if (age <= 60) { // 만약 age(나이)가 60 이상이면
  System.out.println("passed") // 'passed'를 출력하고
} else { // 아니면
  System.out.println("failed") // 'failed'를 출력한다.
}
```
<br>
<br><br><br><br><br><br><br><br><br>
참고 : https://velog.io/@strawberrycream/pseudocode
