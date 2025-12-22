---
title: "Spring Batch란?"
date: 2025-05-31
categories: [Spring]
tags: [spring-batch, batch]
description: "대용량 데이터 처리를 위한 Spring Batch의 개념과 구조 정리"
image:
  path: /assets/img/thumbnails/spring-batch.png
---

## 1. Spring Batch란?

데이터 집계, 정리, 분석 등 대용량의 데이터를 다루는 작업은 언제, 어디서, 어떻게 처리해야 할까?

웹 애플리케이션을 개발하며 주로 Tomcat이나 Spring MVC를 사용하는 개발자라면 이런 작업을 어떻게 처리해야 할지 고민될 수 있다.
대용량 데이터를 처리하는 일은 서버에 많은 부담을 주고, 이는 다른 요청들의 처리를 방해할 수 있고, 일일이 데이터를 집계하는 작업이 하루에 한 번만 이루어진다면, 전용 API를 구성하는 것은 비효율적일 수 있다.

이러한 문제를 효과적으로 해결하기 위해 **Spring Batch**가 등장했다.
Spring Batch는 대량의 데이터를 읽고, 처리하며, 저장하는 과정을 자동화하고, 신뢰성 있게 처리할 수 있도록 설계된 대용량 데이터 처리에 최적화된 배치 애플리케이션 프레임워크이다.

### Spring Batch 조건

Spring Batch는 다음과 같은 조건을 만족해야 한다.

- **대용량 데이터:** 대량의 데이터를 효율적으로 처리할 수 있어야 한다.
- **자동화:** 사용자의 개입 없이 실행되어야 한다. (단, 예외 상황의 해결은 제외)
- **견고성:** 오류 데이터를 안정적으로 처리할 수 있어야 한다.
- **신뢰성:** 처리 과정에서 발생하는 문제를 추적하고, 해결할 수 있어야 한다.
- **성능:** 지정된 시간 내에 처리를 완료하며, 다른 애플리케이션의 운영을 방해하지 않아야 한다.

### Spring Batch Architecture

![](/assets/img/posts/java/spring/spring-batch/spring-batch-architecture.jpg)

Spring Batch는 크게 세 가지 주요 구성 요소(Application Layer, Batch Core Layer, Batch Infrastructure Layer)로 구성되어 각각 독립적으로 동작하면서 배치 작업을 실행한다.

1. **Application 계층**

  - 이 계층은 개발자가 직접 구현하는 부분으로, Job, Step, ItemReader, ItemProcessor, ItemWriter, Tasklet 등 배치 작업(Job)을 구현하는데 필요한 인터페이스와 구현체가 포함된다.
  - 개발자는 이 계층에서 비즈니스 로직 구현에 집중할 수 있으며, 공통적인 기술적인 부분은 스프링 배치 프레임워크가 담당한다.
2. **Batch Core 계층**

  - 배치 작업을 시작하고 제어하는 데 필요한 핵심 기능을 제공하는 계층이다.
  - Job과 Step을 실행하는 데 필요한 인터페이스와 구현체, 데이터 처리와 관련된 ItemReader, ItemProcessor, ItemWriter 등의 기능을 포함한다.
  - 이 계층은 배치 작업의 실행과 제어에 필요한 중심적인 역할을 한다.
3. **Batch Infrastructure 계층**

  - Batch Core 계층에서 사용하는 인프라를 제공하는 계층이다.
  - 데이터베이스 접근과 같은 공통적인 인프라 기능을 제공하며, JobRepository와 같은 Batch Core 계층에서 사용하는 인터페이스와 구현체들을 포함한다.
  - 이 계층은 배치 작업의 실행을 지원하는 기반 구조를 제공하여, 개발자가 복잡한 인프라 관리에 대해 걱정하지 않도록 한다.

### Spring Batch 용어

![](/assets/img/posts/java/spring/spring-batch/spring-batch-terms.png)

#### Job

- **정의**: 배치 처리 과정을 하나의 단위로 만들어 놓은 것으로, 전체 계층 구조에서 최상단에 위치한다.
- **특징**: 하나 이상의 Step을 포함하며, 각 Step은 배치 작업의 일부분을 담당한다.

#### Step

- **정의**: Job 내의 배치 처리를 구체적으로 정의하고 순차적인 단계를 캡슐화한다.
- **특징**: Job은 최소한 하나 이상의 Step을 가져야 하며, Step은 실제 일괄 처리를 제어하는 모든 정보를 담고 있다.

#### Tasklet

- **정의**: Step에서 실행되는 최소 실행 단위이다.
- **특징**: 스프링에서 제공하는 Tasklet 인터페이스를 구현하여 사용하며, Tasklet이 실행 완료되면 Job의 다음 Step으로 넘어간다.

#### Chunk 지향 처리(Chunk-oriented Processing)

- **ItemReader**: Step에서 데이터(Item)를 읽어오는 인터페이스이며, 다양한 방법으로 Item을 읽어올 수 있다.
- **ItemProcessor**: Reader에서 읽어온 Item을 처리(변환, 필터링 등)하는 역할을 한다.
- **ItemWriter**: 처리된 데이터(Item)를 기록(저장)하며, 데이터는 Chunk 단위로 묶여서 처리된다.

#### JobRepository

