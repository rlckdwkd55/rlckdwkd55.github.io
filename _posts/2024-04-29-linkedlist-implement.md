---
title: "LinkedList 직접 구현하기"
date: 2024-04-29 21:20:00 +0900
categories: [Java]
tags: [basics, linkedlist, collection]
description: "LinkedList의 구조를 이해하기 위해 핵심 메서드만 직접 구현해보자."
image:
  path: /assets/img/thumbnails/linkedlist-implement.jpg
---

Queue를 직접 구현할 때 사용했던 직접 구현한 MakeLinkedList이다.
List의 구조를 더욱 자세히 이해하기 위해 클래스를 직접 구현하고자 하였다.
java.util의 LinkedList는 메서드가 굉장히 많다. 따라서 다 구현하는 것보다는 LinkedList의 특징을 알 수 있는 필수적인 메서드만 구현하여 어떻게 동작하는지 위주로 구현을 해보고자 한다.

- addFirst() : Head노드에 데이터 추가
- addLast() : Tail노드에 데이터 추가
- isEmpty() : 배열에 값이 있는지 체크
- removeFirst() : Head노드 데이터 삭제
- removeLast() : Tail노드 데이터 삭제
- clear() : 배열 전체 데이터 삭제
- size() : 배열 크기 반환
- peek() : 첫 번째 노드 반환
- poll() : 첫 번째 노드 삭제
- get() : 요청한 인덱스 반환
  <br>

---

# 구현

### 1. 선언

```java
public class MakeLinkedList<E> {  
    private Node<E> head;  
    private Node<E> tail;  
    private int size = 0;  
  
  
    private class Node<E> {  
        private Node<E> next;  
        private E data;  
  
        public Node(E data) {  
            this.data = data;  
        }  
    }
```

- 노드의 head, tail 그리고 size를 선언해 주었다.
  <br>

### 2. toString()

```java
@Override  
public String toString() {  
    if (isEmpty()) {  
        return "[]";  
    }  
  
    StringBuilder sb = new StringBuilder();  
    sb.append("[");  
  
    Node<E> current = head;  
    sb.append(current.data);  
  
    while (current.next != null) {  
        current = current.next;  
        sb.append(", ").append(current.data);  
    }  
  
    sb.append("]");  
  
    return sb.toString();  
}
```

- 배열의 값을 주소값이 아닌 실제 값을 출력받기 위해 toString 선언해 주었다.
  <br>

### 3. addFirst()

```java
public void addFirst(E data) {  
    if (head == null) { // 링크드 리스트가 비어있을 경우  
        head = new Node<E>(data); // head에 새로운 노드를 생성하여 추가  
        tail = head; // tail도 동일한 노드를 가리키도록 설정  
    } else { //노드가 존재한다면?  
        Node<E> node = new Node<E>(data); // 새로운 노드 생성  
        node.next = head; // 새로운 노드의 다음 노드로 현재 head를 설정 / 과거 헤드를 뒤로 밀어버림  
        head = node; // head를 새로운 노드로 업데이트  
    }  
}
```

- Head노드에 데이터를 추가하는 메서드이다.
- LinkedList가 비었을 경우와 그 외의 경우로 나누어서 구현하였다.
  <br>

### 4. addLast()

```java
public void addLast(E data) {  
    if (head == null) { // 링크드 리스트가 비어있을 경우  
        head = new Node<E>(data); // head에 새로운 노드를 생성하여 추가  
        tail = head;
    } else { //노드가 존재한다면?  
        Node<E> node = this.head; // 현재 head 노드를 넣는다.  
        while (node.next != null) { // 그 다음 노드가 존재할때 현재 노드를 그 다음노드로 바꿔준다.  
            node = node.next;  
        }  
        node.next = new Node<E>(data);  
    } // next 가 null이라면 현재 링크드 리스트의 마지막을 알 수 있다.  
}
```

- Tail 노드에 데이터 추가하는 메서드이다.
- addFirst()와 마찬가지로 LinkedList가 비었을 경우와 그 외의 경우로 나누어서 구현하였다.
  <br>

### 5. isEmpty()

```java
public boolean isEmpty() {  
    return head == null;  
}
```

- LinkedList에 값이 비어있는지 확인하는 메서드이다.
- 비었으면 true, 값이 있으면 false반환한다.
  <br>

### 6. removeFirst()

