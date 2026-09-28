import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  ChevronRight,
  Pencil,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useItems } from '@/hooks/useItems';
import { useBadges } from '@/hooks/useBadges';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Progress } from '@/components/ui/Progress';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { Stepper } from '@/components/ui/Stepper';
import { showToast } from '@/components/ui/toast-store';
import { OCRModal, type SelectedItem } from '@/components/OCRModal';
import {
  cn,
  parsePriceInput,
  resolveEventCurrency,
  resolveItemCurrency,
} from '@/lib/utils';
import { formatPrice, getBadgeLabel, t, tp, useLanguage } from '@/i18n';
import { DEFAULT_BADGE_ID } from '@/constants/presetBadges';
import type { Badge as BadgeRecord, Item } from '@/types';

interface ItemChecklistProps {
  boothId: string;
  imageUrls?: string[] | null;
  /** The event's currency; items without their own currency use it. */
  currency: string | null;
  onOpenSettings?: () => void;
}

interface ItemDraft {
  name: string;
  price: string;
  quantity: number;
  badgeId: string;
}

/** For new input only: a larger stored quantity is still shown and kept. */
const MAX_QUANTITY = 999;

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
    progress,
    createItem,
    updateItem,
    deleteItem,
    restoreItem,
    toggleItemCheck,
  } = useItems(boothId);
  const { badges, getBadgeById, createBadge } = useBadges();
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState<ItemDraft>({
    name: '',
    price: '',
    quantity: 1,
    badgeId: DEFAULT_BADGE_ID,
  });
  const [isCreatingBadge, setIsCreatingBadge] = useState(false);
  const [newBadgeLabel, setNewBadgeLabel] = useState('');
  const [isOCRModalOpen, setIsOCRModalOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const formHeadingId = useId();

  const hasImages = Boolean(imageUrls && imageUrls.length > 0);
  // Same resolution as ChecklistReceipt, so both show the same currency.
  const eventCurrency = resolveEventCurrency(currency);

  useEffect(() => {
    if (isAdding && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isAdding, items.length]);

  const handleAddItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) return;

    await createItem({
      boothId,
      name: draft.name.trim(),
      price: parsePriceInput(draft.price),
      badgeId: draft.badgeId,
      quantity: Math.max(1, draft.quantity),
    });

    setDraft((prev) => ({ ...prev, name: '', price: '', quantity: 1 }));
  };

  const closeForm = () => {
    setIsAdding(false);
    setIsCreatingBadge(false);
    setNewBadgeLabel('');
    setDraft((prev) => ({ ...prev, name: '', price: '' }));
  };

  const handleCreateBadge = async () => {
    if (!newBadgeLabel.trim()) return;
    const newId = await createBadge(newBadgeLabel.trim());
    setDraft((prev) => ({ ...prev, badgeId: newId }));
    setNewBadgeLabel('');
    setIsCreatingBadge(false);
  };

  const handleBadgeKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      // Creates the badge instead of submitting the item form.
      event.preventDefault();
      void handleCreateBadge();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsCreatingBadge(false);
      setNewBadgeLabel('');
    }
  };

  // Deleting has no confirmation, so it can be undone from a toast.
  const handleDelete = async (item: Item) => {
    await deleteItem(item.id);
    showToast({
      message: tp('items', 'itemDeleted', { name: item.name }),
      action: {
        label: t('ui', 'undo'),
        onClick: () => {
          restoreItem(item).catch((error: unknown) => {
            console.error('Failed to restore item:', error);
          });
        },
      },
    });
  };

  const handleOCRItemsSelected = async (selected: SelectedItem[]) => {
    for (const item of selected) {
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
      <div aria-busy="true" className="space-y-2">
        <span className="sr-only">{t('common', 'loading')}</span>
        <Skeleton className="h-5 w-1/3" />
        <Card className="space-y-3 p-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </Card>
      </div>
    );
  }

  const badgeAccessory = isCreatingBadge ? (
    <div className="flex items-center gap-2 pt-1">
      <Input
        placeholder={t('items', 'newBadge')}
        aria-label={t('items', 'newBadge')}
        value={newBadgeLabel}
        onChange={(e) => setNewBadgeLabel(e.target.value)}
        onKeyDown={handleBadgeKeyDown}
        autoFocus
        className="h-9"
      />
      <IconButton
        variant="primary"
        label={t('common', 'add')}
        onClick={() => void handleCreateBadge()}
        disabled={!newBadgeLabel.trim()}
      >
        <Plus />
      </IconButton>
      <IconButton
        label={t('common', 'cancel')}
        onClick={() => {
          setIsCreatingBadge(false);
          setNewBadgeLabel('');
        }}
      >
        <X />
      </IconButton>
    </div>
  ) : null;

  return (
    <section aria-labelledby={headingId} className="space-y-2.5">
      <div className="flex min-h-9 items-center gap-2.5 px-1">
        <h3 id={headingId} className="text-sm font-semibold text-fg">
          {t('items', 'title')}
          <span className="ms-1.5 text-fg-subtle tabular-nums">
            {progress.total}
          </span>
        </h3>
        <Progress value={progress.checked} max={progress.total} />
        {!isAdding && (
          <Button
            size="sm"
            variant="soft"
            className="ml-auto"
            onClick={() => setIsAdding(true)}
          >
            <Plus />
            {t('items', 'addItem')}
          </Button>
        )}
      </div>

      {hasImages && (
        <button
          type="button"
          onClick={() => setIsOCRModalOpen(true)}
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-primary/25 bg-primary-soft p-3 text-left transition-colors duration-150 hover:bg-primary-soft-hover"
        >
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-primary-strong shadow-xs"
          >
            <Sparkles className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-primary-strong">
              {t('items', 'extractFromImage')}
            </span>
            <span className="block truncate text-xs text-fg-muted">
              {tp('ui', 'imagesAttached', { count: imageUrls?.length ?? 0 })}
            </span>
          </span>
          <ChevronRight
            aria-hidden="true"
            className="size-4 shrink-0 text-primary-strong"
          />
        </button>
      )}

      {isAdding && (
        <Card
          as="form"
          aria-labelledby={formHeadingId}
          onSubmit={handleAddItem}
          className="animate-reveal space-y-3 p-4"
        >
          <h4 id={formHeadingId} className="text-sm font-semibold text-fg">
            {t('items', 'addItem')}
          </h4>
          <ItemFields
            draft={draft}
            onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
            badges={badges}
            currencyCode={eventCurrency}
            nameRef={nameInputRef}
            namePlaceholder={t('items', 'itemNamePlaceholder')}
            badgeTrailing={
              !isCreatingBadge && (
                <IconButton
                  variant="secondary"
                  label={t('items', 'addCustomBadge')}
                  onClick={() => setIsCreatingBadge(true)}
                  className="rounded-full"
                >
                  <Plus />
                </IconButton>
              )
            }
            badgeAccessory={badgeAccessory}
          />
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={closeForm}>
              {t('common', 'close')}
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={!draft.name.trim()}
            >
              {t('common', 'add')}
            </Button>
          </div>
        </Card>
      )}

      {items.length === 0 && !isAdding && (
        <Card>
          <EmptyState
            icon={<ShoppingBag />}
            title={t('items', 'noItems')}
            description={t('items', 'noItemsDesc')}
            className="py-8"
            action={
              <Button onClick={() => setIsAdding(true)}>
                <Plus />
                {t('items', 'addItem')}
              </Button>
            }
          />
        </Card>
      )}

      {items.length > 0 && (
        <Card as="ul" className="divide-y divide-line overflow-hidden">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              eventCurrency={eventCurrency}
              badge={getBadgeById(item.badgeId)}
              badges={badges}
              onToggle={() => toggleItemCheck(item.id)}
              onUpdate={(data) => updateItem(item.id, data)}
              onDelete={() => void handleDelete(item)}
            />
          ))}
        </Card>
      )}

      {hasImages && imageUrls && (
        <OCRModal
          isOpen={isOCRModalOpen}
          onClose={() => setIsOCRModalOpen(false)}
          imageUrls={imageUrls}
          currency={eventCurrency}
          onItemsSelected={handleOCRItemsSelected}
          onOpenSettings={onOpenSettings}
        />
      )}
    </section>
  );
}

