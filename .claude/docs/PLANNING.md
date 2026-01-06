# PLANNING: Booth Checker 개발 계획

> 2026년 1월 기준 최신 안정 버전 기술 스택

## 1. Tech Stack

### 1.1 Core Framework

| Category | Technology | Version | Note |
|----------|------------|---------|------|
| **Extension Framework** | WXT | 0.19.x | Chrome/Whale/Edge 단일 코드베이스 |
| **UI Framework** | React | 19.0.x | 2024.12 정식 출시 |
| **Language** | TypeScript | 5.7.x | Strict mode |
| **Styling** | Tailwind CSS | 4.0.x | 2024.12 정식 출시, CSS-first config |
| **Build Tool** | Vite | 6.0.x | WXT 내장 |

### 1.2 State & Storage

| Category | Technology | Version | Note |
|----------|------------|---------|------|
| **State Management** | Zustand | 5.0.x | 경량, React 19 호환 |
| **Local DB** | Dexie.js | 4.0.x | IndexedDB 래퍼, 타입 안전 |
| **Extension Storage** | wxt/storage | - | WXT 내장, chrome.storage 래퍼 |

### 1.3 Parsing & AI

| Category | Technology | Version | Note |
|----------|------------|---------|------|
| **Text Parsing** | 자체 구현 | - | 정규식 + 휴리스틱 |
| **Image OCR (옵션1)** | OpenAI Vision API | gpt-4o | 고정확도, 유료 |
| **Image OCR (옵션2)** | Tesseract.js | 5.1.x | 무료, 로컬, 정확도 낮음 |

### 1.4 UI Components & Utils

| Category | Technology | Version | Note |
|----------|------------|---------|------|
| **UI Components** | shadcn/ui | latest | Radix 기반, 복사해서 사용 |
| **Icons** | Lucide React | 0.468.x | |
| **Image Export** | html-to-image | 1.11.x | DOM → PNG |
| **Canvas (고도화)** | Fabric.js | 6.5.x | 배치도 동선 그리기 |
| **UUID** | nanoid | 5.0.x | |
| **Date** | date-fns | 4.1.x | |

### 1.5 Dev Tools

| Category | Technology | Version | Note |
|----------|------------|---------|------|
| **Linter** | ESLint | 9.x | Flat config |
| **Formatter** | Prettier | 3.4.x | |
| **Type Check** | tsc | - | |
| **Testing** | Vitest | 2.1.x | |

---

## 2. Project Structure