```java
public Object removeFirst() {  
    if (head == null) {  
        System.out.println("데이터가 없습니다.");  
        return null;  
    }  
  
    E data = head.data; // data에 head의 데이터 대입  
    Node<E> firstData = head; // firstData에 head대입  
    head = firstData.next; // head에 head다음 데이터 대입  
  
    firstData = null; // 현재 head null로 변환  
    size--; // 사이즈 줄이기  
    return data; // 대입한 head데이터 반환  
}
```

- LinkedList의 첫 번째 값을 삭제하는 메서드이다.
- 데이터가 없으면 return값을 null로 선언해 주고 그 외의 경우에 진행한다.
- 현재 head를 null로 변환하고 size를 줄여준다.
  <br>

### 7. removeLast()

```java 
public Object removeLast() {  
    if (head == null) {  
        System.out.println("데이터가 없습니다.");  
        return null;  
    }  
  
    if (head.next == null) { // 데이터가 하나일 경우  
        E data = head.data;  
        head = null;  
        tail = null;  
        size--;  
  
        return data;  
    }  
  
    Node<E> current = head;  
    while (current.next.next != null) { // 마지막 노드 이전까지 반복  
        current = current.next;  
    }  
  
    E data = current.next.data; // 마지막 노드 데이터 저장  
    current.next = null; // 마지막 노드 데이터 삭제  
    tail = current; // tail에 마지막 이전 노드 데이터로 설정  
  
    size--;  
  
    return data;  
}
```

- LinkedList의 마지막 값을 삭제하는 메서드이다.
- removeFirst()와 다르게 데이터가 없을 경우, 하나일 경우, 그 외의 경우로 나누어서 구현하였다.
- 마지막 노드의 데이터를 삭제하고 size를 줄여준다.
  <br>

### 8. clear()

```java
public void clear() {  
  
    head = null;  
    tail = null;  
  
    size = 0;  
}
```

- LinkedList의 값을 모두 지우는 메서드이다.
- head와 tail의 값을 모두 지우고 size를 0으로 선언해 준다.
  <br>

### 9. size()

```java
public int size() {  
    int count = 0;  
    Node<E> current = head;  
    while (current != null) {  
        count++;  
        current = current.next;  
    }  
    return count;  
}
```

- LinkedList의 배열 크기를 반환하는 메서드이다.
- return으로 size만 기입했을 때 작동이 되지 않는 문제가 있어서 별도의 변수를 선언해 준 후 반복문을 수행했다.
  <br>

### 10. peek()

```java
public Object peek(){  
    return head.data;  
}
```

- head노드를 반환해 주는 메서드이다.
  <br>

### 11. poll()

```java
public Object poll(){  
    return removeFirst();  
}
```

- head노드를 삭제해 주는 메서드이다.
  <br>

### 12. get()

```java
public E get(int index) {  
  
    Node<E> current = head;  
    for (int i = 0; i < index; i++) {  
        current = current.next;  
    }  
  
    return current.data;  
}
```

- 요청한 인덱스의 값을 반환해 주는 메서드이다.
- 별도의 변수를 선언한 후 반복문을 수행하여 값을 찾아오도록 구현하였다.
  <br>

---

# 전체 코드

