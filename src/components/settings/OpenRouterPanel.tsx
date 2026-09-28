import { useEffect, useState, type FormEvent } from 'react';
import { ExternalLink as ExternalLinkIcon, LogIn, RefreshCw, Unplug } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { showToast } from '@/components/ui/toast-store';
import { formatPrice, t, tp, useLanguage } from '@/i18n';
import { toAIError } from '@/lib/ai/errors';
import {
  connectWithRedirect,
  createHeadlessFlow,
  parseAuthCode,
} from '@/lib/ai/openrouter-oauth';
import {
  getOpenRouterKeyInfo,
  type OpenRouterKeyInfo,
} from '@/lib/ai/providers/openrouter';
import type { AppSettings, OpenRouterSettings } from '@/lib/settings-types';
import { openExternal } from '@/lib/sponsor/links';
import { cn } from '@/lib/utils';
import { KeyForm, OutboundLink } from './connection';
import {
  clearPendingFlow,
  completePendingFlow,
  loadPendingFlow,
  savePendingFlow,
  type PendingHeadlessFlow,
} from './headless-session';
import { PROVIDER_KEY_PAGES } from './links';
import {
  connectionErrorMessage,
  OPENROUTER_KEY_LABEL,
  providerName,
} from './providers';
import type { UpdateSettings } from './useSettings';

const NAME = providerName('openrouter');

type Mode = 'start' | 'code' | 'manual';

type KeyInfoState =
  | { status: 'loading' }
  | { status: 'ok'; info: OpenRouterKeyInfo }
  | { status: 'error'; invalidKey: boolean };

interface OpenRouterPanelProps {
  settings: AppSettings;
  update: UpdateSettings;
}

/**
 * OpenRouter: one-click sign-in (chrome.identity), a "paste a code" fallback
 * that survives a panel reload, or a pasted key. Once connected it shows the
 * key's credit details.
 */
export function OpenRouterPanel({ settings, update }: OpenRouterPanelProps) {
  useLanguage();
  const { apiKey, connectedVia } = settings.ai.openrouter;
  const connected = apiKey.trim() !== '';

  const connect = async (
    key: string,
    via: NonNullable<OpenRouterSettings['connectedVia']>
  ): Promise<boolean> => {
    const ok = await update({
      ai: { provider: 'openrouter', openrouter: { apiKey: key, connectedVia: via } },
    });
    if (ok) {
      showToast({
        tone: 'success',
        message: tp('aiConnect', 'connectedToast', { provider: NAME }),
      });
    }
    return ok;
  };

  if (connected) {
    return (
      <ConnectedView
        apiKey={apiKey.trim()}
        connectedVia={connectedVia}
        onDisconnect={async () => {
          const previous = { apiKey, connectedVia };
          const ok = await update({
            ai: { openrouter: { apiKey: '', connectedVia: null } },
          });
          if (!ok) return;
          showToast({
            message: tp('aiConnect', 'disconnectedToast', { provider: NAME }),
            action: {
              label: t('ui', 'undo'),
              onClick: () => void update({ ai: { openrouter: previous } }),
            },
          });
        }}
      />
    );
  }
  return <ConnectFlows onConnect={connect} />;
}

