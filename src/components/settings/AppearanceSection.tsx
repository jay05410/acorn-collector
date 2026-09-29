import { useId } from 'react';
import { Check, Palette } from 'lucide-react';
import { t, useLanguage } from '@/i18n';
import {
  APP_LANGUAGES,
  LANGUAGE_INFO,
  type AppLanguage,
} from '@/i18n/languages';
import type { AppSettings, ColorTheme } from '@/lib/settings-types';
import { cn } from '@/lib/utils';
import { SettingsSection } from './SettingsSection';
import { COLOR_THEMES, swatchStyle } from './theme-swatches';
import type { UpdateSettings } from './useSettings';

const OPTION_FOCUS =
  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus';

function SelectedMark() {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary-strong text-on-primary shadow-sm ring-2 ring-surface"
    >
      <Check className="size-3" strokeWidth={3.25} />
    </span>
  );
}

interface AppearanceSectionProps {
  settings: AppSettings;
  update: UpdateSettings;
}

export function AppearanceSection({ settings, update }: AppearanceSectionProps) {
  useLanguage();
  const themeName = useId();
  const languageName = useId();

  const handleTheme = (colorTheme: ColorTheme) => {
    void update({ colorTheme });
  };

  // App applies the (optimistic) language, so the view switches at once.
  const handleLanguage = (language: AppLanguage) => {
    void update({ language });
  };

  return (
    <SettingsSection
      id="appearance"
      icon={Palette}
      title={t('settingsView', 'sectionAppearance')}
    >
      <fieldset className="min-w-0">
        <legend className="mb-2 text-[13px] leading-5 font-medium text-fg">
          {t('settings', 'colorTheme')}
        </legend>
        <div className="grid grid-cols-4 gap-2">
          {COLOR_THEMES.map((theme) => {
            const checked = settings.colorTheme === theme;
            return (
              <label
                key={theme}
                style={swatchStyle(theme)}
                className={cn(
                  'relative flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border bg-surface-raised p-1.5 pb-2 transition-[border-color,box-shadow] duration-150 ease-out',
                  OPTION_FOCUS,
                  checked
                    ? 'border-primary-strong ring-1 ring-primary-strong ring-inset'
                    : 'border-line hover:border-line-strong'
                )}
              >
                <input
                  type="radio"
                  name={themeName}
                  value={theme}
                  checked={checked}
                  onChange={() => handleTheme(theme)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className="flex h-12 w-full flex-col justify-between rounded-lg bg-(--sw-l-soft) p-1.5 dark:bg-(--sw-d-soft)"
                >
                  <span className="flex flex-col gap-1">
                    <span className="h-1.5 w-3/4 rounded-full bg-(--sw-l-primary) dark:bg-(--sw-d-primary)" />
                    <span className="h-1.5 w-1/2 rounded-full bg-(--sw-l-primary)/45 dark:bg-(--sw-d-primary)/45" />
                  </span>
                  <span className="h-3.5 w-3/5 self-end rounded bg-(--sw-l-strong) dark:bg-(--sw-d-strong)" />
                </span>
                <span className="max-w-full truncate text-xs font-medium text-fg">
                  {t('themes', theme)}
                </span>
                {checked && <SelectedMark />}
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-fg-subtle">
          {t('settingsView', 'darkModeNote')}
        </p>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className="mb-2 text-[13px] leading-5 font-medium text-fg">
          {t('settings', 'language')}
        </legend>
        <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3">
          {/* Every app language is complete (types + i18n:check), so all are offered. */}
          {APP_LANGUAGES.map((code) => {
            const info = LANGUAGE_INFO[code];
            const checked = settings.language === code;
            return (
              <label
                key={code}
                lang={info.intlLocale}
                className={cn(
                  'relative flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm transition-[background-color,border-color,box-shadow] duration-150 ease-out',
                  OPTION_FOCUS,
                  checked
                    ? 'border-primary-strong bg-primary-soft font-semibold text-primary-strong ring-1 ring-primary-strong ring-inset'
                    : 'border-line bg-surface-raised text-fg hover:border-line-strong'
                )}
              >
                <input
                  type="radio"
                  name={languageName}
                  value={code}
                  checked={checked}
                  onChange={() => handleLanguage(code)}
                  className="sr-only"
                />
                <span className="truncate">{info.nativeName}</span>
                {checked && <SelectedMark />}
              </label>
            );
          })}
        </div>
      </fieldset>
    </SettingsSection>
  );
}
