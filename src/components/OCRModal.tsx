import { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  AlertCircle,
  Check,
  Camera,
  HelpCircle,
  Plus,
  Minus,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  analyzeImages,
  cancelAnalysis,
  isAIEnabled,
  type ImageAnalysisItem,
  ApiKeyFailedError,
  NoAnalysisMethodError,
} from '@/lib/ai';
import {
  formatPrice,
  getCategoryLabel,
  t,
  tn,
  tp,
  useLanguage,
} from '@/i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  imageUrls: string[];
  /** Currency for displaying extracted prices (the event's currency). */
  currency: string | null;
  onItemsSelected: (items: SelectedItem[]) => void;
  onOpenSettings?: () => void;
}

export interface SelectedItem {
  name: string;
  price: number | null;
  category: string | null;
  selectedOption?: string;
  quantity: number;
}

interface ItemState {
  selected: boolean;
  quantity: number;
  selectedOption?: string;
  editedName?: string;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

export function OCRModal({
  isOpen,
  onClose,
  imageUrls,
  currency,
  onItemsSelected,
  onOpenSettings,
}: Props) {
  useLanguage();
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [items, setItems] = useState<ImageAnalysisItem[]>([]);
  const [itemStates, setItemStates] = useState<Map<number, ItemState>>(
    new Map()
  );
  const [apiKeyFailed, setApiKeyFailed] = useState(false);

  useEffect(() => {
    if (isOpen && imageUrls.length > 0 && status === 'idle') {
      checkCapabilityAndStart();
    }
  }, [isOpen, imageUrls]);

  useEffect(() => {
    if (!isOpen) {
      setStatus('idle');
      setProgress('');
      setError('');
      setItems([]);
      setItemStates(new Map());
      setApiKeyFailed(false);
    }
  }, [isOpen]);

  const checkCapabilityAndStart = async () => {
    if (!(await isAIEnabled())) {
      setApiKeyFailed(true);
      setError(t('errors', 'noAnalysisMethod'));
      setStatus('error');
      return;
    }
    startAnalysis();
  };

  const startAnalysis = async () => {
    setStatus('loading');
    setError('');
    setApiKeyFailed(false);

    try {
      const result = await analyzeImages(imageUrls, {
        onProgress: setProgress,
      });

      if (result && result.items.length > 0) {
        setItems(result.items);
        const states = new Map<number, ItemState>();
        result.items.forEach((item, i) => {
          states.set(i, {
            selected: true,
            quantity: 1,
            selectedOption: item.options?.[0],
          });
        });
        setItemStates(states);
        setStatus('success');
      } else {
        setError(t('analysis', 'noItems'));
        setStatus('error');
      }
    } catch (err) {
      if (err instanceof ApiKeyFailedError) {
        setApiKeyFailed(true);
        setError(t('errors', 'apiKeyInvalid'));
      } else if (err instanceof NoAnalysisMethodError) {
        setApiKeyFailed(true);
        setError(t('errors', 'noAnalysisMethod'));
      } else {
        setError(err instanceof Error ? err.message : t('errors', 'unknown'));
      }
      setStatus('error');
    }
  };

  const handleReanalyze = () => {
    cancelAnalysis();
    setItems([]);
    setItemStates(new Map());
    checkCapabilityAndStart();
  };

  const handleCancel = () => {
    cancelAnalysis();
    onClose();
  };

  const handleConfirm = () => {
    const selectedItems: SelectedItem[] = [];
    items.forEach((item, i) => {
      const state = itemStates.get(i);
      if (state?.selected) {
        const baseName = state.editedName || item.name;
        selectedItems.push({
          name: state.selectedOption
            ? `${baseName} (${state.selectedOption})`
            : baseName,
          price: item.price,
          category: item.category,
          selectedOption: state.selectedOption,
          quantity: state.quantity,
        });
      }
    });
    onItemsSelected(selectedItems);
    onClose();
  };

  const toggleItem = (index: number) => {
    setItemStates((prev) => {
      const next = new Map(prev);
      const current = next.get(index);
      if (current) {
        next.set(index, { ...current, selected: !current.selected });
      }
      return next;
    });
  };

  const updateQuantity = (index: number, delta: number) => {
    setItemStates((prev) => {
      const next = new Map(prev);
      const current = next.get(index);
      if (current) {
        const newQty = Math.max(1, Math.min(99, current.quantity + delta));
        next.set(index, { ...current, quantity: newQty });
      }
      return next;
    });
  };

  const updateOption = (index: number, option: string) => {
    setItemStates((prev) => {
      const next = new Map(prev);
      const current = next.get(index);
      if (current) {
        next.set(index, { ...current, selectedOption: option });
      }
      return next;
    });
  };

  const updateName = (index: number, name: string) => {
    setItemStates((prev) => {
      const next = new Map(prev);
      const current = next.get(index);
      if (current) {
        next.set(index, { ...current, editedName: name });
      }
      return next;
    });
  };

  const toggleAll = () => {
    const allSelected = Array.from(itemStates.values()).every(
      (s) => s.selected
    );
    setItemStates((prev) => {
      const next = new Map(prev);
      next.forEach((state, key) => {
        next.set(key, { ...state, selected: !allSelected });
      });
      return next;
    });
  };

  const selectedCount = Array.from(itemStates.values()).filter(
    (s) => s.selected
  ).length;

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn"
        onClick={(e) =>
          e.target === e.currentTarget &&
          status !== 'loading' &&
          onClose()
        }
      >
        <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md mx-4 max-h-[80vh] overflow-hidden flex flex-col animate-slideUp">
          <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('analysis', 'title')}
              </h2>
            </div>
            {status !== 'loading' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label={t('common', 'close')}
              >
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {status === 'idle' && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
              </div>
            )}

