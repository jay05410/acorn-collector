import type { CreditRepository } from '../../domain/repositories/credit-repository';
import type {
  CreditBalance,
  CreditTransaction,
  CreateTransactionInput,
} from '../../domain/entities/credit';

export class D1CreditRepository implements CreditRepository {
  constructor(private db: D1Database) {}

  async getBalance(userId: string): Promise<CreditBalance | null> {
    const row = await this.db
      .prepare('SELECT * FROM credit_balances WHERE user_id = ?')
      .bind(userId)
      .first<BalanceRow>();
    return row ? this.mapToBalance(row) : null;
  }

  async initializeBalance(userId: string): Promise<CreditBalance> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        'INSERT INTO credit_balances (user_id, balance, updated_at) VALUES (?, 0, ?)'
      )
      .bind(userId, now)
      .run();

    return {
      userId,
      balance: 0,
      updatedAt: new Date(now),
    };
  }

  async addCredits(userId: string, amount: number): Promise<CreditBalance> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        'UPDATE credit_balances SET balance = balance + ?, updated_at = ? WHERE user_id = ?'
      )
      .bind(amount, now, userId)
      .run();

    const balance = await this.getBalance(userId);
    if (!balance) throw new Error('Balance not found after update');
    return balance;
  }

  async deductCredits(userId: string, amount: number): Promise<CreditBalance> {
    const now = new Date().toISOString();
    const result = await this.db
      .prepare(
        'UPDATE credit_balances SET balance = balance - ?, updated_at = ? WHERE user_id = ? AND balance >= ?'
      )
      .bind(amount, now, userId, amount)
      .run();

    if (!result.meta.changes) {
      throw new Error('Insufficient credits or user not found');
    }

    const balance = await this.getBalance(userId);
    if (!balance) throw new Error('Balance not found after update');
    return balance;
  }

  async createTransaction(
    input: CreateTransactionInput
  ): Promise<CreditTransaction> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        'INSERT INTO credit_transactions (id, user_id, amount, type, description, reference_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        id,
        input.userId,
        input.amount,
        input.type,
        input.description ?? null,
        input.referenceId ?? null,
        now
      )
      .run();

    return {
      id,
      userId: input.userId,
      amount: input.amount,
      type: input.type,
      description: input.description ?? null,
      referenceId: input.referenceId ?? null,
      createdAt: new Date(now),
    };
  }

  async getTransactions(
    userId: string,
    limit = 50
  ): Promise<CreditTransaction[]> {
    const rows = await this.db
      .prepare(
        'SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
      )
      .bind(userId, limit)
      .all<TransactionRow>();

    return rows.results.map(this.mapToTransaction);
  }

  async addCreditsWithTransaction(
    userId: string,
    amount: number,
    input: CreateTransactionInput
  ): Promise<CreditBalance> {
    const txId = crypto.randomUUID();
    const now = new Date().toISOString();

    const updateBalance = this.db
      .prepare(
        'UPDATE credit_balances SET balance = balance + ?, updated_at = ? WHERE user_id = ?'
      )
      .bind(amount, now, userId);

    const insertTx = this.db
      .prepare(
        'INSERT INTO credit_transactions (id, user_id, amount, type, description, reference_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        txId,
        input.userId,
        input.amount,
        input.type,
        input.description ?? null,
        input.referenceId ?? null,
        now
      );

    await this.db.batch([updateBalance, insertTx]);

    const balance = await this.getBalance(userId);
    if (!balance) throw new Error('Balance not found after update');
    return balance;
  }

  async deductCreditsWithTransaction(
    userId: string,
    amount: number,
    input: CreateTransactionInput
  ): Promise<CreditBalance> {
    const txId = crypto.randomUUID();
    const now = new Date().toISOString();

    const updateBalance = this.db
      .prepare(
        'UPDATE credit_balances SET balance = balance - ?, updated_at = ? WHERE user_id = ? AND balance >= ?'
      )
      .bind(amount, now, userId, amount);

    const insertTx = this.db
      .prepare(
        'INSERT INTO credit_transactions (id, user_id, amount, type, description, reference_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        txId,
        input.userId,
        input.amount,
        input.type,
        input.description ?? null,
        input.referenceId ?? null,
        now
      );

    const results = await this.db.batch([updateBalance, insertTx]);

    if (!results[0].meta.changes) {
      throw new Error('Insufficient credits or user not found');
    }

    const balance = await this.getBalance(userId);
    if (!balance) throw new Error('Balance not found after update');
    return balance;
  }

  async findTransactionByReference(
    referenceId: string
  ): Promise<CreditTransaction | null> {
    const row = await this.db
      .prepare(
        'SELECT * FROM credit_transactions WHERE reference_id = ? LIMIT 1'
      )
      .bind(referenceId)
      .first<TransactionRow>();
    return row ? this.mapToTransaction(row) : null;
  }

  private mapToBalance(row: BalanceRow): CreditBalance {
    return {
      userId: row.user_id,
      balance: row.balance,
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapToTransaction(row: TransactionRow): CreditTransaction {
    return {
      id: row.id,
      userId: row.user_id,
      amount: row.amount,
      type: row.type as CreditTransaction['type'],
      description: row.description,
      referenceId: row.reference_id,
      createdAt: new Date(row.created_at),
    };
  }
}

interface BalanceRow {
  user_id: string;
  balance: number;
  updated_at: string;
}

interface TransactionRow {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  description: string | null;
  reference_id: string | null;
  created_at: string;
}
