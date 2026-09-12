# ⏱️ RealWage (실질 시급 계산기)

> 통근 시간과 대중교통 요금을 반영하여 내가 실제로 버는 **진짜 체감 시급**을 계산해 주는 크롬 확장 프로그램입니다.

---

**📌 프로젝트 소개 (Overview)**

구직 과정에서 표기된 시급만 보고 지원했다가 **긴 통근 시간과 왕복 교통비** 때문에 실질 소득이 낮아지는 문제를 해결하기 위해 개발되었습니다.

웹 브라우저에서 알바 공고를 조회할 때, 사용자의 집 주소와 근무지 주소 간의 이동 시간 및 교통비를 자동으로 계산하여 **실제 노동 가치에 맞는 체감 시급**을 화면에 바로 시각화해 줍니다.

(사진) *실제 알바몬 공고 페이지 실행 화면 캡처*

---

**💡 주요 기능 (Key Features)**

* **사용자 집 주소 설정 (Chrome Storage)**
* 확장 프로그램 팝업 UI를 통해 사용자의 출발지(집 주소)를 간편하게 등록 및 저장합니다.


* **공고 정보 자동 추출 (DOM Parsing)**
* 알바 상세 공고 페이지 접속 시 근무지 주소, 공고 시급, 일 근무 시간을 자동으로 읽어옵니다.


* **실시간 통근 거리 및 요금 산출 (Location API)**
* 출발지와 목적지 좌표를 기반으로 왕복 이동 소요 시간과 대중교통 요금을 계산합니다.


* **체감 시급 렌더링 (UI Injection)**
* 원래 공고의 시급 표기 옆에 계산된 **실질 시급 및 기회비용 리포트**를 이질감 없이 덧붙여 띄워줍니다.



---

**🧮 체감 시급 산출 공식 (Formula)**

$$\text{실질 시급} = \frac{(\text{공고 시급} \times \text{일 근무시간}) - \text{왕복 교통비}}{\text{일 근무시간} + \text{왕복 이동시간}}$$

---

**🏗️ 시스템 아키텍처 (Architecture)**

(아키텍처) *전체 시스템 흐름도 (Popup UI -> Storage -> Content Script -> Kakao API -> DOM Injection)*

```
[Popup UI] ──(집 주소 저장)──> [chrome.storage.local]
                                       │
                                       ▼
[알바 공고 Page] ──(DOM Parsing)──> [Content Script]
                                       │
                                       ├──> [Kakao / ODsay API] (이동시간/교통비 수신)
                                       │
                                       ▼
                             [실질 시급 수식 계산]
                                       │
                                       ▼
                             [알바 공고 UI 렌더링]

```

---

**🛠️ 기술 스택 (Tech Stack)**

* **Frontend / Extension:** JavaScript (ES6+), HTML5, CSS3, Chrome Extension Manifest V3
* **API:** Kakao Mobility API / Kakao Local API (Geocoding & Route)
* **Storage:** Chrome Local Storage API

---

**🚀 시작 가이드 (Getting Started)**

**설치 방법 (Installation)**

1. 본 리포지토리를 클론(Clone)하거나 ZIP 파일로 다운로드합니다.
```bash
git clone https://github.com/your-username/real-wage-calculator.git

```


2. Chrome 브라우저를 열고 `chrome://extensions/` 로 이동합니다.
3. 우측 상단의 '개발자 모드'를 활성화합니다.
4. 좌측 상단의 **'압축해제된 확장 프로그램을 로드합니다'** 버튼을 클릭합니다.
5. 다운로드한 프로젝트 폴더를 선택합니다.

**사용 방법 (How to Use)**

1. 브라우저 우측 상단 확장 프로그램 목록에서 **[RealWage]** 아이콘을 클릭합니다.
2. 팝업 창에 **내 집 주소**를 입력하고 저장합니다.
3. 알바몬 또는 알바천국 공고 상세 페이지에 접속합니다.
4. 시급 표기 영역에 새롭게 뜬 **[체감 시급 분석]** 결과를 확인합니다.

---

**👥 팀원 소개 (Team)**

| 이름 | 역할 | 담당 업무 |
| --- | --- | --- |
| **홍길동** | Lead / Front-end | Chrome Extension DOM 파싱, Content Script 및 렌더링 UI 구현 |
| **김철수** | Back-end / API | Kakao Location API 연동, 통근 시간 및 실질 시급 계산 로직 개발 |