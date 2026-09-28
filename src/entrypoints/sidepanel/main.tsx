import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@/app.css';
import { initializeDatabase, db } from '@/lib/db';
import { getSettings } from '@/lib/storage';
import { setLanguage, t } from '@/i18n';

window.addEventListener('beforeunload', () => {
  db.close();
});

async function bootstrap(root: ReactDOM.Root): Promise<void> {
  // Apply the saved language before the first render to avoid a flash of the
  // browser-detected language. The app still starts if settings can't load.
  const languageReady = getSettings().then(
    (settings) => setLanguage(settings.language),
    (error: unknown) => console.error('Failed to load settings:', error)
  );

  try {
    await Promise.all([initializeDatabase(), languageReady]);
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
      <App />
    </React.StrictMode>
  );
}

void bootstrap(ReactDOM.createRoot(document.getElementById('root')!));
