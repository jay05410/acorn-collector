import { X, Sparkles, Key, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { AnalysisMethod } from '@/lib/ai';
import { t } from '@/lib/i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (method: AnalysisMethod) => void;
  creditCost: number;
  credits: number;
  hasApiKey: boolean;
  hasCredits: boolean;
  onOpenSettings?: () => void;
  onOpenPurchase?: () => void;
}

export function AnalysisMethodModal({
  isOpen,
  onClose,
  onSelect,
  creditCost,
  credits,
  hasApiKey,
  hasCredits,
  onOpenSettings,
  onOpenPurchase,
}: Props) {
  if (!isOpen) return null;

  const noMethods = !hasApiKey && !hasCredits;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-sm mx-4 overflow-hidden animate-slideUp">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('analysis', 'chooseMethod')}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 space-y-3">
          {noMethods ? (
            <div className="text-center py-4 space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('analysis', 'noMethod')}
              </p>
              <div className="flex gap-2 justify-center">
                {onOpenSettings && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onClose();
                      onOpenSettings();
                    }}
                  >
                    <Key className="w-4 h-4 mr-1" />
                    {t('analysis', 'goToSettings')}
                  </Button>
                )}
                {onOpenPurchase && (
                  <Button
                    size="sm"
                    onClick={() => {
                      onClose();
                      onOpenPurchase();
                    }}
                  >
                    <ShoppingCart className="w-4 h-4 mr-1" />
                    {t('analysis', 'buyCredits')}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              {hasApiKey && (
                <button
                  onClick={() => onSelect('direct')}
                  className="w-full p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-primary dark:hover:border-primary transition-all text-left"
                >
                  <div className="flex items-start gap-3">
                    <Key className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {t('analysis', 'methodDirect')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('analysis', 'methodDirectDesc')}
                      </p>
                    </div>
                  </div>
                </button>
              )}

              {hasCredits ? (
                <button
                  onClick={() => onSelect('credit')}
                  className="w-full p-4 rounded-lg border-2 border-primary/30 bg-primary/5 hover:border-primary transition-all text-left"
                >
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {t('analysis', 'methodCredit')} ({creditCost}{' '}
                        {t('analysis', 'creditsUnit')})
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('analysis', 'methodCreditDesc')}
                      </p>
                      <p className="text-xs text-primary mt-1">
                        {t('analysis', 'currentCredits')}: {credits}
                      </p>
                    </div>
                  </div>
                </button>
              ) : (
                <div className="w-full p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600 opacity-60">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-500 dark:text-gray-400">
                        {t('analysis', 'methodCredit')} ({creditCost}{' '}
                        {t('analysis', 'creditsUnit')})
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {t('analysis', 'noCredits')}
                      </p>
                      {onOpenPurchase && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                            onOpenPurchase();
                          }}
                        >
                          <ShoppingCart className="w-3 h-3 mr-1" />
                          {t('analysis', 'buyCredits')}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
