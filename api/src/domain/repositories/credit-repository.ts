import type {
  CreditBalance,
  CreditTransaction,
  CreateTransactionInput,
} from '../entities/credit';

export interface CreditRepository {
  getBalance(userId: string): Promise<CreditBalance | null>;
  initializeBalance(userId: string): Promise<CreditBalance>;
  addCredits(userId: string, amount: number): Promise<CreditBalance>;
  deductCredits(userId: string, amount: number): Promise<CreditBalance>;
  createTransaction(input: CreateTransactionInput): Promise<CreditTransaction>;
  getTransactions(userId: string, limit?: number): Promise<CreditTransaction[]>;
  addCreditsWithTransaction(
    userId: string,
    amount: number,
    input: CreateTransactionInput
  ): Promise<CreditBalance>;
  deductCreditsWithTransaction(
    userId: string,
    amount: number,
    input: CreateTransactionInput
  ): Promise<CreditBalance>;
  findTransactionByReference(referenceId: string): Promise<CreditTransaction | null>;
}
