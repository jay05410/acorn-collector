// i18n-scan-ignore-file: model prompt with multilingual price examples, never shown in the UI
/**
 * Prompt text shared by every provider. The system prompt is the benchmarked
 * baseline (ADR-001 section 2); change it only with benchmark evidence and
 * bump SCHEMA_VERSION when its meaning changes.
 */
import { LANGUAGE_INFO, type AppLanguage } from '@/i18n/languages';
import type { ExtractionRequest } from './types';

/** Matches the PageSnapshot contract (text is trimmed to <= 8000 chars). */
const MAX_TEXT_CHARS = 8000;
const MAX_EVENT_HINTS = 30;
const MAX_EVENT_NAME_CHARS = 100;
const CURRENCY_CODE = /^[A-Z]{3}$/;

export function buildSystemPrompt(languageName: string): string {
  return `You extract structured data from doujin/convention booth announcements (post text and price-list images).
Return JSON matching the schema. Rules:
- items: every distinct product for sale exactly once. Variants of one product (A/B/C, character names, colors) go in opts, not separate items.
- name: product name translated into ${languageName}; keep proper nouns/titles as-is. orig: the exact original text if it differs from name, else null.
- price: number in the currency's main unit as printed per item. Expand shorthand (e.g. Korean "3.0" or "3,0" on a price list = 3000 KRW; "3k" = 3000). Free/無料/무료 = 0. Unknown = null.
- currency: ISO 4217 code of the prices (KRW, JPY, CNY, TWD, USD, EUR, THB, ...), inferred from symbols/units/language; null if no prices.
- Ignore event names, booth numbers, SNS handles, URLs, shipping fees and set-discount notes when listing items.
- booth: booth/space number, circle or artist name, event name, zone/area if shown; mailOrder=true only for mail-order/online sales.
- cat: best category.`;
}

export function systemPromptFor(language: AppLanguage): string {
  return buildSystemPrompt(LANGUAGE_INFO[language].englishName);
}

function cleanEventNames(names: readonly string[] | undefined): string[] {
  const out: string[] = [];
  for (const name of names ?? []) {
    const cleaned = name.replace(/\s+/g, ' ').trim().slice(0, MAX_EVENT_NAME_CHARS);
    if (cleaned !== '' && !out.includes(cleaned)) out.push(cleaned);
    if (out.length === MAX_EVENT_HINTS) break;
  }
  return out;
}

export function buildUserContent(text: string, hints?: ExtractionRequest['hints']): string {
  const postText = text.trim().slice(0, MAX_TEXT_CHARS);
  const lines = [`Post text:\n${postText || '(none)'}`];

  const eventNames = cleanEventNames(hints?.eventNames);
  if (eventNames.length > 0) {
    lines.push(
      `Known events (if the post is for one of these, use its exact name for booth.event):\n${eventNames.map((n) => `- ${n}`).join('\n')}`
    );
  }
  const currency = hints?.defaultCurrency?.trim().toUpperCase();
  if (currency && CURRENCY_CODE.test(currency)) {
    lines.push(`Default currency if the prices show no symbol or unit: ${currency}`);
  }

  lines.push('Extract from the text and the attached image(s).');
  return lines.join('\n\n');
}
