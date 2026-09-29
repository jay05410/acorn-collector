import type { LocaleMessages } from '../../define';
import aiConnect from './aiConnect';
import aiErrors from './aiErrors';
import analysis from './analysis';
import badges from './badges';
import booths from './booths';
import bridgeUi from './bridgeUi';
import capture from './capture';
import categories from './categories';
import common from './common';
import currency from './currency';
import errors from './errors';
import events from './events';
import exportMessages from './export';
import items from './items';
import onboarding from './onboarding';
import review from './review';
import settings from './settings';
import settingsView from './settingsView';
import support from './support';
import themes from './themes';
import ui from './ui';

/** zh-CN messages, loaded on demand. Generated layout; see docs/v2/I18N.md. */
export default {
  aiConnect,
  aiErrors,
  analysis,
  badges,
  booths,
  bridgeUi,
  capture,
  categories,
  common,
  currency,
  errors,
  events,
  export: exportMessages,
  items,
  onboarding,
  review,
  settings,
  settingsView,
  support,
  themes,
  ui,
} satisfies LocaleMessages;
