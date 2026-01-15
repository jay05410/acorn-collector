import { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  AlertCircle,
  Check,
  Camera,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { analyzeImages, cancelOCR, type ImageAnalysisItem } from '@/lib/ai';

interface OCRModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrls: string[];
  onItemsSelected: (items: ImageAnalysisItem[]) => void;
}

type OCRStatus = 'idle' | 'loading' | 'success' | 'error';

export function OCRModal({
  isOpen,
  onClose,
  imageUrls,
  onItemsSelected,
}: OCRModalProps) {
  const [status, setStatus] = useState<OCRStatus>('idle');
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [items, setItems] = useState<ImageAnalysisItem[]>([]);
  const [refinedByAI, setRefinedByAI] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set()
  );

  useEffect(() => {
    if (isOpen && imageUrls.length > 0 && status === 'idle') {
      startOCR();
    }
  }, [isOpen, imageUrls]);

  useEffect(() => {
    if (!isOpen) {
      setStatus('idle');
      setProgress('');
      setError('');
      setItems([]);
      setRefinedByAI(false);
      setSelectedIndices(new Set());
    }
  }, [isOpen]);

  const startOCR = async () => {
    setStatus('loading');
    setError('');
    setProgress('OCR 서버 연결 중...');

    try {
      const result = await analyzeImages(imageUrls, {
        onProgress: setProgress,
      });

      if (result && result.items.length > 0) {
        setItems(result.items);
        setRefinedByAI(result.refinedByAI ?? false);
        setSelectedIndices(new Set(result.items.map((_, i) => i)));
        setStatus('success');
      } else {
        setError('이미지에서 상품 정보를 찾을 수 없습니다');
        setStatus('error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류';
      setError(message);
      setStatus('error');
    }
  };

  const handleCancel = () => {
    cancelOCR();
    onClose();
  };

  const handleRetry = () => {
    setStatus('idle');
    startOCR();
  };

  const toggleItem = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedItems = items.filter((_, i) => selectedIndices.has(i));
    onItemsSelected(selectedItems);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && status !== 'loading') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md mx-4 max-h-[80vh] overflow-hidden flex flex-col animate-slideUp">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              이미지 OCR
            </h2>
          </div>
          {status !== 'loading' && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
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
                  OCR 실패
                </p>
                <p className="text-xs text-red-500 dark:text-red-400">
                  {error}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                  닫기
                </Button>
                <Button size="sm" onClick={handleRetry}>
                  다시 시도
                </Button>
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
                      selectedIndices.size === items.length && items.length > 0
                    }
                    onChange={() => {
                      if (selectedIndices.size === items.length) {
                        setSelectedIndices(new Set());
                      } else {
                        setSelectedIndices(new Set(items.map((_, i) => i)));
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    전체 선택 ({items.length}개)
                  </span>
                </label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedIndices.size}개 선택됨
                </span>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="max-h-60 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
                  {items.map((item, index) => (
                    <label
                      key={index}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIndices.has(index)}
                        onChange={() => toggleItem(index)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-900 dark:text-white block truncate">
                          {item.name}
                        </span>
                        {item.category && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {item.category}
                          </span>
                        )}
                      </div>
                      {item.price !== null && item.price > 0 && (
                        <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
                          {item.price.toLocaleString()}원
                        </span>
                      )}
                      {item.price === 0 && (
                        <span className="text-xs text-green-500 flex-shrink-0">
                          무료
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <div className="flex gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    OCR 결과는 부정확할 수 있습니다. 추가 후 직접 확인해주세요.
                    {refinedByAI && ' (AI 보정됨)'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {status === 'success' && (
          <div className="p-4 border-t dark:border-gray-700 flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              취소
            </Button>
            <Button
              onClick={handleConfirm}
              className="flex-1"
              disabled={selectedIndices.size === 0}
            >
              <Check className="w-4 h-4 mr-1" />
              {selectedIndices.size}개 추가
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

const PROGRESS_STEPS = [
  { key: '준비', label: '준비 중...', percent: 5 },
  { key: '연결', label: 'OCR 서버 연결 중...', percent: 15 },
  { key: '분석', label: '이미지 분석 중...', percent: 45 },
  { key: 'AI', label: 'AI로 결과 정제 중...', percent: 80 },
  { key: '완료', label: '완료!', percent: 100 },
] as const;

function LoadingState({
  progress,
  imageCount,
  onCancel,
}: {
  progress: string;
  imageCount: number;
  onCancel: () => void;
}) {
  const [displayPercent, setDisplayPercent] = useState(5);

  const currentStep = PROGRESS_STEPS.find((s) => progress.includes(s.key));
  const targetPercent = currentStep?.percent ?? 5;

  useEffect(() => {
    if (displayPercent >= targetPercent) return;

    const timer = setInterval(() => {
      setDisplayPercent((prev) => {
        if (prev >= targetPercent) {
          clearInterval(timer);
          return targetPercent;
        }
        const remaining = targetPercent - prev;
        const increment = Math.max(1, Math.ceil(remaining / 8));
        return Math.min(prev + increment, targetPercent);
      });
    }, 80);

    return () => clearInterval(timer);
  }, [targetPercent]);

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="relative">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {progress || '준비 중...'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          이미지 {imageCount}장
        </p>
      </div>
      <div className="w-full max-w-xs space-y-2">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span
            className={
              progress.includes('연결') || progress.includes('분석')
                ? 'text-primary font-medium'
                : ''
            }
          >
            OCR
          </span>
          <span
            className={
              progress.includes('AI') ? 'text-primary font-medium' : ''
            }
          >
            AI 보정
          </span>
        </div>
        <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${displayPercent}%` }}
          />
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onCancel}>
        취소
      </Button>
    </div>
  );
}
