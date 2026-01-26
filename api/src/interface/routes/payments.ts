import { Hono } from 'hono';
import type { Env } from '../../config/types';
import type { AuthContext } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import { D1CreditRepository } from '../../infrastructure/database/d1-credit-repository';
import { StripeGateway } from '../../infrastructure/external/stripe-gateway';
import { TossGateway } from '../../infrastructure/external/toss-gateway';
import { PurchaseCreditsUseCase } from '../../domain/usecases/purchase-credits';
import { CREDIT_PACKAGES, getPackageById } from '../../config/pricing';

const payments = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

payments.get('/packages', (c) => {
  return c.json({ packages: CREDIT_PACKAGES });
});

payments.use('/checkout/*', authMiddleware);
payments.use('/webhook/*');

payments.post('/checkout/stripe', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<{
    packageId: string;
    successUrl: string;
    cancelUrl: string;
  }>();

  if (!body.packageId || !body.successUrl || !body.cancelUrl) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const pkg = getPackageById(body.packageId);
  if (!pkg) {
    return c.json({ error: 'Invalid package' }, 400);
  }

  const stripe = new StripeGateway(c.env.STRIPE_SECRET_KEY);
  const session = await stripe.createCheckoutSession(
    auth.userId,
    body.packageId,
    body.successUrl,
    body.cancelUrl
  );

  return c.json(session);
});

payments.post('/checkout/toss', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<{
    packageId: string;
    successUrl: string;
    failUrl: string;
  }>();

  if (!body.packageId || !body.successUrl || !body.failUrl) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const pkg = getPackageById(body.packageId);
  if (!pkg) {
    return c.json({ error: 'Invalid package' }, 400);
  }

  const orderId = `order_${auth.userId}_${Date.now()}`;
  const toss = new TossGateway(c.env.TOSS_SECRET_KEY);
  const payment = await toss.createPayment(
    auth.userId,
    body.packageId,
    orderId,
    body.successUrl,
    body.failUrl
  );

  return c.json(payment);
});

payments.post('/confirm/toss', async (c) => {
  const body = await c.req.json<{
    paymentKey: string;
    orderId: string;
    amount: number;
  }>();

  if (!body.paymentKey || !body.orderId || !body.amount) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const toss = new TossGateway(c.env.TOSS_SECRET_KEY);
  const creditRepo = new D1CreditRepository(c.env.DB);
  const useCase = new PurchaseCreditsUseCase(creditRepo, toss);

  try {
    await toss.confirmPayment(body.paymentKey, body.orderId, body.amount);
    const balance = await useCase.execute(
      extractUserIdFromOrderId(body.orderId),
      body.paymentKey
    );
    return c.json({ success: true, balance: balance.balance });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment failed';
    return c.json({ error: message }, 400);
  }
});

payments.post('/webhook/stripe', async (c) => {
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 400);
  }

  const payload = await c.req.text();
  const stripe = new StripeGateway(c.env.STRIPE_SECRET_KEY);

  try {
    const event = stripe.verifyWebhookSignature(
      payload,
      signature,
      c.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as {
        id: string;
        metadata?: { userId?: string };
      };
      const userId = session.metadata?.userId;

      if (userId) {
        const creditRepo = new D1CreditRepository(c.env.DB);
        const useCase = new PurchaseCreditsUseCase(creditRepo, stripe);
        await useCase.execute(userId, session.id);
      }
    }

    return c.json({ received: true });
  } catch {
    return c.json({ error: 'Webhook verification failed' }, 400);
  }
});

function extractUserIdFromOrderId(orderId: string): string {
  const parts = orderId.split('_');
  return parts[1] || '';
}

export { payments };
