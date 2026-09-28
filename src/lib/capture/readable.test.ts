// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { extractReadable } from './readable';
import { isReadableResult, mergeReadable } from './readable-result';
import { createSnapshot } from './snapshot';

const ARTICLE = `
<head>
  <title>Autumn Fair report | Circle Blog</title>
  <meta property="og:title" content="Autumn Fair report">
  <meta name="author" content="Mika">
  <meta property="article:published_time" content="2026-09-20T10:00:00Z">
  <meta property="og:image" content="/cover.jpg">
</head>
<body>
  <nav><a href="/">Home</a> <a href="/archive">Archive</a></nav>
  <article>
    <h1>Autumn Fair report</h1>
    <p>We will be at booth E-21 on both days. This is the first time we bring the new acrylic stands and the second volume of our zine.</p>
    <h2>Price list</h2>
    <ul><li>Acrylic stand: 1,500 JPY</li><li>Zine vol. 2: 800 JPY</li></ul>
    <p>Mail order opens after the event at <a href="https://shop.example.com/">our shop</a>. Thank you for reading and see you there.</p>
  </article>
  <footer>Copyright Circle</footer>
</body>`;

afterEach(() => {
  document.documentElement.innerHTML = '';
});

describe('extractReadable (defuddle core)', () => {
  it('returns markdown main content and metadata as plain data', () => {
    document.documentElement.innerHTML = ARTICLE;
    document.documentElement.setAttribute('lang', 'en');
    const before = document.body.innerHTML;

    const result = extractReadable(document, 'https://blog.example.com/autumn');

    expect(isReadableResult(result)).toBe(true);
    expect(result.title).toBe('Autumn Fair report');
    expect(result.author).toBe('Mika');
    expect(result.lang).toBe('en');
    expect(result.image).toBe('https://blog.example.com/cover.jpg');
    expect(result.text).toContain('booth E-21');
    expect(result.text).toContain('- Acrylic stand: 1,500 JPY');
    expect(result.text).toContain('[our shop](https://shop.example.com/)');
    expect(result.text).not.toContain('Archive');
    // The live page is not modified.
    expect(document.body.innerHTML).toBe(before);
    // Survives structured cloning (executeScript result).
    expect(structuredClone(result)).toEqual(result);
  });
});

describe('isReadableResult', () => {
  it('rejects malformed injection results', () => {
    expect(isReadableResult(undefined)).toBe(false);
    expect(isReadableResult({ text: 1 })).toBe(false);
    expect(
      isReadableResult({ text: '', title: null, author: null, published: null, image: null, lang: 3 })
    ).toBe(false);
  });
});

describe('mergeReadable', () => {
  const readable = {
    title: 'Readable title',
    text: 'Main article text. Booth E-21 details.',
    author: 'Mika',
    published: '2026-09-20',
    image: 'https://e.com/cover.jpg',
    lang: 'en',
  };

  it('uses the article as text and fills metadata gaps', () => {
    const snapshot = createSnapshot({
      url: 'https://e.com/a',
      capturedAt: 1,
      text: 'Booth E-21 details.',
      images: [{ url: 'https://e.com/clicked.jpg' }],
    });
    const merged = mergeReadable(snapshot, readable);
    expect(merged).toMatchObject({
      title: 'Readable title',
      text: 'Main article text. Booth E-21 details.',
      author: { name: 'Mika', handle: null, url: null },
      publishedAt: '2026-09-20',
      lang: 'en',
    });
    expect(merged.images.map((image) => image.url)).toEqual([
      'https://e.com/clicked.jpg',
      'https://e.com/cover.jpg',
    ]);
  });

  it('keeps block text the article does not contain in front', () => {
    const snapshot = createSnapshot({
      url: 'https://e.com/a',
      capturedAt: 1,
      title: 'Page',
      text: 'Sidebar notice: sold out',
      lang: 'ja',
    });
    const merged = mergeReadable(snapshot, readable);
    expect(merged.text).toBe('Sidebar notice: sold out\n\nMain article text. Booth E-21 details.');
    expect(merged.title).toBe('Page');
    expect(merged.lang).toBe('ja');
  });

  it('keeps the snapshot text when the article is empty', () => {
    const snapshot = createSnapshot({ url: 'https://e.com/a', capturedAt: 1, text: 'Only text' });
    expect(mergeReadable(snapshot, { ...readable, text: '' }).text).toBe('Only text');
  });
});
