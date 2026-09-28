import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { t, useLanguage } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { IconButton } from './IconButton';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Actions pinned below the scrolling body. */
  footer?: ReactNode;
  /** `alertdialog` for confirmations that interrupt the user. */
  role?: 'dialog' | 'alertdialog';
  /** Receives focus on open; defaults to the first focusable in body/footer. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  size?: 'sm' | 'md';
  /** Extra classes for the scrolling body. */
  bodyClassName?: string;
}

const FOCUSABLE =
  'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"]';

function focusableIn(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) =>
      !el.hasAttribute('disabled') &&
      el.getAttribute('tabindex') !== '-1' &&
      el.getAttribute('type') !== 'hidden' &&
      !el.closest('[hidden], [inert]')
  );
}

/** Open dialogs, innermost last; only the top one traps focus. */
const openDialogs: symbol[] = [];
let scrollLocks = 0;
let savedOverflow = '';

function lockScroll(): void {
  if (scrollLocks++ === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
}

function unlockScroll(): void {
  if (--scrollLocks === 0) document.body.style.overflow = savedOverflow;
}

/**
 * Modal dialog rendered in a portal: a bottom sheet on narrow screens, a
 * centered card from 640px. Traps Tab focus, closes on Escape and backdrop
 * click, locks body scroll and restores focus to the opener on close.
 */
export function Dialog(props: DialogProps) {
  if (!props.open) return null;
  return <DialogPanel {...props} />;
}

function DialogPanel({
  onClose,
  title,
  description,
  children,
  footer,
  role = 'dialog',
  initialFocusRef,
  size = 'md',
  bodyClassName,
}: DialogProps) {
  useLanguage();
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = Symbol('dialog');
    openDialogs.push(token);
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    lockScroll();

    const panel = panelRef.current;
    const target =
      initialFocusRef?.current ?? focusableIn(contentRef.current)[0] ?? panel;
    target?.focus();

    const keepFocusInside = (event: FocusEvent) => {
      if (openDialogs[openDialogs.length - 1] !== token || !panel) return;
      if (!panel.contains(event.target as Node)) {
        (focusableIn(panel)[0] ?? panel).focus();
      }
    };
    document.addEventListener('focusin', keepFocusInside);

    return () => {
      document.removeEventListener('focusin', keepFocusInside);
      openDialogs.splice(openDialogs.indexOf(token), 1);
      unlockScroll();
      if (opener?.isConnected) opener.focus();
    };
  }, [initialFocusRef]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    // Keydowns from dialogs nested in portals bubble here through React.
    if (!panel || !panel.contains(event.target as Node)) return;

    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const items = focusableIn(panel);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) {
      event.preventDefault();
      panel.focus();
      return;
    }
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-(--z-dialog) flex items-end justify-center sm:items-center sm:p-6">
      <div
        aria-hidden="true"
        className="absolute inset-0 animate-fade-in bg-scrim"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative flex max-h-[min(92dvh,44rem)] w-full flex-col overflow-hidden bg-surface-raised shadow-xl outline-none',
          'animate-sheet-in rounded-t-2xl border-t border-line',
          'sm:animate-pop-in sm:rounded-2xl sm:border',
          size === 'sm' ? 'sm:max-w-sm' : 'sm:max-w-md'
        )}
      >
        <div className="flex shrink-0 items-start gap-2 py-3 pr-2 pl-4">
          <div className="min-w-0 flex-1 pt-1.5">
            <h2
              id={titleId}
              className="text-base leading-snug font-semibold break-words text-fg"
            >
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-fg-muted">
                {description}
              </p>
            )}
          </div>
          <IconButton label={t('common', 'close')} onClick={onClose}>
            <X />
          </IconButton>
        </div>
        <div ref={contentRef} className="flex min-h-0 flex-1 flex-col">
          {children && (
            <div
              className={cn(
                'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4',
                bodyClassName
              )}
            >
              {children}
            </div>
          )}
          {footer && (
            <div className="flex shrink-0 gap-2 border-t border-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  /** Label of the destructive action, e.g. "Delete". */
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/** Destructive confirmation. Focus starts on Cancel. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useLanguage();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      role="alertdialog"
      size="sm"
      title={title}
      description={description}
      initialFocusRef={cancelRef}
      footer={
        <>
          <Button
            ref={cancelRef}
            variant="secondary"
            className="flex-1"
            onClick={onCancel}
          >
            {t('common', 'cancel')}
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            loading={busy}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
