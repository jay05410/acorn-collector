import type { AnalysisItem } from '../entities/analysis';

export interface AnalysisSession {
  id: string;
  userId: string;
  method: 'credit' | 'direct';
  model: string;
  creditCost: number;
  imageCount: number;
  itemCount: number;
  status: 'completed' | 'failed';
  createdAt: Date;
  items?: AnalysisItem[];
  images?: string[];
}

export interface AnalysisRepository {
  saveSession(
    session: Omit<AnalysisSession, 'createdAt'>,
    items: AnalysisItem[],
    imageUrls: string[]
  ): Promise<AnalysisSession>;
  getSession(sessionId: string): Promise<AnalysisSession | null>;
  getUserSessions(userId: string, limit?: number): Promise<AnalysisSession[]>;
}
