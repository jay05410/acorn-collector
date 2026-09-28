import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { ImageGrid } from '@/components/capture/ImageGrid';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { showToast } from '@/components/ui/toast-store';
import { DEFAULT_BADGE_ID } from '@/constants/presetBadges';
import { useExtraction } from '@/hooks/useExtraction';
import { t, tn, useLanguage } from '@/i18n';
import { isAIConfigured } from '@/lib/ai/runtime';
import type { AppSettings } from '@/lib/settings-types';
import type { Booth } from '@/types';
import { AnalysisStatus } from './AnalysisStatus';
import { ItemsReview } from './ItemsReview';
import { includedRows, reviewReducer } from './items-review-state';
import { addReviewedItems } from './save-items';

interface AnalysisSheetProps {
  open: boolean;
  onClose: () => void;
  booth: Pick<Booth, 'id' | 'imageUrls' | 'sourceText'>;
  /** Resolved currency of the booth's event. */
  eventCurrency: string;
  settings: AppSettings | null;
  onOpenSettings?: () => void;
}

/**
 * Re-analyzes a saved booth's images and post text, then adds the chosen
 * items. Identical inputs are answered from the local cache.
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
  const extraction = useExtraction({ settings });
  const { state } = extraction;
  const configured = settings ? isAIConfigured(settings.ai) : false;
  const selectedImages = images.filter((_, index) => included[index]);
  const canStart = text.trim() !== '' || selectedImages.length > 0;
  const analyzedUrls = useRef<string[]>([]);

  const start = (tier?: 'fast' | 'accurate') => {
    analyzedUrls.current = selectedImages;
    extraction.start(
      { text, images: selectedImages, hints: { defaultCurrency: eventCurrency } },
      tier ? { tier } : undefined
    );
  };

  // The user asked for this analysis: start as soon as settings are known.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !settings) return;
    started.current = true;
    if (isAIConfigured(settings.ai) && canStart) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening
  }, [settings]);

  const syncedRun = useRef(0);
  useEffect(() => {
    if (state.runId === 0 || state.status === 'idle') return;
    if (syncedRun.current !== state.runId) {
      syncedRun.current = state.runId;
      dispatchRows({ type: 'reset' });
    }
    dispatchRows({
      type: 'sync',
      rows: state.rows.map((row) => ({ key: row.key, item: row.item, currency: row.currency })),
    });
  }, [state.runId, state.status, state.rows]);

  const skipped = useMemo(() => {
    const set = new Set<number>();
    if (state.status !== 'done') return set;
    for (const index of state.outcome?.meta.skippedImages ?? []) {
      const at = images.indexOf(analyzedUrls.current[index] ?? '');
      if (at >= 0) set.add(at);
    }
    return set;
  }, [state.status, state.outcome, images]);

  const running = state.status === 'preparing' || state.status === 'streaming';
  const count = includedRows(rows).length;

  const handleAdd = async () => {
    setAdding(true);
    try {
      const added = await addReviewedItems({ boothId: booth.id, rows, eventCurrency, badgeId });
      extraction.cancel();
      showToast({ message: tn('analysis', 'added', added), tone: 'success' });
      onClose();
    } catch (error) {
      console.error('[analysis] could not add items', error);
      showToast({ message: t('analysis', 'addFailed'), tone: 'error' });
      setAdding(false);
    }
  };

  const openSettings = () => {
    onClose();
    onOpenSettings?.();
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
        configured={configured}
        canStart={canStart}
        itemCount={rows.length}
        onStart={() => start()}
        onCancel={extraction.cancel}
        onRetry={(tier) => start(tier)}
        onOpenSettings={openSettings}
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
