import { useState, useRef, useEffect } from 'react';
import { Check, Pencil, Plus, Trash2, X, Camera, Sparkles } from 'lucide-react';
import { useItems } from '@/hooks/useItems';
import { useBadges } from '@/hooks/useBadges';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { OCRModal } from '@/components/OCRModal';
import { formatPrice } from '@/lib/utils';
import { DEFAULT_BADGE_ID } from '@/constants/presetBadges';
import type { Item } from '@/types';
import type { ImageAnalysisItem } from '@/lib/ai';

interface ItemChecklistProps {
  boothId: string;
  imageUrls?: string[] | null;
}

export function ItemChecklist({ boothId, imageUrls }: ItemChecklistProps) {
  const {
    items,
    isLoading,
    createItem,
    updateItem,
    deleteItem,
    toggleItemCheck,
  } = useItems(boothId);
  const { badges, getBadgeById, createBadge } = useBadges();
  const [isAdding, setIsAdding] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [isCustomQuantity, setIsCustomQuantity] = useState(false);
  const [selectedBadgeId, setSelectedBadgeId] =
    useState<string>(DEFAULT_BADGE_ID);
  const [isCreatingBadge, setIsCreatingBadge] = useState(false);
  const [newBadgeLabel, setNewBadgeLabel] = useState('');
  const [isOCRModalOpen, setIsOCRModalOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const hasImages = imageUrls && imageUrls.length > 0;

  useEffect(() => {
    if (isAdding && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isAdding, items.length]);

  const handleAddItem = async () => {
    if (!itemName.trim()) return;

    await createItem({
      boothId,
      name: itemName.trim(),
      price: itemPrice ? parseInt(itemPrice, 10) : null,
      badgeId: selectedBadgeId,
      quantity: itemQuantity,
    });

    setItemName('');
    setItemPrice('');
    setItemQuantity(1);
    setIsCustomQuantity(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddItem();
    }
  };

  const handleDeleteItem = async (id: string) => {
    await deleteItem(id);
  };

  const handleCreateBadge = async () => {
    if (!newBadgeLabel.trim()) return;
    const newId = await createBadge(newBadgeLabel.trim());
    setSelectedBadgeId(newId);
    setNewBadgeLabel('');
    setIsCreatingBadge(false);
  };

  const handleOCRItemsSelected = async (ocrItems: ImageAnalysisItem[]) => {
    for (const item of ocrItems) {
      await createItem({
        boothId,
        name: item.name,
        price: item.price,
        badgeId: DEFAULT_BADGE_ID,
        quantity: 1,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        로딩 중...
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <h3 className="font-medium text-gray-900 dark:text-white">상품 목록</h3>
      </div>

      {isAdding && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="space-y-3">
            <Input
              ref={nameInputRef}
              placeholder="상품명 (Enter로 추가)"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <Input
              type="number"
              placeholder="가격 (선택)"
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
              onKeyDown={handleKeyDown}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                수량
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setItemQuantity(num);
                      setIsCustomQuantity(false);
                    }}
                    className={`w-9 h-9 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                      itemQuantity === num && !isCustomQuantity
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {num}
                  </button>
                ))}
                {isCustomQuantity ? (
                  <input
                    type="number"
                    min="1"
                    value={itemQuantity}
                    onChange={(e) =>
                      setItemQuantity(
                        Math.max(1, parseInt(e.target.value) || 1)
                      )
                    }
                    className="w-16 h-9 px-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-center text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomQuantity(true);
                      setItemQuantity(5);
                    }}
                    className="w-9 h-9 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 flex items-center justify-center cursor-pointer transition-colors"
                    title="직접 입력"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                뱃지 선택
              </label>
              <div className="flex flex-wrap gap-2">
                {badges.map((badge) => (
                  <button
                    key={badge.id}
                    type="button"
                    onClick={() => setSelectedBadgeId(badge.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-all ${
                      selectedBadgeId === badge.id
                        ? 'scale-110 shadow-md'
                        : 'hover:scale-105'
                    }`}
                    style={{
                      backgroundColor: badge.color
                        ? `${badge.color}${selectedBadgeId === badge.id ? '40' : '20'}`
                        : selectedBadgeId === badge.id
                          ? '#d1d5db'
                          : '#e5e7eb',
                      color: badge.color ?? '#374151',
                      border:
                        selectedBadgeId === badge.id
                          ? `2px solid ${badge.color ?? '#6b7280'}`
                          : '2px solid transparent',
                    }}
                  >
                    {selectedBadgeId === badge.id && (
                      <Check className="w-3 h-3 inline mr-1" />
                    )}
                    {badge.label}
                  </button>
                ))}
                {!isCreatingBadge && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingBadge(true)}
                    className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 flex items-center justify-center cursor-pointer transition-colors"
                    title="커스텀 뱃지 추가"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {isCreatingBadge && (
              <div className="flex gap-2 items-center">
                <Input
                  placeholder="새 뱃지 이름"
                  value={newBadgeLabel}
                  onChange={(e) => setNewBadgeLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateBadge()}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={handleCreateBadge}
                  className="w-8 h-8 rounded-full bg-primary text-white hover:bg-primary-dark flex items-center justify-center cursor-pointer transition-colors"
                  title="추가"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingBadge(false);
                    setNewBadgeLabel('');
                  }}
                  className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 flex items-center justify-center cursor-pointer transition-colors"
                  title="취소"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {hasImages && (
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
                <Sparkles className="w-3 h-3 flex-shrink-0" />
                <span>
                  이미지가 있어요! 닫고 &quot;이미지에서 상품 추출&quot;로 자동
                  입력해보세요.
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleAddItem} className="flex-1">
                추가
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAdding(false);
                  setItemName('');
                  setItemPrice('');
                }}
                className="flex-1"
              >
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 && !isAdding ? (
        <EmptyState
          title="등록된 상품이 없습니다"
          description={
            hasImages
              ? '이미지에서 상품을 자동으로 추출하거나 직접 추가해보세요'
              : '구매/수령할 상품을 추가해보세요'
          }
          action={
            <div className="flex flex-col gap-2">
              {hasImages && (
                <Button
                  onClick={() => setIsOCRModalOpen(true)}
                  size="sm"
                  variant="outline"
                  className="border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-900/20"
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  이미지에서 상품 추출
                </Button>
              )}
              <Button onClick={() => setIsAdding(true)} size="sm">
                <Plus className="w-4 h-4 mr-1" />
                상품 추가
              </Button>
            </div>
          }
          className="py-8"
        />
      ) : (
        <>
          {!isAdding && (
            <div className="flex flex-col border-b border-gray-200 dark:border-gray-700">
              {hasImages && (
                <button
                  onClick={() => setIsOCRModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-3 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors cursor-pointer w-full"
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    이미지에서 상품 추출
                  </span>
                  <Camera className="w-3 h-3 ml-1 opacity-60" />
                </button>
              )}
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-4 py-3 text-primary-dark dark:text-primary hover:bg-primary-light dark:hover:bg-primary-light transition-colors cursor-pointer w-full"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">상품 추가</span>
              </button>
            </div>
          )}
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                badge={getBadgeById(item.badgeId)}
                badges={badges}
                onToggle={() => toggleItemCheck(item.id)}
                onUpdate={(data) => updateItem(item.id, data)}
                onDelete={() => handleDeleteItem(item.id)}
              />
            ))}
          </ul>
        </>
      )}

      {hasImages && (
        <OCRModal
          isOpen={isOCRModalOpen}
          onClose={() => setIsOCRModalOpen(false)}
          imageUrls={imageUrls}
          onItemsSelected={handleOCRItemsSelected}
        />
      )}
    </div>
  );
}

