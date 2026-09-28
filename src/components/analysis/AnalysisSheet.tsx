import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { ImageGrid } from '@/components/capture/ImageGrid';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { showToast } from '@/components/ui/toast-store';
import { DEFAULT_BADGE_ID } from '@/constants/presetBadges';
import { useEvents } from '@/hooks/useEvents';
import { useItems } from '@/hooks/useItems';
import type { ExtractionInput } from '@/hooks/useExtraction';
import { useReviewRun } from '@/hooks/useReviewRun';
import { t, tn, useLanguage } from '@/i18n';
import { isAIConfigured } from '@/lib/ai/runtime';
import type { ModelTier } from '@/lib/ai/types';
import type { AppSettings } from '@/lib/settings-types';
import type { Booth } from '@/types';
import { AnalysisStatus } from './AnalysisStatus';
import { ItemsReview } from './ItemsReview';
import { includedRows, knownItemKey, reviewReducer } from './items-review-state';
import { addReviewedItems } from './save-items';

interface AnalysisSheetProps {
  open: boolean;
  onClose: () => void;
  booth: Pick<Booth, 'id' | 'imageUrls' | 'sourceText'>;
  /** Resolved currency of the booth's event. */
  eventCurrency: string;
  settings: AppSettings | null;
  /** Opens Settings on top of the sheet, which stays open underneath. */
  onOpenSettings?: () => void;
}

/**
 * Re-analyzes a saved booth's images and post text, then adds the chosen
 * items. Calls whose input is unchanged are answered from the local cache.
 */
export function AnalysisSheet(props: AnalysisSheetProps) {
  if (!props.open) return null;
  return <AnalysisSheetContent {...props} />;
}

function AnalysisSheetContent({
  onClose,
  booth,
  eventCurrency,
  settings,
  onOpenSettings,
}: AnalysisSheetProps) {
  useLanguage();
  const images = useMemo(() => booth.imageUrls ?? [], [booth.imageUrls]);
  const text = booth.sourceText ?? '';
  const [included, setIncluded] = useState(() => images.map(() => true));
  const [rows, dispatchRows] = useReducer(reviewReducer, []);
  const [badgeId, setBadgeId] = useState<string>(DEFAULT_BADGE_ID);
  const [adding, setAdding] = useState(false);
  const { events, isLoading: eventsLoading } = useEvents();
  const { items: existingItems, isLoading: itemsLoading } = useItems(booth.id);
  // Items the booth already has start unchecked, so re-analysis adds no duplicates.
  const known = useMemo(
    () =>
      new Set(
        existingItems.flatMap((item) => [
          knownItemKey(item.name, item.price),
          ...(item.originalName ? [knownItemKey(item.originalName, item.price)] : []),
        ])
      ),
    [existingItems]
  );
  const run = useReviewRun({ settings, dispatchRows, known });
  const { state } = run;
  const selectedImages = images.filter((_, index) => included[index]);
  const canStart = text.trim() !== '' || selectedImages.length > 0;

  // Same hints as the capture review. The hints only reach the call that
  // carries the post text, so image-only calls of an analyzed booth are
  // answered from the cache even after the event list changed.
  const input = (): ExtractionInput => ({
    text,
    images: selectedImages,
    hints: { eventNames: events.map((event) => event.name), defaultCurrency: eventCurrency },
  });

  // The user asked for this analysis: start once settings are known and an
  // AI is connected (also when it gets connected from this sheet).
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !settings || eventsLoading || itemsLoading) return;
    if (!isAIConfigured(settings.ai)) return;
    started.current = true;
    if (canStart && state.status === 'idle') run.start(input());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening
  }, [settings, eventsLoading, itemsLoading]);

  const skipped = useMemo(() => {
    const set = new Set<number>();
    images.forEach((url, index) => {
      if (run.skippedUrls.has(url)) set.add(index);
    });
    return set;
  }, [run.skippedUrls, images]);

  const { running } = run;
  const count = includedRows(rows).length;

  const handleAdd = async () => {
    setAdding(true);
    try {
      const added = await addReviewedItems({ boothId: booth.id, rows, eventCurrency, badgeId });
      run.cancel();
      showToast({ message: tn('analysis', 'added', added), tone: 'success' });
      onClose();
    } catch (error) {
      console.error('[analysis] could not add items', error);
      showToast({ message: t('analysis', 'addFailed'), tone: 'error' });
      setAdding(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('analysis', 'title')}
      bodyClassName="space-y-3 pt-1"
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t('common', 'cancel')}
          </Button>
          <Button
            className="flex-[2]"
            disabled={count === 0}
            loading={adding}
            onClick={() => void handleAdd()}
          >
            <Plus />
            {count > 0 ? tn('analysis', 'addCount', count) : t('common', 'add')}
          </Button>
        </>
      }
    >
      {images.length > 0 && (
        <ImageGrid
          images={images.map((url) => ({ url }))}
          included={included}
          onToggle={(index) =>
            setIncluded((current) => current.map((value, i) => (i === index ? !value : value)))
          }
          skipped={skipped}
        />
      )}
      {text.trim() !== '' && (
        <p className="px-1 text-xs text-fg-subtle">{t('analysis', 'usesPostText')}</p>
      )}
      <AnalysisStatus
        state={state}
        configured={run.configured}
        canStart={canStart}
        itemCount={rows.length}
        onStart={() => run.start(input())}
        onCancel={run.cancel}
        onRetry={(tier?: ModelTier) => run.retry(input(), tier)}
        onRunAgain={(tier?: ModelTier) => run.runAgain(input(), tier)}
        onOpenSettings={() => onOpenSettings?.()}
      />
      {(rows.length > 0 || running) && (
        <ItemsReview
          rows={rows}
          dispatch={dispatchRows}
          fallbackCurrency={eventCurrency}
          badgeId={badgeId}
          onBadgeChange={setBadgeId}
          loading={running}
        />
      )}
    </Dialog>
  );
}
