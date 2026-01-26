import type {
  PaymentGateway,
  PaymentVerification,
} from '../../domain/usecases/purchase-credits';
import { getPackageById } from '../../config/pricing';

const TOSS_API_BASE = 'https://api.tosspayments.com/v1';

export class TossGateway implements PaymentGateway {
  private secretKey: string;

  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  private getAuthHeader(): string {
    return `Basic ${btoa(this.secretKey + ':')}`;
  }

  async createPayment(
    userId: string,
    packageId: string,
    orderId: string,
    successUrl: string,
    failUrl: string
  ): Promise<{ paymentKey: string; checkoutUrl: string }> {
    const pkg = getPackageById(packageId);
    if (!pkg) throw new Error('Invalid package');

    const response = await fetch(`${TOSS_API_BASE}/payments`, {
      method: 'POST',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: pkg.priceKRW,
        orderId,
        orderName: `${pkg.name} - ${pkg.credits} 크레딧`,
        successUrl,
        failUrl,
        metadata: {
          userId,
          packageId,
          credits: pkg.credits,
        },
      }),
    });

    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      throw new Error(error.message || 'Failed to create payment');
    }

    const data = (await response.json()) as TossPaymentResponse;
    return { paymentKey: data.paymentKey, checkoutUrl: data.checkout.url };
  }

  async confirmPayment(
    paymentKey: string,
    orderId: string,
    amount: number
  ): Promise<TossPaymentResponse> {
    const response = await fetch(`${TOSS_API_BASE}/payments/confirm`, {
      method: 'POST',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      throw new Error(error.message || 'Payment confirmation failed');
    }

    return response.json() as Promise<TossPaymentResponse>;
  }

  async verifyPayment(paymentId: string): Promise<PaymentVerification> {
    const response = await fetch(`${TOSS_API_BASE}/payments/${paymentId}`, {
      headers: { Authorization: this.getAuthHeader() },
    });

    if (!response.ok) {
      return {
        valid: false,
        amount: 0,
        currency: 'KRW',
        credits: 0,
        paymentId,
      };
    }

    const data = (await response.json()) as TossPaymentResponse;

    if (data.status !== 'DONE') {
      return {
        valid: false,
        amount: 0,
        currency: 'KRW',
        credits: 0,
        paymentId,
      };
    }

    const credits = data.metadata?.credits ?? 0;

    return {
      valid: true,
      amount: data.totalAmount,
      currency: 'KRW',
      credits,
      paymentId,
    };
  }
}

interface TossPaymentResponse {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount: number;
  checkout: { url: string };
  metadata?: { userId?: string; packageId?: string; credits?: number };
}
