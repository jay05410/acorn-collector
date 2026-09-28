import { describe, expect, it } from 'vitest';
import { classifyUrl, cleanUrl, extractLinks, pickFormLinks } from './links';
import { normalizeText } from './normalize';

describe('cleanUrl', () => {
  it.each([
    ['https://forms.gle/abc?utm_source=x&utm_medium=social', 'https://forms.gle/abc'],
    ['https://witchform.com/f.php?fidx=9&utm_campaign=a#top', 'https://witchform.com/f.php?fidx=9#top'],
    ['https://www.instagram.com/p/xyz/?igsh=MTIz', 'https://www.instagram.com/p/xyz/'],
    ['https://x.com/moon/status/1?s=20&t=abc', 'https://x.com/moon/status/1'],
    ['https://x.com/i/communities/1?s=46', 'https://x.com/i/communities/1'],
    ['https://shop.example/p?id=1&fbclid=zz&gclid=yy', 'https://shop.example/p?id=1'],
    // t is a timestamp on YouTube and may be meaningful on unknown hosts
    ['https://youtu.be/abc?t=30', 'https://youtu.be/abc?t=30'],
    ['https://shop.example/p?t=token&s=2', 'https://shop.example/p?t=token&s=2'],
    // no re-encoding of the rest of the URL
    ['https://a.com/%EC%84%9C?q=a+b&utm_id=1', 'https://a.com/%EC%84%9C?q=a+b'],
    ['not a url', 'not a url'],
  ])('%s', (input, output) => {
    expect(cleanUrl(input)).toBe(output);
  });
});

describe('classifyUrl', () => {
  it.each([
    ['https://witchform.com/formViewer.php?fidx=1', 'order', 'witchform'],
    ['https://forms.gle/abc', 'order', 'google-forms'],
    ['https://docs.google.com/forms/d/e/1/viewform', 'order', 'google-forms'],
    ['https://docs.google.com/document/d/1', 'other', undefined],
    ['https://tally.so/r/abc', 'order', 'tally'],
    ['https://moon.typeform.com/to/abc', 'order', 'typeform'],
    ['https://smartstore.naver.com/moon/products/1', 'order', 'smartstore'],
    ['https://moon.booth.pm/items/1', 'order', 'booth'],
    ['https://www.melonbooks.co.jp/detail/detail.php?product_id=1', 'order', 'melonbooks'],
    ['https://ec.toranoana.jp/joshi_r/ec/item/1/', 'order', 'toranoana'],
    ['https://weidian.com/item.html?itemID=1', 'order', 'weidian'],
    ['https://x.com/i/communities/1', 'info', 'x'],
    ['https://x.com/moon/status/1', 'other', 'x'],
    ['https://www.postype.com/@moon/post/1', 'info', 'postype'],
    ['https://linktr.ee/moon', 'info', 'linktree'],
    ['https://webcatalog.circle.ms/Circle/1', 'info', 'circle-ms'],
    ['https://www.pixiv.net/artworks/1', 'other', 'pixiv'],
    ['https://example.com', 'other', undefined],
  ])('%s -> %s', (url, kind, service) => {
    const c = classifyUrl(url);
    expect(c.kind).toBe(kind);
    expect(c.service).toBe(service);
  });
});

describe('extractLinks', () => {
  const urls = (text: string, extra?: string[]) => extractLinks(normalizeText(text), extra).map((l) => l.url);

  it('stops at CJK text glued to a URL', () => {
    expect(urls('폼 https://witchform.com/abc에서 주문')).toEqual(['https://witchform.com/abc']);
    expect(urls('通販はこちらhttps://moon.booth.pm/items/1から')).toEqual(['https://moon.booth.pm/items/1']);
  });

  it('trims trailing punctuation but keeps balanced parens', () => {
    expect(urls('(see https://a.com/x).')).toEqual(['https://a.com/x']);
    expect(urls('https://en.wikipedia.org/wiki/Foo_(bar)!')).toEqual(['https://en.wikipedia.org/wiki/Foo_(bar)']);
    expect(urls('「https://forms.gle/abc」')).toEqual(['https://forms.gle/abc']);
  });

  it('finds bare known hosts as X displays them, but not bare social hosts', () => {
    expect(urls('인포 linktr.ee/moonart 참고, 팔로우는 x.com')).toEqual(['https://linktr.ee/moonart']);
    expect(urls('mail me moon@witchform.com')).toEqual([]);
  });

  it('dedupes after cleaning, keeping first-seen order', () => {
    expect(
      urls('https://forms.gle/a?utm_source=x https://forms.gle/a http://forms.gle/a/ https://b.com')
    ).toEqual(['https://forms.gle/a', 'https://b.com']);
  });

  it('replaces a truncated display URL with the captured full link', () => {
    const links = extractLinks(normalizeText('폼 witchform.com/formViewer.php…'), [
      'https://witchform.com/formViewer.php?fidx=77&utm_source=x',
      'https://forms.gle/zzz',
    ]);
    expect(links.map((l) => l.url)).toEqual([
      'https://witchform.com/formViewer.php?fidx=77',
      'https://forms.gle/zzz',
    ]);
    expect(links.every((l) => !l.truncated)).toBe(true);
  });

  it('flags a truncated URL when no full link is available', () => {
    const [link] = extractLinks(normalizeText('https://witchform.com/formView…'));
    expect(link?.url).toBe('https://witchform.com/formView');
    expect(link?.truncated).toBe(true);
  });
});

describe('pickFormLinks', () => {
  it('lists order forms before info pages', () => {
    const links = extractLinks('https://linktr.ee/a https://x.com/a/status/1 https://forms.gle/b');
    expect(pickFormLinks(links)).toEqual({
      formUrl: 'https://forms.gle/b\nhttps://linktr.ee/a',
      confidence: 0.9,
    });
  });

  it('falls back to non-social links with low confidence', () => {
    const links = extractLinks('https://x.com/a/status/1 https://myshop.example/preorder');
    expect(pickFormLinks(links)).toEqual({ formUrl: 'https://myshop.example/preorder', confidence: 0.3 });
  });

  it('returns nothing for social links only', () => {
    expect(pickFormLinks(extractLinks('https://x.com/a/status/1 https://youtu.be/b'))).toEqual({ confidence: 0 });
  });
});
