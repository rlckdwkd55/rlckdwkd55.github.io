// 프로젝트 추가/수정은 이 파일만 편집하면 됩니다.
export const PROJECTS = [
  {
    icon: 'fa-cube',
    ownerType: 'company',
    ownerLabel: '웨어비즈',
    tech: ['Python', 'FastAPI', 'SQLAlchemy', 'LangChain', 'LangGraph', 'Qdrant', 'Next.js', 'Docker', 'Docker Compose'],
    resultIcon: 'fa-check-circle',
    title: 'Argos AI Chat Search',
    category: 'AI 챗봇 플랫폼',
    description: '· <strong>초기 멤버 2인</strong>으로 기획부터 배포까지 전 주기 담당<br>· LangGraph Supervisor 멀티에이전트 + Qdrant 하이브리드 벡터 검색 + CrossEncoder 리랭킹 구현<br>· 시나리오 에이전트로 LLM 호출 없이 즉시 응답 — 운영 비용 절감·응답 지연 최소화<br>· FastAPI DDD 구조 멀티테넌트 REST API + Next.js 관리자 대시보드·임베더블 챗봇 위젯 풀스택 개발',
    result: 'GS SW 1등급 인증 취득(TTA, 2026.06). 저작권 등록(2026.03). 공공기관(검단구 도프네트웍) 납품.',
    links: [
      { type: 'private' }
    ]
  },
  {
    icon: 'fa-layer-group',
    ownerType: 'company',
    ownerLabel: '웨어비즈',
    tech: ['Java', 'Spring Boot', 'Elasticsearch', 'Redis', 'Apache Tika', 'Docker', 'Docker Compose'],
    resultIcon: 'fa-chart-line',
    title: 'ArgosSearch',
    category: '엔터프라이즈 검색 엔진',
    description: '· 안전보건공단·CJ 온리원푸드넷·고령군청 등 공공기관·기업 대상 실운영 검색 엔진 유지보수<br>· 한글 자동완성·오타교정·동의어·불용어·연관검색어 등 검색 핵심 기능 개선<br>· Apache Tika 문서 파싱 파이프라인(PDF·Word·Excel) 운영 및 다중 외부 DB 연동 유지보수<br>· 커넥션 풀 고갈·색인 누락 등 실운영 장애 원인 분석·해결',
    result: '실운영 장애 분석·해결로 공공기관·기업 고객사(안전보건공단·CJ 온리원푸드넷·고령군청 외) 검색 엔진 안정적 운영 유지.',
    links: [
      { type: 'private' }
    ]
  },
  {
    icon: 'fa-bolt',
    ownerType: 'company',
    ownerLabel: '케니컴퍼니',
    tech: ['Java', 'Spring Boot', 'Node.js', 'MyBatis', 'PostgreSQL', 'FCM'],
    resultIcon: 'fa-check-circle',
    title: '캐치캣',
    category: '크롤링 & 알림 서비스',
    description: '· 700개 이상 사이트 대상 일 3,000건 규모 크롤링 시스템 구축<br>· Node.js 크론 스케줄러 + FCM 연동 실시간 알림 시스템 구현<br>· Proxy 구조로 CORS 차단 우회 — 안정적 수집 환경 확보<br>· Spring Boot 기반 관리자 페이지 개발 및 Node.js 백엔드 연동',
    result: '700개 이상 사이트 대상 일 3,000건 규모 크롤링·FCM 알림 서비스 개발 완료. (회사 경영 사정으로 실서비스 운영 전 종료)',
    links: [
      { type: 'private' },
      { type: 'media', href: 'https://drive.google.com/file/d/1SojMqE4ybqAMY4CPfOlmJI8Bv20y2Xst/view' }
    ]
  },
  {
    icon: 'fa-bus',
    ownerType: 'company',
    ownerLabel: '케니컴퍼니',
    tech: ['Java', 'Spring Boot', 'MyBatis', 'Oracle', 'JSP', 'Apache POI'],
    resultIcon: 'fa-check-circle',
    title: 'GBMS',
    category: '경기도 버스 매니지먼트 시스템',
    description: '· 전자정부프레임워크 기반 경기도 광역 버스 운영 관리 시스템 유지보수<br>· SXSSFWorkbook 스트리밍 방식으로 대용량 엑셀 다운로드 신규 개발 — 응답 속도 대폭 개선<br>· 초기 화면 배너 UI 개선 및 이미지 관리 기능(업로드·삭제·미리보기) 신규 개발<br>· API 응답 최적화, JSP 레거시 코드 유지보수',
    result: '경기도 광역 버스 운영 현장 납품 운영 중.',
    links: [
      { type: 'private' },
      { type: 'site', href: 'https://gbms.gg.go.kr/' }
    ]
  },
  {
    icon: 'fa-bus',
    ownerType: 'company',
    ownerLabel: '케니컴퍼니',
    tech: ['Java', 'Spring Boot', 'MyBatis', 'PostgreSQL', 'JSP', 'Apache POI'],
    resultIcon: 'fa-check-circle',
    title: '버스파인',
    category: '공공 버스 행정 시스템',
    description: '· 전자정부프레임워크 기반 경기도 시내버스 행정 시스템(용인·파주·하남 등) 유지보수<br>· SXSSFWorkbook 스트리밍 방식으로 대용량 엑셀 다운로드 신규 개발 — 응답 속도 대폭 개선<br>· 공공기관 요청 기능 변경·예외 처리 로직 보강 및 QC 피드백 대응<br>· UI 편의성 개선 및 협업 중심 문서화 수행',
    result: '경기도 시내버스 행정 기관(용인·파주·하남 등) 납품 완료. 현재 운영 중.',
    links: [
      { type: 'private' },
      { type: 'site', href: 'https://busfine.gtrans.or.kr/home' }
    ]
  },
  {
    icon: 'fa-shopping-cart',
    ownerType: 'personal',
    ownerLabel: null,
    tech: ['Java', 'Spring Boot', 'MyBatis', 'PostgreSQL', 'AWS EC2', 'OAuth 2.0'],
    resultIcon: 'fa-check-circle',
    title: '술술 — 온라인 전통주 쇼핑몰',
    category: '이커머스 (개인 프로젝트)',
    description: '· Spring Boot 기반 회원·장바구니·주문 백엔드 설계 및 구현<br>· 카카오·네이버 소셜 로그인(OAuth 2.0) 및 결제 API 연동<br>· HikariCP 커넥션 풀 설정 및 N+1 문제 해결을 포함한 쿼리 최적화<br>· AWS EC2 배포 및 운영 환경 구성',
    result: '소셜 로그인·결제 연동까지 완성한 풀스택 쇼핑몰 단독 구현. GitHub 공개.',
    links: [
      { type: 'github', href: 'https://github.com/rlckdwkd55/SulSul' },
      { type: 'media', href: 'https://drive.google.com/file/d/1gzjefGhRO_p6A22L3OOAgt7gsozHCn6Y/view' }
    ]
  }
];
