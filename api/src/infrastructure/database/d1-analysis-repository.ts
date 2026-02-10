import type {
  AnalysisRepository,
  AnalysisSession,
} from '../../domain/repositories/analysis-repository';
import type { AnalysisItem } from '../../domain/entities/analysis';

export class D1AnalysisRepository implements AnalysisRepository {
  constructor(private db: D1Database) {}

  async saveSession(
    session: Omit<AnalysisSession, 'createdAt'>,
    items: AnalysisItem[],
    imageUrls: string[]
  ): Promise<AnalysisSession> {
    const now = new Date().toISOString();

    const insertSession = this.db
      .prepare(
        'INSERT INTO analysis_sessions (id, user_id, method, model, credit_cost, image_count, item_count, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        session.id,
        session.userId,
        session.method,
        session.model,
        session.creditCost,
        session.imageCount,
        items.length,
        session.status,
        now
      );

    const itemStatements = items.map((item, index) =>
      this.db
        .prepare(
          'INSERT INTO analysis_items (id, session_id, name, price, category, options, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          crypto.randomUUID(),
          session.id,
          item.name,
          item.price,
          item.category,
          item.options ? JSON.stringify(item.options) : null,
          index,
          now
        )
    );

    const imageStatements = imageUrls.map((url, index) =>
      this.db
        .prepare(
          'INSERT INTO analysis_images (id, session_id, image_url, sort_order) VALUES (?, ?, ?, ?)'
        )
        .bind(crypto.randomUUID(), session.id, url, index)
    );

    await this.db.batch([insertSession, ...itemStatements, ...imageStatements]);

    return {
      ...session,
      itemCount: items.length,
      createdAt: new Date(now),
      items,
      images: imageUrls,
    };
  }

  async getSession(sessionId: string): Promise<AnalysisSession | null> {
    const sessionRow = await this.db
      .prepare('SELECT * FROM analysis_sessions WHERE id = ?')
      .bind(sessionId)
      .first<SessionRow>();

    if (!sessionRow) return null;

    const itemRows = await this.db
      .prepare(
        'SELECT * FROM analysis_items WHERE session_id = ? ORDER BY sort_order'
      )
      .bind(sessionId)
      .all<ItemRow>();

    const imageRows = await this.db
      .prepare(
        'SELECT * FROM analysis_images WHERE session_id = ? ORDER BY sort_order'
      )
      .bind(sessionId)
      .all<ImageRow>();

    return {
      id: sessionRow.id,
      userId: sessionRow.user_id,
      method: sessionRow.method as 'credit' | 'direct',
      model: sessionRow.model,
      creditCost: sessionRow.credit_cost,
      imageCount: sessionRow.image_count,
      itemCount: sessionRow.item_count,
      status: sessionRow.status as 'completed' | 'failed',
      createdAt: new Date(sessionRow.created_at),
      items: itemRows.results.map((row) => ({
        name: row.name,
        price: row.price,
        category: row.category,
        options: row.options ? JSON.parse(row.options) : undefined,
      })),
      images: imageRows.results.map((row) => row.image_url),
    };
  }

  async getUserSessions(
    userId: string,
    limit = 20
  ): Promise<AnalysisSession[]> {
    const rows = await this.db
      .prepare(
        'SELECT * FROM analysis_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
      )
      .bind(userId, limit)
      .all<SessionRow>();

    return rows.results.map((row) => ({
      id: row.id,
      userId: row.user_id,
      method: row.method as 'credit' | 'direct',
      model: row.model,
      creditCost: row.credit_cost,
      imageCount: row.image_count,
      itemCount: row.item_count,
      status: row.status as 'completed' | 'failed',
      createdAt: new Date(row.created_at),
    }));
  }
}

interface SessionRow {
  id: string;
  user_id: string;
  method: string;
  model: string;
  credit_cost: number;
  image_count: number;
  item_count: number;
  status: string;
  created_at: string;
}

interface ItemRow {
  id: string;
  session_id: string;
  name: string;
  price: number | null;
  category: string | null;
  options: string | null;
  sort_order: number;
  created_at: string;
}

interface ImageRow {
  id: string;
  session_id: string;
  image_url: string;
  sort_order: number;
}
