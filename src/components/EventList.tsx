import { useId, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  Calendar,
  CalendarDays,
  Check,
  ChevronRight,
  ImageDown,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { useBooths } from '@/hooks/useBooths';
import { useItemsForBooths } from '@/hooks/useItems';
import { useBadges } from '@/hooks/useBadges';
import { Badge } from '@/components/ui/Badge';
import { BoothNumber } from '@/components/ui/BoothNumber';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { CurrencySelect } from '@/components/ui/CurrencySelect';
import { DatePicker } from '@/components/ui/DatePicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { PlaceAutocomplete } from '@/components/ui/PlaceAutocomplete';
import { Progress } from '@/components/ui/Progress';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  groupItemsByBooth,
  summarizeChecklist,
} from '@/components/checklist-progress';
import {
  formatDate,
  getBadgeLabel,
  getLanguageInfo,
  t,
  tn,
  useLanguage,
} from '@/i18n';
import {
  cn,
  resolveEventCurrency,
  shouldPersistEventCurrency,
} from '@/lib/utils';
import type { Booth, Event, Item } from '@/types';

interface EventListProps {
  onSelectBooth: (boothId: string, eventId: string) => void;
  onExportEvent: (eventId: string) => void;
  onAddBooth: (eventId: string) => void;
}

interface EventDraft {
  name: string;
  date: string;
  location: string;
  currency: string;
}

function toEventFields(draft: EventDraft) {
  return {
    name: draft.name.trim(),
    date: draft.date || null,
    location: draft.location.trim() || null,
    currency: draft.currency,
  };
}

