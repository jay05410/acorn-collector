import { useId, type ReactNode } from 'react';
import { Cpu, Gauge, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { t, tp, useLanguage } from '@/i18n';
import { defaultModelFor } from '@/lib/ai/models';
import type { ModelTier, ProviderId } from '@/lib/ai/types';
import { cn } from '@/lib/utils';
import { PROVIDER_ORDER, providerName } from './providers';
import type { ProviderReadiness } from './readiness';

interface ProviderNote {
  icon: LucideIcon;
  text: string;
}

function providerDescription(id: ProviderId): string {
  switch (id) {
    case 'openrouter':
      return t('aiConnect', 'descOpenrouter');
    case 'openai':
      return t('aiConnect', 'descOpenai');
    case 'anthropic':
      return t('aiConnect', 'descAnthropic');
    case 'cli':
      return t('aiConnect', 'descCli');
  }
}

/**
 * Speed and cost notes. Speeds are stated only where ADR-001 measured them
 * (OpenAI, local CLI); Anthropic shows its default model instead.
 */
function providerNotes(id: ProviderId, tier: ModelTier): ProviderNote[] {
  switch (id) {
    case 'openrouter':
      return [
        { icon: Gauge, text: t('aiConnect', 'speedOpenrouter') },
        { icon: Wallet, text: t('aiConnect', 'costOpenrouter') },
      ];
    case 'openai':
      return [
        { icon: Gauge, text: t('aiConnect', 'speedOpenai') },
        { icon: Wallet, text: t('aiConnect', 'costOpenai') },
      ];
    case 'anthropic':
      return [
        {
          icon: Cpu,
          text: tp('aiConnect', 'defaultModel', {
            model: defaultModelFor('anthropic', tier),
          }),
        },
        { icon: Wallet, text: t('aiConnect', 'costAnthropic') },
      ];
    case 'cli':
      return [
        { icon: Gauge, text: t('aiConnect', 'speedCli') },
        { icon: Wallet, text: t('aiConnect', 'costCli') },
      ];
  }
}

export function ReadinessBadge({
  readiness,
}: {
  readiness: ProviderReadiness;
}) {
  useLanguage();
  if (readiness === 'ready') {
    return <Badge tone="success">{t('aiConnect', 'statusReady')}</Badge>;
  }
  if (readiness === 'needs-key') {
    return <Badge>{t('aiConnect', 'statusNotConnected')}</Badge>;
  }
  if (readiness === 'unknown') return null;
  return <Badge tone="warning">{t('aiConnect', 'statusSetup')}</Badge>;
}

interface ProviderPickerProps {
  value: ProviderId | null;
  tier: ModelTier;
  readiness: (id: ProviderId) => ProviderReadiness;
  onChange: (id: ProviderId) => void;
  /** Setup controls, shown under the selected card. */
  panel?: ReactNode;
}

/**
 * The active provider as radio cards (native radios, so arrow keys move the
 * selection). The selected card opens its setup panel below it; the panel
 * is a sibling of the label because it holds its own controls.
 */
export function ProviderPicker({
  value,
  tier,
  readiness,
  onChange,
  panel,
}: ProviderPickerProps) {
  useLanguage();
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{t('aiConnect', 'providerGroup')}</legend>
      <div className="flex flex-col gap-2">
        {PROVIDER_ORDER.map((id) => {
          const checked = value === id;
          const showPanel = checked && panel !== undefined && panel !== null;
          const descriptionId = `${name}-${id}-desc`;
          return (
            <div
              key={id}
              className={cn(
                'rounded-xl border transition-[border-color,box-shadow] duration-150 ease-out',
                checked
                  ? 'border-primary-strong bg-surface-raised shadow-xs ring-1 ring-primary-strong ring-inset'
                  : 'border-line bg-surface-raised hover:border-line-strong'
              )}
            >
              <label
                className={cn(
                  'relative flex cursor-pointer gap-3 p-3 transition-colors duration-150 ease-out',
                  'has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-focus',
                  checked
                    ? cn('bg-primary-soft/70', showPanel ? 'rounded-t-[0.6875rem]' : 'rounded-[0.6875rem]')
                    : 'rounded-[0.6875rem] hover:bg-hover'
                )}
              >
                <input
                  type="radio"
                  name={name}
                  value={id}
                  checked={checked}
                  onChange={() => onChange(id)}
                  aria-describedby={descriptionId}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    checked
                      ? 'border-primary-strong'
                      : 'border-line-strong bg-surface-raised'
                  )}
                >
                  {checked && (
                    <span className="size-2.5 rounded-full bg-primary-strong" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <span className="text-sm leading-5 font-semibold text-fg">
                      {providerName(id)}
                    </span>
                    {id === 'openrouter' && (
                      <Badge tone="primary">{t('aiConnect', 'recommended')}</Badge>
                    )}
                    {id === 'cli' && <Badge>{t('aiConnect', 'advanced')}</Badge>}
                    <span className="ms-auto">
                      <ReadinessBadge readiness={readiness(id)} />
                    </span>
                  </span>
                  <span id={descriptionId} className="block">
                    <span className="mt-0.5 block text-[13px] leading-snug text-fg-muted">
                      {providerDescription(id)}
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-subtle">
                      {providerNotes(id, tier).map(({ icon: Icon, text }) => (
                        <span key={text} className="inline-flex items-center gap-1">
                          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                          {text}
                        </span>
                      ))}
                    </span>
                  </span>
                </span>
              </label>
              {showPanel && (
                <div className="border-t border-line px-3 pt-3.5 pb-4">
                  {panel}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
