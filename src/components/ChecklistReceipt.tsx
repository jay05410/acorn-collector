import { useMemo, useState } from 'react';
import { X, Download, Share2, Receipt, Check } from 'lucide-react';
import { useEvent } from '@/hooks/useEvents';
import { useBooths } from '@/hooks/useBooths';
import { useItemsForBooths } from '@/hooks/useItems';
import { useBadges } from '@/hooks/useBadges';
import { Button } from '@/components/ui/Button';
import { exportChecklistAsImage } from '@/lib/export';
import { resolveItemCurrency, totalsByCurrency } from '@/lib/utils';
import {
  formatDate,
  formatPrice,
  getBadgeLabel,
  getLanguageInfo,
  normalizeCurrencyCode,
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

function groupByBooth(items: readonly Item[]): Map<string, Item[]> {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const group = groups.get(item.boothId);
    if (group) group.push(item);
    else groups.set(item.boothId, [item]);
  }
  return groups;
}

export function ChecklistReceipt({ eventId, onClose }: ChecklistReceiptProps) {
  useLanguage();
  const event = useEvent(eventId);
  const { booths } = useBooths(eventId);
  const boothIds = useMemo(() => booths.map((b) => b.id), [booths]);
  const items = useItemsForBooths(boothIds);
  const itemsByBooth = useMemo(() => groupByBooth(items), [items]);
  const [isExporting, setIsExporting] = useState(false);
  const [mode, setMode] = useState<ExportMode>('checklist');

  const eventName = event?.name ?? '';
  const eventCurrency =
    normalizeCurrencyCode(event?.currency) ?? getLanguageInfo().defaultCurrency;
  const totals = useMemo(
    () => totalsByCurrency(items, eventCurrency).filter((row) => row.total > 0),
    [items, eventCurrency]
  );

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportChecklistAsImage('checklist-receipt');
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    try {
      const element = document.getElementById('checklist-receipt');
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
        handleExport();
      }
    } catch (error) {
      console.error('Share failed:', error);
      handleExport();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-sm max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('export', 'title')}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t('common', 'close')}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('checklist')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                mode === 'checklist'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Check className="w-4 h-4" />
              {t('export', 'boothList')}
            </button>
            <button
              onClick={() => setMode('receipt')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                mode === 'receipt'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Receipt className="w-4 h-4" />
              {t('export', 'eventInfo')}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div
            id="checklist-receipt"
            className="bg-white p-4 rounded-lg shadow-sm border-2 border-dashed border-gray-200"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            <div className="text-center mb-3">
              <h1 className="text-lg font-bold text-gray-800">
                {eventName || t('export', 'title')}
              </h1>
              {event?.date && (
                <p className="text-sm text-gray-500">
                  {formatDate(event.date)}
                </p>
              )}
              {event?.location && (
                <p className="text-sm text-gray-500">{event.location}</p>
              )}
            </div>

            <div className="border-t border-dashed border-gray-300 my-3" />

            {booths.length === 0 ? (
              <p className="text-center text-gray-400 py-4">
                {t('booths', 'noBooths')}
              </p>
            ) : (
              <div className="space-y-3">
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

            <div className="border-t border-dashed border-gray-300 my-3" />

            <div className="text-sm text-gray-600">
              <div className="flex justify-between mb-1">
                <span>{t('booths', 'title')}</span>
                <span className="font-medium">{booths.length}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span>{t('items', 'title')}</span>
                <span className="font-medium">{items.length}</span>
              </div>
              {mode === 'receipt' && totals.length > 0 && (
                <>
                  <div className="border-t border-dashed border-gray-200 my-2" />
                  {totals.map((row) => (
                    <div key={row.currency} className="mb-1">
                      <div className="flex justify-between">
                        <span>{t('export', 'total')}</span>
                        <span className="font-medium">
                          {formatPrice(row.total, row.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-green-600 font-semibold">
                        <span>{t('export', 'purchased')}</span>
                        <span>{formatPrice(row.spent, row.currency)}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="text-center mt-3 pt-2 border-t border-dashed border-gray-300">
              <p className="text-xs text-gray-400">{t('common', 'appName')}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t dark:border-gray-700">
          <Button variant="outline" onClick={handleShare} className="flex-1">
            <Share2 className="w-4 h-4 mr-2" />
            {t('export', 'share')}
          </Button>
          <Button
            onClick={handleExport}
            className="flex-1"
            disabled={isExporting}
          >
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? t('common', 'loading') : t('common', 'save')}
          </Button>
        </div>
      </div>
    </div>
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
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-xs font-bold text-accent bg-primary-light px-1.5 py-0.5 rounded">
          {booth.boothNumber}
        </span>
        <span className="font-medium text-gray-800 text-sm truncate flex-1">
          {booth.circleName}
        </span>
        {items.length > 0 && (
          <span className="text-xs text-gray-500">
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
                className={`flex items-center gap-2 text-sm ${
                  item.checked ? 'text-gray-400' : 'text-gray-700'
                }`}
              >
                <span className="w-4 h-4 flex items-center justify-center border border-gray-300 rounded text-xs">
                  {item.checked ? '✓' : ''}
                </span>
                <span
                  className={`flex-1 ${item.checked ? 'line-through' : ''}`}
                >
                  {item.name}
                  {item.quantity > 1 && (
                    <span className="text-gray-500"> ×{item.quantity}</span>
                  )}
                </span>
                {showPrices && item.price !== null && (
                  <span className="text-xs text-gray-500">
                    {formatPrice(
                      item.price,
                      resolveItemCurrency(item, currency)
                    )}
                  </span>
                )}
                {badge && (
                  <span
                    className="text-xs px-1 rounded"
                    style={{
                      backgroundColor: badge.color
                        ? `${badge.color}20`
                        : '#e5e7eb',
                      color: badge.color ?? '#374151',
                    }}
                  >
                    {getBadgeLabel(badge)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-gray-400 italic">{t('items', 'noItems')}</p>
      )}

      {showPrices && totals.length > 0 && (
        <div className="mt-2 pt-2 border-t border-dashed border-gray-200 text-xs text-gray-500 text-right space-y-0.5">
          {totals.map((row) => (
            <div key={row.currency}>
              {row.spent > 0 && (
                <span className="text-green-600 mr-2">
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
    </div>
  );
}