function ConnectFlows({
  onConnect,
}: {
  onConnect: (
    key: string,
    via: NonNullable<OpenRouterSettings['connectedVia']>
  ) => Promise<boolean>;
}) {
  useLanguage();
  const [mode, setMode] = useState<Mode>('start');
  const [pending, setPending] = useState<PendingHeadlessFlow | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [redirectFailed, setRedirectFailed] = useState(false);

  // A code flow started before a panel reload continues where it was.
  useEffect(() => {
    let active = true;
    loadPendingFlow()
      .then((flow) => {
        if (!active || !flow) return;
        setPending(flow);
        setMode('code');
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const handleRedirect = async () => {
    setRedirecting(true);
    setRedirectFailed(false);
    try {
      const credentials = await connectWithRedirect({
        keyLabel: OPENROUTER_KEY_LABEL,
      });
      await onConnect(credentials.key, 'oauth');
    } catch (error) {
      if (toAIError(error, 'openrouter').code !== 'cancelled') {
        setRedirectFailed(true);
      }
    } finally {
      setRedirecting(false);
    }
  };

  const startCodeFlow = async () => {
    setRedirectFailed(false);
    const flow = await createHeadlessFlow(OPENROUTER_KEY_LABEL);
    const saved: PendingHeadlessFlow = {
      authUrl: flow.authUrl,
      verifier: flow.verifier,
      createdAt: Date.now(),
    };
    // Best effort: without session storage the flow still works until reload.
    await savePendingFlow(saved).catch(() => undefined);
    setPending(saved);
    setMode('code');
    openExternal(flow.authUrl);
  };

  const cancelCodeFlow = () => {
    setPending(null);
    setMode('start');
    void clearPendingFlow().catch(() => undefined);
  };

  if (mode === 'code' && pending) {
    return (
      <CodeFlow
        flow={pending}
        onRestart={() => void startCodeFlow()}
        onCancel={cancelCodeFlow}
        onConnected={async (key) => {
          const ok = await onConnect(key, 'oauth');
          if (ok) {
            setPending(null);
            void clearPendingFlow().catch(() => undefined);
          }
          return ok;
        }}
      />
    );
  }

  if (mode === 'manual') {
    return (
      <div className="flex flex-col gap-3">
        <KeyForm
          provider="openrouter"
          label={tp('aiConnect', 'keyLabel', { provider: NAME })}
          hint={tp('aiConnect', 'keyHint', { provider: NAME })}
          autoFocus
          onSave={(key) => onConnect(key, 'manual')}
          onCancel={() => setMode('start')}
        />
        <OutboundLink href={PROVIDER_KEY_PAGES.openrouter} className="self-start">
          {t('aiConnect', 'orManage')}
        </OutboundLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-fg-muted">{t('aiConnect', 'orIntro')}</p>
      <Button loading={redirecting} onClick={() => void handleRedirect()}>
        <LogIn aria-hidden="true" />
        {t('aiConnect', 'orConnect')}
      </Button>
      {redirectFailed && (
        <Banner
          tone="warning"
          action={{
            label: t('aiConnect', 'orUseCode'),
            onClick: () => void startCodeFlow(),
          }}
        >
          {t('aiConnect', 'orRedirectFailed')}
        </Banner>
      )}
      <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
        <Button variant="secondary" size="sm" onClick={() => void startCodeFlow()}>
          {t('aiConnect', 'orUseCode')}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setMode('manual')}>
          {t('aiConnect', 'orPasteKey')}
        </Button>
      </div>
    </div>
  );
}

function CodeFlow({
  flow,
  onRestart,
  onCancel,
  onConnected,
}: {
  flow: PendingHeadlessFlow;
  onRestart: () => void;
  onCancel: () => void;
  onConnected: (key: string) => Promise<boolean>;
}) {
  useLanguage();
  const [code, setCode] = useState('');
  const [error, setError] = useState<{ message: string; restart: boolean } | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (parseAuthCode(code) === null) {
      setError({ message: t('aiConnect', 'orCodeInvalid'), restart: false });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const credentials = await completePendingFlow(flow, code);
      await onConnected(credentials.key);
    } catch (caught) {
      const aiError = toAIError(caught, 'openrouter');
      if (aiError.code === 'auth') {
        setError({ message: t('aiConnect', 'orCodeRejected'), restart: true });
      } else {
        const message = connectionErrorMessage(aiError, NAME);
        if (message) setError({ message, restart: false });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-fg">{t('aiConnect', 'orCodeTitle')}</p>
      <ol className="flex list-decimal flex-col gap-1.5 ps-5 text-sm text-fg-muted marker:font-semibold marker:text-fg-subtle">
        <li>
          {t('aiConnect', 'orCodeStep1')}{' '}
          <Button variant="link" onClick={() => openExternal(flow.authUrl)}>
            {t('aiConnect', 'orCodeReopen')}
            <ExternalLinkIcon aria-hidden="true" />
          </Button>
        </li>
        <li>{t('aiConnect', 'orCodeStep2')}</li>
      </ol>
      <Field label={t('aiConnect', 'orCodeLabel')} error={error?.message}>
        <Input
          value={code}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="font-mono text-[13px]"
          onChange={(event) => {
            setCode(event.target.value);
            setError(null);
          }}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={busy}>
          {t('aiConnect', 'orCodeSubmit')}
        </Button>
        {error?.restart && (
          <Button variant="secondary" size="sm" onClick={onRestart}>
            {t('aiConnect', 'orStartOver')}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t('common', 'cancel')}
        </Button>
      </div>
    </form>
  );
}

const RESET_KEYS = {
  day: 'resetDaily',
  daily: 'resetDaily',
  week: 'resetWeekly',
  weekly: 'resetWeekly',
  month: 'resetMonthly',
  monthly: 'resetMonthly',
} as const;

function resetLabel(reset: string): string {
  const key = RESET_KEYS[reset.toLowerCase() as keyof typeof RESET_KEYS];
  return key ? t('aiConnect', key) : reset;
}

function credits(value: number | null): string {
  return value === null ? t('aiConnect', 'orNoLimit') : formatPrice(value, 'USD');
}

function ConnectedView({
  apiKey,
  connectedVia,
  onDisconnect,
}: {
  apiKey: string;
  connectedVia: OpenRouterSettings['connectedVia'];
  onDisconnect: () => Promise<void>;
}) {
  useLanguage();
  const [state, setState] = useState<KeyInfoState>({ status: 'loading' });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    getOpenRouterKeyInfo(apiKey, controller.signal)
      .then((info) => setState({ status: 'ok', info }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          invalidKey: toAIError(error, 'openrouter').code === 'auth',
        });
      });
    return () => controller.abort();
  }, [apiKey, reload]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-fg">
        {connectedVia === 'manual'
          ? t('aiConnect', 'orConnectedManual')
          : t('aiConnect', 'orConnectedOauth')}
      </p>
      <div aria-live="polite" aria-busy={state.status === 'loading'}>
        {state.status === 'loading' && (
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        )}
        {state.status === 'ok' && <KeyInfo info={state.info} />}
        {state.status === 'error' && (
          <Banner tone={state.invalidKey ? 'error' : 'warning'}>
            {state.invalidKey
              ? t('aiConnect', 'orKeyInvalid')
              : t('aiConnect', 'orKeyInfoFailed')}
          </Banner>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={state.status === 'loading'}
          onClick={() => setReload((value) => value + 1)}
        >
          <RefreshCw aria-hidden="true" />
          {t('aiConnect', 'refresh')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void onDisconnect()}>
          <Unplug aria-hidden="true" />
          {t('aiConnect', 'disconnect')}
        </Button>
      </div>
      <OutboundLink href={PROVIDER_KEY_PAGES.openrouter} className="self-start">
        {t('aiConnect', 'orManage')}
      </OutboundLink>
    </div>
  );
}

function KeyInfo({ info }: { info: OpenRouterKeyInfo }) {
  const rows: { label: string; value: string; wide?: boolean }[] = [];
  if (info.label) {
    rows.push({ label: t('aiConnect', 'orKeyName'), value: info.label, wide: true });
  }
  rows.push(
    { label: t('aiConnect', 'orLimit'), value: credits(info.limit) },
    { label: t('aiConnect', 'orRemaining'), value: credits(info.limitRemaining) },
    {
      label: t('aiConnect', 'orUsage'),
      value: info.usage === null ? '-' : formatPrice(info.usage, 'USD'),
    }
  );
  if (info.limitReset) {
    rows.push({
      label: t('aiConnect', 'orResets'),
      value: resetLabel(info.limitReset),
    });
  }
  return (
    <div className="flex flex-col gap-2">
      {info.isFreeTier && (
        <Badge className="self-start">{t('aiConnect', 'orFreeTier')}</Badge>
      )}
      <dl className="grid grid-cols-2 gap-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className={cn(
              'min-w-0 rounded-lg bg-surface-sunken px-3 py-2 ring-1 ring-line ring-inset',
              row.wide && 'col-span-2'
            )}
          >
            <dt className="text-xs text-fg-muted">{row.label}</dt>
            <dd className="mt-0.5 truncate text-sm font-semibold text-fg tabular-nums">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
