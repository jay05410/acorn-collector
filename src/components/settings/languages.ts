/**
 * Languages offered in the picker: those whose every message namespace is
 * complete. The core five always are (completeness test); extended ones
 * appear once ACORN-9 fills their namespaces.
 */
import { APP_LANGUAGES, type AppLanguage } from '@/i18n/languages';
import { namespaces } from '@/i18n/registry';

type Tables = Record<
  string,
  Partial<Record<AppLanguage, Partial<Record<string, string>>>> & {
    en: Record<string, string>;
  }
>;

export function isLanguageAvailable(
  language: AppLanguage,
  tables: Tables = namespaces as unknown as Tables
): boolean {
  return Object.values(tables).every((table) => {
    const messages = table[language];
    if (!messages) return false;
    return Object.keys(table.en).every((key) => {
      const value = messages[key];
      return typeof value === 'string' && value.trim() !== '';
    });
  });
}

/**
 * Languages to list, in APP_LANGUAGES order. `current` is always included,
 * so a language picked before (or detected from the browser) stays visible
 * as the checked option even if it is incomplete.
 */
export function pickerLanguages(
  current: AppLanguage,
  tables?: Tables
): AppLanguage[] {
  return APP_LANGUAGES.filter(
    (language) => language === current || isLanguageAvailable(language, tables)
  );
}
