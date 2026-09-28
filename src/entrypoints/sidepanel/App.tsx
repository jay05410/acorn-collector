import { useState, useEffect, useCallback } from 'react';
import { EventList } from '@/components/EventList';
import { BoothDetail } from '@/components/BoothDetail';
import { Header } from '@/components/Header';
import { AddBoothModal } from '@/components/AddBoothModal';
import { SettingsModal } from '@/components/SettingsModal';
import { ChecklistReceipt } from '@/components/ChecklistReceipt';
import { useUIStore } from '@/stores/useUIStore';
import {
  appStorage,
  getSettings,
  watchSettings,
  type PendingAddData,
} from '@/lib/storage';
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
  const [pendingData, setPendingData] = useState<PendingAddData | null>(null);
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

  useEffect(() => {
    const checkPendingAdd = async () => {
      try {
        const pending = await appStorage.getPendingAdd();
        if (pending && Date.now() - pending.timestamp < 60000) {
          setPendingData(pending);
          setIsAddModalOpen(true);
          await appStorage.clearPendingAdd();
        }
      } catch (e) {
        console.error('Failed to check pending add:', e);
      }
    };

    checkPendingAdd();

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes.pendingAdd?.newValue) {
        const pending = changes.pendingAdd.newValue as PendingAddData;
        if (Date.now() - pending.timestamp < 60000) {
          setPendingData(pending);
          setIsAddModalOpen(true);
          appStorage.clearPendingAdd();
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

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
    setPendingData(null);
    setIsAddModalOpen(true);
  }, []);

  const handleCloseAddModal = useCallback(() => {
    setIsAddModalOpen(false);
    setPendingData(null);
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
        initialText={pendingData?.text}
        sourceUrl={pendingData?.url}
        author={pendingData?.author}
        imageUrls={pendingData?.imageUrls}
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
    </div>
  );
}
