import { useCallback, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Banner } from '@/components/ui/Banner';
import { t, tp, useLanguage } from '@/i18n';
import type { ProviderId } from '@/lib/ai/types';
import type { AppSettings } from '@/lib/settings-types';
import { ApiKeyPanel } from './ApiKeyPanel';
import { useCliCheck, type CliCheckDeps } from './cli-check';
import { CliPanel } from './CliPanel';
import { OpenRouterPanel } from './OpenRouterPanel';
import { ProviderPicker } from './ProviderPicker';
import { providerName } from './providers';
import { providerReadiness, type ProviderReadiness } from './readiness';
import { SettingsSection } from './SettingsSection';
import type { UpdateSettings } from './useSettings';

interface AiConnectionSectionProps {
  settings: AppSettings;
  update: UpdateSettings;
  /** Injected in tests; defaults to the real bridge. */
  cliDeps?: CliCheckDeps;
}

function Summary({
  provider,
  readiness,
}: {
  provider: ProviderId | null;
  readiness: ProviderReadiness | null;
}) {
  useLanguage();
  if (provider === null) {
    return <Banner tone="info">{t('aiConnect', 'summaryNone')}</Banner>;
  }
  const name = providerName(provider);
  if (readiness === 'ready') {
    return (
      <Banner tone="success">
        {tp('aiConnect', 'summaryReady', { provider: name })}
      </Banner>
    );
  }
  // The CLI's state is unknown until the bridge answers; say nothing yet.
  if (readiness === 'unknown') return null;
  return (
    <Banner tone="warning">
      {readiness === 'key-rejected'
        ? tp('aiConnect', 'summaryKeyRejected', { provider: name })
        : tp('aiConnect', 'summaryNotReady', { provider: name })}
    </Banner>
  );
}

export function AiConnectionSection({
  settings,
  update,
  cliDeps,
}: AiConnectionSectionProps) {
  useLanguage();
  const { provider } = settings.ai;
  const cli = useCliCheck(provider === 'cli', cliDeps);
  // Keys a provider rejected in this session (connection test, key info).
  const [rejected, setRejected] = useState<ReadonlySet<ProviderId>>(new Set());
  const markRejected = useCallback((id: ProviderId, value: boolean) => {
    setRejected((current) => {
      if (current.has(id) === value) return current;
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const onOpenRouterKey = useCallback(
    (value: boolean) => markRejected('openrouter', value),
    [markRejected]
  );
  const onApiKey = useMemo(
    () => ({
      openai: (value: boolean) => markRejected('openai', value),
      anthropic: (value: boolean) => markRejected('anthropic', value),
    }),
    [markRejected]
  );

  const readinessOf = (id: ProviderId) =>
    providerReadiness(settings.ai, id, cli.check, rejected);

  let panel = null;
  if (provider === 'openrouter') {
    panel = (
      <OpenRouterPanel
        settings={settings}
        update={update}
        onKeyRejected={onOpenRouterKey}
      />
    );
  } else if (provider === 'openai' || provider === 'anthropic') {
    panel = (
      <ApiKeyPanel
        key={provider}
        provider={provider}
        settings={settings}
        update={update}
        onKeyRejected={onApiKey[provider]}
      />
    );
  } else if (provider === 'cli') {
    panel = <CliPanel settings={settings} update={update} cli={cli} />;
  }

  return (
    <SettingsSection
      id="ai"
      icon={Sparkles}
      title={t('settingsView', 'sectionAi')}
      description={t('settingsView', 'sectionAiDesc')}
    >
      <Summary
        provider={provider}
        readiness={provider ? readinessOf(provider) : null}
      />
      <ProviderPicker
        value={provider}
        tier={settings.ai.tier}
        readiness={readinessOf}
        onChange={(id) => void update({ ai: { provider: id } })}
        panel={panel}
      />
    </SettingsSection>
  );
}
