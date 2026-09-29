# 도토리주머니 (Acorn Collector)

동인·코믹 행사에서 방문할 부스와 살 상품을 모으는 Chrome 사이드패널 확장입니다. X(트위터)나 BOOTH 같은 페이지에서 부스 홍보글을 담으면 부스 정보가 자동으로 채워지고, 가격표 이미지는 내 AI 계정으로 분석해 상품 목록으로 만듭니다.

- 계정·로그인·서버 저장 없음. 모든 데이터는 이 브라우저에만 저장됩니다.
- 한국어, English, 日本語, 简体中文, 繁體中文.

## 주요 기능

| 기능         | 설명                                                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 페이지 캡처  | 우클릭 메뉴, 이미지 우클릭("이 이미지 분석"), 단축키 Alt+Shift+A, 사이드패널의 캡처 버튼. 보고 있는 페이지를 구조화 스냅샷으로 만듭니다(X는 자동 번역 전 원문 복원, BOOTH는 상품 JSON 직접 사용). |
| 즉시 채움    | 로컬 파서가 부스 번호(코미케 스페이스 표기 포함), 서클명, 행사(기존 행사와 자동 매칭), 통판 여부, 주문폼 링크를 약 5ms 안에 채웁니다.                                                             |
| AI 상품 추출 | 가격표 이미지에서 상품명·원문명·가격·통화·옵션·카테고리를 스트리밍으로 가져옵니다. 이미지별 병렬 처리, 로컬 캐시, 통화 혼합(예: KRW 행사의 JPY 가격표) 처리.                                      |
| 내 AI 연결   | OpenRouter 로그인(OAuth PKCE), OpenAI·Anthropic API 키, 또는 내 컴퓨터의 Claude Code·Codex CLI(고급, 옵트인). Gemini는 사용하지 않습니다.                                                         |
| 체크리스트   | 행사별 부스·상품 체크, 통화별 합계, 영수증 이미지 내보내기, JSON 백업.                                                                                                                            |
| 광고·후원    | 사이드패널 안의 비개인화 스폰서 슬롯(스크립트 없는 JSON 피드), Buy Me a Coffee·GitHub Sponsors 링크.                                                                                              |

## 개발

```bash
pnpm install          # postinstall이 WXT 타입을 생성합니다
pnpm dev              # 개발 서버
pnpm build            # 프로덕션 빌드 (.output/chrome-mv3)
pnpm check            # typecheck + lint + test + i18n:check
node scripts/check-remote-code.mjs   # 빌드 결과에 원격 코드가 없는지 검사
```

Chrome에서 `chrome://extensions` → 개발자 모드 → "압축해제된 확장 프로그램을 로드합니다" → `.output/chrome-mv3`.

### 로컬 CLI 브리지(선택)

Claude Code 또는 Codex CLI에 이미 로그인되어 있다면, 설정 → AI 연결 → 로컬 CLI에서 안내하는 명령으로 설치합니다.

```bash
cd native-host && node install.mjs --extension-id <확장 ID>
```

자세한 내용과 개인정보·약관 안내는 `native-host/README.md`.

### 환경 변수 (빌드 시)

| 변수                                                                  | 용도                                    |
| --------------------------------------------------------------------- | --------------------------------------- |
| `VITE_SPONSOR_FEED_URL`, `VITE_REMOTE_SPONSOR_FEED`                   | 스폰서 피드 주소, 원격 피드 끄기(`off`) |
| `VITE_BMC_URL`, `VITE_GH_SPONSORS_URL`                                | 후원 링크(비우면 버튼 숨김, `off` 가능) |
| `VITE_CWS_URL`, `VITE_PRIVACY_POLICY_URL`, `VITE_SPONSOR_CONTACT_URL` | 스토어·개인정보·광고 문의 링크          |
| `VITE_KAKAO_API_KEY`, `VITE_GOOGLE_PLACES_API_KEY`                    | 행사 장소 자동완성(선택)                |

## 구조

```
src/
  entrypoints/      background(캡처 흐름), content(우클릭 대상), extractor(필요 시 주입), sidepanel(UI)
  lib/ai/           엔진, 프로바이더(OpenAI·Anthropic·OpenRouter), 이미지 전처리, 스트리밍, 캐시
  lib/capture/      페이지 스냅샷, 사이트별 추출, X·BOOTH 보강
  lib/bridge/       CLI 브리지 클라이언트
  lib/parser/       정적 판단(부스 번호·행사·서클·링크)
  lib/sponsor/      광고 피드 검증·선택
  i18n/             언어 레지스트리, locales/<언어>/, 지연 로딩
  components/       화면과 디자인 시스템(ui/)
native-host/        Native Messaging 호스트(Node, 무의존성)
sponsors/feed.json  광고 피드(소유자가 편집)
docs/v2/            설계 결정, 작업 보드, i18n, 결과 보고서
```

## 문서

- 결과 보고서: `docs/v2/REPORT.md`
- 아키텍처 결정: `docs/v2/ADR-001-architecture.md`
- 작업 보드·리뷰 기록: `docs/v2/TICKETS.md`
- 다국어와 언어 추가: `docs/v2/I18N.md`
- 개인정보 처리방침: `docs/PRIVACY.md`, 스토어 문구: `docs/STORE_LISTING.md`
