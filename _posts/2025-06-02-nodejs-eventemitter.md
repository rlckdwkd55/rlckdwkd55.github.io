---
title: "Node.js EventEmitter란?"
date: 2025-06-02
categories: [Web]
tags: [nodejs, eventemitter, async]
description: "Node.js의 이벤트 기반 비동기 모델을 구성하는 EventEmitter"
image:
  path: /assets/img/thumbnails/nodejs-eventemitter.png
---

## Node.js EventEmitter란?

**Node.js**는 비동기 이벤트 기반 아키텍처를 바탕으로 다양한 비동기 작업을 처리하는 데 적합한 **JavaScript 런타임**이다.
이 비동기 이벤트 기반 시스템을 구현하는 핵심 요소 중 하나가 바로 **EventEmitter**.
**EventEmitter**는 **이벤트**를 발생시키고(**emit**), 해당 이벤트를 처리하는 **리스너**를 등록하여 **비동기 작업**을 처리할 수 있다.

---

### EventEmitter의 장점과 단점

#### 장점

- **비동기 프로세스 제어**: **이벤트 기반 프로그래밍**을 통해 작업이 완료될 때 이벤트를 발생시키고 처리할 수 있어, 비동기 작업의 흐름을 제어하는 데 적합하다.
- **모듈 간 결합도 감소**: 모듈 간 통신을 위해 **이벤트 기반 구조**를 사용하므로, 서로 의존하지 않고도 독립적으로 동작하는 모듈을 설계할 수 있다.
- **확장성**: 새로운 이벤트 리스너를 쉽게 추가하여 시스템 확장이 용이하다. 이는 대규모 애플리케이션에서 유연성을 극대화할 수 있다.

#### 단점

- **디버깅의 어려움**: 이벤트 기반 구조는 여러 리스너가 비동기적으로 호출되기 때문에, **디버깅**과 **문제 추적**이 어려울 수 있다.
- **복잡도 증가**: 이벤트 수가 많아질수록 **코드 복잡성**이 증가하여 코드 유지보수가 어려워질 수 있다.

---

### 주요 특징

#### 1. **이벤트 기반 비동기 프로그래밍**

**EventEmitter**는 **이벤트 기반** 비동기 프로그래밍이 가능하다.
Node.js는 비동기 I/O를 기본으로 하기 때문에, 작업이 끝나면 이벤트를 발생시켜야 하며, 이에 대한 리스너가 이벤트를 처리하게 된다.

##### 예시 코드:

```javascript
const EventEmitter = require('events');
const eventEmitter = new EventEmitter();

eventEmitter.on('dataReceived', () => {
    console.log('데이터가 성공적으로 수신되었습니다.');
});

eventEmitter.emit('dataReceived');
```

위 코드에서는 `dataReceived`라는 이벤트를 발생시키면, 등록된 리스너가 이를 수신하여 콘솔에 메시지를 출력한다.

#### 2. **`emit`과 `on` 메서드**

- **`emit`**: 이벤트를 발생시킬 때 사용하며, 추가 데이터를 전달할 수도 있다.
- **`on`**: 특정 이벤트에 대해 리스너를 등록한다. 이벤트가 발생하면 해당 리스너가 실행된다.

---

### EventEmitter의 기본 사용법

#### 1. **EventEmitter 인스턴스 생성**

**`events` 모듈**에서 **EventEmitter** 클래스를 가져와 인스턴스를 생성한다.
이 인스턴스는 이벤트를 발생시키고, 리스너를 등록하는 역할을 한다.

```javascript
const EventEmitter = require('events');
const eventEmitter = new EventEmitter();
```

#### 2. **이벤트 리스너 등록**

**`on()`** 메서드를 사용하여 특정 이벤트에 대해 리스너를 등록할 수 있다.
해당 이벤트가 발생하면 리스너가 호출된다.

```javascript
eventEmitter.on('start', () => {
    console.log('작업이 시작되었습니다.');
});
```

#### 3. **이벤트 발생**

**`emit()`** 메서드를 사용하여 이벤트를 발생시킬 수 있다.
이벤트와 함께 필요한 데이터를 전달할 수도 있다.

```javascript
eventEmitter.emit('start');
```

이벤트 `start`가 발생하면, 이전에 등록된 리스너가 호출되어 '작업이 시작되었습니다'라는 메시지가 출력.

---

### 실전 예제: Job Queue 시스템에서의 EventEmitter 사용

