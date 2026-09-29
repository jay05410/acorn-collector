import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@/app.css';
import { initializeDatabase, db } from '@/lib/db';
import type { AppSettings } from '@/lib/settings-types';
import { t } from '@/i18n';
import { loadStartupSettings } from './startup';

window.addEventListener('beforeunload', () => {
  db.close();
});

async function bootstrap(root: ReactDOM.Root): Promise<void> {
  // The saved language's messages are loaded and applied before the first
  // render (no flash); the app still starts if settings can't load.
  const settingsReady = loadStartupSettings();

  let initialSettings: AppSettings | undefined;
  try {
    [, initialSettings] = await Promise.all([
      initializeDatabase(),
      settingsReady,
    ]);
  } catch (error) {
    console.error('Failed to open the database:', error);
    await settingsReady; // the message below in the user's language
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
