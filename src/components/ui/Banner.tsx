import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { t, useLanguage } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { IconButton } from './IconButton';

export type BannerTone = 'info' | 'success' | 'warning' | 'error';

interface BannerProps {
  tone?: BannerTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: { label: string; onClick: () => void };
  /** Shows a close button. */
  onDismiss?: () => void;
  className?: string;
}

const TONES: Record<BannerTone, { box: string; icon: string }> = {
  info: { box: 'bg-primary-soft', icon: 'text-primary-strong' },
  success: { box: 'bg-success-soft', icon: 'text-success' },
  warning: { box: 'bg-warning-soft', icon: 'text-warning' },
  error: { box: 'bg-danger-soft', icon: 'text-danger' },
};

const ICONS = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
} satisfies Record<BannerTone, unknown>;

/** Inline message. Errors are announced assertively, the rest politely. */
export function Banner({
  tone = 'info',
  title,
  children,
  action,
  onDismiss,
  className,
}: BannerProps) {
  useLanguage();
  const Icon = ICONS[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex gap-3 rounded-xl p-3 text-sm text-fg',
        TONES[tone].box,
        className
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn('mt-0.5 size-[1.125rem] shrink-0', TONES[tone].icon)}
      />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && (
          <div className={cn('text-fg-muted', title ? 'mt-0.5' : undefined)}>
            {children}
          </div>
        )}
        {action && (
          <Button
            variant="link"
            onClick={action.onClick}
            className="mt-1.5 font-semibold"
          >
            {action.label}
          </Button>
        )}
      </div>
      {onDismiss && (
        <IconButton
          label={t('common', 'close')}
          size="sm"
          onClick={onDismiss}
          className="-mt-1 -mr-1"
        >
          <X />
        </IconButton>
      )}
    </div>
  );
}
