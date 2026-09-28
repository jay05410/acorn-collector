/** Narrowing helpers for untrusted JSON (provider responses, stream events). */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function stringField(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function numberField(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function recordField(
  source: Record<string, unknown>,
  key: string
): Record<string, unknown> | undefined {
  const value = source[key];
  return isRecord(value) ? value : undefined;
}
