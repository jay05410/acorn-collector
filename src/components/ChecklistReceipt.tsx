import { useState, useEffect, useMemo } from 'react';
import { X, Download, Share2, Receipt, Check } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { useBooths } from '@/hooks/useBooths';
import { useItems } from '@/hooks/useItems';
import { useBadges } from '@/hooks/useBadges';
import { Button } from '@/components/ui/Button';
import { exportChecklistAsImage } from '@/lib/export';
import { formatPrice } from '@/lib/utils';
import type { Booth, Item } from '@/types';

type ExportMode = 'receipt' | 'checklist';

interface ChecklistReceiptProps {
  eventId: string;
  onClose: () => void;
}

export function ChecklistReceipt({ eventId, onClose }: ChecklistReceiptProps) {
  const { getEvent } = useEvents();
  const { booths } = useBooths(eventId);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState<string | null>(null);
  const [eventLocation, setEventLocation] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [allItems, setAllItems] = useState<Record<string, Item[]>>({});
  const [mode, setMode] = useState<ExportMode>('checklist');

  useEffect(() => {
    getEvent(eventId).then((event) => {
      if (event) {
        setEventName(event.name);
        setEventDate(event.date);
        setEventLocation(event.location);
      }
    });
  }, [eventId, getEvent]);

  const handleItemsLoaded = (boothId: string, items: Item[]) => {
    setAllItems((prev) => ({ ...prev, [boothId]: items }));
  };

  const totals = useMemo(() => {
    const items = Object.values(allItems).flat();
    const totalEstimated = items.reduce((sum, i) => sum + (i.price ?? 0), 0);
    const totalSpent = items
      .filter((i) => i.checked)
      .reduce((sum, i) => sum + (i.price ?? 0), 0);
    const totalItems = items.length;
    const checkedItems = items.filter((i) => i.checked).length;
    return { totalEstimated, totalSpent, totalItems, checkedItems };
  }, [allItems]);

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
          title: `${eventName} 체크리스트`,
        });
      } else {
        handleExport();
      }
    } catch (error) {
      console.error('Share failed:', error);
      handleExport();
    }
  };

  const totalBooths = booths.length;

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
            체크리스트 내보내기
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
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
              체크리스트
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
              영수증
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            {mode === 'checklist' ? '방문할 부스 목록용' : '금액 정산 포함'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div
            id="checklist-receipt"
            className="bg-white p-4 rounded-lg shadow-sm border-2 border-dashed border-gray-200"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            <div className="text-center mb-3">
              <div className="text-2xl mb-1">🌰</div>
              <h1 className="text-lg font-bold text-gray-800">
                {eventName || '체크리스트'}
              </h1>
              {eventDate && (
                <p className="text-sm text-gray-500">{eventDate}</p>
              )}
              {eventLocation && (
                <p className="text-sm text-gray-500">{eventLocation}</p>
              )}
            </div>

            <div className="border-t border-dashed border-gray-300 my-3" />

            {booths.length === 0 ? (
              <p className="text-center text-gray-400 py-4">
                등록된 부스가 없습니다
              </p>
            ) : (
              <div className="space-y-3">
                {booths.map((booth) => (
                  <BoothSection
                    key={booth.id}
                    booth={booth}
                    onItemsLoaded={handleItemsLoaded}
                    showPrices={mode === 'receipt'}
                  />
                ))}
              </div>
            )}

            <div className="border-t border-dashed border-gray-300 my-3" />

            <div className="text-sm text-gray-600">
              <div className="flex justify-between mb-1">
                <span>총 부스</span>
                <span className="font-medium">{totalBooths}개</span>
              </div>
              <div className="flex justify-between mb-1">
                <span>총 상품</span>
                <span className="font-medium">
                  {totals.checkedItems}/{totals.totalItems}개 완료
                </span>
              </div>
              {mode === 'receipt' && totals.totalEstimated > 0 && (
                <>
                  <div className="border-t border-dashed border-gray-200 my-2" />
                  <div className="flex justify-between mb-1">
                    <span>예상 지출</span>
                    <span className="font-medium">
                      {formatPrice(totals.totalEstimated)}
                    </span>
                  </div>
                  <div className="flex justify-between text-green-600 font-semibold">
                    <span>구매 완료</span>
                    <span>{formatPrice(totals.totalSpent)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="text-center mt-3 pt-2 border-t border-dashed border-gray-300">
              <p className="text-xs text-gray-400">도토리 주머니 🌰</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t dark:border-gray-700">
          <Button variant="outline" onClick={handleShare} className="flex-1">
            <Share2 className="w-4 h-4 mr-2" />
            공유
          </Button>
          <Button
            onClick={handleExport}
            className="flex-1"
            disabled={isExporting}
          >
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? '저장 중...' : '이미지 저장'}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface BoothSectionProps {
  booth: Booth;
  onItemsLoaded: (boothId: string, items: Item[]) => void;
  showPrices: boolean;
}

function BoothSection({ booth, onItemsLoaded, showPrices }: BoothSectionProps) {
  const { items } = useItems(booth.id);
  const { getBadgeById } = useBadges();

  useEffect(() => {
    onItemsLoaded(booth.id, items);
  }, [booth.id, items, onItemsLoaded]);

  const sortedItems = [...items].sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    return a.createdAt - b.createdAt;
  });

  const checkedCount = items.filter((i) => i.checked).length;
  const boothTotal = items.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const boothSpent = items
    .filter((i) => i.checked)
    .reduce((sum, i) => sum + (i.price ?? 0), 0);

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
                    {formatPrice(item.price)}
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
                    {badge.label}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-gray-400 italic">아이템 없음</p>
      )}

      {showPrices && boothTotal > 0 && (
        <div className="mt-2 pt-2 border-t border-dashed border-gray-200 text-xs text-gray-500 text-right">
          {boothSpent > 0 && (
            <span className="text-green-600 mr-2">
              {formatPrice(boothSpent)} 완료
            </span>
          )}
          <span>/ {formatPrice(boothTotal)}</span>
        </div>
      )}
    </div>
  );
}
