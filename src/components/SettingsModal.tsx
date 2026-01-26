import { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  Key,
  Sparkles,
  Check,
  Loader2,
  LogIn,
  LogOut,
  User,
  Coins,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  appStorage,
  type AppSettings,
  type ColorTheme,
  type Language,
} from '@/lib/storage';
import { setLanguage, LANGUAGE_OPTIONS, t } from '@/lib/i18n';
import { exportDataAsJson, importDataFromJson } from '@/lib/export';
import { testGeminiApiKey } from '@/lib/ai';
import { useAuthStore } from '@/stores/useAuthStore';

const COLOR_THEMES: {
  value: ColorTheme;
  labelKey: 'acorn' | 'pink' | 'sky' | 'lavender';
  colors: { primary: string; accent: string };
}[] = [
  {
    value: 'acorn',
    labelKey: 'acorn',
    colors: { primary: '#d4a574', accent: '#f5e6d3' },
  },
  {
    value: 'pink',
    labelKey: 'pink',
    colors: { primary: '#e8a0b4', accent: '#fce4ec' },
  },
  {
    value: 'sky',
    labelKey: 'sky',
    colors: { primary: '#7eb8da', accent: '#e3f2fd' },
  },
  {
    value: 'lavender',
    labelKey: 'lavender',
    colors: { primary: '#b39ddb', accent: '#ede7f6' },
  },
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<AppSettings>({
    colorTheme: 'acorn',
    defaultSortBy: 'createdAt',
    aiEnabled: false,
    geminiApiKey: '',
    language: 'ko',
  });
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [apiKeyStatus, setApiKeyStatus] = useState<{
    testing: boolean;
    result?: { success: boolean; error?: string };
  }>({ testing: false });
  const [authLoading, setAuthLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isAuthenticated, user, credits, signIn, signOut } = useAuthStore();

  const handleSignIn = async () => {
    setAuthLoading(true);
    try {
      await signIn();
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setAuthLoading(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      appStorage.getSettings().then(setSettings);
      setApiKeyStatus({ testing: false });
    }
  }, [isOpen]);

  const handleTestApiKey = async () => {
    setApiKeyStatus({ testing: true });
    const result = await testGeminiApiKey(settings.geminiApiKey);
    setApiKeyStatus({ testing: false, result });

    setTimeout(() => setApiKeyStatus({ testing: false }), 5000);
  };

  const handleColorThemeChange = async (colorTheme: ColorTheme) => {
    setSettings((prev) => ({ ...prev, colorTheme }));
    await appStorage.updateSettings({ colorTheme });
  };

  const handleLanguageChange = async (language: Language) => {
    setSettings((prev) => ({ ...prev, language }));
    setLanguage(language);
    await appStorage.updateSettings({ language });
  };

  const handleAiToggle = async () => {
    const aiEnabled = !settings.aiEnabled;
    setSettings((prev) => ({ ...prev, aiEnabled }));
    await appStorage.updateSettings({ aiEnabled });
  };

  const handleApiKeyChange = async (key: string) => {
    setSettings((prev) => ({ ...prev, geminiApiKey: key }));
    await appStorage.updateSettings({ geminiApiKey: key });
  };

  const handleExport = async () => {
    try {
      await exportDataAsJson();
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await importDataFromJson(file);
      setImportStatus(
        `가져오기 완료: ${result.events}개 행사, ${result.booths}개 부스, ${result.items}개 상품`
      );
      setTimeout(() => setImportStatus(null), 3000);
    } catch {
      setImportStatus('가져오기 실패: 파일 형식을 확인해주세요');
      setTimeout(() => setImportStatus(null), 3000);
    }

    e.target.value = '';
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
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              계정
            </h3>
            {isAuthenticated ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                      <User className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {user?.name || user?.email}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      보유 크레딧
                    </span>
                  </div>
                  <span className="text-lg font-bold text-amber-600">
                    {credits.toLocaleString()}
                  </span>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleSignOut}
                  disabled={authLoading}
                >
                  {authLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <LogOut className="w-4 h-4 mr-2" />
                  )}
                  로그아웃
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Google 계정으로 로그인하면 크레딧을 사용하여 AI 분석을 이용할
                  수 있습니다.
                </p>
                <Button
                  className="w-full"
                  onClick={handleSignIn}
                  disabled={authLoading}
                >
                  {authLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <LogIn className="w-4 h-4 mr-2" />
                  )}
                  Google 계정으로 로그인
                </Button>
              </div>
            )}
          </div>

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
                      {t('themes', theme.labelKey)}
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
            <div className="grid grid-cols-4 gap-2">
              {LANGUAGE_OPTIONS.map((lang) => {
                const isSelected = settings.language === lang.value;
                return (
                  <button
                    key={lang.value}
                    onClick={() => handleLanguageChange(lang.value)}
                    className={`relative flex items-center justify-center p-2 rounded-lg border transition-colors text-sm ${
                      isSelected
                        ? 'border-gray-900 dark:border-white bg-gray-100 dark:bg-gray-700'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    {lang.label}
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
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {t('settings', 'aiFeatures')}
              </h3>
              <button
                onClick={handleAiToggle}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  settings.aiEnabled
                    ? 'bg-primary'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    settings.aiEnabled ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
            {settings.aiEnabled && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      type="password"
                      value={settings.geminiApiKey}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      placeholder={t('settings', 'apiKeyPlaceholder')}
                      className="pl-9"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleTestApiKey}
                    disabled={apiKeyStatus.testing}
                    className="shrink-0"
                  >
                    {apiKeyStatus.testing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      t('common', 'confirm')
                    )}
                  </Button>
                </div>
                {apiKeyStatus.result && (
                  <p
                    className={`text-xs ${
                      apiKeyStatus.result.success
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {apiKeyStatus.result.success
                      ? `✓ ${t('settings', 'apiKeyValid')}`
                      : `✗ ${apiKeyStatus.result.error}`}
                  </p>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  <p>{t('settings', 'aiDesc')}</p>
                  <p className="text-gray-400 dark:text-gray-500">
                    {t('settings', 'aiLimit')}
                  </p>
                </div>
              </div>
            )}
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
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            {importStatus && (
              <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                {importStatus}
              </p>
            )}
          </div>
        </div>

        <div className="p-4 border-t dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {t('settings', 'version')} v1.0.0
          </p>
        </div>
      </div>
    </div>
  );
}
