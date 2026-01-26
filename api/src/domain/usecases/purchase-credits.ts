import type { CreditRepository } from '../repositories/credit-repository';
import type { CreditBalance } from '../entities/credit';

export interface PaymentGateway {
  verifyPayment(paymentId: string): Promise<PaymentVerification>;
}

export interface PaymentVerification {
  valid: boolean;
  amount: number;
  currency: string;
  credits: number;
  paymentId: string;
}

export class PurchaseCreditsUseCase {
  constructor(
    private creditRepository: CreditRepository,
    private paymentGateway: PaymentGateway
  ) {}

  async execute(userId: string, paymentId: string): Promise<CreditBalance> {
    const verification = await this.paymentGateway.verifyPayment(paymentId);

    if (!verification.valid) {
      throw new InvalidPaymentError(paymentId);
    }

    const balance = await this.creditRepository.addCredits(
      userId,
      verification.credits
    );

    await this.creditRepository.createTransaction({
      userId,
      amount: verification.credits,
      type: 'purchase',
      description: `Purchased ${verification.credits} credits`,
      referenceId: paymentId,
    });

    return balance;
  }
}

export class InvalidPaymentError extends Error {
  constructor(public paymentId: string) {
    super(`Invalid payment: ${paymentId}`);
    this.name = 'InvalidPaymentError';
  }
}
