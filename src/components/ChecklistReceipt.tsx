import { useMemo, useState } from 'react';
import { Check, Download, ListChecks, Receipt, Share2 } from 'lucide-react';
import { useEvent } from '@/hooks/useEvents';
import { useBooths } from '@/hooks/useBooths';
import { useItemsForBooths } from '@/hooks/useItems';
import { useBadges } from '@/hooks/useBadges';
import { AcornMark } from '@/components/ui/AcornMark';
import { Badge } from '@/components/ui/Badge';
import { BoothNumber } from '@/components/ui/BoothNumber';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { groupItemsByBooth } from '@/components/checklist-progress';
import { exportChecklistAsImage } from '@/lib/export';
import {
  cn,
  resolveEventCurrency,
  resolveItemCurrency,
  totalsByCurrency,
} from '@/lib/utils';
import {
  formatDate,
  formatPrice,
  getBadgeLabel,
  t,
  tp,
  useLanguage,
} from '@/i18n';
import type { Booth, Item } from '@/types';

type ExportMode = 'receipt' | 'checklist';

interface ChecklistReceiptProps {
  eventId: string;
  onClose: () => void;
}

const RECEIPT_ID = 'checklist-receipt';

export function ChecklistReceipt({ eventId, onClose }: ChecklistReceiptProps) {
  useLanguage();
  const event = useEvent(eventId);
  const { booths } = useBooths(eventId);
  const boothIds = useMemo(() => booths.map((b) => b.id), [booths]);
  const items = useItemsForBooths(boothIds);
  const itemsByBooth = useMemo(() => groupItemsByBooth(items), [items]);
  const [isExporting, setIsExporting] = useState(false);
  const [mode, setMode] = useState<ExportMode>('checklist');

  const eventName = event?.name ?? '';
  const eventCurrency = resolveEventCurrency(event?.currency);
  const totals = useMemo(
    () => totalsByCurrency(items, eventCurrency).filter((row) => row.total > 0),
    [items, eventCurrency]
  );

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportChecklistAsImage(RECEIPT_ID);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    try {
      const element = document.getElementById(RECEIPT_ID);
      if (!element) return;

      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(element, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'checklist.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: tp('export', 'shareTitle', { event: eventName }),
        });
      } else {
        await handleExport();
      }
    } catch (error) {
      console.error('Share failed:', error);
      await handleExport();
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('export', 'title')}
      bodyClassName="space-y-3"
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={handleShare}>
            <Share2 />
            {t('export', 'share')}
          </Button>
          <Button className="flex-1" loading={isExporting} onClick={handleExport}>
            {!isExporting && <Download />}
            {t('common', 'save')}
          </Button>
        </>
      }
    >
      <SegmentedControl
        aria-label={t('export', 'title')}
        value={mode}
        onChange={setMode}
        options={[
          {
            value: 'checklist',
            label: t('export', 'boothList'),
            icon: <ListChecks aria-hidden="true" />,
          },
          {
            value: 'receipt',
            label: t('export', 'eventInfo'),
            icon: <Receipt aria-hidden="true" />,
          },
        ]}
      />

      {/* Exported as a PNG: always light, whatever the UI scheme. */}
      <div
        id={RECEIPT_ID}
        className="scheme-light rounded-xl border border-dashed border-line-strong bg-surface p-4 font-sans text-fg"
      >
        <div className="flex flex-col items-center text-center">
          <h3 className="text-base leading-snug font-bold break-words">
            {eventName || t('export', 'title')}
          </h3>
          {(event?.date || event?.location) && (
            <p className="mt-0.5 text-xs text-fg-muted">
              {[event?.date ? formatDate(event.date) : null, event?.location]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>

        <hr className="my-3 border-t border-dashed border-line-strong" />

        {booths.length === 0 ? (
          <p className="py-4 text-center text-sm text-fg-subtle">
            {t('booths', 'noBooths')}
          </p>
        ) : (
          <div className="space-y-2">
            {booths.map((booth) => (
              <BoothSection
                key={booth.id}
                booth={booth}
                items={itemsByBooth.get(booth.id) ?? []}
                currency={eventCurrency}
                showPrices={mode === 'receipt'}
              />
            ))}
          </div>
        )}

        <hr className="my-3 border-t border-dashed border-line-strong" />

        <dl className="space-y-1 text-sm text-fg-muted">
          <div className="flex justify-between">
            <dt>{t('booths', 'title')}</dt>
            <dd className="font-medium text-fg tabular-nums">{booths.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{t('items', 'title')}</dt>
            <dd className="font-medium text-fg tabular-nums">{items.length}</dd>
          </div>
          {mode === 'receipt' &&
            totals.map((row) => (
              <div
                key={row.currency}
                className="space-y-1 border-t border-dashed border-line pt-1"
              >
                <div className="flex justify-between">
                  <dt>{t('export', 'total')}</dt>
                  <dd className="font-medium text-fg tabular-nums">
                    {formatPrice(row.total, row.currency)}
                  </dd>
                </div>
                <div className="flex justify-between font-semibold text-success">
                  <dt>{t('export', 'purchased')}</dt>
                  <dd className="tabular-nums">
                    {formatPrice(row.spent, row.currency)}
                  </dd>
                </div>
              </div>
            ))}
        </dl>

        <div className="mt-3 flex items-center justify-center gap-1.5 border-t border-dashed border-line-strong pt-3">
          <AcornMark className="size-5 rounded-md [&_svg]:size-3.5" />
          <p className="text-xs font-medium text-fg-subtle">
            {t('common', 'appName')}
          </p>
        </div>
      </div>
    </Dialog>
  );
}

interface BoothSectionProps {
  booth: Booth;
  items: Item[];
  /** Event currency, used for items without their own. */
  currency: string;
  showPrices: boolean;
}

function BoothSection({
  booth,
  items,
  currency,
  showPrices,
}: BoothSectionProps) {
  const { getBadgeById } = useBadges();

  const sortedItems = [...items].sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    return a.createdAt - b.createdAt;
  });

  const checkedCount = items.filter((i) => i.checked).length;
  const totals = totalsByCurrency(items, currency).filter(
    (row) => row.total > 0
  );

  return (
    <section className="rounded-lg bg-surface-sunken p-3">
      <div className="mb-2 flex items-center gap-2">
        <BoothNumber size="sm">{booth.boothNumber}</BoothNumber>
        <h4 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {booth.circleName}
        </h4>
        {items.length > 0 && (
          <span className="text-xs text-fg-muted tabular-nums">
            {checkedCount}/{items.length}
          </span>
        )}
      </div>

      {sortedItems.length > 0 ? (
        <ul className="space-y-1">
          {sortedItems.map((item) => {
            const badge = getBadgeById(item.badgeId);
            return (
              <li
                key={item.id}
                className={cn(
                  'flex items-center gap-2 text-sm',
                  item.checked ? 'text-fg-subtle' : 'text-fg'
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded border',
                    item.checked
                      ? 'border-primary-strong bg-primary-strong text-on-primary'
                      : 'border-line-strong bg-surface-raised'
                  )}
                >
                  {item.checked && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 break-words',
                    item.checked && 'line-through'
                  )}
                >
                  {item.name}
                  {item.quantity > 1 && (
                    <span className="text-fg-muted tabular-nums">
                      {' '}
                      ×{item.quantity}
                    </span>
                  )}
                </span>
                {badge && <Badge color={badge.color}>{getBadgeLabel(badge)}</Badge>}
                {showPrices && item.price !== null && (
                  <span className="shrink-0 text-xs text-fg-muted tabular-nums">
                    {formatPrice(
                      item.price,
                      resolveItemCurrency(item, currency)
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-fg-subtle italic">{t('items', 'noItems')}</p>
      )}

      {showPrices && totals.length > 0 && (
        <div className="mt-2 space-y-0.5 border-t border-dashed border-line-strong pt-2 text-right text-xs text-fg-muted tabular-nums">
          {totals.map((row) => (
            <div key={row.currency}>
              {row.spent > 0 && (
                <span className="mr-2 text-success">
                  {tp('export', 'spentAmount', {
                    amount: formatPrice(row.spent, row.currency),
                  })}
                </span>
              )}
              <span>/ {formatPrice(row.total, row.currency)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
