# 도토리주머니 v2 작업 보드

> 작성: 2026-09-29. 이 문서는 정적 티켓 보드입니다. 티켓이 진행될 때마다 상태와 리뷰 기록을 갱신합니다.
> 상태: `TODO` → `IN PROGRESS` → `IN REVIEW` → `DONE`. 브랜치는 `feat/ACORN-<번호>-<slug>` 규칙을 따르고, 리뷰 후 `main`에 `--no-ff`로 머지합니다.

## 목표 (요구사항 요약)

| # | 요구사항 | 담당 티켓 |
|---|---|---|
| R1 | 이미지 분석 속도·정확도 개선, Gemini 제외, 2026-09 기준 모델 사용 | ACORN-4 |
| R2 | 영역별 DOM 파싱 대신 페이지를 분석 가능한 구조로 한 번에 가져오기 (jev / crawl4ai 류 검토) | ACORN-5, ACORN-11 |
| R3 | 크레딧 과금 제거, 사용자 본인 계정(OpenAI·Claude, OAuth·CLI)으로 분석 | ACORN-2, ACORN-4, ACORN-6 |
| R4 | 서버에 저장되는 값 없음 | ACORN-2 |
| R5 | 수익 모델: 후원 + 광고(필수) | ACORN-8 |
| R6 | 다국어 필수, 외국 이미지 분석 | ACORN-3, ACORN-9 |
| R7 | 디자인 개선 | ACORN-10 |
| R8 | 속도·확장성·정확도, 프로덕트 급 품질 | 전 티켓 (테스트·CI·벤치마크) |

## 티켓

### ACORN-1 도구 기반 정비 — `DONE`
- 범위: 기존 타입 오류 2건 수정, pnpm 버전 고정(corepack 호환), Vitest 설정과 첫 테스트, GitHub Actions CI(typecheck·lint·test·build), lint 대상에서 빌드 산출물 제외, 작업 보드 작성.
- 완료 조건: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` 통과.

### ACORN-2 서버·크레딧·로그인 제거 — `DONE`
- 범위: `api/` Cloudflare Worker(D1 사용자·크레딧·분석 세션·이미지 URL 저장, 결제, OAuth 로그인) 삭제. 확장 쪽 로그인·크레딧·결제 UI와 `api-client`, `auth`, `useAuthStore`, `oauth-callback.html` 삭제. 미사용 의존성(`@google/genai`, `tesseract.js`) 제거.
- 완료 조건: 서버로 사용자 데이터를 보내는 코드 경로 0개. 번들 크기 감소 수치 기록.

### ACORN-3 데이터 계층 v5 + i18n 코어 + 계약 정의 — `IN REVIEW`
- 범위: Dexie v5 마이그레이션(행사 통화, 상품 통화·원문명·카테고리·옵션, 로컬 분석 캐시 테이블). 반응형 i18n 코어(언어 변경 즉시 반영, 네임스페이스별 메시지 파일, 영어 폴백). 통화·날짜 현지화 유틸. AI·캡처 공용 타입 계약.
- 완료 조건: v4→v5 마이그레이션 테스트, i18n 키 완전성 테스트.

### ACORN-4 AI 엔진 + 사용자 계정 기반 프로바이더 — `IN REVIEW`
- 범위: 프로바이더 어댑터(OpenAI, Anthropic, OpenRouter OAuth PKCE), 이미지 전처리(축소·재인코딩·해시), 단일 호출 구조화 출력(JSON Schema), 스트리밍 부분 결과, 로컬 캐시, 오류 분류. Gemini 미사용.
- 완료 조건: 벤치마크 픽스처에서 기존 대비 지연·정확도 수치 비교. 요청 빌더·파서 단위 테스트.

### ACORN-5 페이지 캡처 v2 — `IN REVIEW`
- 범위: 콘텐츠 스크립트가 현재 렌더링된 DOM을 구조화 스냅샷(본문·작성자·이미지·링크·메타데이터)으로 반환. 사이트별 추출기(X, Bluesky, 일반 페이지). 우클릭 대상 기억, 이미지 우클릭, 단축키, 사이드패널 캡처 버튼. `chrome.storage.session` 핸드오프(디스크에 흔적 없음).
- 완료 조건: DOM 픽스처 기반 추출 테스트.

### ACORN-6 로컬 CLI 브리지 (Claude Code / Codex) — `IN REVIEW`
- 범위: Native Messaging 호스트(Node, 무의존성), 설치 스크립트(macOS·Linux·Windows), 확장 쪽 클라이언트와 연결 테스트.
- 완료 조건: 프로토콜 단위 테스트, 로컬 Claude Code 실호출 검증.

### ACORN-7 스마트 캡처 리뷰 UI + AI 연결 설정 — `TODO`
- 범위: 캡처 즉시 휴리스틱 결과 표시 → AI 결과 스트리밍 반영 → 부스·상품을 한 번에 저장. 기존 부스의 이미지 재분석 시트. 프로바이더 연결 설정 화면.
- 완료 조건: 기존 AddBoothModal·OCRModal·AnalysisMethodModal 대체.

### ACORN-8 수익화: 광고 + 후원 — `TODO`
- 범위: MV3 정책을 지키는 스폰서 슬롯(원격 JSON 데이터만, 스크립트 없음, "광고" 표기), 후원 링크, 스토어 고지 문구, 개인정보 처리방침.
- 완료 조건: 원격 코드 로드 0건, 피드 검증 테스트.

### ACORN-9 다국어 확장 — `TODO`
- 범위: 하드코딩 문자열 제거, 지원 언어 확장, `_locales` 확장, 통화·날짜 현지화 적용.
- 완료 조건: 모든 언어의 키 완전성 테스트 통과.

### ACORN-10 디자인 리프레시 — `TODO`
- 범위: 디자인 토큰, 공용 컴포넌트(Sheet·Toast·Segmented 등), 접근성(포커스 트랩·aria), 다크모드 정비.

### ACORN-11 정적 판단 v2 (로컬 결정적 파서) — `IN REVIEW`
- 결정: 조사 결과 Jev는 텍스트 전용 판단 모델이라 페이지 캡처를 대체할 수 없고, 호스티드 추출기(Jina·Firecrawl·crawl4ai)는 로그인이 필요한 X 게시글을 읽지 못한다. 그래서 "정적 판단"을 로컬 파서로 고도화했다.
- 범위: 다국어 부스 번호(코미케 스페이스 표기 포함), 통판 플래그 분리(기존 오인식 버그 수정), 행사 사전 확대와 기존 행사 매칭, 서클명 정제, 주문폼 링크 분류, 필드별 신뢰도.

### ACORN-12 검증·스크린샷·보고서 — `TODO`
- 범위: 실제 확장 로드 E2E, 개선 전후 스크린샷, 벤치마크 표, README·아키텍처 문서, 결과 보고서.

## 리뷰 기록

| 티켓 | 브랜치 | 리뷰 결과 | 머지 |
|---|---|---|---|
| ACORN-1 | feat/ACORN-1-tooling-baseline | PR #1. 리뷰 인라인 1건(High): 깨끗한 체크아웃에서 `.wxt` 타입이 없어 CI 타입체크 실패 → `postinstall: wxt prepare`로 수정, 재현 후 검증 | 머지 완료 (a7fd11d) |
| ACORN-2 | feat/ACORN-2-remove-server-credits | PR #2. 인라인 2건(Low): 미사용 identity 권한, 기존 로그인 데이터 잔존 → 둘 다 수정 | 머지 완료 (ff140b6) |
| ACORN-3 | feat/ACORN-3-foundation | 진행 중 | — |
