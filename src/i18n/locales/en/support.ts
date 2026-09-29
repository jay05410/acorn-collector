import type { MessageTable } from '../../define';

/** Sponsor slots, the "About ads" dialog, house promos and donation links. */
export default {
  adLabel: 'Ad',
  adRegion: 'Advertisement',
  opensInNewTab: '(opens in a new tab)',
  aboutAdsButton: 'About this ad',
  aboutAdsTitle: 'About ads',
  aboutAdsIntro:
    'This extension is free. Ads and donations help pay for its development.',
  aboutAdsContextual:
    'Ads are chosen only by your display language. Nothing else about you is used.',
  aboutAdsNoTracking:
    'No tracking: views and clicks are not counted, and no cookies, trackers or ad networks are used.',
  aboutAdsNoPersonalData:
    'Your events, booths, captured pages and AI results are never used for ads and never shared.',
  aboutAdsCampaignTag:
    "Ad links include a campaign tag, so the sponsor's own site can see that a visit came from this extension.",
  aboutAdsNetwork:
    'The ad list and its images are downloaded from {host}. Like any web request, this shows your IP address and browser type to {host}.',
  aboutAdsNetworkOff:
    'Nothing is downloaded for ads: this version only shows messages built into the extension.',
  privacyPolicy: 'Privacy policy',
  advertiseHere: 'Advertise here',
  houseDonateTitle: 'Enjoying {appName}?',
  houseDonateBody:
    'It is free and made by one developer. A coffee keeps it going.',
  houseDonateCta: 'Support',
  houseRateTitle: 'Rate us on the Chrome Web Store',
  houseRateBody: 'A short review helps other fans find it.',
  houseRateCta: 'Rate',
  houseShareTitle: 'Going to an event with friends?',
  houseShareBody: 'Share {appName} so everyone can plan their haul.',
  houseShareCta: 'Get the link',
  houseAdvertiseTitle: 'Advertise here',
  houseAdvertiseBody:
    'Reach fans planning their event shopping. No tracking, language targeting only.',
  houseAdvertiseCta: 'Contact',
  supportLinksLabel: 'Support the developer',
  buyMeACoffee: 'Buy Me a Coffee',
  githubSponsors: 'GitHub Sponsors',
  supportTitle: 'Support development',
  supportBody:
    'Thanks for using {appName}! It is made by one developer. If it helps you at events, a small donation keeps it going.',
  noPaywall: 'Every feature stays free. Donations never unlock anything.',
} satisfies MessageTable;
