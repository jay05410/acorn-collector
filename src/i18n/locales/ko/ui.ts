import type { LocaleMessages } from '../../define';

/** Strings of the shared UI primitives and screen chrome (ACORN-10). */
export default {
  notifications: '알림',
  dismiss: '알림 닫기',
  undo: '실행 취소',
  decrease: '줄이기',
  increase: '늘리기',
  progress: '{total}개 중 {checked}개 체크',
  sortBy: '정렬',
  imagesAttached: '첨부 이미지 {count}장',
  opensInNewTab: '새 탭에서 열림',
} satisfies LocaleMessages['ui'];
