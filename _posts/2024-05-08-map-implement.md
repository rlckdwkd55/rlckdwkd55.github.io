---
title: "Map 직접 구현하기"
date: 2024-05-08 21:35:00 +0900
categories: [Java]
tags: [basics, map, collection]
description: "HashMap의 내부 구조를 이해하기 위해 핵심 메서드만 직접 구현해보자."
image:
  path: /assets/img/thumbnails/map-implement.jpg
---

# 주의할 점

key.hashCode()는 key 객체의 해시코드를 반환하는 메서드이다.
자바에서는 모든 객체가 hashCode() 메서드를 가지고 있으며, 기본적으로는 객체의 메모리 주소를 기반으로 한 해시코드를 반환한다.
하지만 순차적으로 0, 1, 2, 3, ... 순서로 저장되는 것은 아니다.
그렇기 때문에 맵에 저장된 순서와 toString() 메서드로 출력된 순서가 일치하지 않을 수 있다.

만약 순서를 보장하고 싶다면, LinkedHashMap과 같은 자료구조를 사용하는 것이 좋다.
이를 통해 데이터를 순서대로 저장하고 검색할 수 있다.
순차적으로 0, 1, 2, 3, ... 순서로 저장되는 것은 아니지만 인덱스로 변환하는 이유는 두 가지가 있는데

1. 빠른 데이터 접근: 해시 맵은 배열을 사용하여 데이터를 저장하는데, 배열은 인덱스를 사용하여 상수 시간(O(1))에 데이터에 접근할 수 있는 장점이 있다. 만약 키를 인덱스로 변환하지 않고, 리스트나 연결 리스트 등 다른 자료구조를 사용한다면, 데이터를 검색하는 데에 선형 시간(O(n))이 걸릴 수 있지만, 키를 인덱스로 변환하여 배열에 저장함으로써 빠른 데이터 접근을 가능케 한다.

2. 데이터 분산: 해시 맵은 키를 해시코드로 변환하여 배열의 인덱스로 매핑하는데, 이를 통해 데이터를 균일하게 분산시킬 수 있다. 해시 함수는 키의 고유한 해시코드를 생성하는데, 이 해시코드를 배열의 인덱스로 사용하면 데이터가 배열의 각 슬롯에 균등하게 분산된다. 이를 통해 데이터를 효율적으로 저장하고 검색할 수 있다.

따라서, 키를 해시코드로 변환하고, 이를 배열의 인덱스로 매핑하여 데이터를 저장하는 것은 **빠른 데이터 접근과 데이터 분산을 위한 목적**을 가지고 있다.

Map의 구조를 더욱 자세히 이해하기 위해 HashMap을 직접 구현하고자 하였다.
<br>

---

<br>
HashMap은 해싱(Hashing)을 통해 데이터가 저장될 위치의 인덱스를 구한다.
key를 해싱함수에 넣어 인덱스를 산출한 후, 해당 인덱스에 Map데이터를 저장하는 것이다.

다 구현하는 것보다는 Map의 그중에서도 HashMap의 특징을 알 수 있는 필수적인 메서드만 구현하여 어떻게 동작하는지 위주로 구현을 해보고자 한다.

- put() : HashMap에 데이터 추가.
- get() : HashMap에 있는 Key값을 기준으로 value값 꺼내옴
- remove() : Key값에 해당하는 Value값 삭제
- size() : HashMap의 크기 반환
- clear() : 데이터 모두 삭제
- isEmpty() : 값의 유무 반


<br>

---

# 구현

### 1. 선언

```java
public class MakeMap<K, V> {  
    private Entry<K, V>[] Map; // Map 배열을 멤버 변수로 선언.  
    private int size; // size 변수를 멤버 변수로 선언.  
  
    // 생성자  
    public MakeMap(int size) {  
        this.size = 0; // size 멤버 변수 초기화  
        this.Map = new Entry[size]; // Map 배열을 size 크기로 초기화  
    }
```

- Map배열과 size변수를 멤버변수로 선언해 준다.
- 생성자에서 해당 멤버변수들을 초기화해준다.
  <br>

### 2. toString()

