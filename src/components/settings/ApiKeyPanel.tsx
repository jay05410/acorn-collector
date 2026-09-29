import { useEffect, useState } from 'react';
import { KeyRound, PlugZap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/toast-store';
import { t, tp, useLanguage } from '@/i18n';
import type { AISettingsPatch } from '@/lib/storage';
import type { AppSettings } from '@/lib/settings-types';
import { ConnectionTestResult, KeyForm, OutboundLink } from './connection';
import { useConnectionTest } from './connection-test';
import { PROVIDER_KEY_PAGES } from './links';
import { keySuffix, providerName } from './providers';
import type { UpdateSettings } from './useSettings';

type KeyProvider = 'openai' | 'anthropic';

function keyPatch(provider: KeyProvider, apiKey: string): AISettingsPatch {
  const patch: AISettingsPatch = {};
  patch[provider] = { apiKey };
  return patch;
}

interface ApiKeyPanelProps {
  provider: KeyProvider;
  settings: AppSettings;
  update: UpdateSettings;
  /** The provider rejected (true) or accepted (false) the saved key. */
  onKeyRejected?: (rejected: boolean) => void;
}

/** OpenAI / Anthropic: paste, save, test and remove the user's own key. */
export function ApiKeyPanel({
  provider,
  settings,
  update,
  onKeyRejected,
}: ApiKeyPanelProps) {
  useLanguage();
  const name = providerName(provider);
  const saved = settings.ai[provider].apiKey.trim();
  const [editing, setEditing] = useState(false);
  const test = useConnectionTest(provider);
  const showForm = editing || saved === '';
  const testState = test.state;

  useEffect(() => {
    if (testState.status === 'ok') onKeyRejected?.(false);
    else if (testState.status === 'error' && testState.code === 'auth') {
      onKeyRejected?.(true);
    }
  }, [testState, onKeyRejected]);

  // A different (or no) key has not been rejected yet.
  useEffect(() => {
    onKeyRejected?.(false);
  }, [saved, onKeyRejected]);
  const label = tp('aiConnect', 'keyLabel', { provider: name });
  const hint = tp('aiConnect', 'keyHint', { provider: name });

  const handleSave = async (apiKey: string): Promise<boolean> => {
    const ok = await update({ ai: { provider, ...keyPatch(provider, apiKey) } });
    if (!ok) return false;
    setEditing(false);
    showToast({ tone: 'success', message: t('aiConnect', 'keySavedToast') });
    void test.run(apiKey);
    return true;
  };

  const handleRemove = async () => {
    const previous = saved;
    test.reset();
    setEditing(false);
    const ok = await update({ ai: keyPatch(provider, '') });
    if (!ok) return;
    showToast({
      message: t('aiConnect', 'keyRemovedToast'),
      action: {
        label: t('ui', 'undo'),
        onClick: () => void update({ ai: keyPatch(provider, previous) }),
      },
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {showForm ? (
        <KeyForm
          key={provider}
          provider={provider}
          label={label}
          hint={hint}
          autoFocus={editing}
          onSave={handleSave}
          onCancel={saved === '' ? undefined : () => setEditing(false)}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="text-[13px] leading-5 font-medium text-fg">{label}</p>
          <div className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-surface-sunken px-3">
            <KeyRound aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
            <span className="min-w-0 flex-1 truncate text-sm text-fg">
              {tp('aiConnect', 'keySaved', { last4: keySuffix(saved) })}
            </span>
          </div>
          <p className="text-xs text-fg-subtle">{hint}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={test.state.status === 'testing'}
              onClick={() => void test.run(saved)}
            >
              <PlugZap aria-hidden="true" />
              {t('aiConnect', 'testConnection')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              {t('aiConnect', 'changeKey')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void handleRemove()}>
              {t('aiConnect', 'removeKey')}
            </Button>
          </div>
        </div>
      )}
      <ConnectionTestResult state={test.state} provider={provider} />
      <OutboundLink href={PROVIDER_KEY_PAGES[provider]} className="self-start">
        {t('aiConnect', 'getKey')}
      </OutboundLink>
    </div>
  );
}