            {status === 'loading' && (
              <LoadingState
                progress={progress}
                imageCount={imageUrls.length}
                onCancel={handleCancel}
              />
            )}

            {status === 'error' && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <AlertCircle className="w-12 h-12 text-red-500" />
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {t('analysis', 'failed')}
                  </p>
                  <p className="text-xs text-red-500 dark:text-red-400">
                    {error}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={onClose}>
                    {t('common', 'close')}
                  </Button>
                  {apiKeyFailed && onOpenSettings ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        onClose();
                        onOpenSettings();
                      }}
                    >
                      {t('analysis', 'goToSettings')}
                    </Button>
                  ) : (
                    <Button size="sm" onClick={handleReanalyze}>
                      {t('common', 'retry')}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {status === 'success' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        selectedCount === items.length && items.length > 0
                      }
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {t('analysis', 'selectAll')} ({items.length})
                    </span>
                  </label>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {tp('analysis', 'selectedCount', { count: selectedCount })}
                  </span>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
                    {items.map((item, index) => (
                      <ProductItem
                        key={index}
                        item={item}
                        currency={currency}
                        state={itemStates.get(index)!}
                        onToggle={() => toggleItem(index)}
                        onQuantityChange={(delta) =>
                          updateQuantity(index, delta)
                        }
                        onOptionChange={(option) =>
                          updateOption(index, option)
                        }
                        onNameChange={(name) => updateName(index, name)}
                      />
                    ))}
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <div className="flex gap-2">
                    <HelpCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      {t('analysis', 'warning')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {status === 'success' && (
            <div className="p-4 border-t dark:border-gray-700 flex gap-2">
              <Button
                variant="outline"
                onClick={handleReanalyze}
                size="icon"
                title={t('analysis', 'reanalyze')}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={onClose} className="flex-1">
                {t('common', 'cancel')}
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex-1"
                disabled={selectedCount === 0}
              >
                <Check className="w-4 h-4 mr-1" />
                {tp('analysis', 'addCount', { count: selectedCount })}
              </Button>
            </div>
          )}
        </div>
      </div>

    </>
  );
}

