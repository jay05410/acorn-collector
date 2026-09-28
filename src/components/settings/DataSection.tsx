import { useRef, useState, type ChangeEvent } from 'react';
import { Database, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/toast-store';
import { t, tp, useLanguage } from '@/i18n';
import { exportDataAsJson, importDataFromJson } from '@/lib/export';
import { SettingsSection } from './SettingsSection';

/** Backup export and import (merges rows by id; nothing written on error). */
export function DataSection() {
  useLanguage();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);

  const handleExport = async () => {
    setBusy('export');
    try {
      await exportDataAsJson();
      showToast({ tone: 'success', message: t('settingsView', 'exportDone') });
    } catch (error) {
      console.error('[settings] export failed', error);
      showToast({ tone: 'error', message: t('settings', 'exportFailed') });
    } finally {
      setBusy(null);
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    setBusy('import');
    try {
      const summary = await importDataFromJson(file);
      showToast({
        tone: 'success',
        message: tp('settings', 'importSuccess', { ...summary }),
      });
    } catch (error) {
      console.error('[settings] import failed', error);
      showToast({ tone: 'error', message: t('settings', 'importFailed') });
    } finally {
      input.value = '';
      setBusy(null);
    }
  };

  return (
    <SettingsSection
      id="data"
      icon={Database}
      title={t('settingsView', 'sectionData')}
      description={t('settingsView', 'dataIntro')}
    >
      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
        <Button
          variant="secondary"
          loading={busy === 'export'}
          onClick={() => void handleExport()}
        >
          <Download aria-hidden="true" />
          {t('settings', 'exportData')}
        </Button>
        <Button
          variant="secondary"
          loading={busy === 'import'}
          onClick={() => fileInput.current?.click()}
        >
          <Upload aria-hidden="true" />
          {t('settings', 'importData')}
        </Button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={(event) => void handleFile(event)}
      />
    </SettingsSection>
  );
}
