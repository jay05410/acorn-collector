import { useId } from 'react';
import { HeartHandshake } from 'lucide-react';
import { DONATION_LINKS } from '@/config/monetization';
import { t, tp, useLanguage } from '@/i18n';
import { cn } from '@/lib/utils';
import { SupportLinks } from './SupportLinks';

interface SupportCardProps {
  className?: string;
}

/**
 * Settings section: a short thank-you, the donation links and the promise
 * that nothing is paywalled. Hidden when no donation link is configured.
 */
export function SupportCard({ className }: SupportCardProps) {
  useLanguage();
  const titleId = useId();
  if (!DONATION_LINKS.buyMeACoffee && !DONATION_LINKS.githubSponsors)
    return null;

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800',
        className
      )}
    >
      <h3
        id={titleId}
        className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100"
      >
        <HeartHandshake
          className="h-4 w-4 shrink-0 text-accent dark:text-primary"
          aria-hidden="true"
        />
        {t('support', 'supportTitle')}
      </h3>
      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
        {tp('support', 'supportBody', { appName: t('common', 'appName') })}
      </p>
      <SupportLinks className="mt-3" />
      <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
        {t('support', 'noPaywall')}
      </p>
    </section>
  );
}