```
booth-checker/
├── src/
│   ├── entrypoints/           # WXT entry points
│   │   ├── popup/             # 확장 팝업 UI
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── index.html
│   │   ├── background.ts      # Service Worker
│   │   └── content.ts         # Content Script (페이지 주입)
│   │
│   ├── components/            # React 컴포넌트
│   │   ├── ui/                # shadcn/ui 컴포넌트
│   │   ├── EventList.tsx
│   │   ├── BoothList.tsx
│   │   ├── BoothDetail.tsx
│   │   ├── ItemChecklist.tsx
│   │   ├── AddBoothModal.tsx
│   │   └── ExportImage.tsx
│   │
│   ├── lib/                   # 유틸리티
│   │   ├── db.ts              # Dexie 스키마 & 인스턴스
│   │   ├── storage.ts         # wxt/storage 래퍼
│   │   ├── parser/            # 파싱 로직
│   │   │   ├── text.ts        # 텍스트 파싱
│   │   │   ├── image.ts       # 이미지 OCR
│   │   │   └── types.ts
│   │   └── export.ts          # 이미지 내보내기
│   │
│   ├── stores/                # Zustand stores
│   │   ├── useEventStore.ts
│   │   └── useUIStore.ts
│   │
│   ├── hooks/                 # Custom hooks
│   │   ├── useEvents.ts
│   │   ├── useBooths.ts
│   │   ├── useItems.ts
│   │   └── useBadges.ts       # 커스텀 뱃지 관리
│   │
│   ├── types/                 # TypeScript 타입
│   │   └── index.ts
│   │
│   └── constants/
│       └── presetBadges.ts    # 기본 뱃지 정의
│
├── public/
│   └── icon/                  # 확장 아이콘
│       ├── 16.png
│       ├── 32.png
│       ├── 48.png
│       └── 128.png
│
├── wxt.config.ts              # WXT 설정
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 3. Development Phases

### Phase 1: Foundation (Week 1)

| Task | Description | Estimate |
|------|-------------|----------|
| 프로젝트 셋업 | WXT + React + TypeScript + Tailwind 초기화 | 2h |
| Dexie 스키마 | Event, Booth, Item 테이블 정의 | 2h |
| 기본 UI 구조 | 팝업 레이아웃, 라우팅 (이벤트→부스→상품) | 4h |
| CRUD 기본 | 이벤트/부스/상품 생성/조회/수정/삭제 | 8h |

**Deliverable:** 수동으로 이벤트/부스/상품을 추가하고 관리할 수 있는 확장

### Phase 2: Parsing (Week 2)

| Task | Description | Estimate |
|------|-------------|----------|
| 텍스트 파서 | 부스번호, 서클명 정규식 파싱 (상품 X) | 4h |
| 뱃지 시스템 | 기본 뱃지 + 커스텀 뱃지 CRUD, 로컬 저장 | 3h |
| Content Script | 페이지에서 선택한 텍스트 가져오기 | 3h |
| 컨텍스트 메뉴 | 우클릭 → "부스 체커에 추가" | 2h |
| 파싱 확인 UI | 파싱 결과 미리보기 & 수정 모달 | 4h |
| Vision API 연동 (옵션) | 이미지 OCR → 텍스트 추출 | 4h |

**Deliverable:** 트위터에서 홍보글 선택 → 파싱 → 저장 워크플로우

### Phase 3: Polish (Week 3)

| Task | Description | Estimate |
|------|-------------|----------|
| 체크리스트 UI | 체크 토글, 진행률 표시 | 3h |
| 이미지 내보내기 | html-to-image로 체크리스트 PNG 생성 | 4h |
| 다크모드 | Tailwind dark variant | 2h |
| 정렬 기능 | 부스번호순, 추가순, 드래그 정렬 | 3h |
| 데이터 백업 | JSON export/import | 2h |
| 에러 핸들링 | 파싱 실패, 저장 실패 등 | 2h |

**Deliverable:** 출시 가능한 MVP

### Phase 4: Release (Week 4)

| Task | Description | Estimate |
|------|-------------|----------|
| 테스트 | E2E 테스트, 다양한 홍보글 파싱 테스트 | 4h |
| 아이콘 & 스크린샷 | 스토어 등록용 에셋 | 2h |
| 스토어 등록 | Chrome Web Store, Whale Store | 2h |
| 문서화 | README, 사용 가이드 | 2h |

---

## 4. Technical Details

### 4.1 WXT Configuration

```typescript
// wxt.config.ts
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Booth Checker - 부스 체커',
    description: '덕질 행사 부스 체크리스트 관리',
    version: '1.0.0',
    permissions: ['storage', 'contextMenus', 'activeTab'],
    host_permissions: ['<all_urls>'],
    action: {
      default_popup: 'popup.html',
      default_icon: {
        '16': 'icon/16.png',
        '32': 'icon/32.png',
        '48': 'icon/48.png',
        '128': 'icon/128.png',
      },
    },
  },
});
```

### 4.2 Dexie Schema

```typescript
// src/lib/db.ts
import Dexie, { type EntityTable } from 'dexie';
import type { Event, Booth, Item, Badge } from '@/types';

const db = new Dexie('BoothCheckerDB') as Dexie & {
  events: EntityTable<Event, 'id'>;
  booths: EntityTable<Booth, 'id'>;
  items: EntityTable<Item, 'id'>;
};

db.version(1).stores({
  events: '++id, name, date, createdAt',
  booths: '++id, eventId, boothNumber, circleName, order, createdAt',
  items: '++id, boothId, name, badgeId, checked, createdAt',
  badges: '++id, label, isPreset, createdAt', // 커스텀 뱃지 로컬 저장
});

// 기본 뱃지 초기화 (앱 시작 시)
async function initPresetBadges() {
  const presets = [
    { id: 'purchase', label: '구매', isPreset: true },
    { id: 'pickup', label: '수령', isPreset: true },
    { id: 'etc', label: '기타', isPreset: true },
  ];
  await db.badges.bulkPut(presets);
}

