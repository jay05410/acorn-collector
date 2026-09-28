import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@/app.css';
import { initializeDatabase, db } from '@/lib/db';
import { getSettings } from '@/lib/storage';
import type { AppSettings } from '@/lib/settings-types';
import { setLanguage, t } from '@/i18n';

window.addEventListener('beforeunload', () => {
  db.close();
});

async function bootstrap(root: ReactDOM.Root): Promise<void> {
  // Apply the saved language before the first render to avoid a flash of the
  // browser-detected language. The app still starts if settings can't load.
  // App gets these settings too, so startup reads (and migrates) them once.
  const settingsReady = getSettings().then(
    (settings) => {
      setLanguage(settings.language);
      return settings;
    },
    (error: unknown) => {
      console.error('Failed to load settings:', error);
      return undefined;
    }
  );

  let initialSettings: AppSettings | undefined;
  try {
    [, initialSettings] = await Promise.all([
      initializeDatabase(),
      settingsReady,
    ]);
  } catch (error) {
    console.error('Failed to open the database:', error);
    root.render(
      <p role="alert" className="p-4 text-sm text-red-600">
        {t('errors', 'databaseOpenFailed')}
      </p>
    );
    return;
  }

  root.render(
    <React.StrictMode>
      <App initialSettings={initialSettings} />
    </React.StrictMode>
  );
}

void bootstrap(ReactDOM.createRoot(document.getElementById('root')!));
