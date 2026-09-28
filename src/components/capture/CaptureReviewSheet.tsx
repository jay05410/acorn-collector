import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { AnalysisStatus } from '@/components/analysis/AnalysisStatus';
import { ItemsReview } from '@/components/analysis/ItemsReview';
import {
  includedRows,
  prefilledRows,
  reviewReducer,
  type ReviewRow,
} from '@/components/analysis/items-review-state';
import { SponsorSlot } from '@/components/support/SponsorSlot';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { showToast } from '@/components/ui/toast-store';
import { DEFAULT_BADGE_ID } from '@/constants/presetBadges';
import { useEvents } from '@/hooks/useEvents';
import { useExtraction, type ExtractionInput } from '@/hooks/useExtraction';
import { getLanguageInfo, t, tn, useLanguage } from '@/i18n';
import { isAIConfigured } from '@/lib/ai/runtime';
import type { CaptureHandoff, PageSnapshot } from '@/lib/capture/types';
import type { AppSettings } from '@/lib/settings-types';
import type { Event } from '@/types';
import { BoothFields } from './BoothFields';
import {
  draftErrors,
  draftEventCurrency,
  draftReducer,
  initialDraft,
  snapshotText,
  type DraftError,
} from './capture-draft';
import { saveCapture, type SaveCaptureResult } from './save-capture';
import { SourceCard } from './SourceCard';

/** What the sheet reviews: a capture handoff, or a manual entry. */
export type ReviewSource =
  | { kind: 'capture'; handoff: CaptureHandoff }
  | { kind: 'manual'; id: number; eventId: string | null };

export interface SavedBooth extends SaveCaptureResult {
  circleName: string;
}

interface CaptureReviewSheetProps {
  /** null closes the sheet. */
  source: ReviewSource | null;
  settings: AppSettings | null;
  /** The first-run notice was accepted, so sponsor slots may show. */
  adsEnabled: boolean;
  /** Event to preselect when nothing better is known (e.g. last viewed). */
  fallbackEventId: string | null;
  /** Closed without saving (the capture is discarded). */
  onDismiss: () => void;
  onSaved: (booth: SavedBooth) => void;
  onOpenSettings: () => void;
}

function sourceKey(source: ReviewSource): string {
  return source.kind === 'capture' ? `capture-${source.handoff.id}` : `manual-${source.id}`;
}

/**
 * Review sheet for a new booth: instant heuristic prefill from the capture,
 * AI items streaming in, then one save for event, booth and items.
 */
export function CaptureReviewSheet(props: CaptureReviewSheetProps) {
  if (!props.source) return null;
  return <ReviewSheet key={sourceKey(props.source)} {...props} source={props.source} />;
}

function ReviewSheet(props: CaptureReviewSheetProps & { source: ReviewSource }) {
  useLanguage();
  const { events, isLoading } = useEvents();
  const title =
    props.source.kind === 'capture' ? t('capture', 'titleCapture') : t('booths', 'addBooth');

  if (isLoading) {
    return (
      <Dialog open onClose={props.onDismiss} title={title}>
        <div aria-busy="true" className="space-y-3 py-2">
          <span className="sr-only">{t('common', 'loading')}</span>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </Dialog>
    );
  }
  return <ReviewSheetContent {...props} events={events} title={title} />;
}

interface ContentProps extends CaptureReviewSheetProps {
  source: ReviewSource;
  events: Event[];
  title: string;
}

function defaultIncludedImages(handoff: CaptureHandoff | null): boolean[] {
  const images = handoff?.snapshot.images ?? [];
  // A right-clicked image leads the list; start with just that one.
  const onlyFocus = handoff?.trigger === 'image-context-menu' && handoff.focusImageUrl !== null;
  return images.map((_, index) => !onlyFocus || index === 0);
}

