import type { LocaleMessages } from '../../define';

export default {
  title: 'ブース',
  addBooth: '新規ブース追加',
  noBooths: '登録されたブースがありません',
  boothNumber: 'ブース番号',
  boothNumberPlaceholder: '例：A-01',
  circleName: 'サークル/作家名',
  circleNamePlaceholder: 'サークル名または作家名',
  zone: 'ゾーン（任意）',
  zonePlaceholder: '例：プチゾーン',
  formUrl: '通販フォーム/インフォリンク',
  memo: 'メモ',
  memoPlaceholder: '例：13時以降訪問',
  deleteConfirm: 'このブースを削除しますか？',
  sortByOrder: '追加順',
  sortByNumber: 'ブース番号順',
  openForm: '通販フォームを開く',
  openFormNumbered: '通販フォームを開く {index}',
  openSource: '元の投稿を開く',
  source: '元の投稿：{url}',
} satisfies LocaleMessages['booths'];
