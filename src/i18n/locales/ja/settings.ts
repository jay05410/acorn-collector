import type { LocaleMessages } from '../../define';

export default {
  title: '設定',
  colorTheme: 'カラーテーマ',
  language: '言語',
  exportData: 'データエクスポート (JSON)',
  importData: 'データインポート',
  importSuccess:
    'インポート完了：イベント{events}件、ブース{booths}件、商品{items}件',
  importFailed: 'インポートに失敗しました。ファイル形式を確認してください。',
  exportFailed: 'エクスポートに失敗しました。もう一度お試しください。',
} satisfies LocaleMessages['settings'];