export { db, initPresetBadges };
```

### 4.3 Text Parsing Strategy

```typescript
// src/lib/parser/text.ts

// ⚠️ 상품은 파싱하지 않음 - 부스 정보만 추출
interface ParsedBooth {
  eventHint?: string;
  boothNumber?: string;
  circleName?: string;
  confidence: number; // 0-1
}

// 부스번호 패턴 (우선순위 순)
const BOOTH_PATTERNS = [
  /[A-Z]\d{1,2}-\d{1,3}/gi,           // A1-01, B12-123
  /[가-힣]+\d*[-\s]?[A-Z]?\d{1,3}/gi, // 홀1-A01, 신관 B32
  /부스\s*[:#]?\s*([A-Z0-9-]+)/gi,    // 부스: A-01
];

// 서클명 패턴 (이벤트명 뒤에 오는 경우)
const CIRCLE_PATTERNS = [
  /\]\s*(.+?)(?:입니다|예요|에요|!|$)/i,  // [서코45/A-01] 서클명입니다
  /서클[:\s]+(.+)/i,                       // 서클: 서클명
];

export function parseBoothText(text: string): ParsedBooth {
  // 구현 - 부스번호, 서클명만 추출
  // 상품 정보는 사용자가 직접 입력
}
```

### 4.4 Context Menu Setup

```typescript
// src/entrypoints/background.ts
export default defineBackground(() => {
  browser.contextMenus.create({
    id: 'add-to-booth-checker',
    title: '부스 체커에 추가',
    contexts: ['selection', 'image'],
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'add-to-booth-checker') {
      const selectedText = info.selectionText;
      const imageUrl = info.srcUrl;
      
      // Content script로 파싱 요청 또는 팝업 오픈
      await browser.action.openPopup();
      // 메시지로 데이터 전달
    }
  });
});
```

### 4.5 Image Export

```typescript
// src/lib/export.ts
import { toPng } from 'html-to-image';

export async function exportChecklist(elementId: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error('Element not found');

  const dataUrl = await toPng(element, {
    pixelRatio: 2, // Retina
    backgroundColor: '#ffffff',
  });

  const link = document.createElement('a');
  link.download = `booth-checklist-${Date.now()}.png`;
  link.href = dataUrl;
  link.click();
}
```

---

## 5. Commands

```bash
# 개발 서버 (Hot reload)
pnpm dev

# Chrome용 빌드
pnpm build

# Whale용 빌드 (동일)
pnpm build

# 타입 체크
pnpm typecheck

# 린트
pnpm lint

# 테스트
pnpm test

# 스토어 배포용 zip
pnpm zip
```

---

## 6. Dependencies

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "dexie": "^4.0.10",
    "dexie-react-hooks": "^1.1.7",
    "zustand": "^5.0.2",
    "html-to-image": "^1.11.11",
    "nanoid": "^5.0.9",
    "date-fns": "^4.1.0",
    "lucide-react": "^0.468.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "wxt": "^0.19.0",
    "@wxt-dev/module-react": "^1.1.0",
    "typescript": "^5.7.2",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "eslint": "^9.17.0",
    "prettier": "^3.4.2",
    "vitest": "^2.1.8",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 트위터 DOM 구조 변경 | 파싱 실패 | 선택 텍스트 기반 파싱 (DOM 의존 최소화) |
| Vision API 비용 | 무료 서비스 어려움 | 텍스트 파싱 우선, 이미지는 수동 입력 fallback |
| Manifest V3 제한 | Service Worker 불안정 | IndexedDB + storage 이중화 |
| 홍보글 양식 다양성 | 파싱 정확도 저하 | 파싱 실패 시 수동 입력 UX 강화 |

---

## 8. Future Considerations (v2.0+)

- [ ] 부스 배치도 업로드 & 마커 표시 (Fabric.js)
- [ ] 동선 그리기 & 내보내기
- [ ] 특정 사이트 자동 파싱 (dongne.co 등)
- [ ] 클라우드 동기화 (Firebase/Supabase)
- [ ] 공유 기능 (체크리스트 URL 공유)
- [ ] 모바일 PWA 버전
