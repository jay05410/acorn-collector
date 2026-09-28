import { Fragment, useEffect, useState, type ReactNode } from 'react';
import {
  Check,
  CircleCheck,
  CircleX,
  Copy,
  RefreshCw,
  Send,
  ShieldAlert,
  Terminal,
  Timer,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { showToast } from '@/components/ui/toast-store';
import { t, tp, useLanguage } from '@/i18n';
import type { AIError } from '@/lib/ai/types';
import type {
  BridgeStatus,
  BridgeTargetStatus,
  CliTarget,
} from '@/lib/bridge/protocol';
import type { AppSettings } from '@/lib/settings-types';
import { cn } from '@/lib/utils';
import type { CliCheckState } from './cli-check';
import { cliTargetChange } from './cli-target';
import { OutboundLink } from './connection';
import { NATIVE_HOST_README_URL } from './links';
import { CLI_NAMES, CLI_TARGETS } from './providers';
import { cliReadiness } from './readiness';
import type { UpdateSettings } from './useSettings';

function extensionId(): string {
  return typeof chrome === 'undefined' ? '' : (chrome.runtime?.id ?? '');
}

function bridgeErrorText(error: AIError): string {
  switch (error.message) {
    case 'bridge_not_installed':
      return t('bridgeUi', 'errNotInstalled');
    case 'bridge_forbidden':
      return t('bridgeUi', 'errForbidden');
    case 'bridge_outdated':
      return t('bridgeUi', 'errOutdated');
    case 'bridge_unresponsive':
      return t('bridgeUi', 'errUnresponsive');
    default:
      return t('bridgeUi', 'errOther');
  }
}

function warningText(code: string): string {
  if (code === 'anthropic_api_key_ignored') {
    return t('bridgeUi', 'warnApiKeyIgnored');
  }
  if (code === 'status_check_failed') return t('bridgeUi', 'warnStatusFailed');
  return tp('bridgeUi', 'warnOther', { code });
}

interface CliPanelProps {
  settings: AppSettings;
  update: UpdateSettings;
  cli: CliCheckState;
}

/** Local CLI: what it does, then permission, install and status steps. */
export function CliPanel({ settings, update, cli }: CliPanelProps) {
  useLanguage();
  const { check, checking, denied } = cli;
  const target = settings.ai.cli.target;
  const readiness = cliReadiness(settings.ai, check);
  const command = `node install.mjs --extension-id ${extensionId()}`;

  const handleTarget = async (next: CliTarget) => {
    if (next === target) return;
    const { patch, clearedModel } = cliTargetChange(settings.ai.cli, next);
    const ok = await update({ ai: { cli: patch } });
    if (ok && clearedModel) {
      showToast({
        message: tp('bridgeUi', 'modelCleared', {
          model: clearedModel,
          cli: CLI_NAMES[next],
        }),
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 text-sm text-fg-muted">
        <p className="text-fg">{t('bridgeUi', 'intro')}</p>
        <ul className="flex flex-col gap-1.5">
          <Point icon={<Timer />}>{t('bridgeUi', 'pointSlower')}</Point>
          <Point icon={<Send />}>{t('bridgeUi', 'pointData')}</Point>
          <Point icon={<Wrench />}>{t('bridgeUi', 'pointAdvanced')}</Point>
        </ul>
        <p className="flex gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-fg">
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
          {t('bridgeUi', 'policyNote')}
        </p>
      </div>

      <Field label={t('bridgeUi', 'targetLabel')} group>
        <SegmentedControl
          options={CLI_TARGETS.map((value) => ({
            value,
            label: CLI_NAMES[value],
          }))}
          value={target}
          onChange={(next) => void handleTarget(next)}
        />
      </Field>

      <ol className="flex flex-col">
        <Step
          number={1}
          done={check.permission === true}
          title={t('bridgeUi', 'permissionTitle')}
        >
          <p>{t('bridgeUi', 'permissionBody')}</p>
          {check.permission === true ? (
            <p className="inline-flex items-center gap-1.5 font-medium text-success">
              <CircleCheck aria-hidden="true" className="size-4" />
              {t('bridgeUi', 'permissionGranted')}
            </p>
          ) : (
            <Button
              size="sm"
              className="self-start"
              disabled={check.permission === null}
              onClick={() => void cli.requestPermission()}
            >
              {t('bridgeUi', 'permissionAllow')}
            </Button>
          )}
          {denied && check.permission !== true && (
            <p className="text-xs font-medium text-danger">
              {t('bridgeUi', 'permissionDenied')}
            </p>
          )}
        </Step>

        <Step
          number={2}
          done={check.status !== null}
          title={t('bridgeUi', 'installTitle')}
        >
          <p>{t('bridgeUi', 'installBody')}</p>
          <CommandBox command={command} />
          <p>{t('bridgeUi', 'installAfter')}</p>
          <OutboundLink href={NATIVE_HOST_README_URL} className="-my-2 self-start">
            {t('bridgeUi', 'guide')}
          </OutboundLink>
        </Step>

        <Step
          number={3}
          done={readiness === 'ready'}
          title={t('bridgeUi', 'statusTitle')}
          last
        >
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            loading={checking}
            disabled={check.permission !== true}
            onClick={() => void cli.refresh()}
          >
            <RefreshCw aria-hidden="true" />
            {check.status || check.error
              ? t('bridgeUi', 'checkAgain')
              : t('bridgeUi', 'check')}
          </Button>
          <div aria-live="polite" className="flex flex-col gap-2">
            {checking && (
              <span className="sr-only">{t('bridgeUi', 'checking')}</span>
            )}
            {!checking && check.error && (
              <Banner tone="warning">{bridgeErrorText(check.error)}</Banner>
            )}
            {check.status && (
              <TargetList status={check.status} current={target} />
            )}
          </div>
        </Step>
      </ol>
    </div>
  );
}

function Point({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-fg-subtle [&_svg]:size-4"
      >
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}

function Step({
  number,
  done,
  title,
  last = false,
  children,
}: {
  number: number;
  done: boolean;
  title: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <li className={cn('relative flex gap-3', !last && 'pb-5')}>
      {!last && (
        <span
          aria-hidden="true"
          className="absolute top-8 bottom-1.5 left-[0.8125rem] w-px bg-line"
        />
      )}
      <span
        aria-hidden="true"
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
          done
            ? 'bg-success-soft text-success'
            : 'bg-primary-soft text-primary-strong'
        )}
      >
        {done ? <Check className="size-4" strokeWidth={3} /> : number}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1 text-sm text-fg-muted">
        <h3 className="text-sm leading-5 font-semibold text-fg">{title}</h3>
        {children}
      </div>
    </li>
  );
}

function CommandBox({ command }: { command: string }) {
  useLanguage();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle'
  );

  useEffect(() => {
    if (copyState !== 'copied') return;
    const timer = setTimeout(() => setCopyState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [copyState]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-1 rounded-lg bg-surface-sunken py-1 ps-3 pe-1 ring-1 ring-line ring-inset">
        <code className="min-w-0 flex-1 py-1.5 font-mono text-xs leading-5 [overflow-wrap:anywhere] text-fg select-all">
          {/* Flags never break across lines; only the long ID may. */}
          {command.split(' ').map((part, index) => (
            <Fragment key={index}>
              {index > 0 && ' '}
              <span className={part.startsWith('-') ? 'whitespace-nowrap' : undefined}>
                {part}
              </span>
            </Fragment>
          ))}
        </code>
        <IconButton
          label={
            copyState === 'copied' ? t('bridgeUi', 'copied') : t('bridgeUi', 'copy')
          }
          size="sm"
          onClick={() => void handleCopy()}
        >
          {copyState === 'copied' ? <Check /> : <Copy />}
        </IconButton>
      </div>
      <span role="status" className="sr-only">
        {copyState === 'copied' ? t('bridgeUi', 'copied') : ''}
      </span>
      {copyState === 'failed' && (
        <p className="text-xs font-medium text-danger">
          {t('bridgeUi', 'copyFailed')}
        </p>
      )}
    </div>
  );
}

function TargetList({
  status,
  current,
}: {
  status: BridgeStatus;
  current: CliTarget;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {CLI_TARGETS.map((target) => (
        <TargetRow
          key={target}
          target={target}
          status={status.targets[target]}
          inUse={target === current}
        />
      ))}
    </ul>
  );
}

function TargetRow({
  target,
  status,
  inUse,
}: {
  target: CliTarget;
  status: BridgeTargetStatus;
  inUse: boolean;
}) {
  useLanguage();
  const checkFailed = status.warnings.includes('status_check_failed');
  const details = [status.authMethod, status.subscriptionType]
    .filter((value): value is string => Boolean(value))
    .join(' · ');
  let hint: string | null = null;
  if (!status.installed) {
    hint =
      target === 'claude'
        ? t('bridgeUi', 'hintInstallClaude')
        : t('bridgeUi', 'hintInstallCodex');
  } else if (!status.loggedIn && !checkFailed) {
    hint =
      target === 'claude'
        ? t('bridgeUi', 'hintSignInClaude')
        : t('bridgeUi', 'hintSignInCodex');
  }

  return (
    <li
      className={cn(
        'flex flex-col gap-1.5 rounded-lg border px-3 py-2.5',
        inUse ? 'border-primary bg-surface-raised' : 'border-line bg-surface-raised/60'
      )}
    >
      <div className="flex items-center gap-2">
        <Terminal aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
        <span className="text-sm font-semibold text-fg">{CLI_NAMES[target]}</span>
        {inUse && <Badge tone="primary">{t('bridgeUi', 'inUse')}</Badge>}
      </div>
      <StatusLine
        ok={status.installed}
        text={
          status.installed
            ? t('bridgeUi', 'installed')
            : t('bridgeUi', 'notInstalled')
        }
      />
      {status.installed && !checkFailed && (
        <StatusLine
          ok={status.loggedIn}
          text={
            status.loggedIn
              ? details
                ? tp('bridgeUi', 'signedInDetails', { details })
                : t('bridgeUi', 'signedIn')
              : t('bridgeUi', 'notSignedIn')
          }
        />
      )}
      {hint && <p className="text-xs text-fg-muted">{hint}</p>}
      {status.warnings.map((code) => (
        <p key={code} className="flex gap-1.5 text-xs text-fg">
          <TriangleAlert
            aria-hidden="true"
            className="mt-px size-3.5 shrink-0 text-warning"
          />
          {warningText(code)}
        </p>
      ))}
    </li>
  );
}

function StatusLine({ ok, text }: { ok: boolean; text: string }) {
  const Icon = ok ? CircleCheck : CircleX;
  return (
    <p className="flex items-center gap-1.5 text-[13px] text-fg">
      <Icon
        aria-hidden="true"
        className={cn('size-4 shrink-0', ok ? 'text-success' : 'text-fg-subtle')}
      />
      {text}
    </p>
  );
}
