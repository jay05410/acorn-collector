import type { LocaleMessages } from '../../define';

/** Strings of the shared UI primitives and screen chrome (ACORN-10). */
export default {
  notifications: '通知',
  dismiss: '關閉通知',
  undo: '復原',
  decrease: '減少',
  increase: '增加',
  progress: '已勾選 {checked}/{total}',
  sortBy: '排序',
  imagesAttached: '附加圖片 {count} 張',
  opensInNewTab: '在新分頁中開啟',
} satisfies LocaleMessages['ui'];
