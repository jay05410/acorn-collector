import type { LocaleMessages } from '../../define';

/** First-run notice (ACORN-7): data handling, AI and ads, in plain words. */
export default {
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
} satisfies LocaleMessages['onboarding'];