interface ItemFieldsProps {
  draft: ItemDraft;
  onChange: (patch: Partial<ItemDraft>) => void;
  badges: BadgeRecord[];
  currencyCode: string;
  nameRef?: RefObject<HTMLInputElement | null>;
  namePlaceholder?: string;
  autoFocusName?: boolean;
  /** Rendered after the badge chips (e.g. "add custom badge"). */
  badgeTrailing?: ReactNode;
  /** Rendered below the badge chips (e.g. the new-badge input). */
  badgeAccessory?: ReactNode;
}

function ItemFields({
  draft,
  onChange,
  badges,
  currencyCode,
  nameRef,
  namePlaceholder,
  autoFocusName,
  badgeTrailing,
  badgeAccessory,
}: ItemFieldsProps) {
  return (
    <>
      <Field label={t('items', 'itemName')} required>
        <Input
          ref={nameRef}
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={namePlaceholder}
          autoFocus={autoFocusName}
        />
      </Field>
      <div className="flex gap-2">
        <Field label={t('items', 'price')} className="flex-1">
          <Input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={draft.price}
            onChange={(e) => onChange({ price: e.target.value })}
            placeholder={t('items', 'pricePlaceholder')}
            trailing={currencyCode}
            className="tabular-nums"
          />
        </Field>
        <Field label={t('items', 'quantity')} group className="w-36 shrink-0">
          <Stepper
            value={draft.quantity}
            onChange={(quantity) => onChange({ quantity })}
            max={MAX_QUANTITY}
          />
        </Field>
      </div>
      <Field label={t('items', 'badge')} group>
        <div className="flex flex-wrap items-center gap-1.5">
          <SegmentedControl
            variant="chips"
            value={draft.badgeId}
            onChange={(badgeId) => onChange({ badgeId })}
            options={badges.map((badge) => ({
              value: badge.id,
              label: getBadgeLabel(badge),
              color: badge.color,
            }))}
          />
          {badgeTrailing}
        </div>
        {badgeAccessory}
      </Field>
    </>
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
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const nameId = useId();
  const detailsId = useId();
  const itemCurrency = resolveItemCurrency(item, eventCurrency);

  if (draft) {
    const handleSave = async (event: FormEvent) => {
      event.preventDefault();
      if (!draft.name.trim()) return;
      await onUpdate({
        name: draft.name.trim(),
        price: parsePriceInput(draft.price),
        quantity: Math.max(1, draft.quantity),
        badgeId: draft.badgeId,
      });
      setDraft(null);
    };

    return (
      <li className="bg-surface-sunken/60 p-3">
        <form onSubmit={handleSave} className="space-y-3">
          <ItemFields
            draft={draft}
            onChange={(patch) =>
              setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
            }
            badges={badges}
            currencyCode={itemCurrency}
            autoFocusName
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => setDraft(null)}
            >
              {t('common', 'cancel')}
            </Button>
            <Button
              type="submit"
              size="sm"
              className="flex-1"
              disabled={!draft.name.trim()}
            >
              {t('common', 'save')}
            </Button>
          </div>
        </form>
      </li>
    );
  }

  const showOriginal =
    item.originalName !== null && item.originalName !== item.name;

  return (
    <li className="group flex items-start gap-1 py-0.5 pr-2 pl-0.5">
      <label className="flex min-w-0 flex-1 cursor-pointer items-start">
        <Checkbox
          checked={item.checked}
          onCheckedChange={onToggle}
          aria-labelledby={nameId}
          aria-describedby={detailsId}
        />
        <span className="min-w-0 flex-1 py-3 pr-1">
          <span
            id={nameId}
            className={cn(
              'block text-sm leading-5 break-words',
              item.checked ? 'text-fg-subtle line-through' : 'text-fg'
            )}
          >
            {item.name}
          </span>
          <span id={detailsId} className="block">
            {showOriginal && (
              <span className="mt-0.5 block truncate text-xs text-fg-subtle">
                {item.originalName}
              </span>
            )}
            {(badge || item.option) && (
              <span className="mt-1.5 flex flex-wrap items-center gap-1">
                {badge && (
                  <Badge color={badge.color}>{getBadgeLabel(badge)}</Badge>
                )}
                {item.option && <Badge tone="neutral">{item.option}</Badge>}
              </span>
            )}
          </span>
        </span>
      </label>
      <div className="flex shrink-0 flex-col items-end gap-0.5 pt-3">
        {item.price !== null && (
          <span
            className={cn(
              'text-sm leading-5 font-semibold tabular-nums',
              item.checked ? 'text-fg-subtle' : 'text-fg'
            )}
          >
            {formatPrice(item.price, itemCurrency)}
          </span>
        )}
        {item.quantity > 1 && (
          <span className="text-xs text-fg-muted tabular-nums">
            ×{item.quantity}
          </span>
        )}
        {/* gap-3: the 44px hit areas of the 32px buttons must not overlap. */}
        <div className="flex gap-3 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 touch:opacity-100">
          <IconButton
            size="sm"
            label={t('common', 'edit')}
            onClick={() =>
              setDraft({
                name: item.name,
                price: item.price?.toString() ?? '',
                quantity: item.quantity,
                badgeId: item.badgeId,
              })
            }
          >
            <Pencil />
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
    </li>
  );
}
