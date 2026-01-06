import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useItems } from '@/hooks/useItems';
import { useBadges } from '@/hooks/useBadges';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatPrice } from '@/lib/utils';
import { DEFAULT_BADGE_ID } from '@/constants/presetBadges';
import type { Item } from '@/types';

interface ItemChecklistProps {
  boothId: string;
}

export function ItemChecklist({ boothId }: ItemChecklistProps) {
  const { items, isLoading, createItem, deleteItem, toggleItemCheck } =
    useItems(boothId);
  const { badges, getBadgeById } = useBadges();
  const [isAdding, setIsAdding] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [selectedBadgeId, setSelectedBadgeId] = useState<string>(DEFAULT_BADGE_ID);

  const handleAddItem = async () => {
    if (!itemName.trim()) return;

    await createItem({
      boothId,
      name: itemName.trim(),
      price: itemPrice ? parseInt(itemPrice, 10) : null,
      badgeId: selectedBadgeId,
    });

    setItemName('');
    setItemPrice('');
    setSelectedBadgeId(DEFAULT_BADGE_ID);
    setIsAdding(false);
  };

  const handleDeleteItem = async (id: string) => {
    await deleteItem(id);
  };

  if (isLoading) {
    return <div className="p-4 text-center text-gray-500">로딩 중...</div>;
  }

  return (
    <div className="flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="font-medium text-gray-900">상품 목록</h3>
      </div>

      {isAdding && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="space-y-3">
            <Input
              placeholder="상품명"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              autoFocus
            />
            <Input
              type="number"
              placeholder="가격 (선택)"
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <button
                  key={badge.id}
                  onClick={() => setSelectedBadgeId(badge.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedBadgeId === badge.id
                      ? 'ring-2 ring-offset-1 ring-blue-500'
                      : ''
                  }`}
                  style={{
                    backgroundColor: badge.color ? `${badge.color}20` : '#e5e7eb',
                    color: badge.color ?? '#374151',
                  }}
                >
                  {badge.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddItem} className="flex-1">
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

      {items.length === 0 && !isAdding ? (
        <EmptyState
          title="등록된 상품이 없습니다"
          description="구매/수령할 상품을 추가해보세요"
          action={
            <Button onClick={() => setIsAdding(true)} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              상품 추가
            </Button>
          }
          className="py-8"
        />
      ) : (
        <>
          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 px-4 py-3 text-blue-600 hover:bg-blue-50 transition-colors border-b border-gray-200"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">상품 추가</span>
            </button>
          )}
          <ul className="divide-y divide-gray-200">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                badge={getBadgeById(item.badgeId)}
                onToggle={() => toggleItemCheck(item.id)}
                onDelete={() => handleDeleteItem(item.id)}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

interface ItemRowProps {
  item: Item;
  badge?: { label: string; color: string | null };
  onToggle: () => void;
  onDelete: () => void;
}

function ItemRow({ item, badge, onToggle, onDelete }: ItemRowProps) {
  return (
    <li className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group">
      <Checkbox checked={item.checked} onCheckedChange={onToggle} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {badge && <Badge label={badge.label} color={badge.color} />}
          <span
            className={`text-sm ${item.checked ? 'line-through text-gray-400' : 'text-gray-900'}`}
          >
            {item.name}
          </span>
        </div>
        {item.price && (
          <span className="text-xs text-gray-500">{formatPrice(item.price)}</span>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50"
        aria-label="삭제"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </li>
  );
}
