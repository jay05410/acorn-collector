import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getBadgeLabel,
  getCategoryLabel,
  getLanguage,
  getLanguageInfo,
  setLanguage,
  subscribeLanguage,
  t,
  tn,
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
});

describe('tp', () => {
  it('replaces every placeholder', () => {
    expect(
      tp('settings', 'importSuccess', { events: 1, booths: 2, items: 3 })
    ).toBe('Import complete. Events: 1, booths: 2, items: 3');
  });

  it('formats numbers with locale grouping', () => {
    expect(tp('analysis', 'selectedCount', { count: 1200 })).toBe(
      '1,200 selected'
    );
  });

  it('keeps placeholders that have no value', () => {
    expect(tp('booths', 'source', {})).toBe('Source: {url}');
  });

  it('does not re-interpret braces inside values', () => {
    expect(tp('booths', 'source', { url: '{url}/x' })).toBe('Source: {url}/x');
  });
});

describe('tn', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('picks the English one and other forms', () => {
    expect(tn('events', 'boothCount', 1)).toBe('1 booth');
    expect(tn('events', 'boothCount', 0)).toBe('0 booths');
    expect(tn('events', 'boothCount', 2)).toBe('2 booths');
    expect(tn('analysis', 'analyzingImages', 1)).toBe('Analyzing 1 image...');
    expect(tn('items', 'totalItems', 5)).toBe('5 items total');
  });

  it('formats the count with locale grouping', () => {
    expect(tn('events', 'boothCount', 1200)).toBe('1,200 booths');
  });

  it('uses the single Korean form for every count', () => {
    setLanguage('ko');
    expect(tn('events', 'boothCount', 1)).toBe('1개 부스');
    expect(tn('events', 'boothCount', 3)).toBe('3개 부스');
    expect(tn('analysis', 'analyzingImages', 2)).toBe('이미지 2개 분석 중...');
    expect(tn('items', 'totalItems', 1200)).toBe('총 1,200개 상품');
  });

  it('interpolates extra params and never lets them replace the count', () => {
    expect(tn('items', 'totalItems', 1, { count: 99 })).toBe('1 item total');
  });

  it('falls back to the _other form when the category has no message', () => {
    vi.spyOn(Intl.PluralRules.prototype, 'select').mockReturnValue('few');
    expect(tn('events', 'boothCount', 3)).toBe('3 booths');
  });

  it('only accepts base keys that have an _other form', () => {
    // @ts-expect-error 'title' has no plural forms
    expect(tn('events', 'title', 1)).toBe('title_other');
    // @ts-expect-error the full plural key is not a base key
    expect(tn('events', 'boothCount_other', 1)).toBe('boothCount_other_other');
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
    expect(getBadgeLabel({ id: 'pickup', label: '수령', isPreset: true })).toBe(
      '取貨'
    );
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
