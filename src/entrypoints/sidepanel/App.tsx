import { useState, useEffect, useCallback } from 'react';
import { EventList } from '@/components/EventList';
import { BoothDetail } from '@/components/BoothDetail';
import { Header } from '@/components/Header';
import { AddBoothModal } from '@/components/AddBoothModal';
import { SettingsModal } from '@/components/SettingsModal';
import { ChecklistReceipt } from '@/components/ChecklistReceipt';
import { ToastViewport } from '@/components/ui/ToastViewport';
import { useUIStore } from '@/stores/useUIStore';
import { getSettings, watchSettings } from '@/lib/storage';
import { useCaptureHandoff } from '@/lib/capture/client';
import { prefillFromHandoff, type AddBoothPrefill } from '@/lib/capture/prefill';
import type { AppSettings, ColorTheme } from '@/lib/settings-types';
import { LANGUAGE_INFO } from '@/i18n/languages';
import { setLanguage, t, useLanguage } from '@/i18n';

type View = 'events' | 'booth-detail';

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
  const [isDark, setIsDark] = useState(() => getSystemPrefersDark());
  const [prefill, setPrefill] = useState<AddBoothPrefill | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportEventId, setExportEventId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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
    const applySettings = (settings: AppSettings) => {
      applyColorTheme(settings.colorTheme);
      setLanguage(settings.language);
      const dark = getSystemPrefersDark();
      setIsDark(dark);
      applyDarkMode(dark);
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
      setIsDark(e.matches);
      applyDarkMode(e.matches);
    };
    mediaQuery.addEventListener('change', handleSystemChange);

    return () => {
      unwatch();
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, [initialSettings]);

  const { handoff, consume } = useCaptureHandoff();

  // Minimal capture adapter until the review UI (ACORN-7): open the add form
  // prefilled from this window's capture, then clear the handoff so it is
  // not shown again.
  useEffect(() => {
    if (!handoff) return;
    setPrefill(prefillFromHandoff(handoff));
    setIsAddModalOpen(true);
    consume().catch((error: unknown) => {
      console.warn('[acorn] could not clear capture handoff', error);
    });
  }, [handoff, consume]);

  const handleSelectBooth = (boothId: string, eventId: string) => {
    setSelectedEventId(eventId);
    setSelectedBoothId(boothId);
    setCurrentView('booth-detail');
  };

  const handleExportEvent = (eventId: string) => {
    setExportEventId(eventId);
    setShowExport(true);
  };

  const handleAddBoothToEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    setIsAddModalOpen(true);
  };

  const handleBack = () => {
    setSelectedBoothId(null);
    setCurrentView('events');
  };

  const handleOpenAddModal = useCallback(() => {
    setPrefill(null);
    setIsAddModalOpen(true);
  }, []);

  const handleCloseAddModal = useCallback(() => {
    setIsAddModalOpen(false);
    setPrefill(null);
  }, []);

  return (
    <div
      className={`flex flex-col h-full ${isDark ? 'dark bg-gray-900' : 'bg-white'}`}
    >
      <Header
        currentView={currentView}
        onBack={handleBack}
        showBack={currentView !== 'events'}
        onAddClick={handleOpenAddModal}
        onSettingsClick={() => setShowSettings(true)}
      />
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
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
            onOpenSettings={() => setShowSettings(true)}
          />
        )}
      </main>

      <AddBoothModal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
        initialText={prefill?.text}
        sourceUrl={prefill?.url}
        author={prefill?.author}
        imageUrls={prefill?.imageUrls}
        defaultEventId={selectedEventId}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
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

      <ToastViewport />
    </div>
  );
}
