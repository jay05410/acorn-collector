// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyColorTheme, applyDarkMode, followSystemDarkMode } from './theme';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.classList.remove('dark');
  vi.unstubAllGlobals();
});

describe('theme', () => {
  it('sets the color theme on the root element', () => {
    applyColorTheme('sky');
    expect(document.documentElement.getAttribute('data-theme')).toBe('sky');
  });

  it('toggles dark mode', () => {
    applyDarkMode(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    applyDarkMode(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('follows the system dark mode until stopped', () => {
    let listener: ((event: MediaQueryListEvent) => void) | undefined;
    const query = {
      matches: true,
      addEventListener: vi.fn((_type: string, fn: typeof listener) => {
        listener = fn;
      }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', vi.fn(() => query));

    const stop = followSystemDarkMode();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    listener?.({ matches: false } as MediaQueryListEvent);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    stop();
    expect(query.removeEventListener).toHaveBeenCalledWith('change', listener);
  });
});
