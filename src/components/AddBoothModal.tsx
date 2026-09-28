import { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useEvents } from '@/hooks/useEvents';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { parseBoothText } from '@/lib/parser/text';
import type { ParsedBooth } from '@/types';
import { t, tp, useLanguage } from '@/i18n';

interface AddBoothModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText?: string;
  sourceUrl?: string;
  author?: string;
  imageUrls?: string[];
  defaultEventId?: string | null;
}

export function AddBoothModal({
  isOpen,
  onClose,
  initialText = '',
  sourceUrl = '',
  author,
  imageUrls,
  defaultEventId,
}: AddBoothModalProps) {
  useLanguage();
  const { events, createEvent } = useEvents();
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [newEventName, setNewEventName] = useState('');
  const [boothNumber, setBoothNumber] = useState('');
  const [circleName, setCircleName] = useState('');
  const [zone, setZone] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [memo, setMemo] = useState('');
  const [parsed, setParsed] = useState<ParsedBooth | null>(null);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);

  useEffect(() => {
    if (isOpen && initialText) {
      const result = parseBoothText(initialText, { author });
      setParsed(result);
      if (result.boothNumber) setBoothNumber(result.boothNumber);
      if (result.circleName) setCircleName(result.circleName);
      if (result.eventHint) setNewEventName(result.eventHint);
      if (result.zone) setZone(result.zone);
      if (result.formUrl) setFormUrl(result.formUrl);
    }
  }, [isOpen, initialText, author]);

  useEffect(() => {
    if (isOpen) {
      if (defaultEventId) {
        setSelectedEventId(defaultEventId);
      } else if (events.length > 0 && !selectedEventId) {
        setSelectedEventId(events[0]?.id ?? '');
      }
    }
  }, [isOpen, events, selectedEventId, defaultEventId]);

  const handleSubmit = async () => {
    if (!boothNumber.trim() || !circleName.trim()) return;

    let eventId = selectedEventId;

    if ((isCreatingEvent || events.length === 0) && newEventName.trim()) {
      eventId = await createEvent({
        name: newEventName.trim(),
        date: null,
        location: null,
        mapImageUrl: null,
      });
    }

    if (!eventId) return;

    const now = Date.now();
    const boothId = generateId();
    const maxOrder = await db.booths.where('eventId').equals(eventId).count();

    await db.booths.add({
      id: boothId,
      eventId,
      boothNumber: boothNumber.trim(),
      circleName: circleName.trim(),
      zone: zone.trim() || null,
      sourceUrl: sourceUrl || null,
      formUrl: formUrl.trim() || null,
      memo: memo || null,
      imageUrls: imageUrls && imageUrls.length > 0 ? imageUrls : null,
      sourceText: initialText || null,
      order: maxOrder,
      createdAt: now,
      updatedAt: now,
    });

    handleClose();
  };

  const handleClose = () => {
    setBoothNumber('');
    setCircleName('');
    setZone('');
    setFormUrl('');
    setMemo('');
    setNewEventName('');
    setParsed(null);
    setIsCreatingEvent(false);
    onClose();
  };

  if (!isOpen) return null;

  const needsNewEvent = events.length === 0 || isCreatingEvent;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md mx-4 animate-slideUp">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('booths', 'addBooth')}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            aria-label={t('common', 'close')}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="p-4 space-y-4"
        >
          {parsed && parsed.confidence > 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 rounded-lg">
              <Sparkles className="w-4 h-4" />
              <span>
                {tp('booths', 'autoParsed', {
                  confidence: Math.round(parsed.confidence * 100),
                })}
              </span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('events', 'title')}
            </label>
            {needsNewEvent ? (
              <div className="space-y-2">
                <Input
                  placeholder={t('events', 'eventNamePlaceholder')}
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                />
                {events.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingEvent(false)}
                    className="text-sm text-primary-dark dark:text-primary hover:underline"
                  >
                    {t('events', 'chooseExisting')}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsCreatingEvent(true)}
                  className="text-sm text-primary-dark dark:text-primary hover:underline"
                >
                  + {t('events', 'addEvent')}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('booths', 'boothNumber')} *
              </label>
              <Input
                placeholder={t('booths', 'boothNumberPlaceholder')}
                value={boothNumber}
                onChange={(e) => setBoothNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('booths', 'zone')}
              </label>
              <Input
                placeholder={t('booths', 'zonePlaceholder')}
                value={zone}
                onChange={(e) => setZone(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('booths', 'circleName')} *
            </label>
            <Input
              placeholder={t('booths', 'circleNamePlaceholder')}
              value={circleName}
              onChange={(e) => setCircleName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('booths', 'formUrl')}
            </label>
            <Input
              placeholder="https://witchform.com/..."
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('booths', 'memo')}
            </label>
            <Input
              placeholder={t('booths', 'memoPlaceholder')}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>

          {sourceUrl && (
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {tp('booths', 'source', { url: sourceUrl })}
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('booths', 'itemsAfterSaveHint')}
          </p>

          <div className="flex gap-2 pt-4 border-t dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              {t('common', 'cancel')}
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={
                !boothNumber.trim() ||
                !circleName.trim() ||
                (needsNewEvent && !newEventName.trim())
              }
            >
              {t('common', 'save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
