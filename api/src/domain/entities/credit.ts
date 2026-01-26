export interface CreditBalance {
  userId: string;
  balance: number;
  updatedAt: Date;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  type: TransactionType;
  description: string | null;
  referenceId: string | null;
  createdAt: Date;
}

export type TransactionType = 'purchase' | 'usage' | 'refund' | 'bonus';

export interface CreateTransactionInput {
  userId: string;
  amount: number;
  type: TransactionType;
  description?: string;
  referenceId?: string;
}
