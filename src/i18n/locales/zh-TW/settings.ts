import type { LocaleMessages } from '../../define';

export default {
  title: '設定',
  colorTheme: '主題色彩',
  language: '語言',
  exportData: '匯出資料 (JSON)',
  importData: '匯入資料',
  importSuccess: '匯入完成：{events} 個活動、{booths} 個攤位、{items} 件商品',
  importFailed: '匯入失敗，請檢查檔案格式。',
  exportFailed: '匯出失敗，請再試一次。',
} satisfies LocaleMessages['settings'];