```java
@Override  
public String toString() {  
    StringBuilder sb = new StringBuilder();  
    for (Entry<K, V> entry : Map) {  
        while (entry != null) {  
            sb.append(entry.key).append("=").append(entry.value).append(", ");  
            entry = entry.next;  
        }  
    }  
    if (sb.length() > 0) {  
        sb.setLength(sb.length() - 2); // 마지막 쉼표와 공백 제거  
    }  
    return "{" + sb.toString() + "}";  
}
```

- 주소값이 아닌 실제 값을 출력받기 위해 toString 선언해 주었다.
  <br>

### 3. Entry<K, V>

```java
private static class Entry<K, V> {  
    private K key; // key를 저장하는 변수  
    private V value; // value를 저장하는 변수  
    private Entry<K, V> next; // 다음 Entry를 가리키는 변수  
  
    public Entry(K key, V value) {  
        this.key = key;  
        this.value = value;  
        this.next = null; // 다음 Entry는 초기에는 없으므로 null로 설정.  
    }  
}
```

- HashMap을 구현할 때 사용할 Entry값 할당해 준다.
  <br>

### 4. put()

```java
public void put(K key, V value) {  
    int index = key.hashCode() % Map.length; // key를 해시코드를 사용하여 인덱스를 계산.  
    Entry<K, V> entry = new Entry<>(key, value); // 새로운 Entry 객체를 생성.  
  
    if (Map[index] == null) { // 해당 인덱스배열에 아무 값도 없는 경우  
        Map[index] = entry; // 새로운 Entry를 추가.  
        size++; // size 변수를 증가시킴  
  
    } else { // 이 아래 코드는 전부 인덱스에 값이 있을 때  
        Entry<K, V> current = Map[index]; // 현재 인덱스의 첫 번째 Entry를 가져온다.  
        while (current.next != null) { // 다음 Entry가 없을 때까지 반복.  
            if (current.key.equals(key)) { // 이미 같은 key가 있는 경우  
                current.value = value; // value를 업데이트하고 종료.  
                return;  
            }  
            current = current.next; // 다음 Entry로 이동.  
        }  
        if (current.key.equals(key)) { // 마지막 Entry까지 확인한 후 key가 이미 있는 경우  
            current.value = value; // value를 업데이트.  
        } else {  
            current.next = entry; // 마지막 Entry의 다음에 새로운 Entry를 추가.  
            size++; // size 변수를 증가시킴  
        }  
    }  
}
```

- HashMap은 해싱(Hashing)을 통해 데이터가 저장될 위치의 인덱스를 구한다.
- 그렇기 때문에 key의 hashCode를 맵의 총길이로 나눈 나머지 값을 활용해 인덱스를 계산해 준다.
- 값이 없을 땐 Entry를 추가하고 size를 증가시켜 준다.
- 하지만 값이 있을 땐 같은 key를 가지고 있는지 여부를 확인하는 작업을 수행한다.
  <br>

### 5. get()

```java
public V get(K key) {  
    int index = key.hashCode() % Map.length; // key를 해시코드를 사용하여 인덱스를 계산.  
  
    Entry<K, V> current = Map[index]; // 해당 인덱스의 첫 번째 Entry를 가져옴.  
    while (current != null) { // Entry가 없을 때까지 반복.  
        if (current.key.equals(key)) { // key가 일치하는 경우  
            return current.value; // 해당하는 value를 반환.  
        }  
        current = current.next; // 다음 Entry로 이동.  
    }  
  
    return null; // key에 해당하는 value가 없는 경우 null을 반환.  
}
```

- HashMap에 있는 Key값을 기준으로 value값을 꺼내오는 메서드이다.
- key의 hashCode를 맵의 총길이로 나눈 나머지 값을 활용해 인덱스를 계산해 준다.
- 해당 인덱스의 첫 번째 Entry를 가져와서 값이 없을 때까지 반복문을 돌려준다.
- Key가 일치할 때 해당하는 value를 return 해준다.
  <br>

### 6. remove()

