import type { LocaleMessages } from '../../define';

/** Strings of the shared UI primitives and screen chrome (ACORN-10). */
export default {
  notifications: '通知',
  dismiss: '关闭通知',
  undo: '撤销',
  decrease: '减少',
  increase: '增加',
  progress: '已勾选 {checked}/{total}',
  sortBy: '排序',
  imagesAttached: '附带图片 {count} 张',
  opensInNewTab: '在新标签页中打开',
} satisfies LocaleMessages['ui'];
