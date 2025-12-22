---
title: "Spring Scheduler"
date: 2025-06-07
categories: [Spring]
tags: [scheduler]
description: "Spring Scheduler의 개념과 설정 방식, Quartz 및 Java 스케줄러와의 비교"
image:
  path: /assets/img/thumbnails/scheduler.png
---

## 1. Spring Scheduler란?

Spring Scheduler는 애플리케이션에서 정기적인 작업을 자동으로 실행할 수 있게 해주는 도구로, 특정 시간이나 주기에 작업을 수행해야 할 때 유용하다.
예를 들어, 매일 자정에 데이터 백업을 하거나, 특정 시간마다 로그를 정리하는 등 자동화 작업에 활용할 수 있다.

---

### 2. Spring Scheduler 설정 방식

#### A. `@EnableScheduling`

Spring 환경에서 `@EnableScheduling` 어노테이션을 통해 간단하게 스케줄러 기능을 활성화할 수 있다. 이 어노테이션을 클래스에 추가하면 해당 애플리케이션에서 전역적으로 스케줄링 기능이 활성화된다.

- **사용 시기**: 단순하고 주기적인 작업을 처리해야 할 때
- **장점**: 설정이 간단하고 빠르게 적용 가능

##### 예제 코드 설명

`@EnableScheduling`을 사용해 스케줄러를 활성화한 후, 주기적인 작업이 필요한 메서드에 `@Scheduled` 어노테이션을 붙인다. `@Scheduled`는 `fixedRate`, `fixedDelay`, `cron`과 같은 속성을 사용해 작업 간격을 설정할 수 있다.

```java
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration
@EnableScheduling // 스케줄러 활성화
public class SimpleScheduler {

    @Scheduled(fixedRate = 60000) // 매 60초마다 실행
    public void performFixedRateTask() {
        System.out.println("고정 간격으로 작업 수행 중...");
    }

    @Scheduled(cron = "0 0 0 * * ?") // 매일 자정에 실행
    public void performCronTask() {
        System.out.println("매일 자정에 수행되는 작업");
    }
}
```

위 코드에서 `fixedRate` 속성은 고정된 간격(60초)을 설정하고, `cron`은 자정에 작업을 수행하도록 지정한다. 간단한 주기 작업을 구현할 때 적합하다.

#### B. `Quartz Scheduler`

Quartz Scheduler는 복잡한 스케줄링 요구 사항을 충족할 수 있는 고급 도구이다. 다중 트리거 설정이 가능해 `@EnableScheduling`이나 `@Scheduled`로는 처리하기 어려운 조건을 다룰 때 적합하다.

- **사용 시기**: 다중 트리거 또는 고도의 스케줄 관리가 필요할 때
- **장점**: 유연한 트리거 조건과 고급 스케줄링 기능 제공

##### 예제 코드 설명

Quartz에서 작업은 `Job` 인터페이스를 구현한 클래스로 정의되며, 각 작업은 `JobDetail`과 `Trigger`로 등록된다. Spring에서는 `SchedulerFactoryBean`을 통해 Quartz를 쉽게 설정할 수 있다.

```java
import org.quartz.Job;
import org.quartz.JobExecutionContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.quartz.CronTriggerFactoryBean;
import org.springframework.scheduling.quartz.JobDetailFactoryBean;
import org.springframework.scheduling.quartz.SchedulerFactoryBean;

public class MyQuartzJob implements Job {
    @Override
    public void execute(JobExecutionContext context) {
        System.out.println("Quartz 작업 실행 중...");
    }
}

@Configuration
public class QuartzSchedulerConfig {

    @Bean
    public JobDetailFactoryBean jobDetail() {
        JobDetailFactoryBean factoryBean = new JobDetailFactoryBean();
        factoryBean.setJobClass(MyQuartzJob.class);
        factoryBean.setDescription("Quartz Job Example");
        return factoryBean;
    }

    @Bean
    public CronTriggerFactoryBean trigger(JobDetailFactoryBean jobDetail) {
        CronTriggerFactoryBean trigger = new CronTriggerFactoryBean();
        trigger.setJobDetail(jobDetail.getObject());
        trigger.setCronExpression("0 0 12 * * ?"); // 매일 정오에 실행
        return trigger;
    }

    @Bean
    public SchedulerFactoryBean scheduler(CronTriggerFactoryBean trigger) {
        SchedulerFactoryBean scheduler = new SchedulerFactoryBean();
        scheduler.setTriggers(trigger.getObject());
        return scheduler;
    }
}
```

