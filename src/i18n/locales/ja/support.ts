import type { LocaleMessages } from '../../define';

/** Sponsor slots, the "About ads" dialog, house promos and donation links. */
export default {
  adLabel: '広告',
  adRegion: '広告枠',
  opensInNewTab: '(新しいタブで開きます)',
  aboutAdsButton: 'この広告について',
  aboutAdsTitle: '広告について',
  aboutAdsIntro:
    'この拡張機能は無料です。広告と支援で開発費をまかなっています。',
  aboutAdsContextual:
    '広告は表示言語だけをもとに選ばれます。それ以外の情報は一切使いません。',
  aboutAdsNoTracking:
    'トラッキングはしません。表示回数やクリック数を数えず、Cookie・トラッカー・広告ネットワークも使いません。',
  aboutAdsNoPersonalData:
    'イベント、ブース、キャプチャしたページ、AIの解析結果が広告に使われたり、共有されたりすることはありません。',
  aboutAdsCampaignTag:
    '広告のリンクにはキャンペーンタグが付いているため、広告主のサイトではこの拡張機能からの訪問だとわかります。',
  aboutAdsNetwork:
    '広告リストと画像は{host}からダウンロードします。一般的なWebリクエストと同じく、IPアドレスとブラウザの種類が{host}に送信されます。',
  aboutAdsNetworkOff:
    '広告のためにダウンロードするものはありません。このバージョンでは拡張機能に組み込まれたお知らせだけを表示します。',
  privacyPolicy: 'プライバシーポリシー',
  advertiseHere: '広告掲載のお問い合わせ',
  houseDonateTitle: '{appName}はお役に立っていますか？',
  houseDonateBody:
    '個人開発の無料ツールです。コーヒー1杯分の応援が励みになります。',
  houseDonateCta: '応援する',
  houseRateTitle: 'Chrome ウェブストアで評価をお願いします',
  houseRateBody: '短いレビューが、ほかのファンに届くきっかけになります。',
  houseRateCta: '評価する',
  houseShareTitle: '友だちとイベントに行きますか？',
  houseShareBody:
    '{appName}をシェアして、みんなで買い物リストを準備しましょう。',
  houseShareCta: 'リンクを見る',
  houseAdvertiseTitle: 'ここに広告を掲載しませんか',
  houseAdvertiseBody:
    'イベントの買い物を計画中のファンに届けます。トラッキングなし、言語だけで配信します。',
  houseAdvertiseCta: 'お問い合わせ',
  supportLinksLabel: '開発者を支援',
  buyMeACoffee: 'Buy Me a Coffee',
  githubSponsors: 'GitHub Sponsors',
  supportTitle: '開発を応援する',
  supportBody:
    '{appName}をご利用いただきありがとうございます。個人で開発しています。イベント準備のお役に立てたなら、ささやかな支援で応援していただけるとうれしいです。',
  noPaywall:
    'すべての機能は無料のままです。支援によって解放される機能はありません。',
} satisfies LocaleMessages['support'];
