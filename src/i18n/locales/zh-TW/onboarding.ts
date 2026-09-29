import type { LocaleMessages } from '../../define';

/** First-run notice (ACORN-7): data handling, AI and ads, in plain words. */
export default {
  title: '歡迎使用{appName}',
  intro: '開始之前，先說明你的資料會如何處理。',
  localTitle: '所有資料都留在這個瀏覽器中',
  localBody:
    '活動、攤位、商品以及包含 API 金鑰在內的設定，只會儲存在這台裝置上。不需要帳號或登入，我們的伺服器不會儲存任何資料。',
  aiTitle: '只傳送給你連結的 AI',
  aiBody:
    '圖片和貼文文字只會傳送給你連結的 AI 服務，而且只在執行分析時傳送：點選「開始分析」時，或在開啟自動分析時於擷取後立即傳送。你也可以不用 AI，手動新增攤位。',
  autoOn: '開啟：擷取的貼文會立即傳送進行分析。',
  autoOff: '關閉：點選「開始分析」之前不會傳送任何內容。',
  adsTitle: '非個人化廣告',
  adsBody:
    '一張小小的贊助卡片讓應用程式維持免費。廣告只依顯示語言挑選，絕不使用你的資料。',
  howAdsWork: '廣告說明',
  getStarted: '開始使用',
  connectAi: '立即連結 AI',
} satisfies LocaleMessages['onboarding'];
