import { Coffee, Heart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DONATION_LINKS } from '@/config/monetization';
import { t, useLanguage, type MessageKey } from '@/i18n';
import { cn } from '@/lib/utils';
import { ExternalLink } from './ExternalLink';

interface SupportLinksProps {
  className?: string;
}

interface DonationButton {
  href: string;
  label: MessageKey<'support'>;
  icon: LucideIcon;
  iconClass: string;
}

/**
 * Donation buttons as plain links (the providers' widgets are remote scripts,
 * which MV3 forbids). A button without a configured URL is hidden; nothing
 * renders when neither is set.
 */
export function SupportLinks({ className }: SupportLinksProps) {
  useLanguage();
  const candidates: DonationButton[] = [
    {
      href: DONATION_LINKS.buyMeACoffee,
      label: 'buyMeACoffee',
      icon: Coffee,
      iconClass: 'text-amber-600 dark:text-amber-400',
    },
    {
      href: DONATION_LINKS.githubSponsors,
      label: 'githubSponsors',
      icon: Heart,
      iconClass: 'text-pink-600 dark:text-pink-400',
    },
  ];
  const buttons = candidates.filter((button) => button.href !== '');

  if (buttons.length === 0) return null;

  return (
    <nav
      aria-label={t('support', 'supportLinksLabel')}
      className={cn('flex flex-wrap gap-2', className)}
    >
      {buttons.map(({ href, label, icon: Icon, iconClass }) => (
        <ExternalLink
          key={label}
          href={href}
          className="inline-flex min-h-11 flex-1 basis-40 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
        >
          <Icon
            className={cn('h-4 w-4 shrink-0', iconClass)}
            aria-hidden="true"
          />
          {t('support', label)}
        </ExternalLink>
      ))}
    </nav>
  );
}
