import { ChevronLeft, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/stores/useUIStore';

interface HeaderProps {
  currentView: string;
  onBack: () => void;
  showBack: boolean;
}

export function Header({ currentView, onBack, showBack }: HeaderProps) {
  const { openAddModal } = useUIStore();

  const getTitle = () => {
    switch (currentView) {
      case 'events':
        return '도토리 주머니';
      case 'booths':
        return '부스 목록';
      case 'booth-detail':
        return '부스 상세';
      default:
        return '도토리 주머니';
    }
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white sticky top-0 z-10">
      <div className="flex items-center gap-2">
        {showBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="뒤로가기"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
        )}
        <h1 className="text-lg font-semibold text-gray-900">{getTitle()}</h1>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={openAddModal}
          aria-label="추가"
        >
          <Plus className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="설정">
          <Settings className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}
