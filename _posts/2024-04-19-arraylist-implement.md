---
title: "ArrayList 직접 구현하기"
date: 2024-04-19 21:30:00 +0900
categories: [Java]
tags: [basics, arraylist, collection]
description: "ArrayList의 내부 구조를 이해하기 위해 핵심 메서드만 직접 구현해보자."
image:
  path: /assets/img/thumbnails/arraylist-implement.jpg
---

Stack을 직접 구현할 때 사용했던 직접 구현한 MakeArrayList이다.
List의 구조를 더욱 자세히 이해하기 위해 클래스를 직접 구현하고자 하였다.
java.util의 ArrayList는 메서드가 굉장히 많다. 따라서 다 구현하는 것보다는 ArrayList의 특징을 알 수 있는 필수적인 메서드만 구현하여 어떻게 동작하는지 위주로 구현을 해보고자 한다.

- size() : 배열 크기 확인
- isEmpty() : 배열이 비어있는지 확인
- add() : 값 추가
- remove() : 삭제
- clear() : 전체 삭제
- get() : 데이터 가져오기
  <br>

---

# 구현

### 1. toString()

```java
public class MakeArrayList<E> implements List<E> {  
  
    // 데이터 크기  
    private int size = 0;  
  
    // 배열 선언  
    private E[] Data = (E[]) new Object[10];  
  
    // 출력 시 toString    public String toString() {  
        String str = "[";  
        for (int i = 0; i < size; i++) {  
            str += Data[i];  
            if (i < size - 1) {  
                str += ",";  
            }  
        }  
        return str + "]";  
    }
```

- 데이터 크기와 배열을 선언해 주었다.
- 출력 시 주소값이 아니라 값을 돌려받을 수 있도록 toString을 구현해 주었다.
  <br>

### 2. size()

```java
@Override  
public int size() {  
    return size;  
}
```

- 배열의 크기를 알 수 있는 메서드이다.
- return으로 size를 넣어주어 구현했다.
  <br>

### 3. isEmpty()

```java
@Override  
public boolean isEmpty() {  
    return size == 0;  
}
```

- 현재 배열이 비어있는지 확인하는 메서드이다.
- 비어있으면 true, 아니라면 false를 반환한다.
  <br>

### 4. add()

```java
@Override  
public boolean add(E obj) {  
    if (size == Data.length) {  
        Object Data2[] = Data;  
        Data = (E[]) new Object[(int) (Data.length * 1.5)];  
  
        // 배열 복사  
        for (int i = 0; i < Data2.length; i++) {  
            Data[i] = (E) Data2[i];  
        }  
    }  
    Data[size] = (E) obj;  
    size++;  
    return true;  
}
```

- 배열에 값을 추가할 때 사용하는 메서드이다.
- 배열 크기를 처음에 10으로 지정해 줬기 때문에, 그 이상 크기가 커지면 1.5배씩 크기를 키워주는 구문을 포함하였다.
- 그리고 기존에 있던 데이터를 다시 넣어주기 위해 배열을 복사하였다.

<br>

### 5. remove()

```java
@Override  
// 특정 요소를 삭제
public boolean remove(Object obj) {  
  
    int index = indexOf(obj);  
  
    if (index == -1) {  
        return false;  
    }  
  
    remove(index);  
    return true;  
}

// 인덱스를 기준으로 삭제  
@Override  
public E remove(int index) {  
  
    // 객체가 비어있는지 즉 Empty상태인지 확인  
    try {  
        if (index >= size || index < 0) {  
        }        // 삭제될 요소를 반환하기 위해 임시로 담아둠  
        E element = (E) Data[index];  
        Data[index] = null;  
  
        // 삭제 한 자리에 null값으로 공간을 차지하고 있기 때문에  
        // 삭제한 요소의 뒤에 있는 모든 요소들을 한 칸씩 당겨옴  
        for (int i = index; i < size - 1; i++) {  
            Data[i] = Data[i + 1];  
            Data[i + 1] = null;  
        }  
        // 배열 사이즈 줄이기  
        size--;  
        return element;  
  
    } catch (IndexOutOfBoundsException e) {  
        System.out.println("예외가 발생했습니다: " + e.getMessage());  
    }  
  
        return null;  
}
```

- 특정 요소 삭제와, 인덱스 기준으로 삭제 두 가지 구현하였다.
- 삭제 한 자리에 null값으로 공간을 차지하고 있기 때문에 뒤에 있는 모든 요소들을 한 칸씩 당겨오는 구문도 추가하고 size를 줄였다.
- 리스트 계열 자료구조는 데이터들이 '연속되어'있어야 한다는 점을 기억하자.

<br>

### 6. clear()

```java
// 전체삭제  
@Override  
public void clear() {  
    for (int i = 0; i < size; i++) {  
        Data[i] = null;  
    }  
    size = 0;  
}
```

