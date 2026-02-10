const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://acorn-collector-api.workers.dev';

export interface ApiUser {
  id: string;
  email: string;
  name: string | null;
}

export interface CreditBalance {
  balance: number;
  updatedAt: string | null;
}

export interface CreditTransaction {
  id: string;
  amount: number;
  type: 'purchase' | 'usage' | 'refund' | 'bonus';
  description: string | null;
  createdAt: string;
}

export interface AnalysisItem {
  name: string;
  price: number | null;
  category: string | null;
  options?: string[];
}

export interface AnalysisResponse {
  items: AnalysisItem[];
  creditUsed: number;
  remainingCredits: number;
  sessionId?: string;
}

export interface CreditPackage {
  id: string;
  credits: number;
  priceKRW: number;
  priceUSD: number;
  name: string;
  popular?: boolean;
}

export interface CheckoutResponse {
  sessionId?: string;
  url?: string;
  paymentKey?: string;
  checkoutUrl?: string;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null): void {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(response.status, data.error || 'Request failed', data);
    }

    return data as T;
  }

  async login(googleIdToken: string): Promise<{
    user: ApiUser;
    credits: number;
    isNewUser: boolean;
  }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ idToken: googleIdToken }),
    });
  }

  async getBalance(): Promise<CreditBalance> {
    return this.request('/credits/balance');
  }

  async getTransactions(
    limit = 50
  ): Promise<{ transactions: CreditTransaction[] }> {
    return this.request(`/credits/transactions?limit=${limit}`);
  }

  async analyzeImages(imageUrls: string[], language?: string): Promise<AnalysisResponse> {
    return this.request('/analysis', {
      method: 'POST',
      body: JSON.stringify({ imageUrls, language }),
    });
  }

  async getAnalysisCost(
    imageCount: number
  ): Promise<{ imageCount: number; creditCost: number }> {
    return this.request(`/analysis/cost?images=${imageCount}`);
  }

  async getPackages(): Promise<{ packages: CreditPackage[] }> {
    return this.request('/payments/packages');
  }

  async checkoutStripe(
    packageId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<CheckoutResponse> {
    return this.request('/payments/checkout/stripe', {
      method: 'POST',
      body: JSON.stringify({ packageId, successUrl, cancelUrl }),
    });
  }

  async checkoutToss(
    packageId: string,
    successUrl: string,
    failUrl: string
  ): Promise<CheckoutResponse> {
    return this.request('/payments/checkout/toss', {
      method: 'POST',
      body: JSON.stringify({ packageId, successUrl, failUrl }),
    });
  }

  async confirmToss(
    paymentKey: string,
    orderId: string,
    amount: number
  ): Promise<{ success: boolean; balance: number }> {
    return this.request('/payments/confirm/toss', {
      method: 'POST',
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
  }
}

export const apiClient = new ApiClient();
export { ApiError };
