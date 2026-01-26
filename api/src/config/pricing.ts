export interface CreditPackage {
  id: string;
  credits: number;
  priceKRW: number;
  priceUSD: number;
  name: string;
  popular?: boolean;
}

export interface PricingConfig {
  packages: CreditPackage[];
  analysisCosts: Record<number, number>;
  defaultCost: number;
}

const DEFAULT_CONFIG: PricingConfig = {
  packages: [
    {
      id: 'starter',
      credits: 500,
      priceKRW: 990,
      priceUSD: 0.99,
      name: 'Starter',
    },
    {
      id: 'basic',
      credits: 2000,
      priceKRW: 2900,
      priceUSD: 2.49,
      name: 'Basic',
      popular: true,
    },
    { id: 'pro', credits: 10000, priceKRW: 9900, priceUSD: 7.99, name: 'Pro' },
  ],
  analysisCosts: {
    1: 10,
    2: 15,
    3: 20,
    4: 25,
  },
  defaultCost: 10,
};

let currentConfig: PricingConfig = DEFAULT_CONFIG;

export function getPricingConfig(): PricingConfig {
  return currentConfig;
}

export function updatePricingConfig(config: Partial<PricingConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

export function resetPricingConfig(): void {
  currentConfig = DEFAULT_CONFIG;
}

export function getPackages(): CreditPackage[] {
  return currentConfig.packages;
}

export function getPackageById(id: string): CreditPackage | undefined {
  return currentConfig.packages.find((p) => p.id === id);
}

export function getCreditsPerAnalysis(imageCount: number): number {
  const clampedCount = Math.min(Math.max(imageCount, 1), 4);
  return currentConfig.analysisCosts[clampedCount] ?? currentConfig.defaultCost;
}

export const CREDIT_PACKAGES = DEFAULT_CONFIG.packages;
