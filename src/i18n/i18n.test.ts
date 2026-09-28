import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getBadgeLabel,
  getCategoryLabel,
  getLanguage,
  getLanguageInfo,
  setLanguage,
  subscribeLanguage,
  t,
  tp,
} from './index';
import type { AppLanguage } from './languages';

let initial: AppLanguage;

beforeEach(() => {
  initial = getLanguage();
  setLanguage('en');
});

afterEach(() => {
  setLanguage(initial);
});

describe('t', () => {
  it('returns the string for the current language', () => {
    expect(t('common', 'save')).toBe('Save');
    setLanguage('ko');
    expect(t('common', 'save')).toBe('저장');
    setLanguage('zh-TW');
    expect(t('booths', 'title')).toBe('攤位');
  });

  it('falls back to English for languages without the namespace', () => {
    setLanguage('th');
    expect(t('common', 'save')).toBe('Save');
  });
});

describe('tp', () => {
  it('replaces every placeholder', () => {
    expect(
      tp('settings', 'importSuccess', { events: 1, booths: 2, items: 3 })
    ).toBe('Imported 1 events, 2 booths and 3 items');
  });

  it('formats numbers with locale grouping', () => {
    expect(tp('events', 'boothCount', { count: 1200 })).toBe('1,200 booths');
  });

  it('keeps placeholders that have no value', () => {
    expect(tp('booths', 'source', {})).toBe('Source: {url}');
  });

  it('does not re-interpret braces inside values', () => {
    expect(tp('booths', 'source', { url: '{url}/x' })).toBe('Source: {url}/x');
  });
});

describe('language store', () => {
  it('notifies subscribers only on change', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLanguage(listener);

    setLanguage('ja');
    setLanguage('ja');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setLanguage('ko');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores unknown language codes', () => {
    setLanguage('zh' as AppLanguage);
    expect(getLanguage()).toBe('en');
  });

  it('exposes locale information for the current language', () => {
    setLanguage('zh-TW');
    expect(getLanguageInfo()).toMatchObject({
      intlLocale: 'zh-TW',
      defaultCurrency: 'TWD',
    });
  });
});

describe('getCategoryLabel', () => {
  it('localizes known categories, including set and digital', () => {
    setLanguage('ja');
    expect(getCategoryLabel('set')).toBe('セット');
    expect(getCategoryLabel('digital')).toBe('デジタル');
  });

  it('returns unknown categories unchanged', () => {
    expect(getCategoryLabel('mystery')).toBe('mystery');
  });
});

describe('getBadgeLabel', () => {
  it('localizes preset badges by id, ignoring the stored label', () => {
    setLanguage('zh-TW');
    expect(
      getBadgeLabel({ id: 'pickup', label: '수령', isPreset: true })
    ).toBe('取貨');
  });

  it('keeps custom badge labels', () => {
    expect(
      getBadgeLabel({ id: 'purchase', label: 'Mine', isPreset: false })
    ).toBe('Mine');
    expect(getBadgeLabel({ id: 'x1', label: 'Later', isPreset: false })).toBe(
      'Later'
    );
  });
});
