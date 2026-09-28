import { describe, expect, it } from 'vitest';
import { extractClosedItems, parsePartialWire } from './partial-json';

const FULL = JSON.stringify({
  booth: { number: 'A-1', circle: 'x { "items": [ {', event: null, zone: null, mailOrder: false },
  currency: 'JPY',
  items: [
    { name: '缶バッジ "A}"', orig: null, price: 400, cat: 'badge', opts: ['A', 'B]'] },
    { name: 'Sticker\\', orig: null, price: 300, cat: 'sticker', opts: [] },
  ],
});

describe('extractClosedItems', () => {
  it('returns every item from complete JSON', () => {
    expect(extractClosedItems(FULL)).toEqual(JSON.parse(FULL).items);
  });

  it('only returns items whose closing brace has arrived, at every prefix', () => {
    const firstEnd = FULL.indexOf('}', FULL.indexOf('"opts":["A","B]"]')) + 1;
    for (let cut = 0; cut <= FULL.length; cut++) {
      const got = extractClosedItems(FULL.slice(0, cut));
      const expected = cut >= FULL.lastIndexOf('}]') + 1 ? 2 : cut >= firstEnd ? 1 : 0;
      expect(got, `prefix length ${cut}`).toHaveLength(expected);
    }
  });

  it('ignores braces and the word items inside strings and nested objects', () => {
    const json = '{"booth":{"items":[{"name":"not me"}]},"currency":"items","items":[{"name":"me"}';
    expect(extractClosedItems(json)).toEqual([{ name: 'me' }]);
  });

  it('handles whitespace and pretty-printed output', () => {
    const pretty = JSON.stringify(JSON.parse(FULL), null, 2);
    expect(extractClosedItems(pretty)).toHaveLength(2);
  });

  it('returns nothing for non-JSON text', () => {
    expect(extractClosedItems('')).toEqual([]);
    expect(extractClosedItems('I cannot help with that.')).toEqual([]);
  });
});

describe('parsePartialWire', () => {
  it('surfaces the currency as soon as its value is complete, before any item', () => {
    const currencyEnd = FULL.indexOf('"JPY"') + '"JPY"'.length;
    for (let cut = 0; cut <= FULL.length; cut++) {
      const { currency } = parsePartialWire(FULL.slice(0, cut));
      expect(currency, `prefix length ${cut}`).toBe(cut >= currencyEnd ? 'JPY' : undefined);
    }
    expect(parsePartialWire(FULL.slice(0, currencyEnd)).items).toEqual([]);
  });

  it('reads a null currency once the value is followed by the next key', () => {
    const json = '{"booth":{"number":null},"currency":null,"items":[{"name":"a"}';
    expect(parsePartialWire(json)).toEqual({ currency: null, items: [{ name: 'a' }] });
    expect(parsePartialWire('{"booth":{},"currency":nu').currency).toBeUndefined();
    expect(parsePartialWire('{"booth":{},"currency":null').currency).toBeUndefined();
  });

  it('ignores a currency key inside the booth or an item, and handles whitespace', () => {
    const json = '{"booth":{"currency":"KRW"},"items":[{"name":"x","currency":"USD"}';
    expect(parsePartialWire(json).currency).toBeUndefined();
    const pretty = JSON.stringify(JSON.parse(FULL), null, 2);
    expect(parsePartialWire(pretty).currency).toBe('JPY');
    expect(parsePartialWire('{ "currency" : "TWD" }').currency).toBe('TWD');
  });
});
