import { useRef, useState, type ReactNode } from 'react';
import { HardDrive, Megaphone, Sparkles } from 'lucide-react';
import { OutboundLink } from '@/components/settings/connection';
import { PRIVACY_POLICY_URL } from '@/components/settings/links';
import type { SettingsBackend } from '@/components/settings/settings-controller';
import { useSettings } from '@/components/settings/useSettings';
import { AboutAds } from '@/components/support/AboutAds';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { t, tp, useLanguage } from '@/i18n';
import { adsNetworkNotice } from '@/lib/sponsor/disclosure';

interface FirstRunNoticeProps {
  /** "Connect AI now": the notice is accepted, then settings should open. */
  onConnectAi: () => void;
  /** Injected in tests. */
  backend?: SettingsBackend;
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
 * First-run notice: what stays local, what goes to the AI service and when,
 * and how ads work. Shown until settings.noticeAcceptedAt is set; closing it
 * counts as accepting, since it only informs.
 */
export function FirstRunNotice({
  onConnectAi,
  backend,
  now = Date.now,
}: FirstRunNoticeProps) {
  useLanguage();
  const { settings, update } = useSettings(backend);
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
