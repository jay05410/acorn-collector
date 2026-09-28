import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { SlidersHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { showToast } from '@/components/ui/toast-store';
import { t, tn, tp, useLanguage } from '@/i18n';
import {
  defaultModelFor,
  SELECTABLE_MODELS,
  type ApiProviderId,
} from '@/lib/ai/models';
import type { ModelTier } from '@/lib/ai/types';
import { analysisCache } from '@/lib/analysis-cache';
import { CLI_DEFAULT_MODELS } from '@/lib/bridge/provider';
import type { AISettingsPatch } from '@/lib/storage';
import type { AppSettings } from '@/lib/settings-types';
import { isForeignCliModel } from './cli-target';
import { CLI_NAMES } from './providers';
import { SettingRow, SettingsSection } from './SettingsSection';
import type { UpdateSettings } from './useSettings';

const CUSTOM_MODEL = '__custom__';

interface SectionProps {
  settings: AppSettings;
  update: UpdateSettings;
  /** Injected in tests; defaults to the Dexie analysis cache. */
  clearCache?: () => Promise<number>;
}

function clearAnalysisCache(): Promise<number> {
  return analysisCache.prune({ maxEntries: 0, maxAgeMs: 0 });
}

function modelPatch(provider: ApiProviderId, model: string | null): AISettingsPatch {
  const patch: AISettingsPatch = {};
  patch[provider] = { model };
  return patch;
}

function commitOnEnter(commit: () => void) {
  return (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    }
  };
}

export function AnalysisSection({
  settings,
  update,
  clearCache = clearAnalysisCache,
}: SectionProps) {
  useLanguage();
  const { provider, tier, autoAnalyze } = settings.ai;
  const autoId = useId();
  const autoHintId = useId();
  const cacheHintId = useId();
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClear = async () => {
    try {
      const removed = await clearCache();
      showToast({
        tone: 'success',
        message: tn('settingsView', 'cacheCleared', removed),
      });
    } catch (error) {
      console.error('[settings] could not clear the analysis cache', error);
      showToast({ tone: 'error', message: t('settingsView', 'cacheClearFailed') });
    } finally {
      setConfirmClear(false);
    }
  };

  return (
    <SettingsSection
      id="analysis"
      icon={SlidersHorizontal}
      title={t('settingsView', 'sectionAnalysis')}
      description={t('settingsView', 'sectionAnalysisDesc')}
    >
      {provider !== 'cli' && (
        <TierField
          tier={tier}
          model={
            provider === null
              ? null
              : (settings.ai[provider].model ?? defaultModelFor(provider, tier))
          }
          onChange={(next) => void update({ ai: { tier: next } })}
        />
      )}

      {provider === null && (
        <p className="-mt-2 text-xs text-fg-subtle">
          {t('settingsView', 'modelNeedsProvider')}
        </p>
      )}
      {provider === 'cli' && <CliModelField settings={settings} update={update} />}
      {provider !== null && provider !== 'cli' && (
        <ModelField
          key={provider}
          provider={provider}
          settings={settings}
          update={update}
        />
      )}

      <SettingRow
        controlId={autoId}
        label={t('settingsView', 'autoAnalyzeLabel')}
        hint={t('settingsView', 'autoAnalyzeHint')}
        hintId={autoHintId}
        control={
          <Switch
            id={autoId}
            aria-describedby={autoHintId}
            checked={autoAnalyze}
            onCheckedChange={(checked) =>
              void update({ ai: { autoAnalyze: checked } })
            }
          />
        }
      />

      <div className="flex items-start justify-between gap-4 border-t border-line pt-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-5 font-medium text-fg">
            {t('settingsView', 'cacheLabel')}
          </p>
          <p id={cacheHintId} className="mt-0.5 text-xs text-fg-muted">
            {t('settingsView', 'cacheHint')}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          aria-describedby={cacheHintId}
          onClick={() => setConfirmClear(true)}
        >
          <Trash2 aria-hidden="true" />
          {t('settingsView', 'clearCache')}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title={t('settingsView', 'clearCacheTitle')}
        description={t('settingsView', 'clearCacheBody')}
        confirmLabel={t('settingsView', 'clearCacheConfirm')}
        onConfirm={handleClear}
        onCancel={() => setConfirmClear(false)}
      />
    </SettingsSection>
  );
}

