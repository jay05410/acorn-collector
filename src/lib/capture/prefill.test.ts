import { describe, expect, it } from 'vitest';
import { parseBoothText } from '@/lib/parser/text';
import { MAX_PREFILL_LINKS, prefillFromHandoff } from './prefill';
import { createSnapshot } from './snapshot';
import type { CaptureHandoff, PageSnapshot } from './types';

function handoff(snapshot: Partial<PageSnapshot>): CaptureHandoff {
  return {
    id: 'h1',
    trigger: 'context-menu',
    snapshot: createSnapshot({ url: 'https://x.com/circle/status/1', capturedAt: 1, ...snapshot }),
    focusImageUrl: null,
    createdAt: 1,
    windowId: 3,
  };
}

describe('prefillFromHandoff', () => {
  it('maps text, canonical url, "name @handle" author and images', () => {
    const prefill = prefillFromHandoff(
      handoff({
        site: 'x',
        canonicalUrl: 'https://x.com/circle/status/1',
        url: 'https://x.com/i/status/1',
        text: 'Booth A-12 on both days',
        author: { name: 'Circle Acorn', handle: 'circle', url: null },
        images: [{ url: 'https://pbs.twimg.com/media/A.jpg' }, { url: 'https://pbs.twimg.com/media/B.jpg' }],
      })
    );
    expect(prefill).toEqual({
      text: 'Booth A-12 on both days',
      url: 'https://x.com/circle/status/1',
      author: 'Circle Acorn @circle',
      imageUrls: [
        'https://pbs.twimg.com/media/A?format=jpg&name=orig',
        'https://pbs.twimg.com/media/B?format=jpg&name=orig',
      ],
    });
    // The parser reads the circle name back out of the author label.
    expect(parseBoothText(prefill.text, { author: prefill.author }).circleName).toBe('Circle Acorn');
  });

  it('appends links missing from the text so the parser offers them as form URLs', () => {
    const prefill = prefillFromHandoff(
      handoff({
        text: 'Order here: https://shop.example.com/a',
        links: ['https://forms.example.org/f1', 'https://shop.example.com/a'],
      })
    );
    expect(prefill.text).toBe('Order here: https://shop.example.com/a\n\nhttps://forms.example.org/f1');
    expect(parseBoothText(prefill.text).formUrl).toBe(
      'https://shop.example.com/a\nhttps://forms.example.org/f1'
    );
  });

  it('caps appended links and falls back to the selection', () => {
    const links = Array.from({ length: 8 }, (_, index) => `https://e${index}.example.com/`);
    const prefill = prefillFromHandoff(handoff({ text: '', selection: 'Booth B-3', links }));
    expect(prefill.text).toBe(`Booth B-3\n\n${links.slice(0, MAX_PREFILL_LINKS).join('\n')}`);
  });

  it('omits missing author and images', () => {
    const prefill = prefillFromHandoff(handoff({ text: 'Hello', author: null, images: [] }));
    expect(prefill.author).toBeUndefined();
    expect(prefill.imageUrls).toBeUndefined();
    expect(prefillFromHandoff(handoff({ author: { name: null, handle: 'solo', url: null } })).author).toBe('@solo');
  });
});
