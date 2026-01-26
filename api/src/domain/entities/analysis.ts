export interface AnalysisRequest {
  userId: string;
  imageUrls: string[];
  creditCost: number;
}

export interface AnalysisItem {
  name: string;
  price: number | null;
  category: string | null;
  options?: string[];
}

export interface AnalysisResult {
  items: AnalysisItem[];
  tokenCount?: number;
  creditUsed: number;
}
