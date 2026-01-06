import { useState } from 'react';
import { ChevronRight, Plus, Store, Trash2 } from 'lucide-react';
import { useBooths } from '@/hooks/useBooths';
import { useItems } from '@/hooks/useItems';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Booth } from '@/types';

interface BoothListProps {
  eventId: string;
  onSelectBooth: (boothId: string) => void;
}

export function BoothList({ eventId, onSelectBooth }: BoothListProps) {
  const { booths, isLoading, createBooth, deleteBooth } = useBooths(eventId);
  const [isAdding, setIsAdding] = useState(false);
  const [boothNumber, setBoothNumber] = useState('');
  const [circleName, setCircleName] = useState('');

  const handleAddBooth = async () => {
    if (!boothNumber.trim() || !circleName.trim()) return;

    await createBooth({
      eventId,
      boothNumber: boothNumber.trim(),
      circleName: circleName.trim(),
      sourceUrl: null,
      memo: null,
    });

    setBoothNumber('');
    setCircleName('');
    setIsAdding(false);
  };

  const handleDeleteBooth = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('이 부스를 삭제하시겠습니까? 포함된 모든 상품도 삭제됩니다.')) {
      await deleteBooth(id);
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
              placeholder="부스 번호 (예: A-01)"
              value={boothNumber}
              onChange={(e) => setBoothNumber(e.target.value)}
              autoFocus
            />
            <Input
              placeholder="서클/작가명"
              value={circleName}
              onChange={(e) => setCircleName(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={handleAddBooth} className="flex-1">
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

      {booths.length === 0 && !isAdding ? (
        <EmptyState
          icon={<Store className="w-12 h-12" />}
          title="등록된 부스가 없습니다"
          description="방문할 부스를 추가해보세요"
          action={
            <Button onClick={() => setIsAdding(true)}>
              <Plus className="w-4 h-4 mr-2" />
              부스 추가
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
              <span className="font-medium">새 부스 추가</span>
            </button>
          )}
          <ul className="divide-y divide-gray-200">
            {booths.map((booth) => (
              <BoothItem
                key={booth.id}
                booth={booth}
                onClick={() => onSelectBooth(booth.id)}
                onDelete={(e) => handleDeleteBooth(e, booth.id)}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

interface BoothItemProps {
  booth: Booth;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function BoothItem({ booth, onClick, onDelete }: BoothItemProps) {
  const { checkedCount, totalCount } = useItems(booth.id);
  const isComplete = totalCount > 0 && checkedCount === totalCount;

  return (
    <li
      onClick={onClick}
      className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
            {booth.boothNumber}
          </span>
          <h3 className="font-medium text-gray-900 truncate">
            {booth.circleName}
          </h3>
        </div>
        {totalCount > 0 && (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-[120px]">
              <div
                className={`h-full transition-all ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${(checkedCount / totalCount) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">
              {checkedCount}/{totalCount}
            </span>
          </div>
        )}
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
