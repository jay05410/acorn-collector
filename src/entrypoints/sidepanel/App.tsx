import { useState, useEffect, useCallback, useRef } from 'react';
import { EventList } from '@/components/EventList';
import { BoothDetail } from '@/components/BoothDetail';
import { Header } from '@/components/Header';
import {
  CaptureReviewSheet,
  type ReviewSource,
  type SavedBooth,
} from '@/components/capture/CaptureReviewSheet';
import { SettingsView } from '@/components/settings/SettingsView';
import type { SettingsSectionId } from '@/components/settings/section-ids';
import { FirstRunNotice } from '@/components/onboarding/FirstRunNotice';
import { ChecklistReceipt } from '@/components/ChecklistReceipt';
import { SponsorSlot } from '@/components/support/SponsorSlot';
import { CoveredLayer } from '@/components/ui/Layer';
import { ToastViewport } from '@/components/ui/ToastViewport';
import { showToast } from '@/components/ui/toast-store';
import { useUIStore } from '@/stores/useUIStore';
import { getSettings, watchSettings } from '@/lib/storage';
import { ensureAIRuntime, setRuntimeAISettings } from '@/lib/ai/runtime';
import { requestCapture, useCaptureHandoff } from '@/lib/capture/client';
import type { CaptureRequestFailure } from '@/lib/capture/messages';
import type { AppSettings, ColorTheme } from '@/lib/settings-types';
import { LANGUAGE_INFO } from '@/i18n/languages';
import { setLanguage, t, tp, useLanguage, type MessageKey } from '@/i18n';

type View = 'events' | 'booth-detail';

const CAPTURE_FAILURES: Record<CaptureRequestFailure, MessageKey<'capture'>> = {
  'no-tab': 'captureNoTab',
  'unsupported-page': 'captureUnsupported',
  superseded: 'captureSuperseded',
};

function getSystemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyColorTheme(colorTheme: ColorTheme): void {
  document.documentElement.setAttribute('data-theme', colorTheme);
}

