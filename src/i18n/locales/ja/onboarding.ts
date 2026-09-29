import type { LocaleMessages } from '../../define';

/** First-run notice (ACORN-7): data handling, AI and ads, in plain words. */
export default {
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
} satisfies LocaleMessages['onboarding'];