```java
public V remove(K key) {  
    int index = key.hashCode() % Map.length; // key를 해시코드를 사용하여 인덱스를 계산.  
  
    Entry<K, V> current = Map[index]; // 해당 인덱스의 첫 번째 Entry를 가져옴.  
    Entry<K, V> prev = null; // 이전 Entry를 추적하기 위한 변수  
  
    while (current != null && !current.key.equals(key)) { // key가 일치하는 Entry를 찾을 때까지 반복.  
        prev = current; // 이전 Entry를 현재 Entry로 업데이트.  
        current = current.next; // 다음 Entry로 이동.  
    }  
  
    if (current == null) {  
        return null; // key에 해당하는 value가 없는 경우 null을 반환.  
    }  
  
    if (prev == null) { // 첫 번째 Entry를 삭제하는 경우  
        Map[index] = current.next; // 첫 번째 엔트리를 건너뛰고 다음 엔트리를 첫 번째로 지정하여 삭제  
    } else { // 중간이나 마지막 Entry를 삭제하는 경우  
        prev.next = current.next; // 이전 Entry와 다음 Entry를 연결하며 삭제  
    }  
  
    size--; // size 변수를 감소시킴  
    return current.value; // 삭제한 Entry의 value를 반환.  
}
```

- HashMap에서 Key값에 해당하는 데이터를 삭제해 준다.
- key의 hashCode를 맵의 총길이로 나눈 나머지 값을 활용해 인덱스를 계산해 준다.
- 값이 없을 때는 return null을 반환해 준다.
- 첫 번째 Entry를 삭제하거나 나머지 경우를 삭제하는 경우라면 GC를 활용하여 삭제해 준다.
- 모든 수행이 끝나고 size를 감소시켜 주고 삭제한 Entry의 Value를 반환해 준다.
  <br>

### 7. size()

```java 
public int size() {  
  
    return size;  
}
```

- HashMap의 크기를 구하는 메서드이다.
  <br>

### 8. clear()

```java
public void clear() {  
    try{  
    Map = null;  
    size = 0;  
    } catch (NullPointerException e){  
        System.out.println("데이터가 없습니다.");  
    }  
  
}
```

- HashMap의 모든 데이터를 삭제하는 메서드이다.
- Map을 null로 만들고 size를 0으로 선언해 준다.
  <br>

### 9. isEmpty()

```java
public boolean isEmpty() {  
    return size == 0;  
}
```

- HashMap에 값이 비어있는지 확인하는 메서드이다.
- 비었으면 true, 값이 있으면 false반환한다.
  <br>

---

# 전체 코드

