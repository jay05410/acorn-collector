export interface PendingAddData {
  text: string;
  url: string;
  pageUrl?: string;
  author?: string;
  imageUrls?: string[];
  timestamp: number;
}

export type ColorTheme = 'acorn' | 'pink' | 'sky' | 'lavender';
export type Language = 'ko' | 'en' | 'ja' | 'zh';

export interface AppSettings {
  colorTheme: ColorTheme;
  defaultSortBy: 'boothNumber' | 'createdAt' | 'custom';
  aiEnabled: boolean;
  geminiApiKey: string;
  language: Language;
}

function getDefaultLanguage(): Language {
  const browserLang = navigator.language.split('-')[0];
  if (browserLang === 'ko') return 'ko';
  if (browserLang === 'ja') return 'ja';
  if (browserLang === 'zh') return 'zh';
  if (browserLang === 'en') return 'en';
  return 'ko';
}

const DEFAULT_SETTINGS: AppSettings = {
  colorTheme: 'acorn',
  defaultSortBy: 'createdAt',
  aiEnabled: false,
  geminiApiKey: '',
  language: getDefaultLanguage(),
};

function isPendingAddData(value: unknown): value is PendingAddData {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.text === 'string' &&
    typeof obj.url === 'string' &&
    typeof obj.timestamp === 'number' &&
    (obj.author === undefined || typeof obj.author === 'string')
  );
}

function isAppSettings(value: unknown): value is Partial<AppSettings> {
  return value !== null && typeof value === 'object';
}

export const appStorage = {
  async getPendingAdd(): Promise<PendingAddData | null> {
    const result = await chrome.storage.local.get('pendingAdd');
    const pending = result.pendingAdd;
    if (isPendingAddData(pending)) {
      return pending;
    }
    return null;
  },

  async clearPendingAdd(): Promise<void> {
    await chrome.storage.local.remove('pendingAdd');
  },

  async getSettings(): Promise<AppSettings> {
    const result = await chrome.storage.local.get('settings');
    const stored = result.settings;
    if (isAppSettings(stored)) {
      return { ...DEFAULT_SETTINGS, ...stored };
    }
    return DEFAULT_SETTINGS;
  },

  async updateSettings(updates: Partial<AppSettings>): Promise<void> {
    const current = await this.getSettings();
    await chrome.storage.local.set({ settings: { ...current, ...updates } });
  },

  watchSettings(callback: (settings: AppSettings) => void): () => void {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes.settings) {
        const newValue = changes.settings.newValue;
        if (isAppSettings(newValue)) {
          callback({ ...DEFAULT_SETTINGS, ...newValue });
        }
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  },
};
