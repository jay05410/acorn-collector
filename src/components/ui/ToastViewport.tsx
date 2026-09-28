import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { t, useLanguage } from '@/i18n';
import { cn } from '@/lib/utils';
import {
  dismissToast,
  pauseToast,
  resumeToast,
  runToastAction,
  useToasts,
  type Toast,
} from './toast-store';

/**
 * Renders toasts from toast-store at the bottom of the panel. Mount it once
 * (App shell): the polite live region must exist before a toast is shown.
 */
export function ToastViewport() {
  useLanguage();
  const toasts = useToasts();
  return (
    <section
      aria-label={t('ui', 'notifications')}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-(--z-toast) flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <ol
        aria-live="polite"
        aria-atomic="false"
        className="flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </ol>
    </section>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const Icon =
    toast.tone === 'success'
      ? CircleCheck
      : toast.tone === 'error'
        ? CircleAlert
        : null;
  return (
    <li
      onMouseEnter={() => pauseToast(toast.id, 'hover')}
      onMouseLeave={() => resumeToast(toast.id, 'hover')}
      onFocus={() => pauseToast(toast.id, 'focus')}
      onBlur={(event) => {
        // Focus moving between the toast's own buttons is not a blur.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          resumeToast(toast.id, 'focus');
        }
      }}
      className="pointer-events-auto flex animate-toast-in items-center gap-2 rounded-xl bg-fg py-2 pr-1.5 pl-3.5 text-sm text-canvas shadow-lg"
    >
      {Icon && (
        <Icon
          aria-hidden="true"
          className={cn(
            'size-[1.125rem] shrink-0',
            toast.tone === 'error' ? 'text-danger-soft' : 'text-success-soft'
          )}
        />
      )}
      <p className="min-w-0 flex-1 py-1.5">{toast.message}</p>
      {toast.action && (
        <button
          type="button"
          onClick={() => runToastAction(toast.id)}
          className="hit-area shrink-0 cursor-pointer rounded-md px-2.5 py-1.5 font-semibold text-primary-soft hover:bg-canvas/10"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label={t('ui', 'dismiss')}
        title={t('ui', 'dismiss')}
        onClick={() => dismissToast(toast.id)}
        className="hit-area flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-canvas/70 hover:bg-canvas/10 hover:text-canvas"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </li>
  );
}
