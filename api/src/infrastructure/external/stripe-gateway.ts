import Stripe from 'stripe';
import type {
  PaymentGateway,
  PaymentVerification,
} from '../../domain/usecases/purchase-credits';
import { getPackageById } from '../../config/pricing';

export class StripeGateway implements PaymentGateway {
  private stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey);
  }

  async createCheckoutSession(
    userId: string,
    packageId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ sessionId: string; url: string }> {
    const pkg = getPackageById(packageId);
    if (!pkg) throw new Error('Invalid package');

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${pkg.name} - ${pkg.credits} Credits`,
              description: `Acorn Collector ${pkg.credits} credits package`,
            },
            unit_amount: Math.round(pkg.priceUSD * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        packageId,
        credits: String(pkg.credits),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return { sessionId: session.id, url: session.url! };
  }

  async verifyPayment(paymentId: string): Promise<PaymentVerification> {
    const session = await this.stripe.checkout.sessions.retrieve(paymentId);

    if (session.payment_status !== 'paid') {
      return { valid: false, amount: 0, currency: '', credits: 0, paymentId };
    }

    const credits = parseInt(session.metadata?.credits || '0', 10);

    return {
      valid: true,
      amount: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      credits,
      paymentId,
    };
  }

  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }
}
