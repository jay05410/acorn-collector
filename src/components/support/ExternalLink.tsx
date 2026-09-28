import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { t } from '@/i18n';
import { openExternal } from '@/lib/sponsor/links';

interface ExternalLinkProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href' | 'target'
> {
  href: string;
}

/**
 * A real link (copy/middle-click keep working) whose plain click opens a new
 * browser tab through chrome.tabs, since the side panel is not a tab itself.
 */
export function ExternalLink({
  href,
  rel,
  onClick,
  children,
  ...props
}: ExternalLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    openExternal(href);
  };

  return (
    <a
      {...props}
      href={href}
      target="_blank"
      rel={['noopener', 'noreferrer', rel].filter(Boolean).join(' ')}
      onClick={handleClick}
    >
      {children}
      <span className="sr-only"> {t('support', 'opensInNewTab')}</span>
    </a>
  );
}
