# Chrome 웹 스토어 등록 문구

Chrome 웹 스토어 개발자 대시보드에 붙여 넣을 문구입니다. 기준일 2026-09-29.

- 개인정보 처리방침 URL: `https://github.com/jay05410/acorn-collector/blob/main/docs/PRIVACY.md`
- 확장 이름·짧은 설명은 `src/public/_locales/*/messages.json`의 `appName`·`appDescription`이 manifest에 들어갑니다(스토어 목록에도 표시). 아래 짧은 설명은 그 값과 맞춰야 합니다.
- 광고 고지: 모든 언어의 상세 설명 첫 부분에 "사이드패널 안에 맥락형·비개인화 광고를 표시한다"는 문장을 둡니다. 광고는 [Chrome 웹 스토어 광고 정책](https://developer.chrome.com/docs/webstore/program-policies/ads)에 따라 "광고" 표시·출처 표기가 붙고, 확장을 제거하면 사라집니다.

---

## 1. 상세 설명

### 한국어

**짧은 설명**
덕질 행사/전시회에서 방문할 부스와 구매할 상품을 관리하는 체크리스트

**상세 설명**

도토리 주머니는 코믹월드, 코미케 같은 덕질 행사에서 들를 부스와 살 굿즈를 한곳에 모아 주는 사이드패널 체크리스트입니다.

광고 안내: 이 확장 프로그램은 사이드패널 안에 맥락형·비개인화 광고를 표시합니다. 광고는 화면 언어만 보고 고르며, 노출·클릭 추적이나 개인 데이터 사용은 없습니다. 광고와 후원으로 무료 운영됩니다.

주요 기능
• X(트위터)·블루스카이·일반 웹 페이지의 부스 공지를 우클릭 한 번으로 가져오기
• 가격표·메뉴 이미지에서 상품명·가격·통화를 AI로 추출 (OpenAI, Anthropic, OpenRouter 중 본인 계정 연결, 또는 PC에 설치된 Claude Code·Codex)
• 행사별 부스·상품 체크리스트, 통화별 합계, 영수증 이미지로 내보내기
• 한국어·English·日本語·简体中文·繁體中文 지원, 외국 행사 가격표도 분석

개인정보
• 모든 데이터는 브라우저 안에만 저장됩니다. 개발자 서버가 없고, 로그인도 필요 없습니다.
• AI 분석을 실행할 때만 이미지와 게시글 텍스트가 사용자가 고른 AI 서비스로 직접 전송됩니다.
• 데이터를 판매하거나 광고에 쓰지 않습니다.

모든 기능은 무료이며, 후원해도 추가로 열리는 기능은 없습니다.

### English

**Short description**
Checklist for managing booths and products at fan conventions and exhibitions

**Detailed description**

Acorn Collector is a side panel checklist that gathers the booths you want to visit and the goods you want to buy at fan events such as comic markets and conventions.

Ads notice: this extension displays contextual, non-personalized ads inside its side panel. Ads are chosen by your display language only; there is no view or click tracking and no use of personal data. Ads and donations keep the extension free.

Features
• Capture booth announcements from X (Twitter), Bluesky and other web pages with one right-click
• Extract item names, prices and currencies from price-list images with AI (connect your own OpenAI, Anthropic or OpenRouter account, or use Claude Code / Codex installed on your computer)
• Per-event booth and item checklists, totals per currency, export as a receipt image
• Korean, English, Japanese, Simplified and Traditional Chinese; analyzes price lists from events abroad

Privacy
• All data stays in your browser. There is no developer server and no sign-in.
• Images and post text go directly to the AI service you chose, only when you run an analysis.
• Your data is never sold or used for ads.

Every feature is free; donations never unlock anything.

### 日本語

**短い説明**
同人イベントで訪問するブースと購入する商品を管理するチェックリスト

**詳細な説明**

どんぐりポケットは、コミケやオンリーイベントなどで回りたいブースと買いたいグッズをひとつにまとめる、サイドパネル型のチェックリストです。

広告について：この拡張機能は、サイドパネル内に文脈に応じた非パーソナライズ広告を表示します。広告は表示言語だけをもとに選ばれ、表示やクリックのトラッキング、個人データの利用は一切ありません。広告と支援により無料で提供しています。

主な機能
• X（Twitter）・Bluesky・一般的なWebページのお品書きを右クリックひとつで取り込み
• お品書き画像から商品名・価格・通貨をAIで抽出（OpenAI、Anthropic、OpenRouterのご自身のアカウントを接続、またはPCにインストールしたClaude Code・Codexを利用）
• イベントごとのブース・商品チェックリスト、通貨ごとの合計、レシート画像として書き出し
• 韓国語・英語・日本語・簡体字中国語・繁体字中国語に対応、海外イベントのお品書きも解析

プライバシー
• すべてのデータはブラウザ内にのみ保存されます。開発者のサーバーはなく、ログインも不要です。
• AI解析を実行したときだけ、画像と投稿テキストが選択したAIサービスへ直接送信されます。
• データを販売したり、広告に使ったりすることはありません。

すべての機能は無料で、支援によって解放される機能はありません。

---

## 2. 개인정보 보호 관행(Privacy practices) 탭

### 2.1 단일 목적 (Single purpose)

> Acorn Collector helps fans plan purchases at fan events: it captures booth announcements from web pages the user chooses and turns them into a per-event checklist of booths and items, optionally using an AI service the user connects to read prices from images.

### 2.2 권한 사용 근거 (Permission justification)

현재 manifest(ACORN-3 기준)에는 `storage`, `contextMenus`, `activeTab`, `sidePanel`, host `<all_urls>`, `<all_urls>` 콘텐츠 스크립트가 있습니다. `scripting`, `identity`, 선택 권한 `nativeMessaging`은 각 티켓이 manifest 변경을 요청한 상태이며, 병합된 뒤 대시보드에 입력합니다.

| 권한 | 상태 | 근거 (대시보드 입력용, 영문) |
|---|---|---|
| `storage` | 현재 | Stores the user's settings, the API key the user enters for their own AI provider, the cached sponsor list (chrome.storage.local), and the temporary hand-off of a captured page to the side panel (chrome.storage.session, memory only). All checklist data lives in IndexedDB on the device. |
| `contextMenus` | 현재 | Adds the extension's item to the right-click menu for pages, selections, links and images; choosing it is how the user captures a booth announcement. |
| `activeTab` | 현재 | Grants temporary access to the tab the user is on when they invoke the context menu, keyboard shortcut or capture button, so the extension can read that page's post only after an explicit user action. |
| `sidePanel` | 현재 | The whole user interface (checklists, capture review, settings) is a side panel next to the page the user is reading. |
| `scripting` | ACORN-5 요청 | Injects the page extractor into the current tab only when the user captures it, instead of running a heavy extractor on every page. |
| `identity` | ACORN-4 요청 | Runs the OpenRouter OAuth (PKCE) sign-in with chrome.identity.launchWebAuthFlow so the user can create their own OpenRouter key without pasting it. |
| `nativeMessaging` (optional) | ACORN-6 요청 | Optional, requested at runtime only if the user enables the local CLI bridge: talks to the Claude Code or Codex CLI the user installed and signed in to on their own computer. |
| Host `<all_urls>` | 현재 | Needed to (1) capture posts from any site the user chooses (fan events are announced on X, Bluesky, blogs and shop sites), (2) download the images the user asks to analyze from whatever host serves them, (3) call the user-selected AI API (OpenAI, Anthropic, OpenRouter) and the Kakao/Google place search directly from the extension, and (4) download the public sponsor list (JSON) from raw.githubusercontent.com. No data is sent to a developer server. |
| Content script `<all_urls>` | 현재 | A small script that remembers which post or image the user right-clicked so the capture targets that exact element. It reads nothing until the user captures. (ACORN-5 기준으로 문구 재확인) |

### 2.3 원격 코드 (Remote code)

- 선택: **No, I am not using remote code.**
- 근거: All JavaScript is bundled in the package. The only remote content is a JSON list of sponsor messages (text, https links, image URLs) that bundled code validates and renders as plain text; it contains no code. CI runs `scripts/check-remote-code.mjs` on every build to fail on remote `<script src>`, remote `import()`, `eval`, `new Function` and string timers.

### 2.4 데이터 사용 (Data usage)

Chrome 웹 스토어는 기기 안에서만 처리하는 데이터도 공개하도록 요구합니다([User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)). 아래 항목명은 대시보드 체크박스 이름을 기준으로 적었으니, 제출 전 대시보드의 실제 문구와 대조하세요.

| 항목 | 체크 | 이유 |
|---|---|---|
| Personally identifiable information | 아니오 | 이름·이메일 등 수집 없음 |
| Health information | 아니오 | — |
| Financial and payment information | 아니오 | 결제 기능 없음(후원은 외부 사이트 링크) |
| Authentication information | **예** | 사용자가 입력한 AI API 키·OpenRouter 키를 기기에만 저장하고 해당 AI 서비스 호출에만 사용 |
| Personal communications | 아니오 | — |
| Location | 아니오 | 장소 검색은 사용자가 입력한 검색어만 전송, 위치 정보 없음 |
| Web history | **예** | 사용자가 캡처한 게시글의 원문 URL을 부스 출처로 저장(기기 안). 방문 기록 전체는 수집하지 않음 |
| User activity | 아니오 | 클릭·노출·키 입력을 기록하지 않음 |
| Website content | **예** | 사용자가 캡처한 페이지의 텍스트·이미지를 기기에 저장하고, 사용자가 분석을 실행하면 사용자가 고른 AI 서비스로 전송 |

인증 항목 (세 가지 모두 체크):
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

"승인된 사용 사례" 관련: AI 서비스로의 전송은 사용자가 직접 연결하고 실행한 기능을 위한 것입니다(사용자 요청에 의한 전송). 광고 선택에는 사용자 데이터를 쓰지 않습니다.