- **정의**: 스프링 배치에서 Job의 실행 정보(상태, 성공/실패 등)를 저장하고 관리하는 데이터베이스이다.
- **특징**: JobLauncher에 의해 사용되며, 스프링에서는 기본적으로 메모리 기반의 JobRepository를 제공한다.

#### JobExecution

- **정의**: JobInstance에 대한 실행 시도를 나타내는 객체이다.
- **특징**: 실패 후 재실행 시 동일한 JobInstance에 대해 여러 JobExecution 객체가 생성될 수 있다.

#### JobInstance

- **정의**: Job의 실행 단위다.
- **예시**: 동일한 Job이 다른 시간에 실행될 때 각각의 실행은 별도의 JobInstance로 관리된다.

#### StepExecution

- **정의**: Step의 실행 시도를 나타내는 객체이다.
- **특징**: 실행과 관련된 세부 정보(읽기, 쓰기, 커밋, 스킵 수 등)를 포함한다.

#### ExecutionContext

- **정의**: Job 또는 Step에서 데이터를 공유할 수 있는 데이터 저장소이다.
- **특징**: JobExecutionContext와 StepExecutionContext 두 가지 유형이 있으며, 각각 Job과 Step의 범위로 데이터 공유가 가능하다.

#### JobParameters

- **정의**: JobInstance를 구별할 때 사용하는 매개변수다.
- **지원 형식**: String, Double, Long, Date 등의 다양한 타입을 지원한다.

#### JobLauncher

- **정의**: Job을 실행하는 인터페이스이다.
- **특징**: JobRepository에서 Job의 실행 정보를 읽어와 Job을 실행하고, 실행 결과를 JobRepository에 저장한다.
  
<br>

## 2. Spring Batch vs Quartz? Scheduler?

> **Spring Batch는 Scheduler가 아니기에 비교 대상이 아님.**

Spring Batch는 Batch Job을 관리하지만 Job을 구동하거나 실행시키는 기능은 지원하고 있지 않는다.
Spring에서 Batch Job을 실행시키기 위해서는 Quartz, Scheduler, Jenkins등 전용 Scheduler를 사용하여야 한다.

초기에 많은 사람들이 배치와 스케줄링을 비교하곤 하지만, 둘의 역할은 완전히 다르고 서로 상호 보완적이다.

- **배치(Batch):** 대용량 데이터에 대한 배치 처리
- **스케줄링(Schedule):** 특정 비즈니스 혹은 작업에 대해 일정 시간 동안 반복 실행

보통은 스케줄링 + 배치를 조합해서 사용하며, 정해진 스케줄마다 배치를 실행하는 구조라고 보면 된다.

### Spring Batch와 스케줄러의 통합 방법

1. **Quartz와의 통합:** Quartz 스케줄러는 Java로 작성된 강력한 스케줄링 시스템이다. Spring Batch 작업을 Quartz의 Job으로 등록하고, Quartz의 스케줄링 기능을 사용하여 Spring Batch Job을 주기적으로 실행할 수 있다.

2. **Spring Task Scheduler와의 통합:** Spring Framework 내장 스케줄러인 Spring Task Scheduler를 사용하여 Spring Batch 작업을 스케줄링할 수 있다. `@Scheduled` 어노테이션을 사용하여 간단하게 스케줄링 작업을 구현할 수 있으며, 이는 주로 간단한 스케줄링 요구사항에 적합하다.

3. **외부 스케줄링 시스템과의 통합:** Jenkins, Cron Job 등 외부 스케줄링 시스템을 사용하여 Spring Batch 작업을 스케줄링할 수 있다. 이러한 시스템들은 보다 복잡한 스케줄링 요구사항을 만족시키며, Spring Batch 작업 실행을 위한 외부 트리거로 작동한다.
   <br>

## 3. Spring Batch의 장점

- **유연성 및 확장성:** Spring Batch는 다양한 데이터 소스와 대용량 데이터 처리를 위해 유연하고 확장 가능한 구조를 제공한다.
- **효율적인 리소스 관리:** Spring Batch는 대용량 데이터 처리 시 리소스 사용을 최적화하고, 성능을 향상시키기 위한 다양한 기술(예: 청크 기반 처리, 페이징, 병렬 처리)을 제공한다.
- **오류 처리 및 재시도 기능:** Spring Batch는 실패한 작업의 재시도와 오류 데이터의 로깅, 스킵 등의 기능을 통해 높은 견고성과 신뢰성을 보장한다.
- **상세한 모니터링 및 로깅:** Spring Batch는 작업 실행의 상세한 모니터링 및 로깅 기능을 제공하여, 배치 처리의 성공 여부와 성능 분석을 용이하게 한다.





출처:
- https://ittrue.tistory.com/326
- https://azderica.github.io/01-spring-batch/
- https://khj93.tistory.com/entry/Spring-Batch%EB%9E%80-%EC%9D%B4%ED%95%B4%ED%95%98%EA%B3%A0-%EC%82%AC%EC%9A%A9%ED%95%98%EA%B8%B0
- https://medium.com/@itsinil/spring-batch%EB%A5%BC-%ED%86%B5%ED%95%9C-%EB%8C%80%EC%9A%A9%EB%9F%89-%EB%8D%B0%EC%9D%B4%ED%84%B0-%EC%95%88%EC%A0%84%ED%95%98%EA%B2%8C-%EC%B2%98%EB%A6%AC%ED%95%98%EA%B8%B0-d4940e71824b