interface ItemRowProps {
  item: Item;
  badge?: { label: string; color: string | null };
  badges: Array<{ id: string; label: string; color: string | null }>;
  onToggle: () => void;
  onUpdate: (data: Partial<Item>) => Promise<void>;
  onDelete: () => void;
}

function ItemRow({
  item,
  badge,
  badges,
  onToggle,
  onUpdate,
  onDelete,
}: ItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editPrice, setEditPrice] = useState(item.price?.toString() || '');
  const [editBadgeId, setEditBadgeId] = useState(item.badgeId);

  const handleRowClick = () => {
    if (!isEditing) {
      onToggle();
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(item.name);
    setEditPrice(item.price?.toString() || '');
    setEditBadgeId(item.badgeId);
    setIsEditing(true);
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editName.trim()) return;
    await onUpdate({
      name: editName.trim(),
      price: editPrice ? parseInt(editPrice, 10) : null,
      badgeId: editBadgeId,
    });
    setIsEditing(false);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <li
        className="px-4 py-3 bg-gray-50 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <Input
            placeholder="상품명"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            autoFocus
          />
          <Input
            type="number"
            placeholder="가격"
            value={editPrice}
            onChange={(e) => setEditPrice(e.target.value)}
          />
          <div className="flex flex-wrap gap-1">
            {badges.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setEditBadgeId(b.id)}
                className={`px-2 py-1 rounded text-xs font-medium cursor-pointer transition-all ${
                  editBadgeId === b.id ? 'scale-105' : 'hover:scale-105'
                }`}
                style={{
                  backgroundColor: b.color
                    ? `${b.color}${editBadgeId === b.id ? '40' : '20'}`
                    : editBadgeId === b.id
                      ? '#d1d5db'
                      : '#e5e7eb',
                  color: b.color ?? '#374151',
                  border:
                    editBadgeId === b.id
                      ? `2px solid ${b.color ?? '#6b7280'}`
                      : '2px solid transparent',
                }}
              >
                {editBadgeId === b.id && (
                  <Check className="w-3 h-3 inline mr-0.5" />
                )}
                {b.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} size="sm" className="flex-1">
              저장
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              size="sm"
              className="flex-1"
            >
              취소
            </Button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li
      onClick={handleRowClick}
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 group cursor-pointer"
    >
      <Checkbox checked={item.checked} onCheckedChange={onToggle} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {badge && <Badge label={badge.label} color={badge.color} />}
          <span
            className={`text-sm ${
              item.checked
                ? 'line-through text-gray-500 dark:text-gray-400'
                : 'text-gray-900 dark:text-white'
            }`}
          >
            {item.name}
          </span>
          {item.quantity > 1 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              x{item.quantity}
            </span>
          )}
        </div>
        {item.price !== null && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatPrice(item.price)}
          </span>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleEdit}
        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-primary-dark"
        aria-label="수정"
      >
        <Pencil className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
        aria-label="삭제"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </li>
  );
}
