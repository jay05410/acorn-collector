// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import type { CaptureContext } from './context';
import { buildGenericSnapshot, findContentBlock } from './generic';

const PAGE = `
<html lang="en"><head>
  <title>Fallback title</title>
  <link rel="canonical" href="https://shop.example.com/events/summer?utm_source=news">
  <meta property="og:title" content="Summer Fair Booth B-07">
  <meta property="og:description" content="Acrylic goods and zines at Summer Fair.">
  <meta property="og:image" content="/img/cover.jpg">
  <meta property="article:published_time" content="2026-09-01T09:00:00+09:00">
  <meta name="twitter:creator" content="@bookworm">
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Article","headline":"LD headline",
     "author":{"@type":"Person","name":"Rin"},"image":"https://cdn.example.com/ld.jpg"}
  </script>
</head><body>
  <nav><a href="/">Home</a><a href="https://twitter.com/example">Twitter</a></nav>
  <main>
    <article id="post">
      <h1>Summer Fair</h1>
      <p id="para">We are at booth B-07. Acrylic stand 1,500 JPY. Zine 800 JPY.</p>
      <img id="goods" src="/img/goods-small.jpg" srcset="/img/goods-small.jpg 480w, /img/goods-large.jpg 1600w" alt="Goods">
      <img src="/icons/cart.svg" alt="">
      <a href="https://forms.example.org/order?utm_campaign=fair">Order form</a>
      <a href="/about">About us</a>
    </article>
  </main>
  <footer><a href="https://partner.example.net/">Partner</a></footer>
</body></html>`;

function load(): void {
  document.documentElement.innerHTML = PAGE.replace(/^\s*<html[^>]*>/, '').replace(/<\/html>\s*$/, '');
  document.documentElement.setAttribute('lang', 'en');
}

function context(target: Element | null, selection: string | null = null): CaptureContext {
  return {
    doc: document,
    url: 'https://shop.example.com/events/summer',
    target,
    selection,
    now: 1000,
  };
}

afterEach(() => {
  document.documentElement.innerHTML = '';
});

describe('findContentBlock', () => {
  it('climbs to the nearest semantic container or text-rich ancestor', () => {
    load();
    expect(findContentBlock(document.getElementById('para') as Element)?.id).toBe('para');
    expect(findContentBlock(document.getElementById('goods') as Element)?.id).toBe('post');
  });

  it('never returns body', () => {
    document.body.innerHTML = '<span id="s">x</span>';
    expect(findContentBlock(document.getElementById('s') as Element)).toBeNull();
  });
});

describe('buildGenericSnapshot', () => {
  it('combines OpenGraph, JSON-LD, the target block, images and links', () => {
    load();
    const snapshot = buildGenericSnapshot(context(document.getElementById('goods')), 'generic');
    expect(snapshot).toMatchObject({
      site: 'generic',
      url: 'https://shop.example.com/events/summer',
      canonicalUrl: 'https://shop.example.com/events/summer',
      title: 'Summer Fair Booth B-07',
      lang: 'en',
      author: { name: 'Rin', handle: 'bookworm', url: null },
      publishedAt: '2026-09-01T09:00:00+09:00',
    });
    // Block text (innerText; exact line breaks depend on layout) + description.
    expect(snapshot.text.startsWith('Summer Fair\n')).toBe(true);
    expect(snapshot.text).toContain('We are at booth B-07. Acrylic stand 1,500 JPY. Zine 800 JPY.');
    expect(snapshot.text.endsWith('\n\nAcrylic goods and zines at Summer Fair.')).toBe(true);
    expect(snapshot.text).not.toContain('Home');
    // Clicked image (largest srcset candidate) first, icon dropped, og/ld after.
    expect(snapshot.images.map((image) => image.url)).toEqual([
      'https://shop.example.com/img/goods-large.jpg',
      'https://shop.example.com/img/cover.jpg',
      'https://cdn.example.com/ld.jpg',
    ]);
    expect(snapshot.images[0]?.alt).toBe('Goods');
    // Links from the block only, tracking stripped.
    expect(snapshot.links).toEqual([
      'https://forms.example.org/order',
      'https://shop.example.com/about',
    ]);
    expect(snapshot.structured?.openGraph['og:title']).toBe('Summer Fair Booth B-07');
    expect(snapshot.structured?.jsonLd).toHaveLength(1);
  });

  it('without a target uses the description and external links of the page', () => {
    load();
    const snapshot = buildGenericSnapshot(context(null, 'B-07'), 'booth');
    expect(snapshot.site).toBe('booth');
    expect(snapshot.text).toBe('Acrylic goods and zines at Summer Fair.');
    expect(snapshot.selection).toBe('B-07');
    expect(snapshot.links).toEqual([
      'https://twitter.com/example',
      'https://forms.example.org/order',
      'https://partner.example.net/',
    ]);
  });

  it('falls back to document.title and meta description', () => {
    document.head.innerHTML =
      '<title>Plain page</title><meta name="description" content="Just a page">';
    document.body.innerHTML = '<p>Body</p>';
    const snapshot = buildGenericSnapshot(context(null), 'generic');
    expect(snapshot.title).toBe('Plain page');
    expect(snapshot.text).toBe('Just a page');
    expect(snapshot.structured).toBeNull();
    expect(snapshot.author).toBeNull();
  });
});