function ReviewSheetContent({
  source,
  events,
  title,
  settings,
  adsEnabled,
  fallbackEventId,
  onDismiss,
  onSaved,
  onOpenSettings,
}: ContentProps) {
  const handoff = source.kind === 'capture' ? source.handoff : null;
  const snapshot: PageSnapshot | null = handoff?.snapshot ?? null;
  const prefilled = snapshot?.prefilledItems ?? null;

  const [draftState, dispatchDraft] = useReducer(draftReducer, undefined, () =>
    initialDraft({
      snapshot,
      events,
      preselectedEventId: source.kind === 'manual' ? source.eventId : null,
      fallbackEventId,
      defaultCurrency: getLanguageInfo().defaultCurrency,
    })
  );
  const [rows, dispatchRows] = useReducer(reviewReducer, [], (): ReviewRow[] =>
    prefilled && prefilled.length > 0
      ? reviewReducer([], {
          type: 'sync',
          rows: prefilledRows(prefilled, snapshot?.prefilledCurrency ?? null),
        })
      : []
  );
  const [includedImages, setIncludedImages] = useState(() => defaultIncludedImages(handoff));
  const [badgeId, setBadgeId] = useState<string>(DEFAULT_BADGE_ID);
  const [showErrors, setShowErrors] = useState(false);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  // Captures open on the post itself rather than on its first link.
  const sourceRef = useRef<HTMLElement>(null);

  const extraction = useExtraction({ settings });
  const { state } = extraction;
  const configured = settings ? isAIConfigured(settings.ai) : false;
  const text = snapshotText(snapshot);
  const imageUrls = useMemo(
    () => (snapshot?.images ?? []).filter((_, i) => includedImages[i]).map((image) => image.url),
    [snapshot, includedImages]
  );
  const canAnalyze = snapshot !== null && (text.trim() !== '' || imageUrls.length > 0);
  const eventCurrency = draftEventCurrency(draftState.draft, events);

  // Image URLs of the run in flight, to map skipped images back to thumbnails.
  const analyzedUrls = useRef<string[]>([]);
  const startAnalysis = (tier?: 'fast' | 'accurate') => {
    const input: ExtractionInput = {
      text,
      images: imageUrls,
      hints: {
        eventNames: events.map((event) => event.name),
        defaultCurrency: eventCurrency,
      },
    };
    analyzedUrls.current = imageUrls;
    extraction.start(input, tier ? { tier } : undefined);
  };

  // Start automatically once settings are known, at most once per capture.
  const autoDecided = useRef(false);
  useEffect(() => {
    if (autoDecided.current || !settings) return;
    autoDecided.current = true;
    if (
      canAnalyze &&
      !(prefilled && prefilled.length > 0) &&
      isAIConfigured(settings.ai) &&
      settings.ai.autoAnalyze
    ) {
      startAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one decision per sheet
  }, [settings]);

  // Streamed rows into the review list; a new run replaces the old rows.
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

  // AI booth fields, once per finished run.
  const appliedRun = useRef(0);
  useEffect(() => {
    if (state.status !== 'done' || !state.outcome || appliedRun.current === state.runId) return;
    appliedRun.current = state.runId;
    dispatchDraft({ type: 'applyAI', outcome: state.outcome, events });
  }, [state.status, state.outcome, state.runId, events]);

  const skippedImages = useMemo(() => {
    const skipped = new Set<number>();
    if (state.status !== 'done' || !snapshot) return skipped;
    for (const index of state.outcome?.meta.skippedImages ?? []) {
      const url = analyzedUrls.current[index];
      const at = snapshot.images.findIndex((image) => image.url === url);
      if (at >= 0) skipped.add(at);
    }
    return skipped;
  }, [state.status, state.outcome, snapshot]);

  // After a blocked save, take the user to the first field to fix.
  useEffect(() => {
    if (saveAttempt === 0) return;
    document
      .querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"]')
      ?.focus();
  }, [saveAttempt]);

  const running = state.status === 'preparing' || state.status === 'streaming';
  const errors: DraftError[] = draftErrors(draftState.draft, events);
  const itemCount = includedRows(rows).length;
  const dirty =
    draftState.touched.length > 0 || rows.length > 0 || running;

  const requestClose = () => {
    if (saving) return;
    if (dirty) setConfirmingDiscard(true);
    else onDismiss();
  };

  const handleSave = async () => {
    if (errors.length > 0) {
      setShowErrors(true);
      setSaveAttempt((n) => n + 1);
      return;
    }
    setSaving(true);
    try {
      const result = await saveCapture({
        draft: draftState.draft,
        events,
        snapshot,
        imageUrls,
        mailOrderLabel: t('capture', 'mailOrderLabel'),
        rows,
        badgeId,
      });
      extraction.cancel();
      onSaved({ ...result, circleName: draftState.draft.circleName.trim() });
    } catch (error) {
      console.error('[capture] could not save the booth', error);
      showToast({ message: t('capture', 'saveFailed'), tone: 'error' });
      setSaving(false);
    }
  };

  const showItems = snapshot !== null && (rows.length > 0 || running || state.status === 'done');

  return (
    <>
      <Dialog
        open
        onClose={requestClose}
        title={title}
        initialFocusRef={snapshot ? sourceRef : undefined}
        bodyClassName="space-y-3 pt-1"
        footer={
          <>
            <Button variant="secondary" className="flex-1" onClick={requestClose}>
              {t('common', 'cancel')}
            </Button>
            <Button className="flex-[2]" loading={saving} onClick={() => void handleSave()}>
              <Check />
              {itemCount > 0 ? tn('capture', 'saveWithItems', itemCount) : t('common', 'save')}
            </Button>
          </>
        }
      >
        {snapshot && (
          <SourceCard
            ref={sourceRef}
            snapshot={snapshot}
            includedImages={includedImages}
            onToggleImage={(index) =>
              setIncludedImages((current) =>
                current.map((value, i) => (i === index ? !value : value))
              )
            }
            skippedImages={skippedImages}
          />
        )}

        {snapshot && prefilled && prefilled.length > 0 && state.status === 'idle' && (
          <Banner tone="success">{t('capture', 'prefilledNote')}</Banner>
        )}

        {snapshot && !(prefilled && prefilled.length > 0 && state.status === 'idle') && (
          <AnalysisStatus
            state={state}
            configured={configured}
            canStart={canAnalyze}
            itemCount={rows.length}
            onStart={() => startAnalysis()}
            onCancel={extraction.cancel}
            onRetry={(tier) => startAnalysis(tier)}
            onOpenSettings={onOpenSettings}
          />
        )}

        {adsEnabled && running && <SponsorSlot placement="analysis" />}

        {showItems && (
          <ItemsReview
            rows={rows}
            dispatch={dispatchRows}
            fallbackCurrency={eventCurrency}
            badgeId={badgeId}
            onBadgeChange={setBadgeId}
            loading={running}
          />
        )}

        <BoothFields
          state={draftState}
          dispatch={dispatchDraft}
          events={events}
          errors={showErrors ? errors : []}
        />

        {!snapshot && (
          <p className="px-1 text-xs text-fg-subtle">{t('capture', 'manualHint')}</p>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmingDiscard}
        title={t('capture', 'discardTitle')}
        description={t('capture', 'discardBody')}
        confirmLabel={t('capture', 'discard')}
        onConfirm={() => {
          setConfirmingDiscard(false);
          extraction.cancel();
          onDismiss();
        }}
        onCancel={() => setConfirmingDiscard(false)}
      />
    </>
  );
}
