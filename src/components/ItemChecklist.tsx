import { useState, useRef, useEffect } from 'react';
import { Check, Pencil, Plus, Trash2, X, Camera, Sparkles } from 'lucide-react';
import { useItems } from '@/hooks/useItems';
import { useBadges } from '@/hooks/useBadges';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { OCRModal, type SelectedItem } from '@/components/OCRModal';
import {
  parsePriceInput,
  resolveEventCurrency,
  resolveItemCurrency,
} from '@/lib/utils';
import { formatPrice, getBadgeLabel, t, useLanguage } from '@/i18n';
import { DEFAULT_BADGE_ID } from '@/constants/presetBadges';
import type { Badge as BadgeRecord, Item } from '@/types';

interface ItemChecklistProps {
  boothId: string;
  imageUrls?: string[] | null;
  /** The event's currency; items without their own currency use it. */
  currency: string | null;
  onOpenSettings?: () => void;
}

export function ItemChecklist({
  boothId,
  imageUrls,
  currency,
  onOpenSettings,
}: ItemChecklistProps) {
  useLanguage();
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
  // Same resolution as ChecklistReceipt, so both show the same currency.
  const eventCurrency = resolveEventCurrency(currency);

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
      price: parsePriceInput(itemPrice),
      badgeId: selectedBadgeId,
      quantity: Math.max(1, itemQuantity),
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

  const handleOCRItemsSelected = async (items: SelectedItem[]) => {
    for (const item of items) {
      await createItem({
        boothId,
        name: item.name,
        price: item.price,
        badgeId: DEFAULT_BADGE_ID,
        quantity: item.quantity,
      });
    }
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
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <h3 className="font-medium text-gray-900 dark:text-white">
          {t('items', 'title')}
        </h3>
      </div>

      {isAdding && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="space-y-3">
            <Input
              ref={nameInputRef}
              placeholder={t('items', 'itemNamePlaceholder')}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <Input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder={t('items', 'pricePlaceholder')}
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
              onKeyDown={handleKeyDown}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('items', 'quantity')}
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
                    title={t('items', 'customQuantity')}
                    aria-label={t('items', 'customQuantity')}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('items', 'badge')}
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
                    {getBadgeLabel(badge)}
                  </button>
                ))}
                {!isCreatingBadge && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingBadge(true)}
                    className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 flex items-center justify-center cursor-pointer transition-colors"
                    title={t('items', 'addCustomBadge')}
                    aria-label={t('items', 'addCustomBadge')}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {isCreatingBadge && (
              <div className="flex gap-2 items-center">
                <Input
                  placeholder={t('items', 'newBadge')}
                  value={newBadgeLabel}
                  onChange={(e) => setNewBadgeLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateBadge()}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={handleCreateBadge}
                  className="w-8 h-8 rounded-full bg-primary text-white hover:bg-primary-dark flex items-center justify-center cursor-pointer transition-colors"
                  title={t('common', 'add')}
                  aria-label={t('common', 'add')}
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
                  title={t('common', 'cancel')}
                  aria-label={t('common', 'cancel')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {hasImages && (
              <div className="flex items-center gap-2 text-xs text-primary-dark dark:text-primary bg-primary-light dark:bg-primary-light px-3 py-2 rounded-lg">
                <Sparkles className="w-3 h-3 flex-shrink-0" />
                <span>{t('items', 'imageHint')}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleAddItem} className="flex-1">
                {t('common', 'add')}
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
                {t('common', 'close')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 && !isAdding ? (
        <EmptyState
          title={t('items', 'noItems')}
          description={t('items', 'noItemsDesc')}
          action={
            <div className="flex flex-col gap-2">
              {hasImages && (
                <Button
                  onClick={() => setIsOCRModalOpen(true)}
                  size="sm"
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary-light dark:border-primary dark:text-primary dark:hover:bg-primary-light"
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  {t('items', 'extractFromImage')}
                </Button>
              )}
              <Button onClick={() => setIsAdding(true)} size="sm">
                <Plus className="w-4 h-4 mr-1" />
                {t('items', 'addItem')}
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
                  className="flex items-center gap-2 px-4 py-3 text-primary dark:text-primary hover:bg-primary-light dark:hover:bg-primary-light transition-colors cursor-pointer w-full"
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {t('items', 'extractFromImage')}
                  </span>
                  <Camera className="w-3 h-3 ml-1 opacity-60" />
                </button>
              )}
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-4 py-3 text-primary-dark dark:text-primary hover:bg-primary-light dark:hover:bg-primary-light transition-colors cursor-pointer w-full"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {t('items', 'addItem')}
                </span>
              </button>
            </div>
          )}
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                eventCurrency={eventCurrency}
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
          currency={eventCurrency}
          onItemsSelected={handleOCRItemsSelected}
          onOpenSettings={onOpenSettings}
        />
      )}
    </div>
  );
}

interface ItemRowProps {
  item: Item;
  /** Resolved event currency, for items without their own. */
  eventCurrency: string;
  badge?: BadgeRecord;
  badges: BadgeRecord[];
  onToggle: () => void;
  onUpdate: (data: Partial<Item>) => Promise<void>;
  onDelete: () => void;
}

function ItemRow({
  item,
  eventCurrency,
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
      price: parsePriceInput(editPrice),
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
            placeholder={t('items', 'itemName')}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            autoFocus
          />
          <Input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder={t('items', 'price')}
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
                {getBadgeLabel(b)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} size="sm" className="flex-1">
              {t('common', 'save')}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              size="sm"
              className="flex-1"
            >
              {t('common', 'cancel')}
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
          {badge && <Badge label={getBadgeLabel(badge)} color={badge.color} />}
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
            {formatPrice(item.price, resolveItemCurrency(item, eventCurrency))}
          </span>
        )}
      </div>
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
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
        aria-label={t('common', 'delete')}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </li>
  );
}
