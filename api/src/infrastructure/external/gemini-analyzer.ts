import { GoogleGenAI } from '@google/genai';
import type { ImageAnalyzer } from '../../domain/usecases/analyze-images';
import type { AnalysisItem } from '../../domain/entities/analysis';

const MODEL = 'gemini-2.0-flash-lite';

export class GeminiAnalyzer implements ImageAnalyzer {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async analyze(imageUrls: string[]): Promise<AnalysisItem[]> {
    const imageParts = await this.loadImages(imageUrls);
    if (imageParts.length === 0) {
      throw new Error('Failed to load images');
    }

    const response = await this.ai.models.generateContent({
      model: MODEL,
      contents: [...imageParts, { text: this.getPrompt(imageParts.length) }],
      config: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    });

    return this.parseResponse(response.text || '');
  }

  private async loadImages(imageUrls: string[]) {
    const results = await Promise.all(
      imageUrls.slice(0, 4).map(async (url) => {
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              ''
            )
          );
          return {
            inlineData: { data: base64, mimeType: blob.type || 'image/jpeg' },
          };
        } catch {
          return null;
        }
      })
    );
    return results.filter((p): p is NonNullable<typeof p> => p !== null);
  }

  private getPrompt(imageCount: number): string {
    return `Extract UNIQUE products from ${imageCount} booth price list image(s).

[CRITICAL - NO DUPLICATES]
- Each product appears ONCE in output
- If same product shown multiple times, output it ONLY ONCE

[LAYOUT]
- Product name/price are NEAR each other spatially
- Ignore distant text (booth name, event name, artist name)

[NAME RULES]
- Use ONLY text directly next to product
- NEVER add distant prefixes (event/booth/artist name)

[OPTIONS vs SEPARATE]
- OPTIONS: "키링 3000원 (A,B,C)" → {name:"키링", options:["A","B","C"]}
- SEPARATE: Different names → separate items

[FORMAT]
- name: Direct product text only
- price: Number (free=0, unknown=null)  
- category: acrylic|keyring|stand|poster|postcard|sticker|photocard|memo|tape|badge|book|calendar|pouch|plush|apparel|other

[EXCLUDE]
Booth#, SNS, URL, shipping

JSON: {"items":[{"name":"string","price":number|null,"category":"string","options"?:["string"]}]}`;
  }

  private parseResponse(text: string): AnalysisItem[] {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const rawItems = (parsed.items || []).map(
        (item: {
          name: string;
          price?: number | null;
          category?: string;
          options?: string[];
        }) => ({
          name: item.name,
          price: item.price ?? null,
          category: item.category || null,
          options: item.options?.length ? item.options : undefined,
        })
      );

      const seen = new Set<string>();
      return rawItems.filter((item: AnalysisItem) => {
        const dedupeKey = `${item.name}|${item.price}|${item.category}`;
        if (seen.has(dedupeKey)) return false;
        seen.add(dedupeKey);
        return true;
      });
    } catch {
      return [];
    }
  }
}
