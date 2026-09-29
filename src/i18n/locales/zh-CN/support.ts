import type { LocaleMessages } from '../../define';

/** Sponsor slots, the "About ads" dialog, house promos and donation links. */
export default {
  adLabel: '广告',
  adRegion: '广告位',
  opensInNewTab: '（在新标签页中打开）',
  aboutAdsButton: '关于此广告',
  aboutAdsTitle: '关于广告',
  aboutAdsIntro: '本扩展程序免费使用，开发费用由广告和赞助支持。',
  aboutAdsContextual: '广告只根据你的界面语言选择，不会使用你的任何其他信息。',
  aboutAdsNoTracking:
    '不做任何追踪：不统计展示和点击次数，也不使用 Cookie、追踪器或广告联盟。',
  aboutAdsNoPersonalData:
    '你的活动、展位、截取的网页和 AI 分析结果绝不会用于广告，也不会与任何人共享。',
  aboutAdsCampaignTag:
    '广告链接带有活动标记，因此广告主的网站可以看出访问来自本扩展程序。',
  aboutAdsNetwork:
    '广告列表和图片从 {host} 下载。与所有网络请求一样，{host} 会看到你的 IP 地址和浏览器类型。',
  aboutAdsNetworkOff:
    '不会为广告下载任何内容：此版本只显示扩展程序内置的消息。',
  privacyPolicy: '隐私政策',
  advertiseHere: '广告合作',
  houseDonateTitle: '觉得{appName}好用吗？',
  houseDonateBody:
    '这是一位开发者独立制作的免费工具。请我喝杯咖啡，支持持续开发。',
  houseDonateCta: '支持一下',
  houseRateTitle: '在 Chrome 应用商店给我们评分',
  houseRateBody: '一条简短的评价，就能帮助更多粉丝发现它。',
  houseRateCta: '去评分',
  houseShareTitle: '和朋友一起去活动吗？',
  houseShareBody: '分享{appName}，一起规划购物清单。',
  houseShareCta: '获取链接',
  houseAdvertiseTitle: '在此投放广告',
  houseAdvertiseBody: '触达正在规划活动购物的粉丝。无追踪，仅按语言投放。',
  houseAdvertiseCta: '联系我们',
  supportLinksLabel: '支持开发者',
  buyMeACoffee: 'Buy Me a Coffee',
  githubSponsors: 'GitHub Sponsors',
  supportTitle: '支持开发',
  supportBody:
    '感谢使用{appName}！它由一位开发者独立制作。如果它让你准备活动更轻松，欢迎小额赞助支持。',
  noPaywall: '所有功能永久免费，赞助不会解锁任何额外功能。',
} satisfies LocaleMessages['support'];
