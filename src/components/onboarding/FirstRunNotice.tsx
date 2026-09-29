import { useId, useRef, useState, type ReactNode } from 'react';
import { HardDrive, Megaphone, Sparkles } from 'lucide-react';
import { OutboundLink } from '@/components/settings/connection';
import { PRIVACY_POLICY_URL } from '@/components/settings/links';
import { SettingRow } from '@/components/settings/SettingsSection';
import type { UpdateSettings } from '@/components/settings/useSettings';
import { AboutAds } from '@/components/support/AboutAds';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Switch } from '@/components/ui/Switch';
import { t, tp, useLanguage } from '@/i18n';
import type { AppSettings } from '@/lib/settings-types';
import { adsNetworkNotice } from '@/lib/sponsor/disclosure';

interface FirstRunNoticeProps {
  /** The panel's settings state (see useSettings); null until loaded. */
  settings: AppSettings | null;
  update: UpdateSettings;
  /** "Connect AI now": the notice is accepted, then settings should open. */
  onConnectAi: () => void;
  /** Injected in tests. */
  now?: () => number;
}

function Point({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-strong [&_svg]:size-[1.125rem]"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm leading-5 font-semibold text-fg">{title}</h3>
        <div className="mt-0.5 flex flex-col gap-1 text-sm text-fg-muted">
          {children}
        </div>
      </div>
    </li>
  );
}

/**
 * First-run notice: what stays local, what goes to the AI service and when
 * (with the automatic analysis switch, which is on by default), and how ads
 * work. Shown until settings.noticeAcceptedAt is set; closing it counts as
 * accepting, since it only informs.
 */
export function FirstRunNotice({
  settings,
  update,
  onConnectAi,
  now = Date.now,
}: FirstRunNoticeProps) {
  useLanguage();
  const autoId = useId();
  const autoHintId = useId();
  const [aboutAdsOpen, setAboutAdsOpen] = useState(false);
  const startRef = useRef<HTMLButtonElement>(null);
  const open = settings !== null && settings.noticeAcceptedAt === null;

  const accept = () => update({ noticeAcceptedAt: now() });

  return (
    <Dialog
      open={open}
      onClose={() => void accept()}
      title={tp('onboarding', 'title', { appName: t('common', 'appName') })}
      description={t('onboarding', 'intro')}
      initialFocusRef={startRef}
      footer={
        <>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              void accept();
              onConnectAi();
            }}
          >
            {t('onboarding', 'connectAi')}
          </Button>
          <Button ref={startRef} className="flex-1" onClick={() => void accept()}>
            {t('onboarding', 'getStarted')}
          </Button>
        </>
      }
    >
      <ul className="flex flex-col gap-4 pt-1">
        <Point icon={<HardDrive />} title={t('onboarding', 'localTitle')}>
          <p>{t('onboarding', 'localBody')}</p>
        </Point>
        <Point icon={<Sparkles />} title={t('onboarding', 'aiTitle')}>
          <p>{t('onboarding', 'aiBody')}</p>
          {settings && (
            <div className="mt-1.5 rounded-lg bg-surface-sunken px-3 py-2.5 ring-1 ring-line ring-inset">
              <SettingRow
                controlId={autoId}
                label={t('settingsView', 'autoAnalyzeLabel')}
                hint={
                  settings.ai.autoAnalyze
                    ? t('onboarding', 'autoOn')
                    : t('onboarding', 'autoOff')
                }
                hintId={autoHintId}
                control={
                  <Switch
                    id={autoId}
                    aria-describedby={autoHintId}
                    checked={settings.ai.autoAnalyze}
                    onCheckedChange={(checked) =>
                      void update({ ai: { autoAnalyze: checked } })
                    }
                  />
                }
              />
            </div>
          )}
        </Point>
        <Point icon={<Megaphone />} title={t('onboarding', 'adsTitle')}>
          <p>{t('onboarding', 'adsBody')}</p>
          <p className="text-xs text-fg-subtle">{adsNetworkNotice()}</p>
        </Point>
      </ul>
      <div className="mt-2 flex flex-wrap gap-x-5 ps-12">
        <Button
          variant="link"
          aria-haspopup="dialog"
          className="min-h-11"
          onClick={() => setAboutAdsOpen(true)}
        >
          {t('onboarding', 'howAdsWork')}
        </Button>
        <OutboundLink href={PRIVACY_POLICY_URL}>
          {t('support', 'privacyPolicy')}
        </OutboundLink>
      </div>
      {/* Keys inside the native About ads dialog must not reach this
          Dialog, whose Escape would accept the notice. */}
      <div onKeyDown={(event) => event.stopPropagation()}>
        <AboutAds open={aboutAdsOpen} onClose={() => setAboutAdsOpen(false)} />
      </div>
    </Dialog>
  );
}
