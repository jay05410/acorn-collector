export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  GEMINI_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  TOSS_SECRET_KEY: string;
  TOSS_WEBHOOK_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  TWITTER_CLIENT_ID: string;
  TWITTER_CLIENT_SECRET: string;
}

export interface CreditCost {
  images1: number;
  images2: number;
  images3: number;
  images4: number;
}

export const CREDIT_COSTS: CreditCost = {
  images1: 10,
  images2: 15,
  images3: 20,
  images4: 25,
};

export function getCreditCost(imageCount: number): number {
  const key =
    `images${Math.min(Math.max(imageCount, 1), 4)}` as keyof CreditCost;
  return CREDIT_COSTS[key];
}
