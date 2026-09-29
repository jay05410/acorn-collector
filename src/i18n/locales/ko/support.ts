import type { LocaleMessages } from '../../define';

/** Sponsor slots, the "About ads" dialog, house promos and donation links. */
export default {
  adLabel: '광고',
  adRegion: '광고 영역',
  opensInNewTab: '(새 탭에서 열림)',
  aboutAdsButton: '이 광고에 대해',
  aboutAdsTitle: '광고 안내',
  aboutAdsIntro:
    '이 확장 프로그램은 무료입니다. 광고와 후원으로 개발 비용을 충당합니다.',
  aboutAdsContextual:
    '광고는 표시 언어만 보고 고릅니다. 그 밖의 정보는 전혀 사용하지 않습니다.',
  aboutAdsNoTracking:
    '추적하지 않습니다. 노출이나 클릭 수를 세지 않으며 쿠키, 추적기, 광고 네트워크를 쓰지 않습니다.',
  aboutAdsNoPersonalData:
    '행사, 부스, 캡처한 페이지, AI 분석 결과는 광고에 쓰이지 않고 어디에도 공유되지 않습니다.',
  aboutAdsCampaignTag:
    '광고 링크에는 캠페인 태그가 붙어 있어, 광고주 사이트에서는 이 확장 프로그램을 통해 방문했다는 사실을 알 수 있습니다.',
  aboutAdsNetwork:
    '광고 목록과 이미지는 {host}에서 내려받습니다. 여느 웹 요청과 마찬가지로 IP 주소와 브라우저 종류가 {host}에 전달됩니다.',
  aboutAdsNetworkOff:
    '광고 때문에 내려받는 것은 없습니다. 이 버전은 확장 프로그램에 들어 있는 안내만 보여 줍니다.',
  privacyPolicy: '개인정보 처리방침',
  advertiseHere: '광고 문의',
  houseDonateTitle: '{appName}, 유용하게 쓰고 계신가요?',
  houseDonateBody:
    '1인 개발자가 무료로 만들고 있어요. 커피 한 잔이 큰 힘이 됩니다.',
  houseDonateCta: '후원하기',
  houseRateTitle: 'Chrome 웹 스토어에서 평가해 주세요',
  houseRateBody: '짧은 리뷰 하나가 다른 팬들이 찾는 데 큰 도움이 돼요.',
  houseRateCta: '평가하기',
  houseShareTitle: '친구와 함께 행사에 가시나요?',
  houseShareBody: '{appName}를 공유하고 함께 구매 목록을 준비해 보세요.',
  houseShareCta: '링크 받기',
  houseAdvertiseTitle: '이 자리에 광고하세요',
  houseAdvertiseBody:
    '행사 쇼핑을 준비하는 팬들에게 알려 보세요. 추적 없이 언어로만 노출합니다.',
  houseAdvertiseCta: '문의하기',
  supportLinksLabel: '개발자 후원',
  buyMeACoffee: 'Buy Me a Coffee',
  githubSponsors: 'GitHub Sponsors',
  supportTitle: '개발 후원하기',
  supportBody:
    '{appName}를 사용해 주셔서 감사합니다! 1인 개발자가 만들고 있어요. 행사 준비에 도움이 되었다면 작은 후원으로 응원해 주세요.',
  noPaywall:
    '모든 기능은 계속 무료예요. 후원한다고 추가로 열리는 기능은 없습니다.',
} satisfies LocaleMessages['support'];
