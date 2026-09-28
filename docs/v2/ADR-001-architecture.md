# ADR-001 도토리주머니 v2 아키텍처

- 상태: 채택 (2026-09-29)
- 근거 자료: 병렬 조사 6건 + 비판 검증 1건, 실측 벤치마크. 출처는 각 항목에 표기.

## 1. 요구사항 전제 검토 (사실과 판단을 구분)

| 전제 | 확인된 사실 | 결론 |
|---|---|---|
| "Gemini가 느리다" | 기존 코드는 `gemini-2.5-flash`에 thinking 설정을 하지 않아 동적 thinking이 켜진 상태였다 ([Google thinking 문서](https://ai.google.dev/gemini-api/docs/generate-content/thinking)). 실측 1패스 약 8.1초, 호출당 thinking 토큰 626~747개. 서버 경로는 순차 2회 호출이었다. 측정 시점에 503 과부하·429 할당량 초과도 발생. | 느림의 상당 부분은 설정 문제였다. 다만 소유자 결정에 따라 Gemini는 전면 제외한다 (온디바이스 Gemini Nano 포함). |
| "jev로 영역을 가져온다" | Jev는 TypeSafe AI의 텍스트 전용 판단(decision) 모델이다 (2026-09-15 공개, [docs.typesafe.ai](https://docs.typesafe.ai/models.md)). 페이지를 가져오거나 이미지를 읽지 못한다. | 페이지 캡처는 확장 내부 DOM 추출로 한다. "정적 판단" 단계는 Jev 대신 로컬 결정적 판단기로 구현한다(ACORN-11): 비용 0, 지연 약 5ms, 오프라인, CJK 지원. Jev는 소유자 운영 프록시가 필요하고(키를 확장에 넣을 수 없음), 텍스트 전용이며 CJK 정확도가 낮다고 공식 문서가 밝히고, 가입 상태가 2026-09-22 중단 후 불확실하다. |
| "crawl4ai 같은 오픈소스" | crawl4ai 0.9.4는 Python + Playwright 서버 도구다. 로그인이 필요한 X 게시글은 서버에 사용자 세션을 두어야 읽을 수 있다 ([docs](https://docs.crawl4ai.com/advanced/identity-based-crawling/)). Jina Reader는 2026-09-29 x.com 요청에 403을 반환했다. | 서버 무저장 원칙과 X 약관에 맞지 않아 채택하지 않는다. 사용자가 보고 있는 탭의 렌더링된 DOM에서 구조화 스냅샷을 만든다. 일반 페이지 정제에는 defuddle(MIT, 브라우저 동작)을 필요 시 주입한다. |
| "OpenAI·Claude를 OAuth로 붙인다" | Anthropic은 제3자 앱의 Claude.ai 로그인 제공과 토큰 중개를 명시적으로 금지한다 ([legal-and-compliance](https://code.claude.com/docs/en/legal-and-compliance.md)). OpenAI는 제3자용 ChatGPT OAuth 프로그램 문서가 없다. | 허용 경로 세 가지만 구현: ① OpenRouter OAuth PKCE(사용자 소유 키 발급) ② OpenAI·Anthropic API 키 직접 입력 ③ 사용자가 직접 로그인한 로컬 CLI(Claude Code·Codex)를 Native Messaging으로 호출하는 선택 기능(정책 회색지대, 옵트인). |
| "광고는 무조건" | AdSense는 브라우저 확장 게재를 명시적으로 금지한다 ([AdSense 정책](https://support.google.com/adsense/answer/1346295)). MV3는 원격 스크립트를 금지하지만 원격 JSON 데이터는 허용한다 ([Chrome 정책](https://developer.chrome.com/docs/webstore/program-policies/policies)). | 번들 코드가 원격 JSON 스폰서 매니페스트를 렌더링하는 방식. "광고" 표기, 개인화 없음. |
| "토스 등으로 후원" | toss.me는 서비스 종료 안내로 리다이렉트된다. Buy Me a Coffee는 Stripe Express로 한국 정산을 지원한다(2026-08-24 도움말). | Buy Me a Coffee와 GitHub Sponsors 링크(위젯 스크립트 없이 링크만). |

## 2. 모델 선택 (2026-09-29 기준, Gemini 제외)

실측: 합성 가격표 6장(ko·ja·zh-TW·zh-CN·en·손글씨체 ko), 이미지 1장/호출, OpenAI Responses API + strict JSON Schema + 스트리밍.

| 구성 | 지연(호출당) | 상품 재현율 | 가격 정확도 | 통화 정확도 |
|---|---|---|---|---|
| 기존: gemini-2.5-flash, thinking 기본값, 1패스 (n=2, 나머지 503/429) | 약 8.0~8.2초 | 1.00 | 1.00 | 측정 안 함 |
| gpt-6-luna, reasoning none | 2.2~4.2초 | 1.00 | 1.00 | 6/6 |
| gpt-6-luna, reasoning low | 4.3~7.9초 | 0.97 | 0.97 | 6/6 |
| gpt-6-sol, reasoning none | 4.1~5.2초 | 1.00 | 1.00 | 6/6 |

다중 이미지(3장) 실측: 한 번에 보내기 4.6~5.2초, 이미지별 병렬 호출 2.7~3.4초(정확도 동일) → 병렬 채택.
해상도 1024px 축소: 입력 토큰 3386→1480, 지연 차이는 서버 편차 수준, 정확도 동일 → 프로바이더 최대 해상도 유지.
로컬 CLI(Claude Code, 구독) 경로: 이미지당 9.8~13.3초(CLI 기동 + 적응형 thinking). API 비용이 없는 대신 느리다.

한계: 합성 이미지라 실제 사진(반사, 기울어짐, 손글씨)보다 쉽다. Anthropic·OpenRouter 키가 없어 이들 경로는 실측하지 못했다(CLI 브리지로 Claude 경로만 확인).

기본값(코드상 설정 테이블, 하드코딩 아님):

| 프로바이더 | fast | accurate |
|---|---|---|
| OpenAI | `gpt-6-luna` (reasoning none) | `gpt-6-sol` (reasoning low) |
| Anthropic | `claude-sonnet-5` (thinking disabled) | `claude-opus-5-5` (effort low, thinking 비활성 불가) |
| OpenRouter | `openai/gpt-6-luna` | `anthropic/claude-sonnet-5` |
| 로컬 CLI | Claude Code `sonnet` / Codex 기본 모델 | — |

`claude-haiku-4-5`는 유지 약속 기한이 2026-10-15이고 표준 해상도(1568px) 등급이라 기본값에서 제외 ([deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations)).

## 3. 속도 설계

1. 서버 경유 제거: 확장 → 사용자 프로바이더 직접 호출(확장 페이지는 host_permissions로 CORS 면제).
2. 단일 호출: 부스 정보·통화·상품을 한 번의 스키마 강제 호출로 추출(기존 2패스 제거).
3. 추론 최소화: OpenAI `none`, Sonnet 5 `disabled`.
4. 이미지 전처리: 확장에서 리사이즈(프로바이더 한계: OpenAI high 2048px, Claude 4.7+ 2576px) + JPEG 재인코딩 + SHA-256 해시.
5. 여러 이미지는 이미지별 병렬 호출 후 결정적 병합(벽시계 시간 = 가장 느린 1건).
6. 스트리밍으로 상품이 도착하는 대로 표시.
7. 로컬 캐시(이미지 해시 + 모델 + 스키마 버전) → 재분석 즉시 응답.
8. 짧은 키의 와이어 스키마로 출력 토큰 축소.

## 4. 데이터·프라이버시

- 모든 데이터는 IndexedDB(Dexie)와 chrome.storage.local에만 저장. 캡처 핸드오프는 chrome.storage.session(메모리).
- 이미지·텍스트는 사용자가 분석을 실행할 때 사용자가 고른 프로바이더로만 전송.
- 광고 매니페스트 요청은 IP·UA만 노출(정적 호스팅). 개인화·추적 없음.

## 5. 수용한 위험

- 로컬 CLI 브리지: Anthropic 문서가 양방향으로 해석 가능. 옵트인, 선택 권한(`nativeMessaging` optional)으로만 제공하고 보고서에 명시.
- OpenRouter의 chromiumapp.org 콜백 수락은 로그인 계정으로 실검증하지 못함 → 수동 코드 붙여넣기(headless) 경로를 함께 제공.
- 번들된 Kakao·Google Places 키 노출(소유자 수용). 콘솔에서 API·할당량 제한 권장.
