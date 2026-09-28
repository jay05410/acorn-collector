/**
 * Streaming helpers: pull the root "currency" value and the fully closed
 * objects of the root "items" array out of a possibly truncated wire-format
 * JSON string, so the UI can show products (priced in the right currency)
 * while the model is still writing. The wire schema orders currency before
 * items, so the currency is normally known before the first item closes.
 */

export interface PartialWire {
  /**
   * The root currency value once it has fully arrived (a string, or null for
   * a JSON null); undefined while it is missing or still being written.
   * Untrusted: normalize it before use.
   */
  currency: unknown;
  /** Item objects whose closing brace has arrived (untrusted). */
  items: unknown[];
}

/** Scans `json` once; see PartialWire. */
export function parsePartialWire(json: string): PartialWire {
  const items: unknown[] = [];
  let currency: unknown = undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let stringStart = -1;
  let lastRootString: string | null = null;
  let rootKey: string | null = null;
  let inItems = false;
  let itemStart = -1;
  // Start of the currency value (after its colon), while it is being read.
  let currencyStart = -1;

  const finishCurrency = (end: number) => {
    if (currencyStart === -1) return;
    const raw = json.slice(currencyStart, end).trim();
    currencyStart = -1;
    if (raw === '') return;
    try {
      currency = JSON.parse(raw);
    } catch {
      // Malformed value: leave it unknown; the final parse reports real errors.
    }
  };

  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') {
        inString = false;
        if (depth === 1) {
          lastRootString = json.slice(stringStart + 1, i);
          // A string currency is complete at its closing quote.
          finishCurrency(i + 1);
        }
      }
      continue;
    }
    switch (ch) {
      case '"':
        inString = true;
        stringStart = i;
        break;
      case ':':
        if (depth === 1) {
          rootKey = lastRootString;
          if (rootKey === 'currency' && currency === undefined) currencyStart = i + 1;
        }
        break;
      case ',':
        if (depth === 1) {
          finishCurrency(i);
          rootKey = null;
        }
        break;
      case '[':
        if (depth === 1 && rootKey === 'items') inItems = true;
        depth++;
        break;
      case '{':
        depth++;
        if (inItems && depth === 3) itemStart = i;
        break;
      case '}':
        if (depth === 1) finishCurrency(i);
        if (inItems && depth === 3 && itemStart !== -1) {
          try {
            items.push(JSON.parse(json.slice(itemStart, i + 1)));
          } catch {
            // Malformed fragment: skip it; the final parse reports real errors.
          }
          itemStart = -1;
        }
        depth--;
        break;
      case ']':
        depth--;
        if (inItems && depth === 1) inItems = false;
        break;
    }
  }
  return { currency, items };
}

/**
 * Returns the parsed item objects whose closing brace has already arrived.
 * Values are untrusted; normalize them with `normalizeWireItem`.
 */
export function extractClosedItems(json: string): unknown[] {
  return parsePartialWire(json).items;
}
