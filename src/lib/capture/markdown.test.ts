// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { htmlToMarkdown, toMarkdown } from './markdown';

describe('htmlToMarkdown', () => {
  it('converts the elements defuddle emits', () => {
    const html = `
      <h2>Menu</h2>
      <p>Prices are <strong>tax included</strong>, <em>cash only</em>.</p>
      <ul><li>Acrylic stand <a href="https://e.com/a">details</a></li><li>Sticker<ul><li>Set A</li></ul></li></ul>
      <ol><li>First</li><li>Second</li></ol>
      <blockquote><p>Quoted line</p></blockquote>
      <pre><code>const x = 1;\nconst y = 2;</code></pre>
      <table><tr><th>Item</th><th>Price</th></tr><tr><td>Zine</td><td>800</td></tr></table>
      <p>Use <code>A-12</code><br>then turn left.</p>
      <img src="https://e.com/x.jpg" alt="ignored">
      <script>alert(1)</script>
      <hr>
      <p><a href="/relative">relative link</a> and <a href="https://e.com/same">https://e.com/same</a></p>`;
    expect(htmlToMarkdown(html, document)).toBe(
      [
        '## Menu',
        '',
        'Prices are **tax included**, *cash only*.',
        '',
        '- Acrylic stand [details](https://e.com/a)',
        '- Sticker',
        '- Set A',
        '',
        '1. First',
        '2. Second',
        '',
        '> Quoted line',
        '',
        '```',
        'const x = 1;',
        'const y = 2;',
        '```',
        '',
        '| Item | Price |',
        '| Zine | 800 |',
        '',
        'Use `A-12`',
        'then turn left.',
        '',
        '---',
        '',
        'relative link and https://e.com/same',
      ].join('\n')
    );
  });

  it('returns an empty string for empty content', () => {
    expect(toMarkdown(document.createElement('div'))).toBe('');
  });

  it('falls back to tag stripping when HTML parsing is not allowed', () => {
    const blocked = {
      implementation: {
        createHTMLDocument: () => {
          throw new Error('TrustedHTML required');
        },
      },
    } as unknown as Document;
    expect(htmlToMarkdown('<p>A &amp; B</p><p>C<br>D</p><script>x()</script>', blocked)).toBe(
      'A & B\n\nC\nD'
    );
  });
});
