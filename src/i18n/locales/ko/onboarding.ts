import type { LocaleMessages } from '../../define';

/** First-run notice (ACORN-7): data handling, AI and ads, in plain words. */
export default {
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
} satisfies LocaleMessages['onboarding'];
