import type { LocaleMessages } from '../../define';

/** Sponsor slots, the "About ads" dialog, house promos and donation links. */
export default {
  adLabel: '廣告',
  adRegion: '廣告版位',
  opensInNewTab: '（在新分頁中開啟）',
  aboutAdsButton: '關於此廣告',
  aboutAdsTitle: '關於廣告',
  aboutAdsIntro: '本擴充功能免費使用，開發費用由廣告和贊助支持。',
  aboutAdsContextual: '廣告只依據你的介面語言挑選，不會使用你的任何其他資訊。',
  aboutAdsNoTracking:
    '不做任何追蹤：不計算曝光和點擊次數，也不使用 Cookie、追蹤器或廣告聯播網。',
  aboutAdsNoPersonalData:
    '你的活動、攤位、擷取的網頁和 AI 分析結果絕不會用於廣告，也不會與任何人分享。',
  aboutAdsCampaignTag:
    '廣告連結附有活動標記，因此廣告主的網站可以得知造訪來自本擴充功能。',
  aboutAdsNetwork:
    '廣告清單和圖片從 {host} 下載。與所有網路要求一樣，{host} 會看到你的 IP 位址和瀏覽器類型。',
  aboutAdsNetworkOff:
    '不會為廣告下載任何內容：此版本只顯示擴充功能內建的訊息。',
  privacyPolicy: '隱私權政策',
  advertiseHere: '廣告合作',
  houseDonateTitle: '覺得{appName}好用嗎？',
  houseDonateBody:
    '這是由一位開發者獨立製作的免費工具。請我喝杯咖啡，支持持續開發。',
  houseDonateCta: '贊助',
  houseRateTitle: '到 Chrome 線上應用程式商店給我們評分',
  houseRateBody: '一則簡短的評論，就能幫助更多粉絲找到它。',
  houseRateCta: '去評分',
  houseShareTitle: '要和朋友一起去活動嗎？',
  houseShareBody: '分享{appName}，一起規劃購物清單。',
  houseShareCta: '取得連結',
  houseAdvertiseTitle: '在此刊登廣告',
  houseAdvertiseBody: '觸及正在規劃活動採購的粉絲。不追蹤，只依語言投放。',
  houseAdvertiseCta: '聯絡我們',
  supportLinksLabel: '支持開發者',
  buyMeACoffee: 'Buy Me a Coffee',
  githubSponsors: 'GitHub Sponsors',
  supportTitle: '支持開發',
  supportBody:
    '感謝使用{appName}！它由一位開發者獨立製作。如果它讓你準備活動更輕鬆，歡迎小額贊助支持。',
  noPaywall: '所有功能永久免費，贊助不會解鎖任何額外功能。',
} satisfies LocaleMessages['support'];
