# v2 구현 규칙 (에이전트·기여자 공통)

## 계약 파일 (변경 시 ACORN-3 소유자와 합의)
- `src/types/index.ts` — 도메인 타입 (Event.currency, Item.originalName/currency/category/option, Booth.sourceText)
- `src/lib/ai/types.ts` — AIProvider, ExtractionRequest/Result, WireExtraction, AIError
- `src/lib/capture/types.ts` — PageSnapshot, CaptureHandoff, 메시지 타입
- `src/lib/settings-types.ts` — AppSettings v2
- `src/i18n/languages.ts` — 지원 언어와 로케일 정보 (출시 언어는 2026-09-29 소유자 결정: ko, en, ja, zh-CN, zh-TW)

## i18n
전체 구조와 언어 추가 방법은 `docs/v2/I18N.md`.
- 진입점: `import { t, tp, tn, useLanguage, formatPrice, formatDate } from '@/i18n'`.
- 문자열은 언어별 폴더 `src/i18n/locales/<lang>/<ns>.ts`에 둔다. 영어(`locales/en`)가 키의 원본이고, 다른 언어는 같은 키를 모두 가져야 한다(컴파일 오류 + 완전성 테스트 + `pnpm i18n:check`). 형식:
  ```ts
  // locales/en/settings.ts
  import type { MessageTable } from '../../define';
  export default { title: 'Settings' } satisfies MessageTable;

  // locales/ja/settings.ts
  import type { LocaleMessages } from '../../define';
  export default { title: '設定' } satisfies LocaleMessages['settings'];
  ```
  값은 문자열 리터럴만(도구가 파일을 직접 읽는다). 모든 언어 파일을 손으로 고쳐도 되고, `pnpm i18n:export <lang>` → 번역 → `pnpm i18n:import <lang> <file>`로 채워도 된다.
- 새 네임스페이스는 `locales/en/<ns>.ts`를 만들고 각 언어 폴더에 같은 파일을 만든 뒤 모든 `locales/<lang>/index.ts`에 등록한다.
- 영어는 번들에 포함되고 다른 언어는 필요할 때 불러온다. 언어 전환은 `setLanguage(lang)`(불러온 뒤 전환, Promise 반환), 미리 불러오기는 `ensureLanguageLoaded(lang)`. 없는 문자열은 키별로 영어를 쓴다.
- 언어별 차이(서식 로케일, 기본 통화, AI 프롬프트 언어 이름, 달력 로케일, Chrome `_locales` 폴더)는 `LANGUAGE_INFO`에서만 읽는다. 언어 코드로 분기하지 않는다.
- 매개변수는 `{name}` 형식, `tp(ns, key, { name })`로 치환. 번역은 영어와 같은 자리표시자를 같은 개수만큼 가진다.
- 개수에 따라 달라지는 문자열은 `<key>_one`/`<key>_other`(필요하면 `_zero`/`_two`/`_few`/`_many`)로 나누고 `tn(ns, key, count, params?)`로 호출한다. `Intl.PluralRules` 범주를 고르고 없으면 `_other`를 쓰며, `{count}`는 자동으로 채운다. 단복수 구분이 없는 언어(ko, ja, zh-CN, zh-TW)는 두 키에 같은 문장을 넣는다. 모든 복수형 키에는 `_other` 짝이 있어야 한다. 영어에 없는 범주가 필요한 언어(예: 프랑스어 `many`)는 그 형태를 추가로 넣는다.
- UI 코드(.tsx)와 사용자에게 보이는 문자열에 하드코딩된 한글·외국어 금지. 테스트가 검사한다. 예외는 `src/i18n/locales/**`, `src/i18n/languages.ts`(언어 고유 이름), `src/lib/parser/**` 키워드 사전, 테스트 파일.
- 새 언어는 `pnpm i18n:new <lang>`으로 드래프트를 만들고, 완전히 번역된 뒤에만 `APP_LANGUAGES`에 넣는다(`docs/v2/I18N.md` 4단계).

## AI 레이어
- Gemini 관련 코드·의존성 금지.
- 모델 ID는 `src/lib/ai/models.ts` 테이블에서만 참조.
- 프로바이더는 실패 시 반드시 `AIError`를 던진다. UI는 `error.code`로 i18n 메시지를 고른다.
- 네트워크 호출은 확장 페이지(사이드패널) 또는 백그라운드에서만. 콘텐츠 스크립트에서 금지.
- API 키는 `chrome.storage.local`에만 저장. 로그·오류 메시지에 키를 넣지 않는다.

## 캡처 레이어
- 콘텐츠 스크립트는 가볍게 유지하고, 무거운 추출기(defuddle)는 사용자가 캡처할 때만 `chrome.scripting.executeScript`로 주입.
- 캡처 핸드오프는 `chrome.storage.session`(메모리)만 사용. 우클릭 때마다 스토리지에 쓰지 않는다.

## 테스트·품질
- 단위 테스트는 소스 옆 `*.test.ts`(Vitest). DOM이 필요하면 파일 상단에 `// @vitest-environment happy-dom`.
- 완료 조건: `pnpm typecheck`, `pnpm lint`(에러 0), `pnpm test`, `pnpm i18n:check`, `pnpm build` 모두 통과.
- 빌드 산출물에 원격 스크립트·`eval`·`new Function`이 있으면 안 된다(ACORN-8에서 CI 가드 추가).

## Git
- 브랜치 `feat/ACORN-<n>-<slug>`, 커밋 메시지 `type(ACORN-n): 요약` + 본문, 마지막 줄에 커밋을 실제로 작성한 모델의 `Co-Authored-By` 서명(하네스가 지정한 값)을 넣는다.
- 사용자의 미추적 파일(`.github/workflows/deploy.yml`, `codedocs.config.ts`, `analysis-result.json`, `docs-output/`, `api/`)은 절대 스테이징하지 않는다. `git add -A` 금지, 경로를 명시해 추가.
