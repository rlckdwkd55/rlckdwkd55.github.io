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

![](/assets/img/posts/vision/detection/overview.png)

---

### Detection의 출발점: 규칙기반 컴퓨터 비전
딥러닝 이전의 Detection은 학습 모델이 아닌 **규칙과 수식 기반 컴퓨터 비전 기법** 중심이었고,
텍스트 검출에서도 다음과 같은 방식들이 사용되었다.

- 이진화(Thresholding)
- 연결 성분 분석(Connected Component)
- MSER (Maximally Stable Extremal Regions)
- SWT (Stroke Width Transform)

이 방식들의 공통된 전제는 다음과 같다.
> 객체(또는 글자)는 배경과 구분되는 시각적 규칙을 가진다.

이 접근은 학습데이터가 필요 없고 구현이 단순하다는 장점이 있었지만<br>
배경이 복잡해질수록 성능이 급격히 저하되고 조명, 회전, 원근, 폰트 변화에 매우 취약했다.

결국 Detection은 **데이터를 통해 일반화하는 학습 기반 모델**로 전환되기 시작한다.

---

### Object Detection
CNN 기반 딥러닝이 발전하면서 Detection은 **Object Detection** 이라는 이름으로 정립된다.

Object Detection의 목표는 명확하다.
> 객체의 위치(Bounding Box)와 종류(Class)를 동시에 예측한다.

이 흐름에서 Faster R-CNN, SSD, YOLO 같은 모델들이 등장했고, <br>
이들은 사람, 차량, 동물과 같은 **일반 객체 검출에서 매우 성공적**이었다.

초기에는 텍스트 역시 "하나의 객체"로 보고 이 모델들을 그대로 적용하려는 시도도 많았다.

![](/assets/img/posts/vision/detection/object-detection-history.png)

---

#### 2-stage vs 1-stage 구조
Object Detection 모델은 구조적으로 2-stage와 1-stage로 나뉜다.

- **2-stage**: 후보 영역 생성 후 분류 및 박스 보정
- **1-stage**: 후보 단계 없이 한 번에 위치와 클래스를 예측

이 구조적 차이는 속도와 정확도에 영향을 주지만 <br>
여전히 공통 전제는 **Bounding Box 중심의 객체 표현**이다.

이 전제가 텍스트에서는 문제가 되기 시작한다.

---

#### Bounding Box 중심 접근의 한계
Detection 모델은 "박스를 어떻게 표현하느냐"에 따라 한계가 드러났다.<br>
일반 객체는 대부분 수평 박스로 충분했지만, 텍스트는 다음과 같은 특성을 가진다.

- 길쭉하고 얇은 형태
- 회전, 기울기, 원근 변화 빈번
- 경우에 따라 곡선 형태 존재

또한 SSD, YOLO 계열을 포함한 많은 Object Detector는 **Anchor box** 기반으로 설계되었다.

Anchor란 미리 정의된 박스를 기준으로 실제 객체와의 차이를 예측하는 방식인데, 문제는 텍스트의 형태다.

- 길이와 비율이 극단적으로 다양하고
- 이미지 내에서도 크기 편차가 크며
- 회전과 기울기까지 포함된다.

결과적으로 텍스트에 적절한 anchor를 설계하는 것 자체가 어렵고<br>
작은 텍스트 누락, 긴 텍스트 분할 실패, Recall 손실이 발생한다.

![](/assets/img/posts/vision/detection/bounding-box.png)

---

### Object Detection과 Text Detection

| 구분    | Object Detection | Text Detection |
| ----- | ---------------- | -------------- |
| 대상    | 사람, 차량 등         | 문자, 단어, 텍스트 라인 |
| 형태    | 비교적 일정           | 길쭉·얇음·비정형      |
| 방향    | 대부분 수평           | 회전·곡선 빈번       |
| 단위    | 객체 단일            | 문자 → 단어 → 라인   |
| 핵심 지표 | Precision        | Recall         |

Text Detection에서 Recall이 특히 중요한 이유는 명확하다.

Detection단계에서 놓치면 Recognition은 시작도 할 수 없고,<br>
텍스트는 일부 누락만으로도 문맥 전체가 붕괴된다.

Precision은 후처리로 보완할 수 있지만 **Recall은 Detection 단계에서만 확보 가능**하다.

이 문제를 해결하기 위해 등장한 관점은 다음과 같다.
> 텍스트는 "객체(Box)"가 아니라<br>
> 연속된 **영역(Region)** 으로 인식하는 것이 자연스럽다.

즉, 픽셀 단위로 텍스트 영역을 예측하고 이후 후처리로 박스나 폴리곤을 생성한다.

이 흐름에서 등장한 대표적인 모델이<br>
EAST, CRAFT, DBNet이다.

---

### Text Detection
**EAST**는 회전 텍스트를 다루기 위해
기하 정보(geometry)를 회귀하는 방식을 도입했다.
빠르고 단순하지만 붙어 있는 텍스트 분리에는 한계가 있다.

**CRAFT**는 문자 단위 접근을 통해
Character region과 문자 간 연결(Affinity)을 예측한다.
분리 성능은 뛰어나지만 후처리 의존도가 크다.

**DBNet**은 Segmentation 기반 방식의 고질적인 문제였던
임계값(threshold) 설정을 학습으로 해결했다.
확률 맵과 임계값 맵을 함께 예측해
실무에서 안정적인 성능을 보인다.

---

#### Segmentation 기반 Detection의 한계
Segmentation 기반 방식도 만능은 아니다.

매우 작은 글자에서 해상도 한계, 얇은 텍스트에서 마스크 단절, 후처리(Contour → Box)에 민감

그럼에도 불구하고 텍스트의 구조적 특성을 가장 잘 반영하기 때문에
현재 Text Detection의 주류로 자리 잡고 있다.

---

#### Detection과 Recognition의 연결 구조

Detection의 최종 출력은 Recognition(OCR) 모델로 전달될 Crop 영역이다.

Detection 박스가 부정확하면 글자가 잘리거나 배경이 과도하게 포함되어 Recognition 정확도에 직접적인 영향을 준다.

즉, Detection 성능은 OCR 전체 파이프라인의 상한선을 결정한다.

---

## 정리

Detection 모델은 규칙 기반 컴퓨터 비전에서 출발해
딥러닝 기반의 범용 Object Detection으로 발전했다.

그러나 텍스트는 일반 객체와 다른 구조적 특성을 가지기 때문에
Bounding Box, Anchor 기반 Object Detection으로는 한계가 드러났고,
결국 텍스트를 영역(Region)으로 인식하는
Segmentation 기반 Text Detection으로 분화되었다.

그 과정에서
EAST는 회전 문제를,
CRAFT는 문자 분리를,
DBNet은 임계값 문제를 해결하며
Text Detection의 실용성을 끌어올렸다.