위 코드에서 Quartz 스케줄러는 매일 정오에 작업을 실행하도록 설정되었다.
복잡한 트리거 조건이 필요한 경우 Quartz가 매우 유용하다.

#### C. `ScheduledExecutorService`

`ScheduledExecutorService`는 Java 표준 라이브러리로 제공되는 스케줄링 도구이며, Spring을 사용하지 않거나 독립적으로 스케줄링 기능을 구현할 때 적합하다.

- **사용 시기**: Spring 의존성을 피하고 순수 Java로 구현해야 할 때
- **장점**: Java 표준 라이브러리로 Spring과 독립적이며 간단하게 사용 가능

##### 예제 코드 설명

`ScheduledExecutorService`는 `scheduleAtFixedRate`와 `scheduleWithFixedDelay` 메서드를 제공하여 특정 간격으로 실행되는 작업을 설정할 수 있다.

```java
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class JavaScheduler {

    public static void main(String[] args) {
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);

        scheduler.scheduleAtFixedRate(() -> System.out.println("고정된 간격으로 실행 중..."),
                                      0, 10, TimeUnit.SECONDS);

        scheduler.scheduleWithFixedDelay(() -> System.out.println("고정된 지연 후 실행 중..."),
                                         0, 15, TimeUnit.SECONDS);
    }
}
```

이 예제에서는 `scheduleAtFixedRate`와 `scheduleWithFixedDelay`를 사용하여 각기 다른 주기로 작업을 수행하도록 설정했다.
스케줄링이 필요하지만 Spring을 사용할 수 없는 환경에서 활용하기 좋다.

#### D. XML 설정 방식

XML 설정 방식은 XML 기반으로 프로젝트를 구성할 때, 스케줄러 기능을 손쉽게 활성화할 수 있는 방법이다. XML 설정을 통해 `task:annotation-driven`을 활성화하면 `@Scheduled` 어노테이션을 사용할 수 있게 된다.

- **사용 시기**: XML 설정 기반 프로젝트에서 일관성을 유지할 때
- **장점**: 기존 XML 설정과의 일관성 유지

##### XML 설정을 통한 Scheduler 활성화 예시

아래는 XML 설정 파일을 통한 스케줄러 활성화와 빈 등록 예시이다. XML 설정 기반 프로젝트에서 주로 사용된다.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:task="http://www.springframework.org/schema/task"
       xsi:schemaLocation="
           http://www.springframework.org/schema/beans https://www.springframework.org/schema/beans/spring-beans.xsd
           http://www.springframework.org/schema/task https://www.springframework.org/schema/task/spring-task.xsd">

    <!-- 스케줄링 활성화 -->
    <task:annotation-driven/>

    <!-- 스케줄링 할 Bean 등록 -->
    <bean id="myScheduledTask" class="com.example.MyScheduledTask"/>

</beans>
```

이 설정을 통해 `task:annotation-driven`이 스케줄러 기능을 활성화하고, 스케줄 작업이 `@Scheduled`을 통해 실행된다.

##### XML 방식의 구현 방법

XML 설정을 통해 등록된 빈에서 `@Scheduled` 어노테이션을 사용해 간단한 작업을 주기적으로 수행할 수 있다.

```java
package com.example;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class MyScheduledTask {

    @Scheduled(cron = "0 0 0 * * ?")
    public void performTask() {
        System.out.println("매일 자정에 수행되는 작업");
    }
}
```

이와 같이 `MyScheduledTask` 클래스에서 `@Scheduled` 어노테이션을 사용하면 매일 자정마다 `performTask` 메서드가 실행된다.
XML 설정과 코드 설정이 결합하여 간단하게 스케줄링 작업을 구현할 수 있다.

---

### 3. Spring Scheduler 설정 방식 비교

|설정 방식|특징 및 사용 시기|
|---|---|
|`@EnableScheduling` 사용|Spring Boot 프로젝트에서 간단하고 빠른 설정|
|XML 설정 사용|XML 기반의 기존 프로젝트에서 스케줄러 설정이 필요할 때|
|`ScheduledExecutorService` 사용|Spring 외부에서 독립적으로 스케줄링이 필요할 때|
|Quartz Scheduler 사용|복잡한 트리거 조건이나 고급 스케줄이 필요할 때|
