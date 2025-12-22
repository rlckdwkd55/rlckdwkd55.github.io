---
title: "Docker 설치"
date: 2025-04-28
categories: [DevOps]
tags: [docker, wsl2, docker-desktop]
description: "Windows 환경에서 WSL2와 Docker Desktop을 이용한 Docker 설치 방법"
image:
  path: /assets/img/thumbnails/docker.png
---

## WSL2 설치

### WSL2 (Windows Subsystem For Linux 2)와 Hyper-V

WSL과 Hyper-V는 모두 Windows 환경에서 다른 운영 체제를 실행하게 해주는 기술이지만, 사용 목적과 방식에 차이가 있다.
WSL은 Linux 환경을 Windows 내에서 효율적으로 사용할 수 있게 해주는 반면, Hyper-V는 여러 다양한 운영 체제를 완전히 분리된 환경에서 실행할 수 있게 해준다.

Windows 10/11 Professional / Education / Enterprise 에디션
- WSL2 기반 Docker Engine 사용 가능
- Hyper-V 기반 Docker Engine 사용 가능
  Windows 10/11 Home 에디션
- WSL2 기반 Docker Engine 사용 가능

#### WSL이란?

- WSL은 Windows Subsystem for Linux 2의 줄임말로 윈도우에서 리눅스를 사용할 수 있게 해주는 기능이다.
- Home 에디션의 경우 Docker를 사용하려면 WSL2가 필수이다.
- Pro 사용자의 경우 WSL2를 사용하지 않더라도 Hyper-V 기반 가상화를 사용해 Docker Engine을 사용하는 것이 가능하다.

#### Hyper-V란?

- Hyper-V는 마이크로소프트가 개발한 가상화 플랫폼으로, 하나의 물리적 컴퓨터에서 여러 운영 체제를 동시에 실행할 수 있게 해준다.
- 각 운영 체제는 독립적인 가상 머신으로 실행되며, 이는 각자 별도의 시스템 리소스를 가지고 독립적으로 작동한다.
  
<br>

### WSL2 설치하기

#### 1. 관리자 권한으로 Windows PowerShell을 실행한다.

![](/assets/img/posts/docker/wsl-powershell-admin.png)


#### 2. PowerShell에 다음 명령어를 입력하여 WSL2를 설치한다.

``` shell
$ wsl --install
```

![](/assets/img/posts/docker/wsl-install-command.png)

- 설치 후 Windows 재부팅


#### 3. 재부팅 후 username, password설정을 해준다.

![](/assets/img/posts/docker/wsl-user-setup.png)

<br>

### 설치 확인

- username과 password설정까지 완료했다면 아래 명령어를 입력하여 WSL정보를 확인할 수 있다.

``` shell
$ wsl -v
```

- WSL에 설치된 배포판과 설정된 버전확인은 아래 명령어다.

``` shell
$ wsl -l -v
```


![](/assets/img/posts/docker/wsl-version-check.png)

<br>

## Windows에 Docker Desktop설치

### Docker Desktop 설치하기

- WSL을 설치했다면 Docker Desktop을 설치하자
- https://www.docker.com/ 여기서 다운로드 할 수 있다.

#### 1. 홈페이지 접속

![](/assets/img/posts/docker/docker-desktop-download.png)

- 홈페이지 접속 후 해당 버튼을 클릭해 다운로드 한다.


#### 2. 설치

![](/assets/img/posts/docker/docker-desktop-install.png)

![](/assets/img/posts/docker/docker-desktop-restart.png)

- 설치가 완료되면 Close and restart를 눌러 재부팅을 해준다.


![](/assets/img/posts/docker/docker-desktop-license.png)

- 재 부팅 후 첫 실행을 하면 해당 화면이 나오는데 Accept를 눌러준다.

![](/assets/img/posts/docker/docker-desktop-setup-skip.png)

- 사용 목적에 맞게 체크해도 되지만 Skip을 클릭해도 무방하다.

![](/assets/img/posts/docker/docker-desktop-done.png)

위 과정을 지나면 Docker Desktop 설치가 완료된다.
<br><br><br><br><br><br><br><br><br><br>
참고 : https://with-rl.tistory.com/entry/Windows%EC%97%90-Docker-Desktop-%EC%84%A4%EC%B9%98%ED%95%98%EA%B8%B0
