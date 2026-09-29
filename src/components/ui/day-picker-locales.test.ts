import { describe, expect, it } from 'vitest';
import { APP_LANGUAGES, LANGUAGE_INFO } from '@/i18n/languages';
import { DAY_PICKER_LOCALES } from './day-picker-locales';

describe('DAY_PICKER_LOCALES', () => {
  it.each(APP_LANGUAGES)('has a calendar locale for %s', async (language) => {
    const id = LANGUAGE_INFO[language].dayPickerLocale;
    expect(Object.keys(DAY_PICKER_LOCALES)).toContain(id);
    const load = DAY_PICKER_LOCALES[id];
    if (load === null) {
      // DayPicker's built-in locale.
      expect(id).toBe('en-US');
      return;
    }
    const locale = await load();
    expect(locale.code).toBe(id);
  });
});
