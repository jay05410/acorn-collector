import { useState } from 'react';
import { Calendar, ChevronRight, MapPin, Plus, Trash2 } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';
import type { Event } from '@/types';

interface EventListProps {
  onSelectEvent: (eventId: string) => void;
}

export function EventList({ onSelectEvent }: EventListProps) {
  const { events, isLoading, createEvent, deleteEvent } = useEvents();
  const [isAdding, setIsAdding] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');

  const handleAddEvent = async () => {
    if (!newEventName.trim()) return;

    await createEvent({
      name: newEventName.trim(),
      date: newEventDate || null,
      location: null,
      mapImageUrl: null,
    });

    setNewEventName('');
    setNewEventDate('');
    setIsAdding(false);
  };

  const handleDeleteEvent = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('이 행사를 삭제하시겠습니까? 포함된 모든 부스와 상품도 삭제됩니다.')) {
      await deleteEvent(id);
    }
  };

  if (isLoading) {
    return <div className="p-4 text-center text-gray-500">로딩 중...</div>;
  }

  return (
    <div className="flex flex-col">
      {isAdding && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="space-y-3">
            <Input
              placeholder="행사 이름 (예: 서코 45회)"
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
              autoFocus
            />
            <Input
              type="date"
              value={newEventDate}
              onChange={(e) => setNewEventDate(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={handleAddEvent} className="flex-1">
                추가
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsAdding(false)}
                className="flex-1"
              >
                취소
              </Button>
            </div>
          </div>
        </div>
      )}

      {events.length === 0 && !isAdding ? (
        <EmptyState
          icon={<Calendar className="w-12 h-12" />}
          title="등록된 행사가 없습니다"
          description="새로운 행사를 추가해보세요"
          action={
            <Button onClick={() => setIsAdding(true)}>
              <Plus className="w-4 h-4 mr-2" />
              행사 추가
            </Button>
          }
        />
      ) : (
        <>
          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 p-4 text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">새 행사 추가</span>
            </button>
          )}
          <ul className="divide-y divide-gray-200">
            {events.map((event) => (
              <EventItem
                key={event.id}
                event={event}
                onClick={() => onSelectEvent(event.id)}
                onDelete={(e) => handleDeleteEvent(e, event.id)}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

interface EventItemProps {
  event: Event;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function EventItem({ event, onClick, onDelete }: EventItemProps) {
  return (
    <li
      onClick={onClick}
      className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-900 truncate">{event.name}</h3>
        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
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
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50"
          aria-label="삭제"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>
    </li>
  );
}
