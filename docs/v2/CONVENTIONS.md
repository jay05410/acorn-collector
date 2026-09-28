# v2 구현 규칙 (에이전트·기여자 공통)

## 계약 파일 (변경 시 ACORN-3 소유자와 합의)
- `src/types/index.ts` — 도메인 타입 (Event.currency, Item.originalName/currency/category/option, Booth.sourceText)
- `src/lib/ai/types.ts` — AIProvider, ExtractionRequest/Result, WireExtraction, AIError
- `src/lib/capture/types.ts` — PageSnapshot, CaptureHandoff, 메시지 타입
- `src/lib/settings-types.ts` — AppSettings v2
- `src/i18n/languages.ts` — 지원 언어와 로케일 정보

## i18n
- 진입점: `import { t, tp, useLanguage, formatPrice, formatDate } from '@/i18n'`.
- 문자열은 네임스페이스 파일 `src/i18n/messages/<ns>.ts`에 둔다. 형식:
  ```ts
  import { defineMessages } from '../define';
  export default defineMessages({
    en: { title: 'Settings' },          // 기준 언어, 키 집합의 원본
    ko: { title: '설정' },
    ja: { title: '設定' },
    'zh-CN': { title: '设置' },
    'zh-TW': { title: '設定' },
    // th, id, vi, es, fr, de, pt-BR 는 선택(부분 허용, 없으면 en 폴백)
  });
  ```
- 새 네임스페이스는 `src/i18n/registry.ts`에 한 줄 등록한다.
- 매개변수는 `{name}` 형식, `tp(ns, key, { name })`로 치환.
- 개수에 따라 달라지는 문자열은 `<key>_one`/`<key>_other`(필요하면 `_zero`/`_two`/`_few`/`_many`)로 나누고 `tn(ns, key, count, params?)`로 호출한다. `Intl.PluralRules` 범주를 고르고 없으면 `_other`를 쓰며, `{count}`는 자동으로 채운다. 단복수 구분이 없는 언어(ko, ja, zh-CN, zh-TW)는 두 키에 같은 문장을 넣는다. 모든 복수형 키에는 `_other` 짝이 있어야 한다(완전성 테스트).
- UI 코드(.tsx)와 사용자에게 보이는 문자열에 하드코딩된 한글·외국어 금지. 테스트가 검사한다. 예외는 `src/i18n/messages/**`, `src/lib/parser/**` 키워드 사전, 테스트 파일.
- 핵심 5개 언어(ko, en, ja, zh-CN, zh-TW)는 모든 키가 채워져 있어야 한다(완전성 테스트).

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
- 완료 조건: `pnpm typecheck`, `pnpm lint`(에러 0), `pnpm test`, `pnpm build` 모두 통과.
- 빌드 산출물에 원격 스크립트·`eval`·`new Function`이 있으면 안 된다(ACORN-8에서 CI 가드 추가).

## Git
- 브랜치 `feat/ACORN-<n>-<slug>`, 커밋 메시지 `type(ACORN-n): 요약` + 본문, 마지막 줄에 커밋을 실제로 작성한 모델의 `Co-Authored-By` 서명(하네스가 지정한 값)을 넣는다.
- 사용자의 미추적 파일(`.github/workflows/deploy.yml`, `codedocs.config.ts`, `analysis-result.json`, `docs-output/`, `api/`)은 절대 스테이징하지 않는다. `git add -A` 금지, 경로를 명시해 추가.