function TierField({
  tier,
  model,
  onChange,
}: {
  tier: ModelTier;
  model: string | null;
  onChange: (tier: ModelTier) => void;
}) {
  useLanguage();
  const explanation =
    tier === 'fast'
      ? t('settingsView', 'tierFastHint')
      : t('settingsView', 'tierAccurateHint');
  return (
    <Field
      label={t('settingsView', 'tierLabel')}
      group
      hint={
        model
          ? `${explanation} ${tp('settingsView', 'tierUsesModel', { model })}`
          : explanation
      }
    >
      <SegmentedControl
        options={[
          { value: 'fast', label: t('settingsView', 'tierFast') },
          { value: 'accurate', label: t('settingsView', 'tierAccurate') },
        ]}
        value={tier}
        onChange={onChange}
      />
    </Field>
  );
}

function ModelField({
  provider,
  settings,
  update,
}: {
  provider: ApiProviderId;
  settings: AppSettings;
  update: UpdateSettings;
}) {
  useLanguage();
  const stored = settings.ai[provider].model;
  const options = SELECTABLE_MODELS[provider];
  const storedIsCustom = stored !== null && !options.includes(stored);
  const [custom, setCustom] = useState(storedIsCustom);
  const [draft, setDraft] = useState(storedIsCustom ? stored : '');
  const selectValue = custom ? CUSTOM_MODEL : (stored ?? '');

  const commitCustom = () => {
    const value = draft.trim();
    if (value === (stored ?? '')) return;
    void update({ ai: modelPatch(provider, value === '' ? null : value) });
    if (value === '') setCustom(false);
  };

  return (
    <>
      <Field
        label={t('settingsView', 'modelLabel')}
        hint={
          stored !== null && !custom
            ? t('settingsView', 'modelOverrideHint')
            : undefined
        }
      >
        <Select
          value={selectValue}
          onChange={(event) => {
            const value = event.target.value;
            if (value === CUSTOM_MODEL) {
              setCustom(true);
              setDraft(stored ?? '');
              return;
            }
            setCustom(false);
            void update({ ai: modelPatch(provider, value === '' ? null : value) });
          }}
        >
          <option value="">
            {tp('settingsView', 'modelDefault', {
              model: defaultModelFor(provider, settings.ai.tier),
            })}
          </option>
          {options.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
          <option value={CUSTOM_MODEL}>{t('settingsView', 'modelCustom')}</option>
        </Select>
      </Field>
      {custom && (
        <Field
          label={t('settingsView', 'modelCustomLabel')}
          hint={t('settingsView', 'modelCustomHint')}
        >
          <Input
            value={draft}
            placeholder={options[0]}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="font-mono text-[13px]"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitCustom}
            onKeyDown={commitOnEnter(commitCustom)}
          />
        </Field>
      )}
    </>
  );
}

function CliModelField({
  settings,
  update,
}: {
  settings: AppSettings;
  update: UpdateSettings;
}) {
  useLanguage();
  const { target, model } = settings.ai.cli;
  const [draft, setDraft] = useState(model ?? '');

  // Switching the CLI can clear an incompatible model.
  useEffect(() => {
    setDraft(model ?? '');
  }, [model]);

  const commit = () => {
    const value = draft.trim();
    if (value === (model ?? '')) return;
    void update({ ai: { cli: { model: value === '' ? null : value } } });
  };

  const defaultModel = CLI_DEFAULT_MODELS[target];
  const foreign = isForeignCliModel(target, draft);

  return (
    <Field
      label={t('settingsView', 'cliModelLabel')}
      hint={
        defaultModel
          ? tp('settingsView', 'cliModelHintDefault', { model: defaultModel })
          : t('settingsView', 'cliModelHintCodex')
      }
      error={
        foreign
          ? tp('settingsView', 'cliModelForeign', {
              model: draft.trim(),
              cli: CLI_NAMES[target],
            })
          : undefined
      }
    >
      <Input
        value={draft}
        placeholder={defaultModel || undefined}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        className="font-mono text-[13px]"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={commitOnEnter(commit)}
      />
    </Field>
  );
}
