/**
 * Streaming helper: pulls the fully closed objects out of the top-level
 * "items" array of a possibly truncated wire-format JSON string, so the UI can
 * show products while the model is still writing.
 */

/**
 * Returns the parsed item objects whose closing brace has already arrived.
 * Values are untrusted; normalize them with `normalizeWireItem`.
 */
export function extractClosedItems(json: string): unknown[] {
  const items: unknown[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let stringStart = -1;
  let lastRootString: string | null = null;
  let rootKey: string | null = null;
  let inItems = false;
  let itemStart = -1;

  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') {
        inString = false;
        if (depth === 1) lastRootString = json.slice(stringStart + 1, i);
      }
      continue;
    }
    switch (ch) {
      case '"':
        inString = true;
        stringStart = i;
        break;
      case ':':
        if (depth === 1) rootKey = lastRootString;
        break;
      case ',':
        if (depth === 1) rootKey = null;
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
  return items;
}
