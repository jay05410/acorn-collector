// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  decodeHtmlEntities,
  parseMetaTagsFromHtml,
  readJsonLd,
  readMetaDescription,
  readOpenGraph,
  summarizeJsonLd,
} from './meta';

function doc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

const PAGE = `<!doctype html><html lang="ja"><head>
  <meta property="og:title" content="Summer Booth">
  <meta property="og:title" content="Duplicate title">
  <meta property="og:image" content="https://e.com/og.jpg">
  <meta name="twitter:creator" content="@circle">
  <meta property="article:published_time" content="2026-08-01T10:00:00Z">
  <meta name="description" content="Plain description">
  <meta name="viewport" content="width=device-width">
  <script type="application/ld+json">{"@context":"https://schema.org","@graph":[
    {"@type":"WebSite","name":"Site"},
    {"@type":"BlogPosting","headline":"Post headline","author":[{"@type":"Person","name":"Alice"}],
     "datePublished":"2026-08-01","image":{"@type":"ImageObject","url":"https://e.com/ld.jpg"},
     "inLanguage":"ja"}
  ]}</script>
  <script type="application/ld+json">{ not json</script>
  <script type="application/ld+json">[{"@type":"Product","name":"Acrylic stand","image":["https://e.com/p1.jpg","https://e.com/p2.jpg"]}]</script>
</head><body></body></html>`;

describe('readOpenGraph', () => {
  it('keeps prefixed keys, first value wins', () => {
    expect(readOpenGraph(doc(PAGE))).toEqual({
      'og:title': 'Summer Booth',
      'og:image': 'https://e.com/og.jpg',
      'twitter:creator': '@circle',
      'article:published_time': '2026-08-01T10:00:00Z',
    });
  });

  it('reads the meta description', () => {
    expect(readMetaDescription(doc(PAGE))).toBe('Plain description');
    expect(readMetaDescription(doc('<p>none</p>'))).toBeNull();
  });
});

describe('readJsonLd / summarizeJsonLd', () => {
  it('flattens @graph and arrays and skips malformed blocks', () => {
    const entries = readJsonLd(doc(PAGE));
    expect(entries).toHaveLength(3);
  });

  it('prefers the most specific content type', () => {
    const summary = summarizeJsonLd(readJsonLd(doc(PAGE)));
    expect(summary).toEqual({
      title: 'Post headline',
      description: null,
      author: 'Alice',
      publishedAt: '2026-08-01',
      images: ['https://e.com/ld.jpg', 'https://e.com/p1.jpg', 'https://e.com/p2.jpg'],
      lang: 'ja',
    });
  });

  it('ignores entries without a content type', () => {
    expect(summarizeJsonLd([{ '@type': 'Organization', name: 'Org' }, 'x', null]).title).toBeNull();
  });
});

describe('parseMetaTagsFromHtml', () => {
  it('reads meta tags from raw HTML with any quoting and decodes entities', () => {
    const html = `<html><head>
      <meta property="og:description" content="Four &amp; more &#8220;years&#x201D;." nonce="abc"/>
      <meta content='Name (@user) on X' property='og:title'>
      <meta property=og:type content=article>
      </head><body><meta property="og:title" content="body tag ignored"></body></html>`;
    expect(parseMetaTagsFromHtml(html)).toEqual({
      'og:description': 'Four & more “years”.',
      'og:title': 'Name (@user) on X',
      'og:type': 'article',
    });
  });
});

describe('decodeHtmlEntities', () => {
  it('decodes named and numeric entities and leaves unknown ones', () => {
    expect(decodeHtmlEntities('&lt;a&gt; &quot;b&quot; &#39;c&#39; &#x1F600; &bogus;')).toBe(
      '<a> "b" \'c\' 😀 &bogus;'
    );
  });
});