- 배열에 있는 값을 모두 지우는 메서드이다.
- null로 만들어 준 다음 size를 0으로 지정해 주었다.

<br>

### 7. get()

```java 
@Override  
public E get(int index) {  
  
    try {  
        if (index >= size || index < 0) {  
            throw new IndexOutOfBoundsException("인덱스 범위를 벗어났습니다.");  
        }  
    } catch (IndexOutOfBoundsException e) {  
        System.out.println("예외가 발생했습니다: " + e.getMessage());  
    }  
  
    return (E) Data[index];  
}
```

- 특정 인덱스 위치의 제네릭 타입의 데이터를 가져온다.

<br>

---

# 전체 코드

### \[코드]
```java
public class MakeArrayList<E> implements List<E> {  
  
    // 데이터 크기  
    private int size = 0;  
  
    // 배열 선언  
    private E[] Data = (E[]) new Object[10];  
  
    // 출력 시 toString    public String toString() {  
        String str = "[";  
        for (int i = 0; i < size; i++) {  
            str += Data[i];  
            if (i < size - 1) {  
                str += ",";  
            }  
        }  
        return str + "]";  
    }  
  
    // 사이즈 확인  
    @Override  
    public int size() {  
        return size;  
    }  
  
    // 배열이 비어있는지 확인  
    // 비어있으면 true 아니라면 false 반환  
    @Override  
    public boolean isEmpty() {  
        return size == 0;  
    }  
  
    // 값 삽입하기  
    // 배열 크기를 처음 10으로 지정 해 줬기 때문에  
    // 복사할 수 있는 구문 포함  
    @Override  
    public boolean add(E obj) {  
        if (size == Data.length) {  
            Object Data2[] = Data;  
            Data = (E[]) new Object[(int) (Data.length * 1.5)];  
  
            // 배열 복사  
            for (int i = 0; i < Data2.length; i++) {  
                Data[i] = (E) Data2[i];  
            }  
        }  
        Data[size] = (E) obj;  
        size++;  
        return true;  
    }  
  
    // 특정 요소를 삭제  
    @Override  
    public boolean remove(Object obj) {  
  
        int index = indexOf(obj);  
  
        if (index == -1) {  
            return false;  
        }  
  
        remove(index);  
        return true;  
    }  
  
    // 인덱스를 기준으로 삭제  
    @Override  
    public E remove(int index) {  
  
        // 객체가 비어있는지 즉 Empty상태인지 확인  
        try {  
            if (index >= size || index < 0) {  
            }            // 삭제될 요소를 반환하기 위해 임시로 담아둠  
            E element = (E) Data[index];  
            Data[index] = null;  
  
            // 삭제 한 자리에 null값으로 공간을 차지하고 있기 때문에  
            // 삭제한 요소의 뒤에 있는 모든 요소들을 한 칸씩 당겨옴  
            for (int i = index; i < size - 1; i++) {  
                Data[i] = Data[i + 1];  
                Data[i + 1] = null;  
            }  
            // 배열 사이즈 줄이기  
            size--;  
            return element;  
  
        } catch (IndexOutOfBoundsException e) {  
            System.out.println("예외가 발생했습니다: " + e.getMessage());  
        }  
  
        return null;  
    }  
  
    // 전체삭제  
    @Override  
    public void clear() {  
        for (int i = 0; i < size; i++) {  
            Data[i] = null;  
        }  
        size = 0;  
    }  
  
    // 특정 인덱스 위치의 제네릭 타입의 데이터를 가져온다.  
    @Override  
    public E get(int index) {  
  
        try {  
            if (index >= size || index < 0) {  
                throw new IndexOutOfBoundsException("인덱스 범위를 벗어났습니다.");  
            }  
        } catch (IndexOutOfBoundsException e) {  
            System.out.println("예외가 발생했습니다: " + e.getMessage());  
        }  
  
        return (E) Data[index];  
    }
}
```

<br>

### \[Main]
```java
public class MakeArrayListMain {  
    public static void main(String[] args) {  
  
        MakeArrayList<Integer> as = new MakeArrayList<Integer>();  
  
        // add Test  
        for (int i = 0; i < 20; i++) {  
            as.add(i);  
        }  
        System.out.println("addTest : " + as);  
  
        // isEmpty Test  
        System.out.println("isEmptyTest : " + as.isEmpty());  
  
        // size Test  
        System.out.println("sizeTest : " + as.size());  
  
        // get Test  
        System.out.println("getTest : " + as.get(1));  
  
        // remove Test  
        as.remove(1);  
        System.out.println("removeTest : " + as);  
  
        // clear Test  
        as.clear();  
        System.out.println("clearTest : " + as);  
    }  
}
```

<br>

### \[결과]
```console
addTest : [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19]
isEmptyTest : false
sizeTest : 20
getTest : 1
removeTest : [0,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19]
clearTest : []
```
