---
title: "Stack 직접 구현하기"
date: 2024-04-01 21:50:00 +0900
categories: [Java]
tags: [basics, stack, collection]
description: "Stack 구조를 더 깊이 이해하기 위해 ArrayList를 기반으로 Stack을 직접 구현해보자."
image:
  path: /assets/img/thumbnails/stack-implement.jpg
---


Stack의 구조를 더욱 자세히 이해하기 위해 클래스를 직접 구현하고자 하였다.
때문에 직접 구현한 ArrayList를 상속받아서 Stack을 구현하고자 한다.

모든 메서드를 직접 구현하지 않고 주요 메서드 몇 개만 구현하였다.

- add() : 값 추가
- peek() : 값 하나 조회
- pop() : 값 하나 삭제
- clear() : 전체 삭제
  <br>

--- 

# 구현

### 1. toString()

```java
class MakeStack<E> {  
    private MakeArrayList<E> stack; // 스택  
  
    // 생성자  
    public MakeStack() {  
        stack = new MakeArrayList<>();  
    }  
  
    // System.out.println 에서는 toString 이 돼 있어 정상출력 되지만  
    // 해당 클래스는 본인이 임의로 만든 것 이기 때문에 별도의 메소드를 만들어 toString화 해 준다.  
    public String toString() {  
        return stack.toString();  
    }
```

- 직접 구현한 MakeArrayList를 상속받아 생성자를 만들어주었다.
- System.out.println 에서는 toString 이 돼 있어 정상출력 되지만, 해당 클래스는 본인이 임의로 만든 것 이기 때문에 별도의 메서드를 만들어 toString화 해 준다.
  <br>

### 2. add()

```java
// 값 추가(add)  
public void add(E data) {  
    stack.add(data);  
}
```

- 스택에 요소를 추가하기만 하고, 반환 값이 필요하지 않도록 구현했다
- 위의 코드를 사용하면, add() 메서드가 요소를 스택에 추가하는 역할을 수행한다.
  <br>


### 3. peek()

```java
// 값 하나 조회(peek)  
public E peek(){  
    return stack.get(stack.size() - 1);  
}
```

- 스택의 제일 상단에 있는(마지막으로 저장된) 요소를 반환하는 메서드이다.
- 마지막 데이터란 배열의 크기 size에서 -1을 한 값을 마지막 데이터라 할 수 있다.(index는 0부터 시작)
- 만약 Stack이 비어있다면 get(-1);이 호출되기 때문에 예외처리를 해 주어야 한다.
  <br>


### 4. pop()

```java
// 값 하나 삭제(pop) 
public E pop() {  
    if (stack.isEmpty()) {  
        System.out.println("데이터가 없습니다.");  
        return null;  
    }  
  
    int lastIndex = stack.size() - 1;  
    return stack.remove(lastIndex);  
}
```

- 스택의 제일 상단에 있는(마지막으로 저장된) 요소를 반환 후,  해당 요소를 스택에서 제거하는 메서드이다.
- 조건문으로 Stack이 비어있을 땐 "데이터가 없습니다." 구문 출력되도록 구현하였다.
  <br>

### 5. clear()

```java
// 전체 삭제(clear)  
public void clear(){  
    if (stack.isEmpty()){  
        System.out.println("데이터가 없습니다.");  
    } else {  
        stack.clear();  
    }  
}
```

- Stack에 담은 모든 데이터를 삭제하는 메서드이다.
- 조건문으로 Stack이 비어있을 땐 "데이터가 없습니다." 구문 출력되도록 구현하였다.

<br>

---

# 전체 코드

### \[코드]
```java
class MakeStack<E> {  
    private MakeArrayList<E> stack; // 스택  
  
    // 생성자  
    public MakeStack() {  
        stack = new MakeArrayList<>();  
    }  
  
    // System.out.println 에서는 toString 이 돼 있어 정상출력 되지만  
    // 해당 클래스는 본인이 임의로 만든 것 이기 때문에 별도의 메소드를 만들어 toString화 해 준다.  
    public String toString() {  
        return stack.toString();  
    }  
  
    // 값 추가(add)  
    public void add(E data) {  
        stack.add(data);  
    }  
  
    // 값 하나 조회(peek)  
    public E peek(){  
        return stack.get(stack.size() - 1);  
    }  
  
  
    // 값 하나 삭제(pop)  
    // 데이터가 없을 경우 null과 "데이터가 없습니다." 반환하기때문에  
    // 예외발생 여부가 없다.  
    public E pop() {  
        if (stack.isEmpty()) {  
            System.out.println("데이터가 없습니다.");  
            return null;  
        }  
  
        int lastIndex = stack.size() - 1;  
        return stack.remove(lastIndex);  
    }  
  
  
    // 전체 삭제(clear)  
    public void clear(){  
        if (stack.isEmpty()){  
            System.out.println("데이터가 없습니다.");  
        } else {  
            stack.clear();  
        }  
  
    }  
}
```

<br>

### \[Main]
```java
public class MakeStackMain {  
    public static void main(String[] args) {  
        MakeStack<Object> stack = new MakeStack<>();  
  
        // add Test  
        for (int i = 0; i <= 10; i++) {  
            stack.add(i);  
        }  
        System.out.println("add Test : " + stack);  
  
        // peek Test  
        System.out.println("peek Test : " + stack.peek());  
  
        // pop Test  
        System.out.println("pop Test : " + stack.pop());  
        System.out.println("pop Test : " + stack);  
  
        // clear Test  
        stack.clear();  
        System.out.println("clear Test : " + stack);  
    }  
}
```

<br>

### \[결과]
```console
add Test : [0,1,2,3,4,5,6,7,8,9,10]
peek Test : 10
pop Test : 10
pop Test : [0,1,2,3,4,5,6,7,8,9]
clear Test : []
```
