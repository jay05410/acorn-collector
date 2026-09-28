import type { ReactNode } from 'react';
import { CircleCheck, RotateCw, Sparkles, Square, WandSparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { getLanguageInfo, t, tn, tp, useLanguage } from '@/i18n';
import { describeAIError, errorActionLabel } from '@/lib/ai/error-messages';
import type { ModelTier, ProviderId } from '@/lib/ai/types';
import { useElapsed, type ExtractionState } from '@/hooks/useExtraction';
import { cn } from '@/lib/utils';

interface AnalysisStatusProps {
  state: ExtractionState;
  /** An AI provider is set up. */
  configured: boolean;
  /** There is text or an image to analyze. */
  canStart: boolean;
  /** Rows currently shown (streamed or final). */
  itemCount: number;
  onStart: () => void;
  onCancel: () => void;
  onRetry: (tier?: ModelTier) => void;
  onOpenSettings: () => void;
  className?: string;
}

const PROVIDER_NAMES: Record<Exclude<ProviderId, 'cli'>, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
};

function providerName(provider: ProviderId): string {
  return provider === 'cli' ? t('review', 'providerCli') : PROVIDER_NAMES[provider];
}

function formatSeconds(ms: number): string {
  const seconds = new Intl.NumberFormat(getLanguageInfo().intlLocale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.floor(ms / 100) / 10);
  return tp('review', 'elapsed', { seconds });
}

/** What screen readers hear; changes only on state transitions. */
function announcement(state: ExtractionState, itemCount: number): string {
  switch (state.status) {
    case 'preparing':
      return t('review', 'statusStarting');
    case 'streaming':
      return t('review', 'statusFinding');
    case 'done':
      return itemCount > 0
        ? tn('review', 'statusDone', itemCount)
        : t('review', 'statusNone');
    case 'cancelled':
      return t('aiErrors', 'cancelledTitle');
    case 'error':
      // The error banner is an alert and announces itself.
      return '';
    case 'idle':
      return '';
  }
}

function MetaChips({ state, elapsedMs }: { state: ExtractionState; elapsedMs: number }) {
  const cached = state.status === 'done' && state.outcome?.meta.cached;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {state.provider && (
        <Badge tone="neutral" className="max-w-full">
          {state.model
            ? `${providerName(state.provider)} · ${state.model}`
            : providerName(state.provider)}
        </Badge>
      )}
      {state.tier === 'accurate' && (
        <Badge tone="primary">{t('review', 'tierAccurate')}</Badge>
      )}
      {cached ? (
        <Badge tone="success">{t('review', 'cached')}</Badge>
      ) : (
        <span aria-hidden="true" className="text-xs text-fg-subtle tabular-nums">
          {formatSeconds(elapsedMs)}
        </span>
      )}
    </span>
  );
}

/**
 * Progress and outcome of the AI analysis: provider and model, a timer,
 * cancel, the accurate-mode rerun, skipped images and errors with the next
 * step. One polite live region announces transitions (not the timer).
 */
export function AnalysisStatus({
  state,
  configured,
  canStart,
  itemCount,
  onStart,
  onCancel,
  onRetry,
  onOpenSettings,
  className,
}: AnalysisStatusProps) {
  useLanguage();
  const elapsedMs = useElapsed(state);
  const running = state.status === 'preparing' || state.status === 'streaming';
  const skipped = state.status === 'done' ? (state.outcome?.meta.skippedImages.length ?? 0) : 0;

  let body: ReactNode = null;
  if (state.status === 'idle') {
    if (!configured) {
      body = (
        <Banner
          tone="info"
          title={t('review', 'connectTitle')}
          action={{ label: t('review', 'connectAction'), onClick: onOpenSettings }}
        >
          {t('review', 'connectBody')}
        </Banner>
      );
    } else if (canStart) {
      body = (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-xs">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-strong"
          >
            <Sparkles className="size-[1.125rem]" />
          </span>
          <p className="min-w-0 flex-1 text-sm text-fg-muted">{t('review', 'startHint')}</p>
          <Button size="sm" onClick={onStart}>
            {t('review', 'start')}
          </Button>
        </div>
      );
    }
  } else if (running) {
    body = (
      <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <Spinner className="size-[1.125rem] text-primary-strong" />
          <p aria-hidden="true" className="min-w-0 flex-1 text-sm font-medium text-fg">
            {state.status === 'streaming' && itemCount > 0
              ? tn('review', 'statusStreaming', itemCount)
              : state.imageCount > 0
                ? tn('analysis', 'analyzingImages', state.imageCount)
                : t('review', 'statusReadingText')}
          </p>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            <Square className="fill-current" />
            {t('review', 'stop')}
          </Button>
        </div>
        <div className="mt-2 pl-7">
          <MetaChips state={state} elapsedMs={elapsedMs} />
        </div>
      </div>
    );
  } else if (state.status === 'done') {
    body = (
      <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
        <div className="flex items-start gap-2.5">
          <CircleCheck
            aria-hidden="true"
            className={cn(
              'mt-0.5 size-[1.125rem] shrink-0',
              itemCount > 0 ? 'text-success' : 'text-fg-subtle'
            )}
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <p aria-hidden="true" className="text-sm font-medium text-fg">
              {itemCount > 0 ? tn('review', 'statusDone', itemCount) : t('review', 'statusNone')}
            </p>
            <MetaChips state={state} elapsedMs={elapsedMs} />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
          {state.tier === 'fast' ? (
            <Button variant="soft" size="sm" onClick={() => onRetry('accurate')}>
              <WandSparkles />
              {t('review', 'runAccurate')}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => onRetry()}>
              <RotateCw />
              {t('review', 'runAgain')}
            </Button>
          )}
          <span className="text-xs text-fg-subtle">
            {state.tier === 'fast' ? t('review', 'runAccurateHint') : t('review', 'aiMayBeWrong')}
          </span>
        </div>
      </div>
    );
  } else if (state.status === 'cancelled') {
    body = (
      <Banner
        tone="info"
        title={t('aiErrors', 'cancelledTitle')}
        action={{ label: errorActionLabel('retry'), onClick: () => onRetry() }}
      >
        {t('aiErrors', 'cancelledBody')}
      </Banner>
    );
  } else {
    const described = describeAIError(state.error);
    const action =
      described.action === 'open-settings'
        ? { label: errorActionLabel('open-settings'), onClick: onOpenSettings }
        : described.action === 'retry'
          ? { label: errorActionLabel('retry'), onClick: () => onRetry() }
          : described.action === 'retry-accurate'
            ? state.tier === 'accurate'
              ? { label: errorActionLabel('retry'), onClick: () => onRetry() }
              : {
                  label: errorActionLabel('retry-accurate'),
                  onClick: () => onRetry('accurate'),
                }
            : undefined;
    body = (
      <Banner tone="error" title={described.title} action={action}>
        {described.body}
      </Banner>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement(state, itemCount)}
      </p>
      {body}
      {skipped > 0 && (
        <Banner tone="warning">{tn('review', 'skippedImages', skipped)}</Banner>
      )}
    </div>
  );
}
