---
title: "JavaScript란?"
date: 2025-05-29
categories: [Web]
tags: [javascript]
description: "JavaScript의 개념과 특징, 주요 문법"
image:
  path: /assets/img/thumbnails/javascript.png
---

## JavaScript란?

- **JavaScript**는 웹 브라우저에서 실행되는 **클라이언트 측 스크립트 언어**로, 웹 페이지를 동적으로 만들고 사용자와 상호작용할 수 있게 한다.
- HTML과 CSS와 함께 웹의 3대 핵심 기술로 자리잡았으며, 현재는 **서버 측(Node.js)**에서도 사용할 수 있는 **범용 프로그래밍 언어**이다.

### 장단점

#### 장점

- **동적 웹 페이지 제작**: JavaScript를 통해 웹 페이지에 동적인 콘텐츠를 추가할 수 있다.
- **빠른 응답성**: 클라이언트 측에서 바로 실행되므로 서버에 요청하지 않아도 즉시 반응한다.
- **비동기 처리**: AJAX, `fetch` API 등을 사용해 페이지를 새로고침하지 않고도 서버와 데이터를 주고받을 수 있다.
- **범용성**: 프론트엔드(브라우저)와 백엔드(Node.js) 모두에서 사용할 수 있어, **전체 스택 개발**에 용이하다.
- **광범위한 커뮤니티와 생태계**: 다양한 라이브러리와 프레임워크(React, Vue.js, Angular 등)가 있어 개발을 빠르게 진행할 수 있다.

#### 단점

- **보안 문제**: 클라이언트 측에서 실행되므로 코드가 쉽게 노출될 수 있으며, **XSS**와 같은 공격에 취약하다.
- **브라우저 호환성 이슈**: 각 브라우저에서 JavaScript를 해석하는 방식이 다를 수 있어, **크로스 브라우징** 문제를 해결해야 한다.
- **대규모 코드 관리 어려움**: 프로젝트가 커질수록 코드가 복잡해지고 관리가 어려워진다.

---

## 주요 문법

### 변수 선언

JavaScript에서 변수를 선언할 때는 `var`, `let`, `const`를 사용할 수 있다.

``` javascript
let name = "JohnSiNa";   // 재할당 가능
const age = 30;      // 재할당 불가
```

| 키워드     | 특징                |
| ------- | ----------------- |
| `var`   | 함수 스코프, 중복 선언 가능  |
| `let`   | 블록 스코프, 중복 선언 불가  |
| `const` | 블록 스코프, 상수(변경 불가) |

### 데이터 타입

JavaScript는 기본적으로 두 가지 데이터 타입을 지원한다.

1. **원시 타입(Primitive Type)**: `string`, `number`, `boolean`, `null`, `undefined`, `symbol`
2. **참조 타입(Reference Type)**: `object`, `array`, `function`

``` javascript
let str = "HelloWorld";  // string
let num = 12;       // number
let isTrue = true;  // boolean
let obj = { name: "JohnSiNa", age: 30 };  // object
```

### 조건문

조건문을 통해 프로그램의 흐름을 제어할 수 있다.

``` javascript
if (age > 18) {
  console.log("Adult");
} else {
  console.log("Minor");
}
```

### 반복문

반복문은 특정 조건이 만족될 때까지 코드를 반복 실행한다.

``` javascript
for (let i = 0; i < 5; i++) {
  console.log(i);  // 0부터 4까지 출력
}
```

### 함수 선언

JavaScript에서는 함수를 선언하고 호출하여 코드를 재사용할 수 있다.

``` javascript
// 일반 함수 선언
function greet(name) {
  return `Hello, ${name}!`;
}

// 람다식(화살표 함수)로 선언
const greetArrow = (name) => `Hello, ${name}!`;

console.log(greet("John"));        // 일반 함수 호출 -> Hello, John!
console.log(greetArrow("Doe"));    // 화살표 함수 호출 -> Hello, Doe!
```

### 객체

객체는 key-value 쌍으로 이루어진 데이터를 저장하는 데 사용됩니다.

``` javascript
let person = {
  name: "JohnSiNa",
  age: 30,
  greet: function() {
    console.log("Hello!");
  }
};
```

### 배열

배열은 여러 값을 순서대로 저장하는 리스트이다.

``` javascript
let numbers = [1, 2, 3, 4, 5];
console.log(numbers[0]);  // 1 출력
```

### 비동기 처리

비동기 작업을 처리할 때는 `Promise` 또는 `async/await`을 사용할 수 있다.

``` javascript
fetch('https://api.example.com/data')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));

// async/await 예시
async function getData() {
  try {
    const response = await fetch('https://api.example.com/data');
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error('Error:', error);
  }
}
```

---

## JavaScript의 발전

JavaScript는 처음에는 웹 페이지의 간단한 동적 요소를 추가하는 용도로 시작했지만, **Ajax** 기술과 함께 웹 애플리케이션의 핵심 기술로 자리 잡게 되었다.
또한 **Node.js**의 등장으로 서버 측 프로그래밍에도 사용되며, **프론트엔드와 백엔드**를 모두 다룰 수 있는 **범용 언어**로 성장했다.

---

## 결론

JavaScript는 웹 개발에서 필수적인 언어로, **클라이언트**와 **서버** 측에서 모두 사용 가능하며 다양한 프레임워크와 라이브러리를 통해 빠르게 확장할 수 있다.
