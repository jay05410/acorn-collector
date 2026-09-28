import { useEffect, useRef, type KeyboardEvent } from 'react';
import { ChevronLeft } from 'lucide-react';
import { SponsorSlot } from '@/components/support/SponsorSlot';
import { SupportCard } from '@/components/support/SupportCard';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { setLanguage, t, useLanguage } from '@/i18n';
import { AboutSection } from './AboutSection';
import { AiConnectionSection } from './AiConnectionSection';
import { AnalysisSection } from './AnalysisSection';
import { AppearanceSection } from './AppearanceSection';
import type { CliCheckDeps } from './cli-check';
import { DataSection } from './DataSection';
import {
  sectionElementId,
  sectionHeadingId,
  type SettingsSectionId,
} from './section-ids';
import type { SettingsBackend } from './settings-controller';
import { useSettings } from './useSettings';

export interface SettingsViewProps {
  onBack: () => void;
  /** Scrolls to and focuses this section once settings have loaded. */
  initialSection?: SettingsSectionId;
  /** Injected in tests. */
  backend?: SettingsBackend;
  cliDeps?: CliCheckDeps;
}

/** Escape goes back unless a dialog inside the view is handling it. */
function isInsideDialog(target: EventTarget): boolean {
  return (
    target instanceof Element &&
    target.closest('dialog, [role="dialog"], [role="alertdialog"]') !== null
  );
}

function SettingsSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      {[0, 1, 2].map((index) => (
        <div key={index} className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="mt-4 h-16 w-full rounded-lg" />
          <Skeleton className="mt-2 h-16 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/**
 * Settings as a full side-panel view with its own top bar: AI connection,
 * analysis, appearance, data, support and about. Every change is saved at
 * once (optimistically, rolled back with a toast if storage fails).
 */
export function SettingsView({
  onBack,
  initialSection,
  backend,
  cliDeps,
}: SettingsViewProps) {
  useLanguage();
  const { settings, update } = useSettings(backend);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const jumped = useRef(false);
  const language = settings?.language;
  const colorTheme = settings?.colorTheme;

  // Optimistic language and theme, and their rollback when a save fails.
  // (App also applies stored changes; applying twice is harmless.)
  useEffect(() => {
    if (language) setLanguage(language);
  }, [language]);
  useEffect(() => {
    if (colorTheme) document.documentElement.setAttribute('data-theme', colorTheme);
  }, [colorTheme]);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const loaded = settings !== null;
  useEffect(() => {
    if (!loaded || !initialSection || jumped.current) return;
    jumped.current = true;
    document
      .getElementById(sectionElementId(initialSection))
      ?.scrollIntoView({ block: 'start' });
    document.getElementById(sectionHeadingId(initialSection))?.focus();
  }, [loaded, initialSection]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (isInsideDialog(event.target)) return;
    onBack();
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-canvas"
      onKeyDown={handleKeyDown}
    >
      <header className="sticky top-0 z-(--z-sticky) flex h-13 shrink-0 items-center gap-1 border-b border-line bg-surface px-2">
        <IconButton label={t('common', 'back')} onClick={onBack}>
          <ChevronLeft />
        </IconButton>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="min-w-0 flex-1 truncate px-1 text-base font-semibold text-fg outline-none"
        >
          {t('settings', 'title')}
        </h1>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div
          aria-busy={!loaded}
          className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pt-4 pb-10"
        >
          {settings ? (
            <>
              <AiConnectionSection
                settings={settings}
                update={update}
                cliDeps={cliDeps}
              />
              <AnalysisSection settings={settings} update={update} />
              <AppearanceSection settings={settings} update={update} />
              <DataSection />
              <SupportCard className="rounded-xl border-line bg-surface p-4 shadow-xs dark:border-line dark:bg-surface" />
              {settings.noticeAcceptedAt !== null && (
                <SponsorSlot placement="settings" className="rounded-xl" />
              )}
              <AboutSection />
            </>
          ) : (
            <SettingsSkeleton />
          )}
        </div>
      </main>
    </div>
  );
}
