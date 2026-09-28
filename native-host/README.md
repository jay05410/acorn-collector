# 도토리주머니 CLI 브리지 / Acorn Collector CLI bridge

[한국어](#한국어) · [English](#english)

---

## 한국어

### 무엇인가요
확장 프로그램이 **내 컴퓨터에 설치되어 이미 로그인된** Claude Code(`claude`) 또는 OpenAI Codex(`codex`) CLI로 이미지·텍스트 분석을 실행하게 해 주는 Chrome Native Messaging 호스트입니다. API 키를 따로 발급하지 않아도 되지만, **고급 사용자용 선택 기능**입니다.

- 확장 프로그램은 로그인 토큰을 보지도, 저장하지도 않습니다. 호스트가 로컬 CLI를 실행하고 결과 JSON만 돌려줍니다.
- Node.js 20 이상, 의존성 없음.

### 설치
1. `claude` 또는 `codex`를 설치하고 터미널에서 한 번 로그인합니다 (`claude` 실행 후 로그인, 또는 `codex login`).
2. 확장 프로그램 ID를 확인합니다 (`chrome://extensions`에서 개발자 모드를 켜면 표시, 또는 확장 프로그램의 AI 설정 화면).
3. 이 폴더에서 실행합니다.
   ```sh
   node install.mjs --extension-id <확장 프로그램 ID>
   ```
   - 호스트 파일을 사용자 폴더(macOS `~/Library/Application Support/acorn-collector-bridge`, Linux `~/.local/share/acorn-collector-bridge`, Windows `%LOCALAPPDATA%\acorn-collector-bridge`)로 복사하고, 설치된 브라우저마다 매니페스트를 등록합니다. 관리자 권한은 필요 없습니다(`sudo` 금지).
   - `--dry-run`으로 할 일만 출력할 수 있고, `--extension-id`는 여러 번 줄 수 있습니다.
4. 브라우저를 재시작하고, 확장 프로그램 설정에서 "로컬 CLI"를 선택한 뒤 연결 테스트를 누릅니다(이때 `nativeMessaging` 권한을 요청합니다).

CLI를 새로 설치하거나 위치가 바뀌면 설치 명령을 다시 실행하세요(설치 시점의 절대 경로를 기록합니다).

제거: `node install.mjs --uninstall`

지원 브라우저: Chrome, Chrome for Testing, Chromium, Edge. Brave와 Naver Whale은 경로만 등록하며 동작은 검증하지 않았습니다. Windows는 Chrome·Edge 레지스트리에 등록하며, npm으로 설치된 `.cmd` 실행 파일은 지원하지 않습니다(네이티브 `claude.exe`/`codex.exe` 필요).

### 개인정보
- 분석을 실행하면 이미지와 텍스트가 **내 계정으로** Anthropic(Claude Code) 또는 OpenAI(Codex)에 전송됩니다. 해당 서비스의 약관과 내 요금제의 데이터 설정이 적용됩니다.
- 호스트는 아무것도 보관하지 않습니다. 작업마다 권한 0700인 임시 폴더를 만들고 끝나면 지우며, 비정상 종료로 남은 폴더는 1시간 뒤 다음 실행 때 지웁니다.
- 상태 확인에는 로그인 여부, 로그인 방식, 요금제 종류만 전달합니다(이메일·조직 정보는 전달하지 않음).
- 환경 변수의 `ANTHROPIC_API_KEY` 등은 CLI에 넘기지 않습니다. 그래서 Claude Code는 API 과금이 아니라 구독으로 동작합니다.

### 정책 안내
이 기능은 사용자가 직접 설치·로그인한 CLI를 사용자 컴퓨터에서 실행할 뿐, 로그인 정보나 토큰을 중개하지 않습니다. 다만 Anthropic은 제3자 제품이 Claude.ai 로그인을 제공하는 것을 제한하고 있으므로([Claude Code 법률·준수 문서](https://code.claude.com/docs/en/legal-and-compliance.md)), 이 사용 방식이 내 요금제 약관에 맞는지는 사용자가 판단해야 합니다. 확실하지 않다면 API 키 방식의 프로바이더를 쓰세요.

### 보안 설계
- 브라우저가 넘겨준 호출자 origin이 `config.json`의 허용 목록과 정확히 일치할 때만 동작합니다.
- CLI는 셸 없이 절대 경로로 실행하고, 작업 폴더는 빈 임시 폴더, 환경 변수는 허용 목록에 있는 것만 넘깁니다.
- Claude Code는 `--safe-mode --permission-mode dontAsk --tools StructuredOutput`으로 실행해 셸·파일·웹 도구를 모델에 제공하지 않습니다. Codex는 `--sandbox read-only`로 실행합니다.
- 한 번에 한 작업만 실행하며, 180초 제한을 넘으면 프로세스 그룹에 SIGINT → SIGTERM → SIGKILL(Windows는 `taskkill /T /F`)을 보냅니다.
- 이미지는 최대 6장, 장당 8 MB, JPEG·PNG·WebP만 받습니다(파일 시그니처로 판별).

---

## English

### What it is
A Chrome Native Messaging host that lets the extension run image and text analysis on the Claude Code (`claude`) or OpenAI Codex (`codex`) CLI that is **already installed and logged in on your computer**. No API key is needed, but this is an **advanced, opt-in feature**.

- The extension never sees or stores your login tokens. The host runs your local CLI and returns only the result JSON.
- Node.js 20 or newer, zero dependencies.

### Install
1. Install `claude` or `codex` and log in once in a terminal (run `claude` and log in, or `codex login`).
2. Find the extension ID (shown on `chrome://extensions` with Developer mode on, or in the extension's AI settings).
3. From this folder run:
   ```sh
   node install.mjs --extension-id <extension id>
   ```
   - Copies the host into a per-user folder (macOS `~/Library/Application Support/acorn-collector-bridge`, Linux `~/.local/share/acorn-collector-bridge`, Windows `%LOCALAPPDATA%\acorn-collector-bridge`) and registers a manifest for every installed browser. No admin rights needed; do not use `sudo`.
   - `--dry-run` prints the actions only; `--extension-id` may be repeated.
4. Restart the browser, choose "Local CLI" in the extension settings and run the connection test (this requests the `nativeMessaging` permission).

Re-run the installer after installing or moving a CLI; it records absolute paths at install time.

Uninstall: `node install.mjs --uninstall`

Browsers: Chrome, Chrome for Testing, Chromium, Edge. Brave and Naver Whale get a manifest but are untested. On Windows the Chrome and Edge registry keys are written; npm `.cmd` shims are not supported (a native `claude.exe`/`codex.exe` is required).

### Privacy
- When you run an analysis, the images and text are sent **under your own account** to Anthropic (Claude Code) or OpenAI (Codex). Their terms and your plan's data settings apply.
- The host keeps nothing. Each job gets a private (0700) temp folder that is deleted afterwards; folders left by a crash are removed on a later start once they are an hour old.
- The status check reports only whether you are logged in, the login method and the plan type (never email or organization).
- `ANTHROPIC_API_KEY` and other variables outside an allowlist are not passed to the CLI, so Claude Code runs on your subscription rather than API billing.

### Policy note
The bridge runs a CLI that you installed and logged into yourself, on your own machine; it never brokers your login or tokens. Anthropic does restrict third-party products from offering Claude.ai login ([Claude Code legal and compliance](https://code.claude.com/docs/en/legal-and-compliance.md)), so whether this use fits your plan's terms is your call. If unsure, use an API-key provider instead.

### Security design
- Works only when the caller origin passed by the browser exactly matches the allowlist in `config.json`.
- CLIs run by absolute path without a shell, in an empty temp folder, with an allowlisted environment.
- Claude Code runs with `--safe-mode --permission-mode dontAsk --tools StructuredOutput`, so the model is offered no shell, file or web tools. Codex runs with `--sandbox read-only`.
- One job at a time; after 180 s the process group gets SIGINT → SIGTERM → SIGKILL (`taskkill /T /F` on Windows).
- At most 6 images of 8 MB each, JPEG/PNG/WebP only (detected by file signature).

### Protocol (for developers)
Messages are UTF-8 JSON with a 4-byte native-endian length prefix (host → extension ≤ 1 MB).

| Request | Response |
|---|---|
| `{id, op:'ping'}` | `{id, status:'ok', result:{protocol:1}}` |
| `{id, op:'status'}` | `{id, status:'ok', result:{protocol, platform, targets:{claude, codex}}}` |
| `{id, op:'analyze', target, model, system, text, images:[{mimeType, base64}], schema}` | `{id, status:'queued'\|'running'}` heartbeats every 5 s, then `{id, status:'ok', result:{output, model, usage}}` |
| `{id, op:'cancel', targetId}` | `{id, status:'ok', result:{cancelled}}`; the cancelled job ends with error `cancelled` |

Errors: `{id, status:'error', error:{code, message}}` with `code` one of `bad_request`, `busy`, `cancelled`, `timeout`, `cli_not_found`, `not_logged_in`, `rate_limited`, `cli_failed`, `bad_output`, `internal`.

### Development
- Unit tests run with the extension's `pnpm test` (`native-host/**/*.test.mjs`).
- Live check on your own subscription (one request): `node scripts/e2e.mjs --image <file> [--truth <file>] [--debug]`.
- `node scripts/gen-dev-key.mjs` prints a public key for a development manifest `key` and the extension ID it pins. The private key is discarded.
