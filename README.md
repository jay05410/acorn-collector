# Acorn Collector (도토리 주머니)

덕질 행사/전시회에서 방문할 부스와 구매할 상품을 관리하는 브라우저 확장 프로그램

## 개발 환경

```bash
# 의존성 설치
pnpm install

# 개발 서버 (Hot reload)
pnpm dev

# 빌드
pnpm build

# 타입 체크
pnpm typecheck

# 린트
pnpm lint
```

## 브라우저에서 테스트

1. `pnpm dev` 실행
2. Chrome에서 `chrome://extensions` 접속
3. "개발자 모드" 활성화
4. "압축해제된 확장 프로그램을 로드합니다" 클릭
5. `.output/chrome-mv3` 폴더 선택

## 기술 스택

- WXT (Extension Framework)
- React 19
- TypeScript
- Tailwind CSS 4
- Dexie.js (IndexedDB)
- Zustand (State Management)
