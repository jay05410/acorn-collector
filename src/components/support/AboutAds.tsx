import { useEffect, useId, useRef } from 'react';
import { EyeOff, Globe, Languages, Lock, Tag, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MONETIZATION, SPONSOR_CONTACT } from '@/config/monetization';
import { getLanguage, t, useLanguage, type MessageKey } from '@/i18n';
import { ExternalLink } from './ExternalLink';

interface AboutAdsProps {
  open: boolean;
  onClose: () => void;
}

/** Privacy policy URL pointing at the ads section in the reader's language. */
function adsPolicyUrl(): string {
  const anchor = getLanguage() === 'ko' ? 'ads-ko' : 'ads-en';
  const [base] = MONETIZATION.privacyPolicyUrl.split('#');
  return `${base}#${anchor}`;
}

const POINTS: { icon: LucideIcon; key: MessageKey<'support'> }[] = [
  { icon: Languages, key: 'aboutAdsContextual' },
  { icon: EyeOff, key: 'aboutAdsNoTracking' },
  { icon: Lock, key: 'aboutAdsNoPersonalData' },
  { icon: Tag, key: 'aboutAdsCampaignTag' },
  { icon: Globe, key: 'aboutAdsNetwork' },
];

/**
 * Explains how ads work. A native modal <dialog>: focus is trapped, Escape
 * closes it and focus returns to the button that opened it.
 */
export function AboutAds({ open, onClose }: AboutAdsProps) {
  useLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop targets the dialog element itself.
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl bg-white p-0 text-gray-900 shadow-xl backdrop:bg-black/50 dark:bg-gray-800 dark:text-gray-100"
    >
      <div className="flex items-center justify-between border-b border-gray-200 py-1 pl-4 pr-1 dark:border-gray-700">
        <h2 id={titleId} className="text-base font-semibold">
          {t('support', 'aboutAdsTitle')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common', 'close')}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="space-y-3 p-4 text-sm">
        <p className="text-gray-700 dark:text-gray-300">
          {t('support', 'aboutAdsIntro')}
        </p>
        <ul className="space-y-2.5">
          {POINTS.map(({ icon: Icon, key }) => (
            <li key={key} className="flex gap-2.5">
              <Icon
                className="mt-0.5 h-4 w-4 shrink-0 text-accent dark:text-primary"
                aria-hidden="true"
              />
              <span className="text-gray-700 dark:text-gray-300">
                {t('support', key)}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-x-4 pt-1">
          <ExternalLink
            href={adsPolicyUrl()}
            className="inline-flex min-h-11 items-center rounded font-medium text-gray-900 underline decoration-primary decoration-2 underline-offset-4 hover:decoration-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-gray-100"
          >
            {t('support', 'privacyPolicy')}
          </ExternalLink>
          <ExternalLink
            href={SPONSOR_CONTACT}
            className="inline-flex min-h-11 items-center rounded font-medium text-gray-900 underline decoration-primary decoration-2 underline-offset-4 hover:decoration-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-gray-100"
          >
            {t('support', 'advertiseHere')}
          </ExternalLink>
        </div>
      </div>
    </dialog>
  );
}
