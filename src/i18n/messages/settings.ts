import { defineMessages } from '../define';

export default defineMessages({
  en: {
    title: 'Settings',
    colorTheme: 'Color Theme',
    language: 'Language',
    exportData: 'Export Data (JSON)',
    importData: 'Import Data',
    importSuccess:
      'Import complete. Events: {events}, booths: {booths}, items: {items}',
    importFailed: 'Import failed. Please check the file format.',
    exportFailed: 'Export failed. Please try again.',
  },
  ko: {
    title: '설정',
    colorTheme: '컬러 테마',
    language: '언어',
    exportData: '데이터 내보내기 (JSON)',
    importData: '데이터 가져오기',
    importSuccess:
      '가져오기 완료: 행사 {events}개, 부스 {booths}개, 상품 {items}개',
    importFailed: '가져오기 실패: 파일 형식을 확인해주세요',
    exportFailed: '내보내기에 실패했습니다. 다시 시도해주세요.',
  },
  ja: {
    title: '設定',
    colorTheme: 'カラーテーマ',
    language: '言語',
    exportData: 'データエクスポート (JSON)',
    importData: 'データインポート',
    importSuccess:
      'インポート完了：イベント{events}件、ブース{booths}件、商品{items}件',
    importFailed: 'インポートに失敗しました。ファイル形式を確認してください。',
    exportFailed: 'エクスポートに失敗しました。もう一度お試しください。',
  },
  'zh-CN': {
    title: '设置',
    colorTheme: '颜色主题',
    language: '语言',
    exportData: '导出数据 (JSON)',
    importData: '导入数据',
    importSuccess: '导入完成：{events} 个活动、{booths} 个展位、{items} 件商品',
    importFailed: '导入失败，请检查文件格式。',
    exportFailed: '导出失败，请重试。',
  },
  'zh-TW': {
    title: '設定',
    colorTheme: '主題色彩',
    language: '語言',
    exportData: '匯出資料 (JSON)',
    importData: '匯入資料',
    importSuccess: '匯入完成：{events} 個活動、{booths} 個攤位、{items} 件商品',
    importFailed: '匯入失敗，請檢查檔案格式。',
    exportFailed: '匯出失敗，請再試一次。',
  },
});
