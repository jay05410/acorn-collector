import { cn } from '@/lib/utils';

interface BadgeProps {
  label: string;
  color?: string | null;
  className?: string;
}

export function Badge({ label, color, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        className
      )}
      style={{
        backgroundColor: color ? `${color}20` : '#e5e7eb',
        color: color ?? '#374151',
      }}
    >
      {label}
    </span>
  );
}
