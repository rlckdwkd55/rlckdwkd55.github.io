---
title: "Queue 직접 구현하기"
date: 2024-04-10 22:05:00 +0900
categories: [Java]
tags: [basics, queue, collection]
description: "Queue의 FIFO 구조를 더 깊이 이해하기 위해 LinkedList 기반의 Queue를 직접 구현해보자."
image:
  path: /assets/img/thumbnails/queue-implement.jpg
---

Queue의 구조를 더욱 자세히 이해하기 위해 클래스를 직접 구현하고자 하였다.
때문에 직접 구현한 MakeLinkedList를 상속받아서 Queue을 구현하고자 한다.

Stack과 다르게 데이터가 들어간 순서대로 나오는 FIFO(First In First Out) 선입선출 자료구조이다.

모든 메서드를 직접 구현하지 않고 주요 메서드 몇 개만 구현하였다.

- add() : 값 추가
- peek() : 값 하나 조회
- poll() : 값 하나 삭제
- clear() : 전체 삭제
  <br>

--- 

# 구현

### 1. toString()

```java
class MakeQueue<E> {  
    private MakeLinkedList<E> queue; // 큐  
  
    // 생성자  
    public MakeQueue() {  
        queue = new MakeLinkedList<>();  
    }  
  
    public String toString() {  
        StringBuilder sb = new StringBuilder();  
        sb.append("[");  
  
        for (int i = 0; i < queue.size(); i++) {  
            sb.append(queue.get(i));  
            if (i < queue.size() - 1) {  
                sb.append(", ");  
            }  
        }  
        sb.append("]");  
        return sb.toString();  
    }
```

- 직접 구현한 MakeLinkedList를 상속받아 생성자를 만들어주었다.
- System.out.println 에서는 toString 이 돼 있어 정상출력 되지만, 해당 클래스는 본인이 임의로 만든 것 이기 때문에 별도의 메서드를 만들어 toString화 해 준다.
  <br>

### 2. add()

```java
// 값 추가(add)  
public void add(E data) {  
    queue.addLast(data);  
}
```

- 큐에 요소를 추가하기만 하고, 반환 값이 필요하지 않도록 구현했다
- 위의 코드를 사용하면, add() 메서드가 요소를 큐에 추가하는 역할을 수행한다.
  <br>


### 3. peek()

```java
public E peek(){  
    return (E) queue.peek();  
}
```

- 데이터 첫번째 값 가져온다.
- 만약 Queue가 비어있다면 null.
  <br>


### 4. poll()

```java
// 값 하나 삭제(poll)  
public E poll() {  
    if (queue.isEmpty()){  
        System.out.println("데이터가 없습니다.");  
        return null;  
    }

    return (E) queue.removeFirst();
}
```

- 데이터 삭제 queue에 첫번째 값을 반환하고 제거 비어있다면 null.
- 조건문으로 Queue 비어있을 땐 "데이터가 없습니다." 구문 출력되도록 구현하였다.
  <br>

### 5. clear()

```java
// 전체 삭제(clear)  
public void clear() {  
    if (queue.isEmpty()) {  
        System.out.println("데이터가 없습니다.");  
    } else {  
        queue.clear();  
    }  
}
```

- Queue에 담은 모든 데이터를 삭제하는 메서드이다.
- 조건문으로 Queue가 비어있을 땐 "데이터가 없습니다." 구문 출력되도록 구현하였다.

<br>

---

# 전체 코드

### \[코드]
```java
class MakeQueue<E> {
  private MakeLinkedList<E> queue; // 큐  

  // 생성자  
  public MakeQueue() {
    queue = new MakeLinkedList<>();
  }

  // System.out.println 에서는 toString 이 돼 있어 정상출력 되지만  
  // 해당 클래스는 본인이 임의로 만든 것 이기 때문에 별도의 메소드를 만들어 toString화 해 준다.  
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("[");

    for (int i = 0; i < queue.size(); i++) {
      sb.append(queue.get(i));
      if (i < queue.size() - 1) {
        sb.append(", ");
      }
    }
    sb.append("]");
    return sb.toString();
  }


  // 값 추가(add)  
  public void add(E data) {
    queue.addLast(data);
  }

  // 값 하나 조회(peek)  
  public E peek(){
    return (E) queue.peek();
  }


  // 값 하나 삭제(poll)  
  public E poll() {
    if (queue.isEmpty()){
      System.out.println("데이터가 없습니다.");
      return null;
    }

    return (E) queue.removeFirst();
  }

  // 전체 삭제(clear)  
  public void clear() {
    if (queue.isEmpty()) {
      System.out.println("데이터가 없습니다.");
    } else {
      queue.clear();
    }
  }
}
```

<br>

### \[Main]
```java
public class MakeQueueMain {

  public static void main(String[] args) {
    MakeQueue<Object> queue = new MakeQueue<>();

    queue.add("Hello");
    queue.add("World");
    queue.add("Hello");
    queue.add("Hello");
    queue.add("World");

    System.out.println("add Test : " + queue);

    // peek Test  
    System.out.println("peek Test : " + queue.peek());

    // pop Test  
    System.out.println("poll Test : " + queue.poll());
    System.out.println("poll Test : " + queue);

    // clear Test  
    queue.clear();
    System.out.println("clear Test : " + queue);
  }
}
```

<br>

### \[결과]
```console
add Test : [Hello, World, Hello, Hello, World]
peek Test : Hello
poll Test : Hello
poll Test : [World, Hello, Hello, World]
clear Test : []
```
