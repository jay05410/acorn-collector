import type { MessageTable } from '../../define';

/** First-run notice (ACORN-7): data handling, AI and ads, in plain words. */
export default {
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
} satisfies MessageTable;
