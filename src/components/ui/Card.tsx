import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'li' | 'ul' | 'form';
}

/** Surface container with the standard border, radius and shadow. */
export function Card({ as: Tag = 'div', className, ...props }: CardProps) {
  return (
    <Tag
      className={cn(
        'rounded-xl border border-line bg-surface shadow-xs',
        className
      )}
      {...props}
    />
  );
}
