/**
 * Preview colors for the theme picker. The brand tokens in app.css only apply
 * to the root element (`:root[data-theme=...]`), so a swatch cannot switch
 * them locally; these mirror the brand-l-* and brand-d-* values there.
 * Keep them in sync when a palette changes.
 */
import type { CSSProperties } from 'react';
import type { ColorTheme } from '@/lib/settings-types';

export const COLOR_THEMES: readonly ColorTheme[] = [
  'acorn',
  'pink',
  'sky',
  'lavender',
];

interface Palette {
  primary: string;
  strong: string;
  soft: string;
}

const PALETTES: Record<ColorTheme, { light: Palette; dark: Palette }> = {
  acorn: {
    light: {
      primary: 'oklch(60.5% 0.105 58)',
      strong: 'oklch(48.5% 0.095 52)',
      soft: 'oklch(94.6% 0.03 72)',
    },
    dark: {
      primary: 'oklch(70% 0.1 64)',
      strong: 'oklch(81% 0.085 72)',
      soft: 'oklch(31% 0.04 60)',
    },
  },
  pink: {
    light: {
      primary: 'oklch(62% 0.15 358)',
      strong: 'oklch(51% 0.16 358)',
      soft: 'oklch(95.3% 0.024 355)',
    },
    dark: {
      primary: 'oklch(72% 0.13 358)',
      strong: 'oklch(82% 0.085 358)',
      soft: 'oklch(31% 0.055 358)',
    },
  },
  sky: {
    light: {
      primary: 'oklch(60% 0.11 240)',
      strong: 'oklch(49.5% 0.11 245)',
      soft: 'oklch(95.3% 0.02 235)',
    },
    dark: {
      primary: 'oklch(72% 0.1 238)',
      strong: 'oklch(82% 0.075 232)',
      soft: 'oklch(31% 0.045 240)',
    },
  },
  lavender: {
    light: {
      primary: 'oklch(60% 0.13 295)',
      strong: 'oklch(49.5% 0.15 292)',
      soft: 'oklch(95.3% 0.025 300)',
    },
    dark: {
      primary: 'oklch(72% 0.11 295)',
      strong: 'oklch(82% 0.075 295)',
      soft: 'oklch(31% 0.055 295)',
    },
  },
};

/**
 * CSS variables for one swatch: --sw-l-* (light) and --sw-d-* (dark), used
 * as `bg-(--sw-l-soft) dark:bg-(--sw-d-soft)`.
 */
export function swatchStyle(theme: ColorTheme): CSSProperties {
  const { light, dark } = PALETTES[theme];
  return {
    '--sw-l-primary': light.primary,
    '--sw-l-strong': light.strong,
    '--sw-l-soft': light.soft,
    '--sw-d-primary': dark.primary,
    '--sw-d-strong': dark.strong,
    '--sw-d-soft': dark.soft,
  } as CSSProperties;
}
