# 개인정보 처리방침 · Privacy Policy

도토리 주머니 (Acorn Collector) 브라우저 확장 프로그램

- 시행일 · Effective: 2026-09-29
- [한국어](#한국어) · [English](#english)

---

## 한국어

### 1. 요약

- 사용자가 만든 데이터(행사, 부스, 상품, 캡처한 게시글, AI 분석 결과, 설정)는 **사용자의 브라우저 안에만** 저장됩니다. 개발자는 서버를 운영하지 않으며 어떤 데이터도 받지 않습니다.
- 데이터가 외부로 나가는 경우는 사용자가 직접 기능을 쓸 때뿐입니다: AI 분석(사용자가 고른 AI 서비스로), 장소 검색(Kakao·Google), 분석할 이미지 내려받기(이미지가 있는 사이트에서).
- 광고는 **화면 언어만 보고** 확장 안에서 고릅니다. 개인 맞춤 광고, 노출·클릭 추적, 쿠키, 광고 네트워크가 없습니다.
- 데이터를 판매하거나 제3자에게 넘기지 않습니다.

### 2. 기기에 저장하는 데이터

| 저장 위치 | 내용 | 비고 |
|---|---|---|
| IndexedDB (확장 전용) | 행사, 부스, 상품, 배지, 캡처한 게시글의 본문·작성자·원문 링크·이미지 주소, AI 분석 결과 캐시 | 사용자가 삭제하거나 확장을 제거하면 사라짐 |
| `chrome.storage.local` | 설정(테마, 언어, 정렬), AI 연결 정보(API 키 또는 OpenRouter 키, 모델 선택), 광고 목록 캐시 | API 키는 이 기기에만 저장되며 동기화(`storage.sync`)하지 않음 |
| `chrome.storage.session` | 우클릭·단축키로 캡처한 페이지를 사이드패널에 넘기는 임시 데이터 | 메모리에만 있고 브라우저를 닫으면 사라짐 |

설정 화면의 "데이터 내보내기"로 JSON 백업 파일을 만들 수 있습니다. 이 파일은 사용자의 컴퓨터에 저장되며 개발자에게 전송되지 않습니다.

### 3. 외부로 전송되는 데이터

#### 3.1 AI 분석 (사용자가 실행할 때만)

사용자가 분석을 실행하면, 분석할 **이미지와 게시글·페이지 텍스트**가 사용자가 직접 연결한 AI 서비스로 전송됩니다. 확장은 중간 서버를 거치지 않고 해당 서비스에 직접 요청합니다.

- OpenAI API (사용자의 API 키) — [개인정보 처리방침](https://openai.com/policies/privacy-policy/)
- Anthropic API (사용자의 API 키) — [개인정보 처리방침](https://www.anthropic.com/legal/privacy)
- OpenRouter (사용자가 OAuth로 발급받거나 입력한 키) — [개인정보 처리방침](https://openrouter.ai/privacy)
- 로컬 Claude Code / Codex CLI (선택 기능, 사용자가 설치·로그인한 경우): 확장이 Native Messaging으로 사용자의 컴퓨터에 설치된 CLI에 데이터를 넘기고, CLI가 사용자의 계정으로 해당 서비스에 요청합니다.

전송된 데이터의 보관·이용은 각 서비스의 약관과 처리방침을 따릅니다. 분석 결과는 기기에만 저장됩니다.

#### 3.2 분석할 이미지 내려받기

웹 페이지의 이미지를 분석할 때, 확장은 그 이미지를 호스팅하는 사이트에서 이미지를 내려받습니다(쿠키 없이). 이때 해당 사이트는 일반적인 웹 요청과 마찬가지로 IP 주소와 브라우저 정보를 볼 수 있습니다.

#### 3.3 장소 자동완성

행사 장소 입력란에 입력한 **검색어**가 Kakao 로컬 API 또는 Google Places API로 전송됩니다(Google에는 결과 언어를 정하기 위해 화면 언어 코드도 함께). 사용자의 위치 정보는 보내지 않습니다. — [Kakao 개인정보 처리방침](https://www.kakao.com/policy/privacy), [Google 개인정보처리방침](https://policies.google.com/privacy)

<a id="ads-ko"></a>

#### 3.4 광고와 스폰서 목록

- 확장은 광고 목록(JSON 데이터)을 GitHub(raw.githubusercontent.com)의 공개 파일에서 최대 6시간에 한 번 내려받고, 광고 이미지도 같은 호스트에서만 불러옵니다. 요청에는 쿠키, 사용자 식별자, 쿼리 매개변수가 없습니다. 다만 모든 웹 요청과 마찬가지로 **IP 주소와 브라우저 종류(User-Agent)가 GitHub에 전달**됩니다. — [GitHub 개인정보 처리방침](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)
- 어떤 광고를 보여줄지는 확장 안에서 **슬롯 위치와 화면 언어만으로** 정합니다. 행사·부스·캡처한 페이지·방문 기록·AI 결과 등 다른 정보는 광고에 쓰지 않습니다.
- 확장은 광고 노출이나 클릭을 세거나 기록하거나 전송하지 않습니다.
- 광고를 누르면 광고주 페이지가 새 탭에서 열리고, 링크에 `utm_source=acorn-collector`, `utm_medium=sidepanel`, `utm_campaign=<슬롯 위치>`가 붙습니다. 그래서 광고주는 **자신의 사이트에서** 방문이 이 확장에서 왔다는 사실을 알 수 있습니다. 열린 페이지에는 그 사이트의 처리방침이 적용됩니다.
- 광고는 확장을 제거하면 사라집니다.

#### 3.5 후원 링크

Buy Me a Coffee, GitHub Sponsors 버튼은 일반 링크이며, 누르면 해당 사이트가 새 탭에서 열립니다. 확장은 이들 서비스의 스크립트나 위젯을 불러오지 않습니다.

### 4. 하지 않는 것

- 개발자 서버에 데이터를 저장하거나 전송하지 않습니다.
- 개인 맞춤 광고를 하지 않으며, 사용자 데이터를 광고에 쓰지 않습니다.
- 사용자 데이터를 판매하거나 광고 플랫폼, 데이터 브로커 등 제3자에게 넘기지 않습니다.
- 신용도 판단이나 대출 목적으로 데이터를 쓰지 않습니다.
- 사용자가 캡처하지 않은 페이지의 내용이나 방문 기록을 수집하지 않습니다.
- 분석(애널리틱스)·오류 수집 도구를 쓰지 않습니다.

### 5. Chrome 웹 스토어 사용자 데이터 정책 준수

The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

(Google API로부터 받은 정보의 사용은 Limited Use 요구사항을 포함한 Chrome 웹 스토어 사용자 데이터 정책을 따릅니다.) 이 확장은 사용자 데이터를 단일 목적(행사 부스 체크리스트 작성)을 제공·개선하는 데만 사용합니다.

### 6. 데이터 삭제

- 부스·행사·상품은 앱 안에서 개별 삭제할 수 있습니다.
- API 키는 AI 연결 설정에서 지울 수 있습니다.
- 확장을 제거하면 IndexedDB와 `chrome.storage`의 모든 데이터가 브라우저에서 삭제됩니다.
- 외부 AI 서비스에 이미 전송된 데이터의 삭제는 해당 서비스에 요청해야 합니다.

### 7. 문의

[GitHub 이슈](https://github.com/jay05410/acorn-collector/issues)로 문의해 주세요.

### 8. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-09-29 | v2 전면 개정: 개발자 서버·로그인·크레딧 제거, 사용자 선택 AI 서비스 직접 연결, 비개인화 광고와 후원 링크 도입 |

처리방침이 바뀌면 이 문서의 변경 이력에 기록합니다.

---

## English

### 1. Summary

- Everything you create (events, booths, items, captured posts, AI results, settings) is stored **only in your browser**. The developer runs no server and receives none of your data.
- Data leaves your browser only when you use a feature: AI analysis (to the AI service you chose), venue search (Kakao or Google), and downloading images you analyze (from the site that hosts them).
- Ads are chosen inside the extension **by your display language only**. There are no personalized ads, no view or click tracking, no cookies and no ad networks.
- Your data is never sold or transferred to third parties.

### 2. Data stored on your device

| Where | What | Notes |
|---|---|---|
| IndexedDB (extension only) | Events, booths, items, badges, captured post text/author/source link/image URLs, AI result cache | Removed when you delete it or uninstall |
| `chrome.storage.local` | Settings (theme, language, sort), AI connection (API key or OpenRouter key, model choice), cached ad list | API keys stay on this device and are never synced (`storage.sync` is not used) |
| `chrome.storage.session` | Temporary handoff of a page you captured via right-click or shortcut | Memory only; cleared when the browser closes |

"Export data" in Settings creates a JSON backup file on your computer. It is not sent to the developer.

### 3. Data sent outside your browser

#### 3.1 AI analysis (only when you run it)

When you run an analysis, the **images and post/page text** being analyzed are sent to the AI service you connected, directly from the extension (no intermediate server):

- OpenAI API (your API key) — [privacy policy](https://openai.com/policies/privacy-policy/)
- Anthropic API (your API key) — [privacy policy](https://www.anthropic.com/legal/privacy)
- OpenRouter (a key you created via OAuth or entered) — [privacy policy](https://openrouter.ai/privacy)
- Local Claude Code / Codex CLI (optional, if you installed and signed in to it): the extension passes the data to the CLI on your computer through Native Messaging, and the CLI sends it to its service under your account.

Each service's terms and privacy policy govern what it does with the data. Results are stored only on your device.

#### 3.2 Downloading images to analyze

To analyze an image from a web page, the extension downloads it from the site that hosts it (without cookies). Like any web request, that site can see your IP address and browser details.

#### 3.3 Venue autocomplete

The **text you type** in the venue field is sent to the Kakao Local API or the Google Places API (Google also receives your display language code, to localize results). Your location is not sent. — [Kakao privacy policy](https://www.kakao.com/policy/privacy), [Google privacy policy](https://policies.google.com/privacy)

<a id="ads-en"></a>

#### 3.4 Ads and the sponsor list

- The extension downloads the ad list (JSON data) from a public file on GitHub (raw.githubusercontent.com) at most once every six hours, and loads ad images from that same host only. Requests carry no cookies, no user identifiers and no query parameters. Like any web request, they **reveal your IP address and browser type (User-Agent) to GitHub**. — [GitHub privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)
- Which ad to show is decided inside the extension **from the slot position and your display language only**. Your events, booths, captured pages, browsing history, AI results and any other data are never used for ads.
- The extension does not count, record or send ad views or clicks.
- Clicking an ad opens the sponsor's page in a new tab with `utm_source=acorn-collector`, `utm_medium=sidepanel` and `utm_campaign=<slot>` added, so the sponsor can tell **on their own site** that the visit came from this extension. That site's privacy policy applies to the opened page.
- Ads go away when you uninstall the extension.

#### 3.5 Donation links

The Buy Me a Coffee and GitHub Sponsors buttons are plain links that open those sites in a new tab. The extension loads no scripts or widgets from these services.

### 4. What we do not do

- Store or send data to a developer server.
- Show personalized ads or use your data for ads.
- Sell your data or transfer it to third parties such as ad platforms or data brokers.
- Use data to determine creditworthiness or for lending.
- Collect the content of pages you did not capture, or your browsing history.
- Use analytics or crash-reporting tools.

### 5. Chrome Web Store User Data Policy

The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

The extension uses your data only to provide and improve its single purpose: building checklists of booths to visit at fan events.

### 6. Deleting data

- Delete booths, events and items inside the app.
- Remove API keys in the AI connection settings.
- Uninstalling the extension deletes all of its IndexedDB and `chrome.storage` data from your browser.
- Data already sent to an AI service must be deleted through that service.

### 7. Contact

Please open a [GitHub issue](https://github.com/jay05410/acorn-collector/issues).

### 8. Change log

| Date | Change |
|---|---|
| 2026-09-29 | v2 rewrite: developer server, sign-in and credits removed; direct connection to the AI service you choose; non-personalized ads and donation links added |

Changes to this policy are recorded in this change log.
