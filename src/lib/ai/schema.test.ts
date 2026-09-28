import { describe, expect, it } from 'vitest';
import { ITEM_CATEGORIES } from '@/types';
import {
  coercePrice,
  dedupeItems,
  normalizeName,
  normalizeWireItem,
  nullableTypesToAnyOf,
  parseWireJson,
  toResult,
  validateWire,
  WIRE_SCHEMA,
  WIRE_SCHEMA_ANY_OF,
  wireSchema,
  type WireItem,
} from './schema';
import { AIError } from './types';

const item = (over: Partial<WireItem> = {}): WireItem => ({
  name: 'Sticker',
  orig: null,
  price: 300,
  cat: 'sticker',
  opts: [],
  ...over,
});

describe('WIRE_SCHEMA', () => {
  it('requires every property and forbids extras (strict mode)', () => {
    expect(WIRE_SCHEMA.required).toEqual(['booth', 'currency', 'items']);
    expect(WIRE_SCHEMA.properties.items.items.required).toEqual([
      'name',
      'orig',
      'price',
      'cat',
      'opts',
    ]);
    expect(WIRE_SCHEMA.properties.items.items.properties.cat.enum).toEqual(ITEM_CATEGORIES);
  });

  it('converts nullable type arrays to anyOf recursively', () => {
    const schema = WIRE_SCHEMA_ANY_OF as typeof WIRE_SCHEMA_ANY_OF & {
      properties: Record<string, Record<string, unknown>>;
    };
    expect(schema.properties.currency).toEqual({
      anyOf: [{ type: 'string' }, { type: 'null' }],
    });
    expect(JSON.stringify(WIRE_SCHEMA_ANY_OF)).not.toMatch(/"type":\[/);
    expect(JSON.stringify(WIRE_SCHEMA_ANY_OF)).toContain('"enum":[');
    expect(wireSchema('any-of')).toBe(WIRE_SCHEMA_ANY_OF);
    expect(wireSchema('type-array')).toBe(WIRE_SCHEMA);
  });

  it('keeps sibling keywords on the non-null branch', () => {
    expect(nullableTypesToAnyOf({ type: ['string', 'null'], enum: ['a', null] })).toEqual({
      anyOf: [{ type: 'string', enum: ['a', null] }, { type: 'null' }],
    });
  });
});

describe('coercePrice', () => {
  it.each([
    [800, 800],
    [0, 0],
    ['3000', 3000],
    ['3,000', 3000],
    ['¥1,500', 1500],
    ['1500円', 1500],
    ['12.50', 12.5],
    [-5, null],
    [Number.NaN, null],
    ['free', null],
    ['1,2', null],
    [null, null],
    [true, null],
  ])('%s -> %s', (input, expected) => {
    expect(coercePrice(input)).toBe(expected);
  });
});

describe('normalizeName', () => {
  it('folds width, case, brackets and spaces', () => {
    expect(normalizeName('新刊「星の庭」')).toBe(normalizeName('新刊 星の庭'));
    expect(normalizeName('ＡＢＣ Sticker')).toBe('abcsticker');
  });

  it('keeps symbol-only names distinguishable', () => {
    expect(normalizeName(' ★ ')).toBe('★');
  });
});

describe('normalizeWireItem', () => {
  it('trims, coerces and fills defaults', () => {
    expect(
      normalizeWireItem({
        name: '  Acrylic  stand ',
        orig: 'アクスタ',
        price: '1,500',
        cat: 'STAND',
        opts: [' A ', 'a', '', 'B'],
      })
    ).toEqual({ name: 'Acrylic stand', orig: 'アクスタ', price: 1500, cat: 'stand', opts: ['A', 'B'] });
  });

  it('maps unknown categories to other and drops orig equal to name', () => {
    expect(normalizeWireItem({ name: 'Mug', orig: 'Mug', price: 1, cat: 'mug', opts: 'x' })).toEqual(
      { name: 'Mug', orig: null, price: 1, cat: 'other', opts: [] }
    );
  });

  it('drops items without a usable name', () => {
    expect(normalizeWireItem({ name: '   ', price: 1 })).toBeNull();
    expect(normalizeWireItem('Sticker')).toBeNull();
  });
});

describe('dedupeItems', () => {
  it('merges same name+price, unions options and keeps first position', () => {
    const out = dedupeItems([
      item({ name: 'Badge', price: 400, cat: 'other', opts: ['A'] }),
      item({ name: 'Sticker' }),
      item({ name: 'badge ', price: 400, cat: 'badge', orig: '缶バッジ', opts: ['B', 'a'] }),
    ]);
    expect(out).toEqual([
      item({ name: 'Badge', price: 400, cat: 'badge', orig: '缶バッジ', opts: ['A', 'B'] }),
      item({ name: 'Sticker' }),
    ]);
  });

  it('keeps same name with different prices apart and does not mutate input', () => {
    const input = [item({ opts: ['A'] }), item({ price: 500, opts: ['B'] })];
    const out = dedupeItems(input);
    expect(out).toHaveLength(2);
    out[0]?.opts.push('Z');
    expect(input[0]?.opts).toEqual(['A']);
  });
});

describe('validateWire', () => {
  it('normalizes booth, currency and items', () => {
    const wire = validateWire({
      booth: { number: ' A-01 ', circle: '', event: 'COMIC', zone: null, mailOrder: 'yes' },
      currency: 'krw',
      items: [{ name: 'Tape', orig: null, price: '4000', cat: 'tape', opts: [] }, { name: '' }],
    });
    expect(wire).toEqual({
      booth: { number: 'A-01', circle: null, event: 'COMIC', zone: null, mailOrder: false },
      currency: 'KRW',
      items: [{ name: 'Tape', orig: null, price: 4000, cat: 'tape', opts: [] }],
    });
  });

  it('rejects invalid currency codes and missing booth', () => {
    const wire = validateWire({ currency: '원', items: [] });
    expect(wire.currency).toBeNull();
    expect(validateWire({ currency: 392, items: [] }).currency).toBeNull();
    expect(validateWire({ currency: ' jpy ', items: [] }).currency).toBe('JPY');
    expect(wire.booth).toEqual({
      number: null,
      circle: null,
      event: null,
      zone: null,
      mailOrder: false,
    });
  });

  it('throws bad_response when items is missing', () => {
    expect(() => validateWire({ booth: {} }, 'openai')).toThrowError(AIError);
    expect(() => validateWire(null, 'anthropic')).toThrowError(
      expect.objectContaining({ code: 'bad_response', provider: 'anthropic' })
    );
  });
});

describe('parseWireJson', () => {
  it('parses valid JSON', () => {
    expect(parseWireJson('{"booth":null,"currency":"JPY","items":[]}', 'openai').currency).toBe(
      'JPY'
    );
  });

  it('maps invalid JSON to bad_response', () => {
    expect(() => parseWireJson('{"items": [', 'openrouter')).toThrowError(
      expect.objectContaining({ code: 'bad_response', provider: 'openrouter' })
    );
  });
});

describe('toResult', () => {
  it('maps wire keys to app keys', () => {
    const meta = { provider: 'openai' as const, model: 'm', latencyMs: 5, cached: false };
    const result = toResult(
      {
        booth: { number: 'B-12', circle: 'Moon', event: 'SCW', zone: 'Hall B', mailOrder: true },
        currency: 'KRW',
        items: [item({ orig: '스티커', opts: ['A'] })],
      },
      meta
    );
    expect(result).toEqual({
      booth: {
        boothNumber: 'B-12',
        circleName: 'Moon',
        eventName: 'SCW',
        zone: 'Hall B',
        isMailOrder: true,
      },
      currency: 'KRW',
      items: [
        { name: 'Sticker', originalName: '스티커', price: 300, category: 'sticker', options: ['A'] },
      ],
      meta,
    });
  });
});
