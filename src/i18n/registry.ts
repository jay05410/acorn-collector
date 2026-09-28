/**
 * Every message namespace, imported explicitly so bundlers can see them.
 * Register a new file under ./messages here (the registry test enforces it).
 */
import analysis from './messages/analysis';
import badges from './messages/badges';
import booths from './messages/booths';
import categories from './messages/categories';
import common from './messages/common';
import currency from './messages/currency';
import errors from './messages/errors';
import events from './messages/events';
import exportMessages from './messages/export';
import items from './messages/items';
import settings from './messages/settings';
import themes from './messages/themes';
import ui from './messages/ui';

export const namespaces = {
  analysis,
  badges,
  booths,
  categories,
  common,
  currency,
  errors,
  events,
  export: exportMessages,
  items,
  settings,
  themes,
  ui,
};