function applyDarkMode(isDark: boolean): void {
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

interface AppProps {
  /** Settings read at bootstrap; App reads them itself when absent. */
  initialSettings?: AppSettings;
}

export default function App({ initialSettings }: AppProps) {
  const language = useLanguage();
  const [currentView, setCurrentView] = useState<View>('events');
  const [settings, setSettings] = useState<AppSettings | null>(
    initialSettings ?? null
  );
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>();
  const [showExport, setShowExport] = useState(false);
  const [exportEventId, setExportEventId] = useState<string | null>(null);
  const [reviewSource, setReviewSource] = useState<ReviewSource | null>(null);
  const [capturing, setCapturing] = useState(false);
  const manualCount = useRef(0);

  const {
    selectedEventId,
    selectedBoothId,
    setSelectedEventId,
    setSelectedBoothId,
  } = useUIStore();

  useEffect(() => {
    document.documentElement.lang = LANGUAGE_INFO[language].intlLocale;
    document.title = t('common', 'appName');
  }, [language]);

  useEffect(() => {
    ensureAIRuntime();
  }, []);

  useEffect(() => {
    const applySettings = (next: AppSettings) => {
      applyColorTheme(next.colorTheme);
      setLanguage(next.language);
      setRuntimeAISettings(next.ai);
      setSettings(next);
      applyDarkMode(getSystemPrefersDark());
    };

    if (initialSettings) {
      applySettings(initialSettings);
    } else {
      getSettings()
        .then(applySettings)
        .catch((error: unknown) => {
          console.error('Failed to load settings:', error);
        });
    }

    const unwatch = watchSettings(applySettings);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e: MediaQueryListEvent) => {
      applyDarkMode(e.matches);
    };
    mediaQuery.addEventListener('change', handleSystemChange);

    return () => {
      unwatch();
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, [initialSettings]);

  const { handoff, consume } = useCaptureHandoff();

  // A capture for this window opens the review sheet (a newer capture
  // replaces the one on screen). The handoff stays in session storage until
  // the booth is saved or the sheet is dismissed, so reopening the panel
  // shows it again.
  useEffect(() => {
    if (handoff) setReviewSource({ kind: 'capture', handoff });
  }, [handoff]);

  const releaseReview = useCallback(
    (source: ReviewSource | null) => {
      setReviewSource(null);
      if (source?.kind !== 'capture') return;
      consume().catch((error: unknown) => {
        console.warn('[acorn] could not clear capture handoff', error);
      });
    },
    [consume]
  );

  const handleSelectBooth = useCallback(
    (boothId: string, eventId: string) => {
      setSelectedEventId(eventId);
      setSelectedBoothId(boothId);
      setCurrentView('booth-detail');
    },
    [setSelectedEventId, setSelectedBoothId]
  );

  const handleSaved = useCallback(
    (booth: SavedBooth) => {
      releaseReview(reviewSource);
      showToast({
        message: tp('capture', 'savedToast', { name: booth.circleName }),
        tone: 'success',
        action: {
          label: t('capture', 'view'),
          onClick: () => handleSelectBooth(booth.boothId, booth.eventId),
        },
      });
    },
    [releaseReview, reviewSource, handleSelectBooth]
  );

  const handleCapture = useCallback(async () => {
    setCapturing(true);
    try {
      const response = await requestCapture();
      if (!response.ok) {
        showToast({
          message: t('capture', CAPTURE_FAILURES[response.code]),
          tone: 'error',
        });
      }
    } catch (error) {
      console.warn('[acorn] capture request failed', error);
      showToast({ message: t('capture', 'captureFailed'), tone: 'error' });
    } finally {
      setCapturing(false);
    }
  }, []);

  const onOpenSettings = useCallback(() => setShowSettings(true), []);

  const handleExportEvent = (eventId: string) => {
    setExportEventId(eventId);
    setShowExport(true);
  };

  const openManualReview = useCallback((eventId: string | null) => {
    manualCount.current += 1;
    setReviewSource({ kind: 'manual', id: manualCount.current, eventId });
  }, []);

  const handleAddBoothToEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    openManualReview(eventId);
  };

  const handleBack = () => {
    setSelectedBoothId(null);
    setCurrentView('events');
  };

  const adsEnabled = settings?.noticeAcceptedAt != null;

  return (
    <div className="flex h-full flex-col bg-canvas">
      {/* The panel and every sheet opened from it. Settings cover this layer
          instead of replacing it, so a review in progress (its edits and a
          running analysis) is still there when the user comes back. */}
      <CoveredLayer covered={showSettings} className="flex min-h-0 flex-1 flex-col">
        <Header
          currentView={currentView}
          onBack={handleBack}
          showBack={currentView !== 'events'}
          onAddClick={() => openManualReview(null)}
          onSettingsClick={onOpenSettings}
          onCaptureClick={() => void handleCapture()}
          capturing={capturing}
        />
        <main className="flex-1 overflow-y-auto bg-canvas">
          {currentView === 'events' && (
            <EventList
              onSelectBooth={handleSelectBooth}
              onExportEvent={handleExportEvent}
              onAddBooth={handleAddBoothToEvent}
            />
          )}
          {currentView === 'booth-detail' && selectedBoothId && (
            <BoothDetail
              boothId={selectedBoothId}
              settings={settings}
              onOpenSettings={onOpenSettings}
            />
          )}
        </main>
        {adsEnabled && <SponsorSlot placement="footer" />}

        <CaptureReviewSheet
          source={reviewSource}
          settings={settings}
          adsEnabled={adsEnabled}
          fallbackEventId={selectedEventId}
          onDismiss={() => releaseReview(reviewSource)}
          onSaved={handleSaved}
          onOpenSettings={onOpenSettings}
        />

        <FirstRunNotice
          onConnectAi={() => {
            setSettingsSection('ai');
            setShowSettings(true);
          }}
        />

        {showExport && exportEventId && (
          <ChecklistReceipt
            eventId={exportEventId}
            onClose={() => {
              setShowExport(false);
              setExportEventId(null);
            }}
          />
        )}
      </CoveredLayer>

      {/* Settings: a full view with its own top bar, in a layer above the
          panel and its dialogs (--z-overlay). */}
      {showSettings && (
        <div className="fixed inset-0 z-(--z-overlay) flex flex-col bg-canvas">
          <SettingsView
            initialSection={settingsSection}
            onBack={() => {
              setShowSettings(false);
              setSettingsSection(undefined);
            }}
          />
        </div>
      )}

      <ToastViewport />
    </div>
  );
}
