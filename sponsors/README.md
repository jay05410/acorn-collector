# 스폰서 피드 (`sponsors/feed.json`)

사이드패널의 광고 슬롯에 표시할 광고 목록입니다. 확장은 이 파일을 **데이터(JSON)로만** 내려받아 번들된 코드로 그립니다. 스크립트·HTML·위젯은 받지 않습니다(MV3 원격 코드 금지 준수).

- 기본 주소: `https://raw.githubusercontent.com/jay05410/acorn-collector/main/sponsors/feed.json` (`main` 브랜치의 이 파일)
- 반영 시간: 확장은 받은 피드를 6시간 캐시하고, 만료 후 `ETag`로 변경 여부만 확인합니다. raw.githubusercontent.com 자체 캐시(`max-age=300`)까지 더하면 **수정 후 최대 약 6시간 5분** 뒤 모든 사용자에게 반영됩니다. 패널을 오래 열어 둔 경우에도 패널이 다시 보이거나 포커스를 받을 때, 그리고 보이는 동안 30분마다 만료 여부를 확인합니다(이때는 최대 30분 더 늦을 수 있음).
- 실패 시: 네트워크 오류·형식 오류면 사용자는 마지막으로 받은 피드를 계속 보고, 그것도 없으면 번들된 하우스 프로모(후원·스토어 평가·공유·광고 문의)를 봅니다. 열려 있는 패널은 30분 뒤 다시 시도합니다.

## 편집 방법

1. 이 파일을 수정하고 `updatedAt`을 현재 시각으로 바꿉니다.
2. `pnpm test`를 실행합니다. `src/lib/sponsor/feed.test.ts`가 이 파일을 실제 검증기로 검사해, 건너뛰어질 광고가 하나라도 있으면 실패합니다(CI에서도 같은 검사).
3. `main`에 머지하면 위 반영 시간 안에 배포됩니다. 확장 재배포는 필요 없습니다.

광고를 모두 내리려면 `"creatives": []`로 두면 됩니다. 그러면 번들된 하우스 프로모가 표시됩니다.

## 형식 (schema v1)

```json
{
  "version": 1,
  "updatedAt": "2026-09-29T00:00:00Z",
  "creatives": [
    {
      "id": "acme-2026-10",
      "placements": ["footer", "analysis"],
      "locales": ["ko", "ja"],
      "sponsorName": "Acme 문구",
      "title": "팬레터용 젤펜 12색 세트",
      "body": "부스 굿즈 포장에 맞는 스티커와 펜",
      "cta": "보러 가기",
      "imageUrl": "https://raw.githubusercontent.com/jay05410/acorn-collector/main/sponsors/images/acme.webp",
      "clickUrl": "https://acme.example/pens",
      "startsAt": "2026-10-01T00:00:00+09:00",
      "endsAt": "2026-11-01T00:00:00+09:00",
      "weight": 10
    }
  ]
}
```

봉투(`version`, `updatedAt`, `creatives`)가 틀리면 **피드 전체**를 무시합니다. 개별 광고가 틀리면 **그 광고만** 건너뜁니다.

| 필드 | 필수 | 규칙 |
|---|---|---|
| `version` | 예 | `1` |
| `updatedAt` | 예 | ISO 8601 날짜·시각 + 시간대 (`Z` 또는 `+09:00`) |
| `id` | 예 | 영문·숫자·`-`·`_`, 64자 이하, 피드 안에서 유일(중복이면 첫 번째만 사용) |
| `placements` | 예 | `footer`(하단 64px 바), `analysis`(분석 화면 카드), `settings`(설정 화면 카드) 중 1개 이상. 모르는 값이 있으면 광고 전체를 건너뜀 |
| `locales` | 예 | `"*"`(모든 언어) 또는 앱 언어 코드: `ko` `en` `ja` `zh-CN` `zh-TW` (`src/i18n/languages.ts`의 `APP_LANGUAGES`). 사용자의 **화면 언어와 정확히 일치**할 때만 표시. 모르는 코드가 하나라도 있으면 광고 전체를 건너뛰므로, 새 언어를 추가한 뒤에는 그 언어만 담은 광고를 따로 만든다(이전 버전은 새 코드를 모름) |
| `sponsorName` | 예 | 40자 이하. "광고" 표시 옆에 나옴 |
| `title` | 예 | 60자 이하. 하단 바에서는 한 줄로 잘림 |
| `body` | 아니오 | 120자 이하. 카드형 슬롯(`analysis`, `settings`)에서만 두 줄까지 표시 |
| `cta` | 아니오 | 24자 이하. 좁은 카드에서는 숨겨질 수 있음(카드 전체가 링크) |
| `imageUrl` | 아니오 | `https`, 확장자 `.png` `.jpg` `.jpeg` `.webp` (SVG 불가), **피드와 같은 호스트**(기본값이면 raw.githubusercontent.com) |
| `clickUrl` | 예 | `https`만 허용, 2048자 이하, URL 안에 사용자명·비밀번호 불가 |
| `startsAt` / `endsAt` | 아니오 | ISO 8601 날짜·시각 + 시간대. `startsAt` 이상, `endsAt` 미만일 때 표시. 날짜만(`2026-10-01`)은 거부 |
| `weight` | 아니오 | 정수 1~100, 기본 1. 같은 슬롯 후보 사이의 노출 비율 |

기타:
- 광고는 최대 50개, 파일 크기는 64KB까지입니다.
- 글자 수는 문자 단위로 셉니다(한글·한자·이모지 1자 = 1).
- 제어 문자, 폭 없는 문자, 양방향(bidi) 제어 문자는 제거되고 연속 공백은 하나로 합쳐집니다. 모든 문자열은 일반 텍스트로만 표시됩니다(HTML 해석 없음).
- 알 수 없는 필드는 무시합니다.
- 선택 필드(`body`, `imageUrl`, `cta`, `startsAt`, `endsAt`, `weight`)의 값이 `null`이면 없는 것으로 봅니다.

