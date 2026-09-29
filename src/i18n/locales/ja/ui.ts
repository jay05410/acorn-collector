import type { LocaleMessages } from '../../define';

/** Strings of the shared UI primitives and screen chrome (ACORN-10). */
export default {
  notifications: '通知',
  dismiss: '通知を閉じる',
  undo: '元に戻す',
  decrease: '減らす',
  increase: '増やす',
  progress: '{total}件中{checked}件チェック済み',
  sortBy: '並べ替え',
  imagesAttached: '添付画像 {count}枚',
  opensInNewTab: '新しいタブで開きます',
} satisfies LocaleMessages['ui'];
