import { describe, expect, it, vi } from 'vitest';
import { createSnapshot } from '../snapshot';
import {
  boothItemJsonUrl,
  enrichBoothSnapshot,
  mapBoothCategory,
  mapBoothItems,
  parseBoothItem,
  parseBoothItemId,
} from './booth';

/** Trimmed from https://booth.pm/ja/items/8477745.json (2026-09-29). */
const TWO_PRICES = {
  id: 8477745,
  name: '配信中ロゴ素材',
  price: '¥ 0~',
  published_at: '2026-06-01T12:00:00.000+09:00',
  description: 'ゲーム配信で使える「配信中」表示素材です。',
  category: { id: 22, name: 'ロゴ', parent: { name: '素材データ' } },
  shop: {
    name: 'すのもんの挑戦',
    subdomain: 'sunomon',
    url: 'https://sunomon.booth.pm/',
    thumbnail_url: 'https://booth.pximg.net/c/48x48/users/1103362/icon_image/x_base_resized.jpg',
  },
  images: [
    {
      caption: null,
      original: 'https://booth.pximg.net/1ed55324/i/8477745/0dbd_base_resized.jpg',
      resized: 'https://booth.pximg.net/c/72x72_a2_g5/1ed55324/i/8477745/0dbd_base_resized.jpg',
    },
  ],
  variations: [
    { id: 14144788, name: '無料PNG', price: 0, type: 'digital', status: 'free_download' },
    { id: 14896756, name: '有料', price: 250, type: 'digital', status: 'addable_to_cart' },
  ],
};

const PHYSICAL = {
  name: 'アクリルスタンド 夏',
  price: '¥ 1,500',
  category: { name: 'アクリルフィギュア', parent: { name: 'グッズ' } },
  shop: { name: 'Circle', subdomain: 'circle', url: 'https://circle.booth.pm/' },
  images: [],
  variations: [
    { name: 'A', price: 1500, type: 'shipping' },
    { name: 'B', price: 1500, type: 'shipping' },
  ],
};

describe('parseBoothItemId', () => {
  it.each([
    ['https://booth.pm/ja/items/8893147', '8893147'],
    ['https://booth.pm/en/items/8893147?utm_source=x', '8893147'],
    ['https://booth.pm/zh-tw/items/12', '12'],
    ['https://ator.booth.pm/items/8893147', '8893147'],
    ['https://booth.pm/ja/items', null],
    ['https://booth.pm.evil.com/items/1', null],
    ['https://example.com/items/1', null],
  ])('%s -> %s', (url, id) => {
    expect(parseBoothItemId(url)).toBe(id);
  });

  it('always uses the /ja/ JSON endpoint', () => {
    expect(boothItemJsonUrl('1')).toBe('https://booth.pm/ja/items/1.json');
  });
});

describe('mapBoothCategory', () => {
  it.each([
    [['アクリルキーホルダー', 'グッズ'], 'keyring'],
    [['アクリルフィギュア', 'グッズ'], 'stand'],
    [['缶バッジ', 'グッズ'], 'badge'],
    [['ポストカード', 'グッズ'], 'postcard'],
    [['シール・ステッカー', 'グッズ'], 'sticker'],
    [['マスキングテープ', 'ステーショナリー'], 'tape'],
    [['漫画・マンガ', null], 'book'],
    [['クリアファイル', 'グッズ'], 'other'],
    [[null, null], 'other'],
  ] as const)('%j -> %s', (names, category) => {
    expect(mapBoothCategory(names, false)).toBe(category);
  });

  it('digital variations win over the category', () => {
    expect(mapBoothCategory(['ポストカード', null], true)).toBe('digital');
  });
});

describe('mapBoothItems', () => {
  it('one item per variation when prices differ', () => {
    expect(mapBoothItems(TWO_PRICES)).toEqual([
      { name: '配信中ロゴ素材', originalName: null, price: 0, category: 'digital', options: ['無料PNG'] },
      { name: '配信中ロゴ素材', originalName: null, price: 250, category: 'digital', options: ['有料'] },
    ]);
  });

  it('one item with options when all variations share a price', () => {
    expect(mapBoothItems(PHYSICAL)).toEqual([
      { name: 'アクリルスタンド 夏', originalName: null, price: 1500, category: 'stand', options: ['A', 'B'] },
    ]);
  });

  it('a single unnamed variation has no options', () => {
    expect(
      mapBoothItems({ ...PHYSICAL, variations: [{ name: null, price: 500, type: 'digital' }] })
    ).toEqual([{ name: 'アクリルスタンド 夏', originalName: null, price: 500, category: 'digital', options: [] }]);
  });

  it('parses the display price when variations are missing', () => {
    expect(mapBoothItems({ ...PHYSICAL, variations: [] })[0]?.price).toBe(1500);
  });

  it('returns nothing without a name', () => {
    expect(mapBoothItems({ variations: [] })).toEqual([]);
    expect(parseBoothItem({ variations: [] })).toBeNull();
  });
});

describe('enrichBoothSnapshot', () => {
  const page = createSnapshot({
    site: 'booth',
    url: 'https://booth.pm/ja/items/8477745',
    capturedAt: 1,
    title: 'BOOTH page title',
    lang: 'ja',
    text: 'Page description',
    images: [{ url: 'https://booth.pximg.net/c/300x300_a2_g5/1ed55324/i/8477745/0dbd_base_resized.jpg' }],
  });

  it('adds prefilled JPY items, shop and original images', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => Response.json(TWO_PRICES));
    const result = await enrichBoothSnapshot(page, { fetch: fetchMock });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://booth.pm/ja/items/8477745.json');
    expect(result).toMatchObject({
      title: '配信中ロゴ素材',
      text: 'ゲーム配信で使える「配信中」表示素材です。',
      lang: null,
      author: { name: 'すのもんの挑戦', handle: 'sunomon', url: 'https://sunomon.booth.pm/' },
      publishedAt: '2026-06-01T12:00:00.000+09:00',
      prefilledCurrency: 'JPY',
    });
    expect(result.prefilledItems).toHaveLength(2);
    // The resized page image dedupes against the original.
    expect(result.images).toEqual([
      { url: 'https://booth.pximg.net/1ed55324/i/8477745/0dbd_base_resized.jpg' },
    ]);
  });

  it('keeps the page snapshot when the JSON is unavailable', async () => {
    const fetchMock = vi.fn(async () => new Response('Not found', { status: 404 }));
    expect(await enrichBoothSnapshot(page, { fetch: fetchMock })).toBe(page);
  });

  it('skips non-item pages', async () => {
    const fetchMock = vi.fn();
    const shop = createSnapshot({ site: 'booth', url: 'https://sunomon.booth.pm/', capturedAt: 1 });
    expect(await enrichBoothSnapshot(shop, { fetch: fetchMock })).toBe(shop);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
