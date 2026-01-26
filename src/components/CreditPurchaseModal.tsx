import { useState, useEffect } from 'react';
import { X, CreditCard, Loader2, Check } from 'lucide-react';
import { apiClient, type CreditPackage } from '../lib/api-client';
import { useAuthStore } from '../stores/useAuthStore';

interface CreditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PaymentMethod = 'stripe' | 'toss';

export function CreditPurchaseModal({
  isOpen,
  onClose,
}: CreditPurchaseModalProps) {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('toss');
  const [loading, setLoading] = useState(false);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const { credits, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isOpen) {
      loadPackages();
    }
  }, [isOpen]);

  async function loadPackages() {
    setLoadingPackages(true);
    try {
      const result = await apiClient.getPackages();
      setPackages(result.packages);
      const popular = result.packages.find((p) => p.popular);
      if (popular) setSelectedPackage(popular.id);
    } catch {
      setPackages([]);
    } finally {
      setLoadingPackages(false);
    }
  }

  async function handlePurchase() {
    if (!selectedPackage || !isAuthenticated) return;

    setLoading(true);
    try {
      const successUrl = chrome.runtime.getURL(
        'sidepanel.html?payment=success'
      );
      const cancelUrl = chrome.runtime.getURL('sidepanel.html?payment=cancel');

      let checkoutUrl: string | undefined;

      if (paymentMethod === 'stripe') {
        const result = await apiClient.checkoutStripe(
          selectedPackage,
          successUrl,
          cancelUrl
        );
        checkoutUrl = result.url;
      } else {
        const result = await apiClient.checkoutToss(
          selectedPackage,
          successUrl,
          cancelUrl
        );
        checkoutUrl = result.checkoutUrl;
      }

      if (checkoutUrl) {
        chrome.tabs.create({ url: checkoutUrl });
        onClose();
      }
    } catch (error) {
      console.error('Payment error:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">크레딧 구매</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-4 p-3 bg-amber-50 rounded-lg">
            <p className="text-sm text-amber-800">
              현재 보유:{' '}
              <span className="font-bold">{credits.toLocaleString()}</span>{' '}
              크레딧
            </p>
          </div>

          {loadingPackages ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg.id)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left relative ${
                    selectedPackage === pkg.id
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {pkg.popular && (
                    <span className="absolute -top-2 right-3 px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full">
                      인기
                    </span>
                  )}
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{pkg.name}</p>
                      <p className="text-sm text-gray-500">
                        {pkg.credits.toLocaleString()} 크레딧
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">
                        ₩{pkg.priceKRW.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400">${pkg.priceUSD}</p>
                    </div>
                  </div>
                  {selectedPackage === pkg.id && (
                    <div className="absolute top-4 left-4">
                      <Check className="w-5 h-5 text-amber-500" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-2">결제 수단</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPaymentMethod('toss')}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                  paymentMethod === 'toss'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200'
                }`}
              >
                <span className="text-sm font-medium">토스페이먼츠</span>
              </button>
              <button
                onClick={() => setPaymentMethod('stripe')}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                  paymentMethod === 'stripe'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200'
                }`}
              >
                <span className="text-sm font-medium">Stripe (해외카드)</span>
              </button>
            </div>
          </div>

          <button
            onClick={handlePurchase}
            disabled={!selectedPackage || loading || !isAuthenticated}
            className="w-full py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                결제하기
              </>
            )}
          </button>

          {!isAuthenticated && (
            <p className="text-center text-sm text-red-500 mt-2">
              로그인이 필요합니다
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