EventEmitter는 특히 **Job Queue 시스템**에서 유용하게 사용된다.
**Job Generator**가 작업을 생성하고, **Job Executor**가 해당 작업을 처리하는 구조에서 EventEmitter는 두 모듈 간의 통신을 처리하는 역할을 한다.

#### 1. **Job Generator**: 작업을 생성하고 이벤트를 발생시키는 모듈

```javascript
const eventEmitter = require('./eventEmitter');
const { saveJobToDB } = require('./db/jobDb');

async function createJob(jobType, siteId) {
    const job = {
        type: jobType,
        siteId: siteId,
        status: 'pending',
        createdAt: new Date()
    };

    const savedJob = await saveJobToDB(job);
    eventEmitter.emit('newJob', savedJob);
    return savedJob;
}

module.exports = { createJob };
```

**Job Generator**는 새로운 작업을 생성하고, 이를 **`emit`** 메서드를 통해 Job Executor에 전달한다.

#### 2. **Job Executor**: 작업을 처리하는 모듈

```javascript
const eventEmitter = require('./eventEmitter');
const { updateJobStatus } = require('./db/jobDb');

eventEmitter.on('newJob', async (job) => {
    try {
        await updateJobStatus(job.job_id, 'in-progress');
        // 작업 처리 로직...
        await updateJobStatus(job.job_id, 'completed');
    } catch (error) {
        await updateJobStatus(job.job_id, 'failed');
    }
});
```

**Job Executor**는 **`on()`** 메서드를 사용하여 **`newJob`** 이벤트를 수신하고, 해당 작업을 처리하는 리스너를 등록한다.

---

### EventEmitter 실전 사용 예: 웹 크롤러 시스템

**웹 크롤러 시스템**에서 EventEmitter를 사용하여 **비동기 작업 처리**를 구현할 수 있다.
예를 들어, Job Queue를 통해 **RSS 크롤링** 작업을 생성하고, EventEmitter를 통해 **Job Executor**가 크롤링을 실행하는 구조를 생각해볼 수 있다.

#### 1. Job Generator

```javascript
const { saveJobToDB } = require('../db/jobDb');
const eventEmitter = require('../events/eventEmitter');

async function createJob(jobType, siteId) {
    const job = {
        type: jobType,
        siteId: siteId,
        status: 'pending',
        createdAt: new Date()
    };

    const savedJob = await saveJobToDB(job);
    eventEmitter.emit('newJob', savedJob);
    return savedJob;
}

module.exports = { createJob };
```

#### 2. Job Executor

```javascript
const eventEmitter = require('../events/eventEmitter');
const { updateJobStatus } = require('../db/jobDb');
const crawlRSS = require('../crawlers/rssCrawler');

eventEmitter.on('newJob', async (job) => {
    try {
        await updateJobStatus(job.job_id, 'in-progress');
        if (job.type === 'RSS') {
            await crawlRSS([job.site_id]);
        }
        await updateJobStatus(job.job_id, 'completed');
    } catch (err) {
        await updateJobStatus(job.job_id, 'failed');
    }
});
```

---

### EventEmitter와 Node.js의 비동기 프로그래밍

**Node.js의 이벤트 기반 비동기 모델**은 **EventEmitter**를 통해 극대화된다.
Node.js가 **싱글 스레드**에서 비동기 작업을 효율적으로 처리하는 이유 중 하나는 EventEmitter의 사용 덕분이며, 작업이 완료되면 이벤트가 발생하고, 이에 대한 리스너가 이를 처리하는 방식으로 **논블로킹 I/O**를 구현한다.

#### 예시 코드: 비동기 파일 읽기

```javascript
const fs = require('fs');
const EventEmitter = require('events');
const eventEmitter = new EventEmitter();

fs.readFile('example.txt', 'utf8', (err, data) => {
    if (err) throw err;
    eventEmitter.emit('fileRead', data);
});

eventEmitter.on('fileRead', (data) => {
    console.log('파일 내용:', data);
});
```

---

## 결론

**EventEmitter**는 Node.js 애플리케이션에서 **비동기 이벤트 처리**를 구현하는 데 중요한 역할을 한다.
특히 **비동기 I/O**와 **비동기 작업 흐름 제어**가 필요한 상황에서 매우 유용하며, **Job Queue 시스템**, **실시간 애플리케이션** 등 다양한 상황에서 널리 사용된다.
