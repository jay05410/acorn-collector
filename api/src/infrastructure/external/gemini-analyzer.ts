import { GoogleGenAI, Type } from '@google/genai';
import type { ImageAnalyzer } from '../../domain/usecases/analyze-images';
import type { AnalysisItem } from '../../domain/entities/analysis';
import { GEMINI_MODEL } from '../../config/types';

export class GeminiAnalyzer implements ImageAnalyzer {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async analyze(imageUrls: string[], language?: string): Promise<AnalysisItem[]> {
    const imageParts = await this.loadImages(imageUrls);
    if (imageParts.length === 0) {
      throw new Error('Failed to load images');
    }

    const userLanguage = language || 'ko';

    // Pass 1: Extract items
    const pass1Response = await this.ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [...imageParts, { text: this.getExtractionPrompt(imageParts.length, userLanguage) }],
      config: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  price: { type: Type.NUMBER, nullable: true },
                  category: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['name', 'price', 'category'],
              },
            },
          },
          required: ['items'],
        },
      },
    });

    const pass1Items = this.parseResponse(pass1Response.text || '');
    if (pass1Items.length === 0) {
      return [];
    }

    // Pass 2: Verify and correct with original images
    const pass2Response = await this.ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        ...imageParts,
        { text: this.getVerificationPrompt(pass1Items, userLanguage) },
      ],
      config: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  price: { type: Type.NUMBER, nullable: true },
                  category: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['name', 'price', 'category'],
              },
            },
          },
          required: ['items'],
        },
      },
    });

    const pass2Items = this.parseResponse(pass2Response.text || '');
    return pass2Items.length > 0 ? pass2Items : pass1Items;
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

  private getLanguageName(code: string): string {
    const map: Record<string, string> = { ko: 'Korean', en: 'English', ja: 'Japanese', zh: 'Chinese' };
    return map[code] || 'Korean';
  }

  private getExtractionPrompt(imageCount: number, language: string): string {
    const langName = this.getLanguageName(language);
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
- OPTIONS: Same product with variants (A,B,C) → single item with options array
- SEPARATE: Different product names → separate items

[FORMAT]
- name: Direct product text only
- price: Number (free=0, unknown=null)
- category: acrylic|keyring|stand|poster|postcard|sticker|photocard|memo|tape|badge|book|calendar|pouch|plush|apparel|other
- options: Array of variant names if applicable

[LANGUAGE]
- Return item names in ${langName}.
- If the text in the image is in a DIFFERENT language from ${langName}, format the name as: "Translated Name (Original Name)"
  Example: If image has "키링" and user language is English → "Keyring (키링)"
  Example: If image has "Keyring" and user language is Korean → "키링 (Keyring)"
- If the text is ALREADY in ${langName}, use the original text as-is.
- Category values must ALWAYS be in English (acrylic|keyring|...).
- Options should preserve the original text from the image.

[EXCLUDE]
Booth#, SNS, URL, shipping

JSON: {"items":[{"name":"string","price":number|null,"category":"string","options"?:["string"]}]}`;
  }

  private getVerificationPrompt(pass1Items: AnalysisItem[], language: string): string {
    const langName = this.getLanguageName(language);
    const itemsJson = JSON.stringify(pass1Items, null, 2);
    return `Below is a list of products extracted from the image(s):
${itemsJson}

Compare against the original image(s) and:
1. Add any missing products
2. Fix incorrect prices or names
3. Remove duplicate entries
4. Verify categories are correct
5. Ensure item names follow the language rule: names must be in ${langName}. If the original text differs, use "Translated (Original)" format.

Return the corrected final result in the same JSON format.

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