## 선택 규칙

1. 슬롯 위치(`placements`), 화면 언어(`locales`), 기간(`startsAt`/`endsAt`)으로 후보를 거릅니다. **이 밖의 사용자 정보는 쓰지 않습니다.**
2. 후보 중 `weight` 비율로 무작위 선택합니다. 선택은 한 슬롯에서 **최소 60초 유지**되고, 그 뒤에도 패널을 다시 열거나 다시 보이게 될 때만 바뀝니다(타이머로 돌지 않음). 화면 언어나 피드가 바뀌거나 기간을 다시 확인할 때(패널이 다시 보이거나 포커스를 받을 때, 보이는 동안 30분마다)는 지금 광고가 여전히 조건에 맞으면 그대로 둡니다.
3. 같은 광고가 두 슬롯에 동시에 나오지 않습니다.
4. 피드에 해당 슬롯·언어의 광고가 **하나라도 있으면** 번들 하우스 프로모는 그 슬롯에 나오지 않습니다. 하우스 프로모를 보여 주던 슬롯은 피드 광고를 쓸 수 있게 되면(피드 도착, 기간 시작, 다른 슬롯이 비움) 60초를 기다리지 않고 바로 바뀝니다. 현재 예시 피드는 `analysis` 슬롯만 채우므로, 하단 바와 설정 화면에는 하우스 프로모가 계속 나옵니다.

## 이미지

- 이 저장소의 `sponsors/images/`에 올리고 raw 주소를 씁니다. 다른 호스트의 이미지는 거부됩니다. 광고주 서버에서 이미지를 불러오면 노출 시점·IP가 광고주에게 전달되어 "추적 없음" 약속이 깨지기 때문입니다.
- 권장: 정사각형 112×112px 이상(카드 썸네일 56px의 2배), 50KB 이하, WebP 또는 PNG.
- 이미지는 `loading="lazy"`, `referrerpolicy="no-referrer"`로 불러오며, 실패하면 기본 아이콘이 대신 표시됩니다.

## 추적과 통계

- **노출(impression) 추적은 없습니다.** 확장은 표시 횟수·클릭 횟수를 세거나 어디에도 보내지 않습니다.
- 클릭 통계는 **광고주 쪽 분석 도구의 UTM 값**으로만 확인할 수 있습니다. 확장은 클릭 시 `clickUrl`에 다음을 붙여 새 탭으로 엽니다: `utm_source=acorn-collector`, `utm_medium=sidepanel`, `utm_campaign=<footer|analysis|settings>`. 광고주가 `clickUrl`에 이미 넣은 같은 이름의 `utm_*` 값은 그대로 둡니다.
- `clickUrl`에는 광고주 자신의 랜딩 페이지를 넣고, 제3자 광고 서버의 리다이렉트·클릭 추적 링크는 쓰지 않습니다(개인정보 처리방침의 "개인 맞춤 광고 없음·데이터 제3자 제공 없음"과 충돌).

## Chrome 웹 스토어 광고 정책 체크리스트

([Ads 정책](https://developer.chrome.com/docs/webstore/program-policies/ads), 2026-09-29 확인)

- 표시·출처: 모든 슬롯에 "광고" 표시와 `sponsorName`이 자동으로 붙습니다.
- 시스템 알림·경고를 흉내 내는 문구·이미지 금지 (예: "바이러스가 발견되었습니다", 브라우저 대화상자 모양).
- 확장의 콘텐츠 등급과 맞지 않는 광고 금지 (성인·도박 등).
- 클릭을 강요하지 않습니다(광고를 눌러야 쓸 수 있는 기능 없음). 광고는 확장을 제거하면 사라집니다.
- AdSense는 확장 안에서 쓸 수 없습니다([AdSense 정책](https://support.google.com/adsense/answer/1346295)). 이 피드 방식은 광고 네트워크를 쓰지 않습니다.

## 빌드 환경 변수

`src/config/monetization.ts`가 읽습니다. 셸 환경 변수나 `.env` 파일로 넣고, 잘못된 값(예: `http://`)은 무시되어 기본값이 쓰입니다.

| 변수 | 기본값 | 설명 |
|---|---|---|
| `VITE_SPONSOR_FEED_URL` | 위 기본 주소 | 피드 주소(`https`만). 이미지 허용 호스트도 이 주소의 호스트로 바뀝니다 |
| `VITE_REMOTE_SPONSOR_FEED` | `true` | `off`면 피드를 받지 않고 하우스 프로모만 표시 |
| `VITE_SPONSOR_SLOTS` | `true` | `off`면 광고 슬롯 자체를 렌더링하지 않음(개발용) |
| `VITE_BMC_URL` | (없음) | Buy Me a Coffee 페이지. 비어 있으면 버튼 숨김 |
| `VITE_GH_SPONSORS_URL` | `https://github.com/sponsors/jay05410` | GitHub Sponsors 페이지. `off`면 버튼 숨김 |
| `VITE_SPONSOR_CONTACT_URL` | 저장소 이슈 페이지 | "광고 문의" 링크. `https` 또는 `mailto:` |
| `VITE_CWS_URL` | (없음) | 스토어 상세 페이지. 비우면 스토어 설치본에서 확장 ID로 자동 계산, 압축 해제 설치본에서는 "평가" 프로모 숨김 |
| `VITE_PRIVACY_POLICY_URL` | `docs/PRIVACY.md`의 GitHub 주소 | "광고 안내"의 개인정보 처리방침 링크(언어별로 `#ads-ko`/`#ads-en` 앵커를 붙임) |
