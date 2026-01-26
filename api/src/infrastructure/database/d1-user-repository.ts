import type { UserRepository } from '../../domain/repositories/user-repository';
import type { User, CreateUserInput } from '../../domain/entities/user';

export class D1UserRepository implements UserRepository {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(id)
      .first<UserRow>();
    return row ? this.mapToUser(row) : null;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    const row = await this.db
      .prepare('SELECT * FROM users WHERE google_id = ?')
      .bind(googleId)
      .first<UserRow>();
    return row ? this.mapToUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(email)
      .first<UserRow>();
    return row ? this.mapToUser(row) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        'INSERT INTO users (id, google_id, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(id, input.googleId, input.email, input.name, now, now)
      .run();

    return {
      id,
      googleId: input.googleId,
      email: input.email,
      name: input.name,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?'];
    const values: (string | null)[] = [now];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.email !== undefined) {
      updates.push('email = ?');
      values.push(data.email);
    }

    values.push(id);

    await this.db
      .prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const user = await this.findById(id);
    if (!user) throw new Error('User not found after update');
    return user;
  }

  private mapToUser(row: UserRow): User {
    return {
      id: row.id,
      googleId: row.google_id,
      email: row.email,
      name: row.name,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

interface UserRow {
  id: string;
  google_id: string;
  email: string;
  name: string | null;
  created_at: string;
  updated_at: string;
}
