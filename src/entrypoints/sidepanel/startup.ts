import { getLanguage, setLanguage } from '@/i18n';
import type { AppSettings } from '@/lib/settings-types';
import { getSettings } from '@/lib/storage';

/**
 * Reads the settings and loads and applies their language (or the detected
 * one when settings can't be read) before the first render, so the panel
 * never flashes another language or English fallbacks. App gets these
 * settings too, so startup reads (and migrates) them once. Never rejects.
 */
export async function loadStartupSettings(
  read: () => Promise<AppSettings> = getSettings
): Promise<AppSettings | undefined> {
  let settings: AppSettings | undefined;
  try {
    settings = await read();
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  await setLanguage(settings?.language ?? getLanguage());
  return settings;
}
