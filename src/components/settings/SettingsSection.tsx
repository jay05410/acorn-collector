import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import {
  sectionElementId,
  sectionHeadingId,
  type SettingsSectionId,
} from './section-ids';

interface SettingsSectionProps {
  id: SettingsSectionId;
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/** One settings card: icon, heading, optional description, then controls. */
export function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  children,
  className,
}: SettingsSectionProps) {
  const headingId = sectionHeadingId(id);
  return (
    <Card
      as="section"
      id={sectionElementId(id)}
      aria-labelledby={headingId}
      className={cn('scroll-mt-3 p-4', className)}
    >
      <div className="mb-4 flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-strong [&_svg]:size-[1.125rem]"
        >
          <Icon />
        </span>
        <div className="min-w-0 flex-1 pt-1">
          <h2
            id={headingId}
            tabIndex={-1}
            className="text-base leading-snug font-semibold text-fg outline-none"
          >
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm text-fg-muted">{description}</p>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </Card>
  );
}

interface SettingRowProps {
  /** id of the control, for the label. */
  controlId: string;
  label: string;
  hint?: string;
  hintId?: string;
  control: ReactNode;
}

/** Label and hint on the left, a compact control (switch, button) on the right. */
export function SettingRow({
  controlId,
  label,
  hint,
  hintId,
  control,
}: SettingRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <label
          htmlFor={controlId}
          className="block text-sm leading-5 font-medium text-fg"
        >
          {label}
        </label>
        {hint && (
          <p id={hintId} className="mt-0.5 text-xs text-fg-muted">
            {hint}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center pt-0.5">{control}</div>
    </div>
  );
}