export function EventList({
  onSelectBooth,
  onExportEvent,
  onAddBooth,
}: EventListProps) {
  useLanguage();
  const { events, isLoading, createEvent, updateEvent, deleteEvent } =
    useEvents();
  const [isAdding, setIsAdding] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<Event | null>(null);
  const addHeadingId = useId();

  const handleAddEvent = async (draft: EventDraft) => {
    await createEvent({ ...toEventFields(draft), mapImageUrl: null });
    setIsAdding(false);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    await deleteEvent(pendingDelete.id);
    setPendingDelete(null);
  };

  const toggleExpand = (eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div aria-busy="true" className="space-y-2 p-3">
        <span className="sr-only">{t('common', 'loading')}</span>
        {[0, 1].map((key) => (
          <Card key={key} className="space-y-2.5 p-4 pl-11">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-6 w-20" />
          </Card>
        ))}
      </div>
    );
  }

  const addForm = isAdding && (
    <Card
      as="section"
      aria-labelledby={addHeadingId}
      className="mx-3 mb-3 animate-reveal p-4"
    >
      <h2 id={addHeadingId} className="mb-3 text-sm font-semibold text-fg">
        {t('events', 'addEvent')}
      </h2>
      <EventForm
        initial={{
          name: '',
          date: '',
          location: '',
          currency: getLanguageInfo().defaultCurrency,
        }}
        submitLabel={t('common', 'add')}
        onSubmit={handleAddEvent}
        onCancel={() => setIsAdding(false)}
      />
    </Card>
  );

  return (
    <div className="flex flex-col pb-4">
      {events.length === 0 && !isAdding ? (
        <EmptyState
          icon={<CalendarDays />}
          title={t('events', 'noEvents')}
          description={t('events', 'noEventsDesc')}
          className="py-16"
          action={
            <Button onClick={() => setIsAdding(true)}>
              <Plus />
              {t('events', 'addEvent')}
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex min-h-14 items-center justify-between gap-2 px-4 pt-2">
            <h2 className="text-sm font-semibold text-fg-muted">
              {t('events', 'title')}
              <span className="ms-1.5 text-fg-subtle tabular-nums">
                {events.length}
              </span>
            </h2>
            {!isAdding && (
              <Button size="sm" variant="soft" onClick={() => setIsAdding(true)}>
                <Plus />
                {t('events', 'addEvent')}
              </Button>
            )}
          </div>
          {addForm}
          <ul className="space-y-2 px-3">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                isExpanded={expandedEvents.has(event.id)}
                onToggleExpand={() => toggleExpand(event.id)}
                onSelectBooth={(boothId) => onSelectBooth(boothId, event.id)}
                onAddBooth={() => onAddBooth(event.id)}
                onUpdate={(data) => updateEvent(event.id, data)}
                onDelete={() => setPendingDelete(event)}
                onExportImage={() => onExportEvent(event.id)}
              />
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.name}
        description={t('events', 'deleteConfirm')}
        confirmLabel={t('common', 'delete')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

interface EventFormProps {
  initial: EventDraft;
  submitLabel: string;
  onSubmit: (draft: EventDraft) => Promise<void>;
  onCancel: () => void;
}

function EventForm({ initial, submitLabel, onSubmit, onCancel }: EventFormProps) {
  const [draft, setDraft] = useState(initial);
  const canSubmit = draft.name.trim().length > 0;
  const update = (patch: Partial<EventDraft>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit) void onSubmit(draft);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field label={t('events', 'eventName')} required>
        <Input
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder={t('events', 'eventNamePlaceholder')}
          autoFocus
        />
      </Field>
      <div className="flex gap-2">
        <Field label={t('events', 'eventDate')} className="flex-1">
          <DatePicker
            value={draft.date}
            onChange={(date) => update({ date })}
          />
        </Field>
        <Field label={t('currency', 'label')} className="w-28 shrink-0">
          <CurrencySelect
            value={draft.currency}
            onChange={(currency) => update({ currency })}
          />
        </Field>
      </div>
      <Field label={t('events', 'eventLocation')}>
        <PlaceAutocomplete
          value={draft.location}
          onChange={(location) => update({ location })}
          placeholder={t('events', 'eventLocationPlaceholder')}
        />
      </Field>
      <div className="flex gap-2 pt-1">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          {t('common', 'cancel')}
        </Button>
        <Button type="submit" className="flex-1" disabled={!canSubmit}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

interface EventCardProps {
  event: Event;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelectBooth: (boothId: string) => void;
  onAddBooth: () => void;
  onUpdate: (data: Partial<Event>) => Promise<void>;
  onDelete: () => void;
  onExportImage: () => void;
}

function EventCard({
  event,
  isExpanded,
  onToggleExpand,
  onSelectBooth,
  onAddBooth,
  onUpdate,
  onDelete,
  onExportImage,
}: EventCardProps) {
  const { booths } = useBooths(event.id);
  const boothIds = useMemo(() => booths.map((booth) => booth.id), [booths]);
  const items = useItemsForBooths(boothIds);
  const progress = useMemo(() => summarizeChecklist(items), [items]);
  const [isEditing, setIsEditing] = useState(false);
  // What the picker showed when editing began. For an event without a
  // currency this is only a display fallback and must not be saved as is.
  const [seededCurrency, setSeededCurrency] = useState('');
  const panelId = useId();

  const startEditing = () => {
    setSeededCurrency(resolveEventCurrency(event.currency));
    setIsEditing(true);
  };

  const handleSave = async (draft: EventDraft) => {
    const { currency, ...fields } = toEventFields(draft);
    const update: Partial<Event> = fields;
    if (shouldPersistEventCurrency(event.currency, seededCurrency, currency)) {
      update.currency = currency;
    }
    await onUpdate(update);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <li id={`event-${event.id}`}>
        <Card className="animate-reveal p-4">
          <EventForm
            initial={{
              name: event.name,
              date: event.date ?? '',
              location: event.location ?? '',
              currency: seededCurrency,
            }}
            submitLabel={t('common', 'save')}
            onSubmit={handleSave}
            onCancel={() => setIsEditing(false)}
          />
        </Card>
      </li>
    );
  }

  return (
    <li id={`event-${event.id}`}>
      <Card
        as="article"
        className="group relative transition-shadow duration-150 ease-out hover:shadow-sm"
      >
        <h3>
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={isExpanded ? panelId : undefined}
            onClick={onToggleExpand}
            className="flex w-full cursor-pointer items-start gap-2 p-3 pb-1.5 text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
          >
            <ChevronRight
              aria-hidden="true"
              className={cn(
                'mt-px size-5 shrink-0 text-fg-subtle transition-transform duration-200 ease-out',
                isExpanded && 'rotate-90'
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-[15px] leading-snug font-semibold break-words text-fg">
                {event.name}
              </span>
              {(event.date || event.location) && (
                <span className="mt-1 flex min-w-0 items-center gap-x-3 text-xs text-fg-muted">
                  {event.date && (
                    <span className="inline-flex shrink-0 items-center gap-1">
                      <Calendar
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-fg-subtle"
                      />
                      <span className="whitespace-nowrap tabular-nums">
                        {formatDate(event.date)}
                      </span>
                    </span>
                  )}
                  {event.location && (
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <MapPin
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-fg-subtle"
                      />
                      <span className="truncate">{event.location}</span>
                    </span>
                  )}
                </span>
              )}
            </span>
          </button>
        </h3>
        <div className="flex min-h-10 items-center gap-2.5 pr-2 pb-2 pl-10">
          <Badge tone="primary" size="md">
            {tn('events', 'boothCount', booths.length)}
          </Badge>
          <Progress value={progress.checked} max={progress.total} />
          <div className="relative z-10 ml-auto flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 touch:opacity-100">
            <IconButton
              size="sm"
              label={t('common', 'edit')}
              onClick={startEditing}
            >
              <Pencil />
            </IconButton>
            <IconButton
              size="sm"
              label={t('export', 'saveImage')}
              onClick={onExportImage}
            >
              <ImageDown />
            </IconButton>
            <IconButton
              size="sm"
              variant="danger"
              label={t('common', 'delete')}
              onClick={onDelete}
            >
              <Trash2 />
            </IconButton>
          </div>
        </div>
        {isExpanded && (
          <div
            id={panelId}
            className="relative z-10 animate-reveal border-t border-line p-2"
          >
            <BoothPreviewList
              booths={booths}
              items={items}
              onSelectBooth={onSelectBooth}
              onAddBooth={onAddBooth}
            />
          </div>
        )}
      </Card>
    </li>
  );
}

type BoothSort = 'order' | 'boothNumber';

interface BoothPreviewListProps {
  booths: Booth[];
  items: Item[];
  onSelectBooth: (boothId: string) => void;
  onAddBooth: () => void;
}

function BoothPreviewList({
  booths,
  items,
  onSelectBooth,
  onAddBooth,
}: BoothPreviewListProps) {
  const [sortBy, setSortBy] = useState<BoothSort>('order');
  const itemsByBooth = useMemo(() => groupItemsByBooth(items), [items]);

  const sortedBooths = [...booths].sort((a, b) => {
    if (sortBy === 'boothNumber') {
      return a.boothNumber.localeCompare(b.boothNumber, undefined, {
        numeric: true,
      });
    }
    return a.order - b.order;
  });

  return (
    <div>
      {booths.length > 0 && (
        <div className="flex justify-end px-1 pt-0.5 pb-2">
          <SegmentedControl
            size="sm"
            aria-label={t('ui', 'sortBy')}
            value={sortBy}
            onChange={setSortBy}
            options={[
              {
                value: 'order',
                label: t('booths', 'sortByOrder'),
                icon: <ArrowDownWideNarrow aria-hidden="true" />,
              },
              {
                value: 'boothNumber',
                label: t('booths', 'sortByNumber'),
                icon: <ArrowDownAZ aria-hidden="true" />,
              },
            ]}
          />
        </div>
      )}
      {booths.length === 0 ? (
        <p className="px-2 py-3 text-sm text-fg-muted">
          {t('booths', 'noBooths')}
        </p>
      ) : (
        <ul className="space-y-0.5">
          {sortedBooths.map((booth) => (
            <BoothPreviewRow
              key={booth.id}
              booth={booth}
              items={itemsByBooth.get(booth.id) ?? []}
              onClick={() => onSelectBooth(booth.id)}
            />
          ))}
        </ul>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={onAddBooth}
        className="mt-1 w-full justify-start text-primary-strong hover:text-primary-strong"
      >
        <Plus />
        {t('booths', 'addBooth')}
      </Button>
    </div>
  );
}

function BoothPreviewRow({
  booth,
  items,
  onClick,
}: {
  booth: Booth;
  items: Item[];
  onClick: () => void;
}) {
  const { getBadgeById } = useBadges();
  const progress = summarizeChecklist(items);
  const isComplete = progress.total > 0 && progress.checked === progress.total;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150 hover:bg-hover active:bg-pressed focus-visible:outline-offset-0"
      >
        <BoothNumber>{booth.boothNumber}</BoothNumber>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">
            {booth.circleName}
          </span>
          {progress.total > 0 && (
            <span className="mt-1 flex flex-wrap gap-1">
              {isComplete ? (
                <Badge tone="success" icon={<Check aria-hidden="true" />}>
                  {t('common', 'complete')}
                </Badge>
              ) : (
                progress.byBadge.map((stat) => {
                  const badge = getBadgeById(stat.badgeId);
                  if (!badge) return null;
                  const done = stat.checked === stat.total;
                  return (
                    <Badge
                      key={stat.badgeId}
                      color={badge.color}
                      icon={done ? <Check aria-hidden="true" /> : undefined}
                    >
                      {getBadgeLabel(badge)}{' '}
                      <span className="tabular-nums">
                        {stat.checked}/{stat.total}
                      </span>
                    </Badge>
                  );
                })
              )}
            </span>
          )}
        </span>
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-fg-subtle"
        />
      </button>
    </li>
  );
}
