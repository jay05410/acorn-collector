import { useState, type FormEvent, type ReactNode } from 'react';
import {
  CalendarDays,
  ExternalLink,
  FileText,
  Link2,
  Pencil,
  StickyNote,
  Store,
  Trash2,
} from 'lucide-react';
import { useBooth, useBooths } from '@/hooks/useBooths';
import { useEvent } from '@/hooks/useEvents';
import { ItemChecklist } from '@/components/ItemChecklist';
import { Badge } from '@/components/ui/Badge';
import { BoothNumber } from '@/components/ui/BoothNumber';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { Input, Textarea } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useUIStore } from '@/stores/useUIStore';
import { t, tp, useLanguage } from '@/i18n';
import type { Booth } from '@/types';

interface BoothDetailProps {
  boothId: string;
  onOpenSettings?: () => void;
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function BoothDetail({ boothId, onOpenSettings }: BoothDetailProps) {
  useLanguage();
  const { booth, isLoading } = useBooth(boothId);
  const { updateBooth, deleteBooth } = useBooths(booth?.eventId || '');
  const event = useEvent(booth?.eventId);
  const { setSelectedBoothId } = useUIStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  if (isLoading) {
    return (
      <div aria-busy="true" className="p-3">
        <span className="sr-only">{t('common', 'loading')}</span>
        <Card className="space-y-3 p-4">
          <Skeleton className="h-7 w-14" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </Card>
      </div>
    );
  }

  if (!booth) {
    return (
      <EmptyState icon={<Store />} title={t('booths', 'noBooths')} />
    );
  }

  const handleSave = async (draft: BoothDraft) => {
    await updateBooth(boothId, {
      boothNumber: draft.boothNumber.trim(),
      circleName: draft.circleName.trim(),
      formUrl: draft.formUrl.trim() || null,
      memo: draft.memo.trim() || null,
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await deleteBooth(boothId);
    setIsConfirmingDelete(false);
    setSelectedBoothId(null);
  };

  const formUrls = (booth.formUrl ?? '')
    .split('\n')
    .map((url) => url.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3 p-3 pb-6">
      <Card as="section" className="p-4">
        {isEditing ? (
          <BoothForm
            booth={booth}
            onSubmit={handleSave}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <BoothNumber>{booth.boothNumber}</BoothNumber>
                  {booth.zone && (
                    <Badge tone="neutral" size="md">
                      {booth.zone}
                    </Badge>
                  )}
                </div>
                <h2 className="mt-2 text-lg leading-snug font-semibold break-words text-fg">
                  {booth.circleName}
                </h2>
                {event && (
                  <p className="mt-1 flex min-w-0 items-center gap-1 text-xs text-fg-muted">
                    <CalendarDays
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-fg-subtle"
                    />
                    <span className="truncate">{event.name}</span>
                  </p>
                )}
              </div>
              {/* gap-2: the 44px hit areas of the 36px buttons must not overlap. */}
              <div className="-mt-1 -mr-1 flex shrink-0 gap-2">
                <IconButton
                  label={t('common', 'edit')}
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil />
                </IconButton>
                <IconButton
                  variant="danger"
                  label={t('common', 'delete')}
                  onClick={() => setIsConfirmingDelete(true)}
                >
                  <Trash2 />
                </IconButton>
              </div>
            </div>

            {(formUrls.length > 0 || booth.sourceUrl) && (
              <ul className="-mx-2 mt-3 border-t border-line pt-2">
                {formUrls.map((url, index) => (
                  <LinkRow
                    key={`${index}-${url}`}
                    href={url}
                    icon={<FileText />}
                    label={
                      formUrls.length > 1
                        ? tp('booths', 'openFormNumbered', { index: index + 1 })
                        : t('booths', 'openForm')
                    }
                  />
                ))}
                {booth.sourceUrl && (
                  <LinkRow
                    href={booth.sourceUrl}
                    icon={<Link2 />}
                    label={t('booths', 'openSource')}
                  />
                )}
              </ul>
            )}

            {booth.memo && (
              <div className="mt-3 flex gap-2.5 rounded-lg bg-surface-sunken px-3 py-2.5 text-sm text-fg-muted">
                <StickyNote
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-fg-subtle"
                />
                <p className="min-w-0 break-words whitespace-pre-wrap">
                  <span className="sr-only">{t('booths', 'memo')}: </span>
                  {booth.memo}
                </p>
              </div>
            )}
          </>
        )}
      </Card>

      <ItemChecklist
        boothId={boothId}
        imageUrls={booth.imageUrls}
        currency={event?.currency ?? null}
        onOpenSettings={onOpenSettings}
      />

      <ConfirmDialog
        open={isConfirmingDelete}
        title={booth.circleName}
        description={t('booths', 'deleteConfirm')}
        confirmLabel={t('common', 'delete')}
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmingDelete(false)}
      />
    </div>
  );
}

function LinkRow({
  href,
  icon,
  label,
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  const host = hostnameOf(href);
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-12 items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-hover active:bg-pressed focus-visible:outline-offset-0"
      >
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-strong [&_svg]:size-4"
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">
            {label}
          </span>
          {host && (
            <span className="block truncate text-xs text-fg-subtle">{host}</span>
          )}
        </span>
        <ExternalLink
          aria-hidden="true"
          className="size-4 shrink-0 text-fg-subtle"
        />
        <span className="sr-only">({t('ui', 'opensInNewTab')})</span>
      </a>
    </li>
  );
}

interface BoothDraft {
  boothNumber: string;
  circleName: string;
  formUrl: string;
  memo: string;
}

function BoothForm({
  booth,
  onSubmit,
  onCancel,
}: {
  booth: Booth;
  onSubmit: (draft: BoothDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<BoothDraft>({
    boothNumber: booth.boothNumber,
    circleName: booth.circleName,
    formUrl: booth.formUrl ?? '',
    memo: booth.memo ?? '',
  });
  const update = (patch: Partial<BoothDraft>) =>
    setDraft((prev) => ({ ...prev, ...patch }));
  const canSubmit =
    draft.boothNumber.trim().length > 0 && draft.circleName.trim().length > 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit) void onSubmit(draft);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <Field label={t('booths', 'boothNumber')} required className="w-28 shrink-0">
          <Input
            value={draft.boothNumber}
            onChange={(e) => update({ boothNumber: e.target.value })}
            placeholder={t('booths', 'boothNumberPlaceholder')}
            autoFocus
          />
        </Field>
        <Field label={t('booths', 'circleName')} required className="flex-1">
          <Input
            value={draft.circleName}
            onChange={(e) => update({ circleName: e.target.value })}
            placeholder={t('booths', 'circleNamePlaceholder')}
          />
        </Field>
      </div>
      <Field label={t('booths', 'formUrl')}>
        <Textarea
          rows={2}
          value={draft.formUrl}
          onChange={(e) => update({ formUrl: e.target.value })}
          placeholder="https://"
          className="min-h-16"
        />
      </Field>
      <Field label={t('booths', 'memo')}>
        <Textarea
          rows={2}
          value={draft.memo}
          onChange={(e) => update({ memo: e.target.value })}
          placeholder={t('booths', 'memoPlaceholder')}
          className="min-h-16"
        />
      </Field>
      <div className="flex gap-2 pt-1">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          {t('common', 'cancel')}
        </Button>
        <Button type="submit" className="flex-1" disabled={!canSubmit}>
          {t('common', 'save')}
        </Button>
      </div>
    </form>
  );
}
