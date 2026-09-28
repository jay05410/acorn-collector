// @vitest-environment happy-dom
import { act, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { AppLanguage } from '@/i18n/languages';
import type { Creative, Placement, SponsorFeed } from '@/lib/sponsor/feed';
import { FEED_CACHE_KEY, type FeedCacheEntry } from '@/lib/sponsor/loader';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const T0 = Date.UTC(2026, 9, 15, 12);

let cache: FeedCacheEntry | undefined;
let root: Root | null = null;
let container: HTMLDivElement;

function sponsor(id: string, overrides: Partial<Creative> = {}): Creative {
  return {
    id,
    placements: ['footer', 'analysis'],
    locales: ['*'],
    title: `Title ${id}`,
    clickUrl: `https://acme.example/${id}`,
    sponsorName: 'Acme',
    ...overrides,
  };
}

/**
 * A fresh module graph (store, selector, i18n) whose cached feed is `feed`,
 * so every test starts from a clean page.
 */
async function page(creatives: Creative[]) {
  const feed: SponsorFeed = {
    version: 1,
    updatedAt: '2026-10-01T00:00:00Z',
    creatives,
  };
  cache = { feed, etag: null, fetchedAt: Date.now() };
  vi.resetModules();
  const [{ SponsorSlot }, i18n] = await Promise.all([
    import('./SponsorSlot'),
    import('@/i18n'),
  ]);
  return {
    SponsorSlot: SponsorSlot as ComponentType<{ placement: Placement }>,
    setLanguage: (language: AppLanguage) => i18n.setLanguage(language),
  };
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function render(ui: React.ReactNode): Promise<void> {
  if (!root) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  }
  await act(async () => {
    root?.render(ui);
  });
  await settle();
}

function slotText(placement: Placement): string {
  const slot = container.querySelector(`aside[data-placement="${placement}"]`);
  if (!slot) throw new Error(`no ${placement} slot`);
  return slot.textContent ?? '';
}

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (key: string) =>
          key === FEED_CACHE_KEY && cache
            ? { [key]: structuredClone(cache) }
            : {},
        set: async () => {},
      },
    },
    tabs: { create: vi.fn() },
    runtime: { id: 'test-extension', getManifest: () => ({}) },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline')))
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  vi.useRealTimers();
});

describe('useSponsorCreative', () => {
  it('keeps each slot on its creative when a shared update re-picks', async () => {
    const { SponsorSlot, setLanguage } = await page([
      sponsor('ko-only', { placements: ['footer'], locales: ['ko'] }),
      sponsor('everyone'),
    ]);
    act(() => setLanguage('ko'));
    const Slots = ({ footer }: { footer: boolean }) => (
      <>
        {footer && <SponsorSlot placement="footer" />}
        <SponsorSlot placement="analysis" />
      </>
    );
    // Analysis mounts first and takes the only sponsor it may show...
    await render(<Slots footer={false} />);
    expect(slotText('analysis')).toContain('Title everyone');
    // ...so the footer, rendered before it, gets the Korean-only one.
    await render(<Slots footer />);
    expect(slotText('footer')).toContain('Title ko-only');

    // Switching language re-picks every slot. The footer must not take
    // the analysis slot's creative while that slot is re-picking.
    act(() => setLanguage('en'));
    await settle();
    expect(slotText('analysis')).toContain('Title everyone');
    expect(slotText('footer')).not.toContain('Title everyone');
    expect(slotText('footer')).not.toContain('Title ko-only');
  });

  it('rechecks date windows when the panel regains focus', async () => {
    vi.useFakeTimers({ now: T0, toFake: ['Date'] });
    const { SponsorSlot, setLanguage } = await page([
      sponsor('ending', {
        placements: ['footer'],
        endsAt: new Date(T0 + 60_000).toISOString(),
      }),
      sponsor('starting', {
        placements: ['analysis'],
        startsAt: new Date(T0 + 60_000).toISOString(),
      }),
    ]);
    act(() => setLanguage('en'));
    await render(
      <>
        <SponsorSlot placement="footer" />
        <SponsorSlot placement="analysis" />
      </>
    );
    expect(slotText('footer')).toContain('Title ending');
    expect(slotText('analysis')).not.toContain('Title starting');

    vi.setSystemTime(T0 + 60_000);
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await settle();
    // The ended sponsor leaves; the started one replaces a house promo.
    expect(slotText('footer')).not.toContain('Title ending');
    expect(slotText('analysis')).toContain('Title starting');
  });
});