function ProductItem({
  item,
  currency,
  state,
  onToggle,
  onQuantityChange,
  onOptionChange,
  onNameChange,
}: {
  item: ImageAnalysisItem;
  currency: string | null;
  state: ItemState;
  onToggle: () => void;
  onQuantityChange: (delta: number) => void;
  onOptionChange: (option: string) => void;
  onNameChange: (name: string) => void;
}) {
  const [optionOpen, setOptionOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(state.editedName || item.name);
  const hasOptions = item.options && item.options.length > 0;
  const displayName = state.editedName || item.name;

  const handleNameSave = () => {
    if (editValue.trim()) {
      onNameChange(editValue.trim());
    } else {
      setEditValue(displayName);
    }
    setIsEditing(false);
  };

  return (
    <div className={`px-3 py-2 ${state.selected ? 'bg-primary/5' : ''}`}>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={state.selected}
          onChange={onToggle}
          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer flex-shrink-0"
        />

        <div className="flex-1 min-w-0 flex items-center gap-2">
          {isEditing ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSave();
                if (e.key === 'Escape') {
                  setEditValue(displayName);
                  setIsEditing(false);
                }
              }}
              className="flex-1 text-sm font-medium bg-white dark:bg-gray-700 border border-primary rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          ) : (
            <span
              onClick={() => setIsEditing(true)}
              className="text-sm font-medium text-gray-900 dark:text-white truncate cursor-pointer hover:text-primary"
              title={t('analysis', 'clickToEdit')}
            >
              {displayName}
            </span>
          )}
          {item.category && !isEditing && (
            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
              {getCategoryLabel(item.category)}
            </span>
          )}
        </div>

        {state.selected && hasOptions && (
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setOptionOpen(!optionOpen)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <span className="max-w-16 truncate">
                {state.selectedOption || item.options![0]}
              </span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {optionOpen && (
              <div className="absolute right-0 z-10 mt-1 w-32 max-h-32 overflow-y-auto bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded shadow-lg">
                {item.options!.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      onOptionChange(opt);
                      setOptionOpen(false);
                    }}
                    className={`w-full px-2 py-1 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-600 ${
                      state.selectedOption === opt
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {state.selected && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={() => onQuantityChange(-1)}
              disabled={state.quantity <= 1}
              className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40"
            >
              <Minus className="w-2.5 h-2.5" />
            </button>
            <span className="w-5 text-center text-xs font-medium">
              {state.quantity}
            </span>
            <button
              onClick={() => onQuantityChange(1)}
              disabled={state.quantity >= 99}
              className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40"
            >
              <Plus className="w-2.5 h-2.5" />
            </button>
          </div>
        )}

        <div className="flex-shrink-0 text-right min-w-12">
          {item.price !== null && item.price > 0 && (
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {formatPrice(item.price, currency)}
            </span>
          )}
          {item.price === 0 && (
            <span className="text-xs text-green-500">
              {t('common', 'free')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingState({
  progress,
  imageCount,
  onCancel,
}: {
  progress: string;
  imageCount: number;
  onCancel: () => void;
}) {
  const [displayPercent, setDisplayPercent] = useState(0);
  const targetPercent = parseInt(progress) || 0;

  useEffect(() => {
    if (displayPercent >= targetPercent) return;

    const timer = setInterval(() => {
      setDisplayPercent((prev) => {
        if (prev >= targetPercent) return targetPercent;
        const step = Math.max(1, Math.ceil((targetPercent - prev) / 5));
        return Math.min(prev + step, targetPercent);
      });
    }, 50);

    return () => clearInterval(timer);
  }, [targetPercent, displayPercent]);

  const getStatusText = () => {
    if (targetPercent <= 10) return t('analysis', 'analyzing');
    if (targetPercent <= 40) return t('analysis', 'downloading');
    if (targetPercent <= 90) return t('analysis', 'processing');
    return t('analysis', 'complete');
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className="w-12 h-12 text-primary animate-spin" />
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {getStatusText()}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {tn('analysis', 'analyzingImages', imageCount)}
        </p>
      </div>
      <div className="w-full max-w-xs">
        <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-150 ease-out"
            style={{ width: `${displayPercent}%` }}
          />
        </div>
        <p className="text-xs text-center text-gray-400 mt-1">
          {displayPercent}%
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onCancel}>
        {t('common', 'cancel')}
      </Button>
    </div>
  );
}