### \[코드]
```java
public class MakeMap<K, V> {  
    private Entry<K, V>[] Map; // Map 배열을 멤버 변수로 선언.  
    private int size; // size 변수를 멤버 변수로 선언.  
  
    // 생성자  
    public MakeMap(int size) {  
        this.size = 0; // size 멤버 변수 초기화  
        this.Map = new Entry[size]; // Map 배열을 size 크기로 초기화  
    }  
  
    // ToString  
    @Override  
    public String toString() {  
        StringBuilder sb = new StringBuilder();  
        for (Entry<K, V> entry : Map) {  
            while (entry != null) {  
                sb.append(entry.key).append("=").append(entry.value).append(", ");  
                entry = entry.next;  
            }  
        }  
        if (sb.length() > 0) {  
            sb.setLength(sb.length() - 2); // 마지막 쉼표와 공백 제거  
        }  
        return "{" + sb.toString() + "}";  
    }  
  
    // Entry 값 할당  
    private static class Entry<K, V> {  
        private K key; // key를 저장하는 변수  
        private V value; // value를 저장하는 변수  
        private Entry<K, V> next; // 다음 Entry를 가리키는 변수  
  
        public Entry(K key, V value) {  
            this.key = key;  
            this.value = value;  
            this.next = null; // 다음 Entry는 초기에는 없으므로 null로 설정.  
        }  
    }  
  
    // Put  
    // HashMap에 데이터 추가.  
    public void put(K key, V value) {  
        int index = key.hashCode() % Map.length; // key를 해시코드를 사용하여 인덱스를 계산.  
        Entry<K, V> entry = new Entry<>(key, value); // 새로운 Entry 객체를 생성.  
  
        if (Map[index] == null) { // 해당 인덱스배열에 아무 값도 없는 경우  
            Map[index] = entry; // 새로운 Entry를 추가.  
            size++; // size 변수를 증가시킴  
  
        } else { // 이 아래 코드는 전부 인덱스에 값이 있을 때  
            Entry<K, V> current = Map[index]; // 현재 인덱스의 첫 번째 Entry를 가져온다.  
            while (current.next != null) { // 다음 Entry가 없을 때까지 반복.  
                if (current.key.equals(key)) { // 이미 같은 key가 있는 경우  
                    current.value = value; // value를 업데이트하고 종료.  
                    return;  
                }  
                current = current.next; // 다음 Entry로 이동.  
            }  
            if (current.key.equals(key)) { // 마지막 Entry까지 확인한 후 key가 이미 있는 경우  
                current.value = value; // value를 업데이트.  
            } else {  
                current.next = entry; // 마지막 Entry의 다음에 새로운 Entry를 추가.  
                size++; // size 변수를 증가시킴  
            }  
        }  
    }  
  
    // get  
    // HashMap에 있는 Key값을 기준으로  
    // value값 꺼내옴  
    public V get(K key) {  
        int index = key.hashCode() % Map.length; // key를 해시코드를 사용하여 인덱스를 계산.  
  
        Entry<K, V> current = Map[index]; // 해당 인덱스의 첫 번째 Entry를 가져옴.  
        while (current != null) { // Entry가 없을 때까지 반복.  
            if (current.key.equals(key)) { // key가 일치하는 경우  
                return current.value; // 해당하는 value를 반환.  
            }  
            current = current.next; // 다음 Entry로 이동.  
        }  
  
        return null; // key에 해당하는 value가 없는 경우 null을 반환.  
    }  
  
    // Key값에 해당하는 Value값 삭제  
    public V remove(K key) {  
        int index = key.hashCode() % Map.length; // key를 해시코드를 사용하여 인덱스를 계산.  
  
        Entry<K, V> current = Map[index]; // 해당 인덱스의 첫 번째 Entry를 가져옴.  
        Entry<K, V> prev = null; // 이전 Entry를 추적하기 위한 변수  
  
        while (current != null && !current.key.equals(key)) { // key가 일치하는 Entry를 찾을 때까지 반복.  
            prev = current; // 이전 Entry를 현재 Entry로 업데이트.  
            current = current.next; // 다음 Entry로 이동.  
        }  
  
        if (current == null) {  
            return null; // key에 해당하는 value가 없는 경우 null을 반환.  
        }  
  
        if (prev == null) { // 첫 번째 Entry를 삭제하는 경우  
            Map[index] = current.next; // 첫 번째 엔트리를 건너뛰고 다음 엔트리를 첫 번째로 지정하여 삭제  
        } else { // 중간이나 마지막 Entry를 삭제하는 경우  
            prev.next = current.next; // 이전 Entry와 다음 Entry를 연결하며 삭제  
        }  
  
        size--; // size 변수를 감소시킴  
        return current.value; // 삭제한 Entry의 value를 반환.  
    }  
  
  
    public int size() {  
  
        return size;  
    }  
  
    // 데이터 모두 삭제  
    public void clear() {  
        try{  
        Map = null;  
        size = 0;  
        } catch (NullPointerException e){  
            System.out.println("데이터가 없습니다.");  
        }  
  
    }  
  
    // 값이 있으면 false 없으면 true    public boolean isEmpty() {  
        return size == 0;  
    }  
}
```

<br>

### \[Main]
```java
public class MakeMapMain {  
    public static void main(String[] args) {  
        MakeMap<String, String> map = new MakeMap<>(4);  
  
        System.out.println("putTest--------------------------");  
        map.put("1", "apple");  
        map.put("2", "banana");  
        map.put("3", "melon");  
        map.put("4", "cherry");  
        map.put("5", "fig");  
        map.put("6", "grapes");  
        map.put("7", "kiwi");  
        System.out.println(map);  
  
        System.out.println("getTest--------------------------");  
        System.out.println(map.get("3"));  
  
        System.out.println("removeTest--------------------------");  
        System.out.println(map.remove("2"));  
        System.out.println(map);  
  
        System.out.println("sizeTest--------------------------");  
        System.out.println(map.size());  
  
  
        System.out.println("clearTest--------------------------" + "\n");  
        map.clear();  
  
        System.out.println("isEmptyTest--------------------------");  
        System.out.println(map.isEmpty());  
  
    }  
}
```

<br>

### \[결과]
```console
putTest--------------------------
{4=cherry, 1=apple, 5=fig, 2=banana, 6=grapes, 3=melon, 7=kiwi}
getTest--------------------------
melon
removeTest--------------------------
banana
{4=cherry, 1=apple, 5=fig, 6=grapes, 3=melon, 7=kiwi}
sizeTest--------------------------
6
clearTest--------------------------

isEmptyTest--------------------------
true
```
