import { useState } from 'react';
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Image,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { useBooths } from '@/hooks/useBooths';
import { useItems } from '@/hooks/useItems';
import { useBadges } from '@/hooks/useBadges';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CurrencySelect } from '@/components/ui/CurrencySelect';
import { DatePicker } from '@/components/ui/DatePicker';
import { PlaceAutocomplete } from '@/components/ui/PlaceAutocomplete';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  formatDate,
  getBadgeLabel,
  getLanguageInfo,
  t,
  tn,
  useLanguage,
} from '@/i18n';
import { resolveEventCurrency, shouldPersistEventCurrency } from '@/lib/utils';
import type { Event, Booth } from '@/types';

interface EventListProps {
  onSelectBooth: (boothId: string, eventId: string) => void;
  onExportEvent: (eventId: string) => void;
  onAddBooth: (eventId: string) => void;
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
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventCurrency, setNewEventCurrency] = useState('');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const openAddForm = () => {
    setNewEventName('');
    setNewEventDate('');
    setNewEventLocation('');
    setNewEventCurrency(getLanguageInfo().defaultCurrency);
    setIsAdding(true);
  };

  const handleAddEvent = async () => {
    if (!newEventName.trim()) return;

    await createEvent({
      name: newEventName.trim(),
      date: newEventDate || null,
      location: newEventLocation || null,
      mapImageUrl: null,
      currency: newEventCurrency,
    });

    setIsAdding(false);
  };

  const handleDeleteEvent = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm(t('events', 'deleteConfirm'))) {
      await deleteEvent(id);
    }
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

  const handleExportImage = (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    onExportEvent(eventId);
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        {t('common', 'loading')}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {isAdding && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddEvent();
            }}
            className="space-y-3"
          >
            <Input
              placeholder={t('events', 'eventNamePlaceholder')}
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <DatePicker
                  value={newEventDate}
                  onChange={setNewEventDate}
                  placeholder={t('events', 'eventDate')}
                />
              </div>
              <CurrencySelect
                value={newEventCurrency}
                onChange={setNewEventCurrency}
                className="w-24"
              />
            </div>
            <PlaceAutocomplete
              value={newEventLocation}
              onChange={setNewEventLocation}
              placeholder={t('events', 'eventLocationPlaceholder')}
            />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                {t('common', 'add')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAdding(false)}
                className="flex-1"
              >
                {t('common', 'cancel')}
              </Button>
            </div>
          </form>
        </div>
      )}

      {events.length === 0 && !isAdding ? (
        <EmptyState
          icon={<Calendar className="w-12 h-12" />}
          title={t('events', 'noEvents')}
          description={t('events', 'noEventsDesc')}
          action={
            <Button onClick={openAddForm}>
              <Plus className="w-4 h-4 mr-2" />
              {t('events', 'addEvent')}
            </Button>
          }
        />
      ) : (
        <>
          {!isAdding && (
            <button
              onClick={openAddForm}
              className="flex items-center gap-2 p-4 text-primary-dark dark:text-primary hover:bg-primary-light dark:hover:bg-primary-light transition-colors cursor-pointer w-full"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">{t('events', 'addEvent')}</span>
            </button>
          )}
          <div className="space-y-1 pb-3">
            {events.map((event) => (
              <EventItem
                key={event.id}
                event={event}
                isExpanded={expandedEvents.has(event.id)}
                onToggleExpand={() => toggleExpand(event.id)}
                onSelectBooth={(boothId) => onSelectBooth(boothId, event.id)}
                onAddBooth={() => onAddBooth(event.id)}
                onUpdate={(data) => updateEvent(event.id, data)}
                onDelete={(e) => handleDeleteEvent(e, event.id)}
                onExportImage={(e) => handleExportImage(e, event.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface EventItemProps {
  event: Event;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelectBooth: (boothId: string) => void;
  onAddBooth: () => void;
  onUpdate: (data: Partial<Event>) => Promise<void>;
  onDelete: (e: React.MouseEvent) => void;
  onExportImage: (e: React.MouseEvent) => void;
}

function EventItem({
  event,
  isExpanded,
  onToggleExpand,
  onSelectBooth,
  onAddBooth,
  onUpdate,
  onDelete,
  onExportImage,
}: EventItemProps) {
  const { booths } = useBooths(event.id);
  const boothCount = booths.length;
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(event.name);
  const [editDate, setEditDate] = useState(event.date || '');
  const [editLocation, setEditLocation] = useState(event.location || '');
  const [editCurrency, setEditCurrency] = useState('');
  // What the picker showed when editing began. For an event without a
  // currency this is only a display fallback and must not be saved as is.
  const [seededCurrency, setSeededCurrency] = useState('');

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    const seeded = resolveEventCurrency(event.currency);
    setEditName(event.name);
    setEditDate(event.date || '');
    setEditLocation(event.location || '');
    setEditCurrency(seeded);
    setSeededCurrency(seeded);
    setIsEditing(true);
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editName.trim()) return;
    const update: Partial<Event> = {
      name: editName.trim(),
      date: editDate || null,
      location: editLocation.trim() || null,
    };
    if (
      shouldPersistEventCurrency(event.currency, seededCurrency, editCurrency)
    ) {
      update.currency = editCurrency;
    }
    await onUpdate(update);
    setIsEditing(false);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div
        id={`event-${event.id}`}
        className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
      >
        <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
          <Input
            placeholder={t('events', 'eventName')}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <DatePicker
                value={editDate}
                onChange={setEditDate}
                placeholder={t('events', 'eventDate')}
              />
            </div>
            <CurrencySelect
              value={editCurrency}
              onChange={setEditCurrency}
              className="w-24"
            />
          </div>
          <PlaceAutocomplete
            value={editLocation}
            onChange={setEditLocation}
            placeholder={t('events', 'eventLocation')}
          />
          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">
              {t('common', 'save')}
            </Button>
            <Button variant="outline" onClick={handleCancel} className="flex-1">
              {t('common', 'cancel')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id={`event-${event.id}`} className="mx-3 my-2">
      <div
        onClick={onToggleExpand}
        className="relative flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-all group overflow-hidden"
      >
        <div className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full" />
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            className="text-primary dark:text-primary"
            onClick={onToggleExpand}
          >
            {isExpanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
              {event.name}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
              {event.date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(event.date)}
                </span>
              )}
              {event.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {event.location}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-primary dark:text-primary bg-primary-light dark:bg-primary-light px-2 py-0.5 rounded-full">
            {tn('events', 'boothCount', boothCount)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleEdit}
            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-primary-dark"
            aria-label={t('common', 'edit')}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onExportImage}
            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-primary-dark"
            aria-label={t('export', 'saveImage')}
          >
            <Image className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
            aria-label={t('common', 'delete')}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      {isExpanded && (
        <div className="ml-6 mt-2 pl-6 border-l-2 border-gray-200 dark:border-gray-700 animate-expandDown">
          <BoothPreviewList
            eventId={event.id}
            onSelectBooth={onSelectBooth}
            onAddBooth={onAddBooth}
          />
        </div>
      )}
    </div>
  );
}

type SortBy = 'order' | 'boothNumber';

function BoothPreviewList({
  eventId,
  onSelectBooth,
  onAddBooth,
}: {
  eventId: string;
  onSelectBooth: (boothId: string) => void;
  onAddBooth: () => void;
}) {
  const { booths } = useBooths(eventId);
  const [sortBy, setSortBy] = useState<SortBy>('order');

  const sortedBooths = [...booths].sort((a, b) => {
    if (sortBy === 'boothNumber') {
      return a.boothNumber.localeCompare(b.boothNumber, undefined, {
        numeric: true,
      });
    }
    return a.order - b.order;
  });

  return (
    <div className="space-y-2 py-2">
      {booths.length > 0 && (
        <div className="flex items-center justify-end gap-1 pb-1">
          <button
            onClick={() => setSortBy('order')}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
              sortBy === 'order'
                ? 'bg-primary-light text-accent dark:text-primary font-medium'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <ArrowDownWideNarrow className="w-3.5 h-3.5" />
            {t('booths', 'sortByOrder')}
          </button>
          <button
            onClick={() => setSortBy('boothNumber')}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
              sortBy === 'boothNumber'
                ? 'bg-primary-light text-accent dark:text-primary font-medium'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <ArrowDownAZ className="w-3.5 h-3.5" />
            {t('booths', 'sortByNumber')}
          </button>
        </div>
      )}
      {booths.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
          {t('booths', 'noBooths')}
        </p>
      ) : (
        <div className="space-y-1.5">
          {sortedBooths.map((booth) => (
            <BoothPreviewItem
              key={booth.id}
              booth={booth}
              onClick={() => onSelectBooth(booth.id)}
            />
          ))}
        </div>
      )}
      <button
        onClick={onAddBooth}
        className="flex items-center gap-1 text-sm text-primary-dark dark:text-primary hover:underline py-2 cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        {t('booths', 'addBooth')}
      </button>
    </div>
  );
}

function BoothPreviewItem({
  booth,
  onClick,
}: {
  booth: Booth;
  onClick: () => void;
}) {
  const { checkedCount, totalCount, badgeStats } = useItems(booth.id);
  const { getBadgeById } = useBadges();
  const isComplete = totalCount > 0 && checkedCount === totalCount;

  const badgeEntries = Object.entries(badgeStats).filter(
    ([, stat]) => stat.total > 0
  );

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-700 cursor-pointer text-sm transition-colors"
    >
      <span className="font-mono text-xs font-bold text-white bg-primary px-2 py-1 rounded-md shadow-sm">
        {booth.boothNumber}
      </span>
      <span className="text-gray-800 dark:text-gray-200 font-medium truncate flex-1">
        {booth.circleName}
      </span>
      {totalCount > 0 && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isComplete ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-green-500 px-2 py-0.5 rounded-full">
              <Check className="w-3 h-3" />
              {t('common', 'complete')}
            </span>
          ) : (
            <>
              {badgeEntries.slice(0, 3).map(([badgeId, stat]) => {
                const badge = getBadgeById(badgeId);
                if (!badge) return null;
                const isDone = stat.checked === stat.total;
                return (
                  <span
                    key={badgeId}
                    className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${isDone ? 'opacity-60' : ''}`}
                    style={{
                      backgroundColor: badge.color
                        ? `${badge.color}25`
                        : '#e5e7eb',
                      color: badge.color ?? '#374151',
                    }}
                  >
                    {getBadgeLabel(badge)} {stat.checked}/{stat.total}
                  </span>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