### \[코드]
```java
public class MakeLinkedList<E> {  
    private Node<E> head;  
    private Node<E> tail;  
    private int size = 0;  
  
  
    private class Node<E> {  
        private Node<E> next;  
        private E data;  
  
        public Node(E data) {  
            this.data = data;  
        }  
    }  
  
    @Override  
    public String toString() {  
        if (isEmpty()) {  
            return "[]";  
        }  
  
        StringBuilder sb = new StringBuilder();  
        sb.append("[");  
  
        Node<E> current = head;  
        sb.append(current.data);  
  
        while (current.next != null) {  
            current = current.next;  
            sb.append(", ").append(current.data);  
        }  
  
        sb.append("]");  
  
        return sb.toString();  
    }  
  
    // Head노드에 데이터 추가  
    public void addFirst(E data) {  
        if (head == null) { // 링크드 리스트가 비어있을 경우  
            head = new Node<E>(data); // head에 새로운 노드를 생성하여 추가  
            tail = head; // tail도 동일한 노드를 가리키도록 설정  
        } else { //노드가 존재한다면?  
            Node<E> node = new Node<E>(data); // 새로운 노드 생성  
            node.next = head; // 새로운 노드의 다음 노드로 현재 head를 설정 / 과거 헤드를 뒤로 밀어버림  
            head = node; // head를 새로운 노드로 업데이트  
        }  
    }  
  
    // Tail 노드에 데이터 추가.  
    public void addLast(E data) {  
        if (head == null) { // 링크드 리스트가 비어있을 경우  
            head = new Node<E>(data); // head에 새로운 노드를 생성하여 추가  
            tail = head;  
        } else { //노드가 존재한다면?  
            Node<E> node = this.head; // 현재 head 노드를 넣는다.  
            while (node.next != null) { // 그 다음 노드가 존재할때 현재 노드를 그 다음노드로 바꿔준다.  
                node = node.next;  
            }  
            node.next = new Node<E>(data);  
        } // next 가 null이라면 현재 링크드 리스트의 마지막을 알 수 있다.  
    }  
  
    // LinkedList에 값이 있는지 Check    // 비었으면 true 값이 있으면 false반환  
    public boolean isEmpty() {  
        return head == null;  
    }  
  
  
    // LinkedList의 첫 번째 값을 삭제하고  
    // size --, 데이터 한 칸씩 당김  
    public Object removeFirst() {  
        if (head == null) {  
            System.out.println("데이터가 없습니다.");  
            return null;  
        }  
  
        E data = head.data; // data에 head의 데이터 대입  
        Node<E> firstData = head; // firstData에 head대입  
        head = firstData.next; // head에 head다음 데이터 대입  
  
        firstData = null; // 현재 head null로 변환  
        size--; // 사이즈 줄이기  
        return data; // 대입한 head데이터 반환  
    }  
  
    // Tail노드 데이터 삭제  
    public Object removeLast() {  
        if (head == null) {  
            System.out.println("데이터가 없습니다.");  
            return null;  
        }  
  
        if (head.next == null) { // 데이터가 하나일 경우  
            E data = head.data;  
            head = null;  
            tail = null;  
            size--;  
  
            return data;  
        }  
  
        Node<E> current = head;  
        while (current.next.next != null) { // 마지막 노드 이전까지 반복  
            current = current.next;  
        }  
  
        E data = current.next.data; // 마지막 노드 데이터 저장  
        current.next = null; // 마지막 노드 데이터 삭제  
        tail = current; // tail에 마지막 이전 노드 데이터로 설정  
  
        size--;  
  
        return data;  
    }  
  
    // 모두삭제  
    public void clear() {  
  
        head = null;  
        tail = null;  
  
        size = 0;  
    }  
  
    // 크기반환  
    public int size() {  
        int count = 0;  
        Node<E> current = head;  
        while (current != null) {  
            count++;  
            current = current.next;  
        }  
        return count;  
    }  
  
    // 첫 번째 노드 반환  
    public Object peek(){  
        return head.data;  
    }  
  
    // 첫 번째 노드 삭제  
    public Object poll(){  
        return removeFirst();  
    }  
  
    // 요청한 인덱스 반환  
    public E get(int index) {  
  
        Node<E> current = head;  
        for (int i = 0; i < index; i++) {  
            current = current.next;  
        }  
  
        return current.data;  
    }   
}
```

<br>

### \[Main]
```java
public class MakeLinkedListMain<E> {  
  
    public static void main(String[] args) {  
        MakeLinkedList<Integer> list = new MakeLinkedList<>();  
  
        System.out.println("addLastTest--------------------");  
        list.addLast(1);  
        list.addLast(2);  
        list.addLast(3);  
        System.out.println(list);  
  
        System.out.println("peekTest--------------------");  
        System.out.println(list.peek());  
  
        System.out.println("pollTest--------------------");  
        list.poll();  
        System.out.println(list);  
  
        System.out.println("addFirstTest--------------------");  
        list.addFirst(8);  
        System.out.println(list);  
  
        System.out.println("sizeTest--------------------");  
        System.out.println(list.size());  
  
        System.out.println("getTest--------------------");  
        System.out.println(list.get(0));  
  
        System.out.println("isEmptyTest--------------------");  
        System.out.println(list.isEmpty());  
  
        System.out.println("removeFirstTest--------------------");  
        list.removeFirst();  
        System.out.println(list);  
  
        System.out.println("removeLastTest--------------------");  
        list.removeLast();  
        System.out.println(list);  
  
        System.out.println("clearTest--------------------");  
        list.clear();  
        System.out.println(list);  
    }  
}
```

<br>

### \[결과]
```console
addLastTest--------------------
[1, 2, 3]
peekTest--------------------
1
pollTest--------------------
[2, 3]
addFirstTest--------------------
[8, 2, 3]
sizeTest--------------------
3
getTest--------------------
8
isEmptyTest--------------------
false
removeFirstTest--------------------
[2, 3]
removeLastTest--------------------
[2]
clearTest--------------------
[]
```
