import { Info, ShieldCheck } from 'lucide-react';
import { t, useLanguage } from '@/i18n';
import { OutboundLink } from './connection';
import { PRIVACY_POLICY_URL, SOURCE_CODE_URL } from './links';
import { SettingsSection } from './SettingsSection';

function manifestVersion(): string {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return '';
  }
}

export function AboutSection() {
  useLanguage();
  const version = manifestVersion();
  return (
    <SettingsSection
      id="about"
      icon={Info}
      title={t('settingsView', 'sectionAbout')}
    >
      <dl className="flex items-baseline justify-between gap-4 text-sm">
        <dt className="text-fg-muted">{t('settingsView', 'version')}</dt>
        <dd className="font-medium text-fg tabular-nums">
          {t('common', 'appName')} {version}
        </dd>
      </dl>
      <p className="flex gap-2 rounded-lg bg-surface-sunken px-3 py-2.5 text-sm text-fg-muted">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
        {t('settingsView', 'noServers')}
      </p>
      <div className="-my-2 flex flex-wrap gap-x-5">
        <OutboundLink href={PRIVACY_POLICY_URL}>
          {t('support', 'privacyPolicy')}
        </OutboundLink>
        <OutboundLink href={SOURCE_CODE_URL}>
          {t('settingsView', 'sourceCode')}
        </OutboundLink>
      </div>
    </SettingsSection>
  );
}
