/**
 * Applies the appearance settings to the document: the color theme (CSS
 * tokens keyed on `<html data-theme>`) and dark mode, which follows the
 * system setting (`<html class="dark">`).
 */
import type { ColorTheme } from '@/lib/settings-types';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function applyColorTheme(colorTheme: ColorTheme): void {
  document.documentElement.setAttribute('data-theme', colorTheme);
}

export function applyDarkMode(isDark: boolean): void {
  document.documentElement.classList.toggle('dark', isDark);
}

/** Applies the system's dark mode now and whenever it changes; returns a stop function. */
export function followSystemDarkMode(): () => void {
  const query = window.matchMedia(DARK_QUERY);
  applyDarkMode(query.matches);
  const onChange = (event: MediaQueryListEvent) => applyDarkMode(event.matches);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
