import { defineMessages } from '../define';

/** First-run notice (ACORN-7): data handling, AI and ads, in plain words. */
export default defineMessages({
  en: {
    title: 'Welcome to {appName}',
    intro: 'Before you start, here is how your data is handled.',
    localTitle: 'Everything stays in this browser',
    localBody:
      'Events, booths, items and settings, including API keys, are saved only on this device. There is no account or sign-in, and nothing is stored on our servers.',
    aiTitle: 'Sent only to the AI you connect',
    aiBody:
      'Images and post text go only to the AI service you connect, and only when an analysis runs: when you tap Analyze, or right after a capture while automatic analysis is on. You can also add booths by hand without AI.',
    autoOn: 'On: a captured post is sent for analysis right away.',
    autoOff: 'Off: nothing is sent until you tap Analyze.',
    adsTitle: 'Non-personalized ads',
    adsBody:
      'A small sponsor card keeps the app free. Ads are chosen only by your display language, never from your data.',
    howAdsWork: 'How ads work',
    getStarted: 'Get started',
    connectAi: 'Connect AI now',
  },
  ko: {
    title: '{appName}에 오신 것을 환영합니다',
    intro: '시작하기 전에 데이터가 어떻게 다뤄지는지 알려드릴게요.',
    localTitle: '모든 데이터는 이 브라우저에',
    localBody:
      '행사, 부스, 상품, 그리고 API 키를 포함한 설정은 이 기기에만 저장됩니다. 계정이나 로그인이 없고, 저희 서버에는 아무것도 저장되지 않습니다.',
    aiTitle: '내가 연결한 AI로만 전송',
    aiBody:
      '이미지와 게시글은 내가 연결한 AI 서비스로만, 분석이 실행될 때만 전송됩니다. 분석하기를 누를 때, 그리고 자동 분석이 켜져 있으면 캡처 직후에 전송됩니다. AI 없이 부스를 직접 추가할 수도 있습니다.',
    autoOn: '켜짐: 캡처한 게시글을 바로 분석하도록 전송합니다.',
    autoOff: '꺼짐: 분석하기를 누르기 전에는 아무것도 전송하지 않습니다.',
    adsTitle: '맞춤형이 아닌 광고',
    adsBody:
      '작은 후원 카드 덕분에 무료로 운영됩니다. 광고는 표시 언어로만 고르며, 내 데이터는 절대 사용하지 않습니다.',
    howAdsWork: '광고 안내',
    getStarted: '시작하기',
    connectAi: '지금 AI 연결',
  },
  ja: {
    title: '{appName}へようこそ',
    intro: '始める前に、データの扱い方をお知らせします。',
    localTitle: 'データはすべてこのブラウザに',
    localBody:
      'イベント、ブース、商品、そしてAPIキーを含む設定は、この端末にのみ保存されます。アカウントやサインインはなく、当方のサーバーには何も保存されません。',
    aiTitle: '接続したAIにだけ送信',
    aiBody:
      '画像と投稿テキストは、接続したAIサービスにだけ、分析を実行するときにだけ送信されます。「分析する」を押したとき、また自動分析がオンならキャプチャの直後に送信されます。AIを使わずに手動でブースを追加することもできます。',
    autoOn: 'オン：キャプチャした投稿をすぐに分析のため送信します。',
    autoOff: 'オフ：「分析する」を押すまで何も送信しません。',
    adsTitle: 'パーソナライズされない広告',
    adsBody:
      '小さなスポンサーカードのおかげで無料で使えます。広告は表示言語だけで選ばれ、あなたのデータは一切使われません。',
    howAdsWork: '広告について',
    getStarted: 'はじめる',
    connectAi: '今すぐAIを接続',
  },
  'zh-CN': {
    title: '欢迎使用{appName}',
    intro: '开始之前，先说明一下你的数据是如何处理的。',
    localTitle: '所有数据都留在此浏览器中',
    localBody:
      '活动、展位、商品以及包括 API 密钥在内的设置只保存在这台设备上。无需账号或登录，我们的服务器不存储任何数据。',
    aiTitle: '只发送给你连接的 AI',
    aiBody:
      '图片和帖子文字只会发送给你连接的 AI 服务，并且只在运行分析时发送：点击“开始分析”时，或在开启自动分析时于截取后立即发送。你也可以不用 AI，手动添加展位。',
    autoOn: '开启：截取的帖子会立即发送进行分析。',
    autoOff: '关闭：点击“开始分析”之前不会发送任何内容。',
    adsTitle: '非个性化广告',
    adsBody:
      '一张小小的赞助卡片让应用保持免费。广告只按显示语言挑选，绝不使用你的数据。',
    howAdsWork: '广告说明',
    getStarted: '开始使用',
    connectAi: '立即连接 AI',
  },
  'zh-TW': {
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
  },
});
