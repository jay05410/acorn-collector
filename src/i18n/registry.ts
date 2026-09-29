/**
 * Where messages come from. English is bundled (it defines the keys and is
 * the per-key fallback); every other app language is a separate chunk,
 * found by folder name under ./locales and imported on first use.
 */
import type { LocaleMessages } from './define';
import { isAppLanguage, type AppLanguage } from './languages';
import en from './locales/en';

export const englishMessages = en;

type LocaleModule = { default: LocaleMessages };

const modules = import.meta.glob<LocaleModule>([
  './locales/*/index.ts',
  '!./locales/en/index.ts',
]);

/**
 * Loaders for the non-English app languages. A locale folder whose language
 * is not in APP_LANGUAGES (a draft) gets no loader, so it is never fetched.
 */
export const localeLoaders: Partial<
  Record<AppLanguage, () => Promise<LocaleMessages>>
> = {};

for (const [path, load] of Object.entries(modules)) {
  const language = path.split('/')[2];
  if (isAppLanguage(language)) {
    localeLoaders[language] = () => load().then((module) => module.default);
  }
}
