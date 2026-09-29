/**
 * Every message namespace, imported explicitly so bundlers can see them.
 * Register a new file under ./messages here (the registry test enforces it).
 */
import aiConnect from './messages/aiConnect';
import aiErrors from './messages/aiErrors';
import analysis from './messages/analysis';
import badges from './messages/badges';
import booths from './messages/booths';
import bridgeUi from './messages/bridgeUi';
import capture from './messages/capture';
import categories from './messages/categories';
import common from './messages/common';
import currency from './messages/currency';
import errors from './messages/errors';
import events from './messages/events';
import exportMessages from './messages/export';
import items from './messages/items';
import onboarding from './messages/onboarding';
import review from './messages/review';
import settings from './messages/settings';
import settingsView from './messages/settingsView';
import support from './messages/support';
import themes from './messages/themes';
import ui from './messages/ui';

export const namespaces = {
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
};
