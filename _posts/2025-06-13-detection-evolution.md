---
title: "Detection 모델의 발전 흐름"
date: 2025-06-13
categories: [Computer Vision]
tags: [detection, text-detection, ocr]
description: "Detection 모델의 발전 흐름을 통해 Object Detection과 Text Detection의 분화를 정리한다."
image:
  path: /assets/img/thumbnails/detection-evolution.jpg
---

## 디텍팅(Detection) 모델의 발전 흐름
Detection(디텍팅)은 컴퓨터 비전에서 가장 기본적인 문제 중 하나다. <br>
이미지 안에서 **"어디에 무엇이 있는가"**를 찾아내는 것, 그 자체가 Detection의 출발점이다.

하지만 "무엇"의 종류에 따라 Detection의 난이도와 해결 방식은 크게 달라진다.

대표적으로 **일반 객체(Object)** 와 **텍스트(Text)** 는 같은 Detection 문제처럼 보이지만, <br> 
실제로는 발전 과정에서 전혀 다른 방향으로 분화되었다.

이 글에서는 다음 내용을 하나의 흐름으로 정리한다.

- Detection 모델이 어떤 방향으로 발전해 왔는지
- 그 과정에서 Object Detection과 Text Detection이 왜 갈라졌는지
- Text Detection에서 자주 언급되는 EAST / CRAFT / DBNet이
  각각 어떤 문제를 해결했는지



