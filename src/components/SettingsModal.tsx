import { useState, useEffect, useRef } from 'react';
import { X, Upload, Download, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  createDefaultSettings,
  getSettings,
  updateSettings,
  type SettingsPatch,
} from '@/lib/storage';
import type { AppSettings, ColorTheme } from '@/lib/settings-types';
import {
  CORE_LANGUAGES,
  LANGUAGE_INFO,
  type AppLanguage,
} from '@/i18n/languages';
import { getLanguage, setLanguage, t, tp, useLanguage } from '@/i18n';
import { exportDataAsJson, importDataFromJson } from '@/lib/export';

const COLOR_THEMES: {
  value: ColorTheme;
  colors: { primary: string; accent: string };
}[] = [
  { value: 'acorn', colors: { primary: '#d4a574', accent: '#f5e6d3' } },
  { value: 'pink', colors: { primary: '#e8a0b4', accent: '#fce4ec' } },
  { value: 'sky', colors: { primary: '#7eb8da', accent: '#e3f2fd' } },
  { value: 'lavender', colors: { primary: '#b39ddb', accent: '#ede7f6' } },
];

const STATUS_DURATION_MS = 3000;

type BackupStatus = { kind: 'success' | 'error'; message: string } | null;

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

async function persist(patch: SettingsPatch): Promise<void> {
  try {
    await updateSettings(patch);
  } catch (error) {
    console.error('[settings] could not save settings', error);
  }
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  useLanguage();
  // Until storage answers, show the language the UI is already using.
  const [settings, setSettings] = useState<AppSettings>(() => ({
    ...createDefaultSettings(),
    language: getLanguage(),
  }));
  const [backupStatus, setBackupStatus] = useState<BackupStatus>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    getSettings()
      .then(setSettings)
      .catch((error: unknown) => {
        console.error('[settings] could not load settings', error);
      });
  }, [isOpen]);

  useEffect(() => {
    if (!backupStatus) return;
    const timer = setTimeout(() => setBackupStatus(null), STATUS_DURATION_MS);
    return () => clearTimeout(timer);
  }, [backupStatus]);

  const handleColorThemeChange = (colorTheme: ColorTheme) => {
    setSettings((prev) => ({ ...prev, colorTheme }));
    void persist({ colorTheme });
  };

  const handleLanguageChange = (language: AppLanguage) => {
    setSettings((prev) => ({ ...prev, language }));
    setLanguage(language);
    void persist({ language });
  };

  const handleExport = async () => {
    try {
      await exportDataAsJson();
    } catch (error) {
      console.error('Export failed:', error);
      setBackupStatus({
        kind: 'error',
        message: t('settings', 'exportFailed'),
      });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const result = await importDataFromJson(file);
      setBackupStatus({
        kind: 'success',
        message: tp('settings', 'importSuccess', { ...result }),
      });
    } catch (error) {
      console.error('Import failed:', error);
      setBackupStatus({
        kind: 'error',
        message: t('settings', 'importFailed'),
      });
    } finally {
      input.value = '';
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md mx-4 animate-slideUp">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('settings', 'title')}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t('common', 'close')}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('settings', 'colorTheme')}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {t('settings', 'colorThemeDesc')}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_THEMES.map((theme) => {
                const isSelected = settings.colorTheme === theme.value;
                return (
                  <button
                    key={theme.value}
                    onClick={() => handleColorThemeChange(theme.value)}
                    aria-pressed={isSelected}
                    className={`relative flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-gray-900 dark:border-white'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-700 shadow-sm"
                      style={{
                        background: `linear-gradient(135deg, ${theme.colors.primary} 50%, ${theme.colors.accent} 50%)`,
                      }}
                    />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {t('themes', theme.value)}
                    </span>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-900 dark:bg-white rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white dark:text-gray-900" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('settings', 'language')}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {CORE_LANGUAGES.map((code) => {
                const info = LANGUAGE_INFO[code];
                const isSelected = settings.language === code;
                return (
                  <button
                    key={code}
                    lang={info.intlLocale}
                    onClick={() => handleLanguageChange(code)}
                    aria-pressed={isSelected}
                    className={`relative flex items-center justify-center p-2 rounded-lg border transition-colors text-sm ${
                      isSelected
                        ? 'border-gray-900 dark:border-white bg-gray-100 dark:bg-gray-700'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    {info.nativeName}
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-900 dark:bg-white rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white dark:text-gray-900" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              {t('settings', 'aiFeatures')}
            </h3>
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <p>{t('settings', 'aiDesc')}</p>
              <p>{t('settings', 'aiComingSoon')}</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('settings', 'dataBackup')}
            </h3>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleExport}
              >
                <Upload className="w-4 h-4 mr-2" />
                {t('settings', 'exportData')}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleImportClick}
              >
                <Download className="w-4 h-4 mr-2" />
                {t('settings', 'importData')}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            {backupStatus && (
              <p
                role="status"
                className={`mt-2 text-sm ${
                  backupStatus.kind === 'success'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {backupStatus.message}
              </p>
            )}
          </div>
        </div>

        <div className="p-4 border-t dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {t('common', 'appName')} v{chrome.runtime.getManifest().version}
          </p>
        </div>
      </div>
    </div>
  );
}
