// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bestSrcsetUrl,
  collectLinks,
  imageFromElement,
  isInViewport,
  largeImagesInView,
  readRichText,
  selectionTarget,
} from './dom';

// In a content script the base is the document's own URL, which is also what
// img.currentSrc resolves against.
const BASE = new URL('/page', window.location.href).href;
const ORIGIN = new URL(BASE).origin;

function rect(width: number, height: number, top = 0): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    left: 0,
    bottom: top + height,
    right: width,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('readRichText', () => {
  it('keeps emoji alt text, line breaks and block boundaries', () => {
    document.body.innerHTML =
      '<div id="r"><span>Hi </span><img alt="👋"><br><span>there</span><p>Block</p><script>x()</script></div>';
    expect(readRichText(document.getElementById('r') as Element)).toBe('Hi 👋\nthere\nBlock');
  });
});

describe('bestSrcsetUrl', () => {
  it('prefers the widest candidate, then the highest density', () => {
    expect(bestSrcsetUrl('a.jpg 480w, b.jpg 1600w, c.jpg 800w')).toBe('b.jpg');
    expect(bestSrcsetUrl('a.jpg, b.jpg 2x, c.jpg 1.5x')).toBe('b.jpg');
    expect(bestSrcsetUrl('')).toBeNull();
    expect(bestSrcsetUrl(null)).toBeNull();
  });
});

describe('imageFromElement', () => {
  it('uses lazy-load attributes behind a data: placeholder', () => {
    document.body.innerHTML =
      '<img id="i" src="data:image/gif;base64,R0lGOD" data-src="/real.jpg" alt=" Poster ">';
    expect(imageFromElement(document.getElementById('i') as HTMLImageElement, BASE)).toEqual({
      url: `${ORIGIN}/real.jpg`,
      alt: 'Poster',
    });
  });

  it('reports natural size only for the loaded URL', () => {
    document.body.innerHTML = '<img id="i" src="/a.jpg">';
    const img = document.getElementById('i') as HTMLImageElement;
    vi.spyOn(img, 'naturalWidth', 'get').mockReturnValue(640);
    vi.spyOn(img, 'naturalHeight', 'get').mockReturnValue(480);
    expect(imageFromElement(img, BASE)).toEqual({
      url: `${ORIGIN}/a.jpg`,
      width: 640,
      height: 480,
    });
    img.setAttribute('srcset', '/a.jpg 640w, /a-2x.jpg 1280w');
    expect(imageFromElement(img, BASE)).toEqual({ url: `${ORIGIN}/a-2x.jpg` });
  });

  it('rejects images without an http URL', () => {
    document.body.innerHTML = '<img id="i" src="data:image/png;base64,AAAA">';
    expect(imageFromElement(document.getElementById('i') as HTMLImageElement, BASE)).toBeNull();
  });
});

describe('viewport helpers', () => {
  it('detects on-screen elements and ranks large visible images by area', () => {
    document.body.innerHTML =
      '<img id="small" src="/s.jpg"><img id="big" src="/b.jpg"><img id="off" src="/o.jpg"><img id="mid" src="/m.jpg">';
    const byId = (id: string) => document.getElementById(id) as HTMLElement;
    vi.spyOn(byId('small'), 'getBoundingClientRect').mockReturnValue(rect(100, 100));
    vi.spyOn(byId('big'), 'getBoundingClientRect').mockReturnValue(rect(600, 400));
    vi.spyOn(byId('off'), 'getBoundingClientRect').mockReturnValue(rect(600, 400, 5000));
    vi.spyOn(byId('mid'), 'getBoundingClientRect').mockReturnValue(rect(300, 300));

    expect(isInViewport(byId('big'))).toBe(true);
    expect(isInViewport(byId('off'))).toBe(false);
    expect(largeImagesInView(document, BASE).map((image) => image.url)).toEqual([
      `${ORIGIN}/b.jpg`,
      `${ORIGIN}/m.jpg`,
    ]);
  });
});

describe('collectLinks', () => {
  it('resolves http links and can skip same-host ones', () => {
    document.body.innerHTML =
      '<a href="/about">a</a><a href="https://o.com/x">b</a><a href="mailto:a@b.c">c</a><a href="#top">d</a>';
    expect(collectLinks(document.body, BASE)).toEqual([
      `${ORIGIN}/about`,
      'https://o.com/x',
      `${ORIGIN}/page#top`,
    ]);
    expect(collectLinks(document.body, BASE, { externalOnly: true })).toEqual(['https://o.com/x']);
  });
});

describe('selectionTarget', () => {
  it('returns the element holding a non-empty selection', () => {
    document.body.innerHTML = '<p id="p">Select me</p>';
    const text = document.getElementById('p')?.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 6);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    expect(selectionTarget(window)?.id).toBe('p');
    selection?.removeAllRanges();
    expect(selectionTarget(window)).toBeNull();
  });
});
