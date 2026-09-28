import { useCallback, useEffect, useRef, useState } from 'react';
import { showToast } from '@/components/ui/toast-store';
import { t } from '@/i18n';
import type { SettingsPatch } from '@/lib/storage';
import type { AppSettings } from '@/lib/settings-types';
import {
  chromeSettingsBackend,
  createSettingsController,
  type SettingsBackend,
  type SettingsController,
} from './settings-controller';

export type UpdateSettings = (patch: SettingsPatch) => Promise<boolean>;

export interface UseSettingsResult {
  /** null until loaded. */
  settings: AppSettings | null;
  /** Optimistic; rolls back and shows an error toast if saving fails. */
  update: UpdateSettings;
}

export function useSettings(
  backend: SettingsBackend = chromeSettingsBackend
): UseSettingsResult {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const controllerRef = useRef<SettingsController | null>(null);

  useEffect(() => {
    const controller = createSettingsController(backend, {
      onChange: setSettings,
      onError: (error) => {
        // Never log the patch: it can hold an API key.
        console.error('[settings] could not save settings', error);
        showToast({ tone: 'error', message: t('settingsView', 'saveFailed') });
      },
    });
    controllerRef.current = controller;
    return () => {
      controller.stop();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [backend]);

  const update = useCallback<UpdateSettings>(
    (patch) => controllerRef.current?.update(patch) ?? Promise.resolve(false),
    []
  );

  return { settings, update };
}
