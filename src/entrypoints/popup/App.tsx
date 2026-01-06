import { useState } from 'react';
import { EventList } from '@/components/EventList';
import { BoothList } from '@/components/BoothList';
import { BoothDetail } from '@/components/BoothDetail';
import { Header } from '@/components/Header';
import { useUIStore } from '@/stores/useUIStore';

type View = 'events' | 'booths' | 'booth-detail';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('events');
  const { selectedEventId, selectedBoothId, setSelectedEventId, setSelectedBoothId } = useUIStore();

  const handleSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    setCurrentView('booths');
  };

  const handleSelectBooth = (boothId: string) => {
    setSelectedBoothId(boothId);
    setCurrentView('booth-detail');
  };

  const handleBack = () => {
    if (currentView === 'booth-detail') {
      setSelectedBoothId(null);
      setCurrentView('booths');
    } else if (currentView === 'booths') {
      setSelectedEventId(null);
      setCurrentView('events');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <Header
        currentView={currentView}
        onBack={handleBack}
        showBack={currentView !== 'events'}
      />
      <main className="flex-1 overflow-y-auto">
        {currentView === 'events' && (
          <EventList onSelectEvent={handleSelectEvent} />
        )}
        {currentView === 'booths' && selectedEventId && (
          <BoothList
            eventId={selectedEventId}
            onSelectBooth={handleSelectBooth}
          />
        )}
        {currentView === 'booth-detail' && selectedBoothId && (
          <BoothDetail boothId={selectedBoothId} />
        )}
      </main>
    </div>
  );
}
