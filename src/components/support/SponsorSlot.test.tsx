// @vitest-environment happy-dom
import { act } from 'react';
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
import { getLanguage, setLanguage } from '@/i18n';
import type { AppLanguage } from '@/i18n/languages';
import type { SponsorFeed } from '@/lib/sponsor/feed';
import { FEED_CACHE_KEY, type FeedCacheEntry } from '@/lib/sponsor/loader';
import { SponsorSlot } from './SponsorSlot';
import { SupportCard } from './SupportCard';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const FEED: SponsorFeed = {
  version: 1,
  updatedAt: '2026-09-29T00:00:00Z',
  creatives: [
    {
      id: 'acme',
      placements: ['footer', 'analysis'],
      locales: ['*'],
      title: 'Gel pens for fan letters',
      body: 'Twelve colors',
      cta: 'Shop',
      clickUrl: 'https://acme.example/pens?ref=1#top',
      sponsorName: 'Acme Stationery',
    },
  ],
};

const tabsCreate = vi.fn((_props: { url: string }) => Promise.resolve({}));
const fetchMock = vi.fn(() => Promise.reject(new Error('offline')));
let initialLanguage: AppLanguage;
let root: Root | null = null;
let container: HTMLDivElement;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  initialLanguage = getLanguage();
  const cache: FeedCacheEntry = {
    feed: FEED,
    etag: null,
    fetchedAt: Date.now(),
  };
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (key: string) =>
          key === FEED_CACHE_KEY ? { [key]: structuredClone(cache) } : {},
        set: async () => {},
      },
    },
    tabs: { create: tabsCreate },
    runtime: { id: 'test-extension', getManifest: () => ({}) },
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterAll(() => {
  setLanguage(initialLanguage);
  vi.unstubAllGlobals();
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  tabsCreate.mockClear();
});

async function render(ui: React.ReactNode): Promise<HTMLDivElement> {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(ui);
  });
  // Let the cached feed load and the slot pick its creative.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return container;
}

function slot(placement: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(
    `aside[data-placement="${placement}"]`
  );
  if (!element) throw new Error(`no ${placement} slot`);
  return element;
}

describe('SponsorSlot', () => {
  it('labels the ad in the UI language and names the sponsor', async () => {
    setLanguage('ko');
    await render(<SponsorSlot placement="footer" />);
    const footer = slot('footer');
    expect(footer.getAttribute('aria-label')).toBe('광고 영역');
    expect(footer.textContent).toContain('광고');
    expect(footer.textContent).toContain('Acme Stationery');
    expect(footer.textContent).toContain('Gel pens for fan letters');
    expect(footer.textContent).not.toContain('Twelve colors');
  });

  it.each([
    ['en', 'Ad'],
    ['ja', '広告'],
    ['zh-CN', '广告'],
    ['zh-TW', '廣告'],
  ] as const)('uses the %s label', async (language, label) => {
    setLanguage(language);
    await render(<SponsorSlot placement="footer" />);
    const chip = slot('footer').querySelector('a span span span');
    expect(chip?.textContent).toBe(label);
  });

  it('makes the whole card one UTM-tagged link opened with chrome.tabs', async () => {
    setLanguage('en');
    await render(<SponsorSlot placement="footer" />);
    // Links inside the (closed) About ads dialog are not part of the card.
    const links = [...slot('footer').querySelectorAll('a')].filter(
      (a) => !a.closest('dialog')
    );
    expect(links).toHaveLength(1);
    const link = links[0]!;
    const href =
      'https://acme.example/pens?ref=1&utm_source=acorn-collector&utm_medium=sidepanel&utm_campaign=footer#top';
    expect(link.getAttribute('href')).toBe(href);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer sponsored');

    const click = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    act(() => {
      link.dispatchEvent(click);
    });
    expect(click.defaultPrevented).toBe(true);
    expect(tabsCreate).toHaveBeenCalledWith({ url: href });
  });

  it('leaves modified clicks to the browser', async () => {
    setLanguage('en');
    await render(<SponsorSlot placement="footer" />);
    const click = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
      ctrlKey: true,
    });
    // Record what the app did, then stop the test DOM from navigating.
    let preventedByApp: boolean | undefined;
    const guard = (event: Event) => {
      preventedByApp = event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener('click', guard);
    act(() => {
      slot('footer').querySelector('a')!.dispatchEvent(click);
    });
    document.removeEventListener('click', guard);
    expect(preventedByApp).toBe(false);
    expect(tabsCreate).not.toHaveBeenCalled();
  });

  it('opens the About ads dialog from the (i) button outside the link', async () => {
    setLanguage('en');
    await render(<SponsorSlot placement="footer" />);
    const button = slot('footer').querySelector<HTMLButtonElement>(
      'button[aria-label="About this ad"]'
    );
    expect(button).not.toBeNull();
    expect(button?.closest('a')).toBeNull();

    const dialog = slot('footer').querySelector('dialog')!;
    expect(dialog.open).toBe(false);
    act(() => button!.click());
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain(
      'chosen only by your display language'
    );
    // The feed host of this build, not a hard-coded name.
    expect(dialog.textContent).toContain(
      'downloaded from raw.githubusercontent.com'
    );
    const policy = [...dialog.querySelectorAll('a')].find((a) =>
      a.textContent?.includes('Privacy policy')
    );
    expect(policy?.getAttribute('href')).toMatch(/PRIVACY\.md#ads-en$/);
  });

  it('shows a body on larger placements and falls back to house promos', async () => {
    setLanguage('en');
    await render(
      <>
        <SponsorSlot placement="analysis" />
        <SponsorSlot placement="settings" />
      </>
    );
    expect(slot('analysis').textContent).toContain('Twelve colors');
    // The feed has nothing for settings, so a bundled promo fills it.
    expect(slot('settings').textContent).toContain('Acorn Collector');
    expect(slot('settings').textContent).not.toContain('Acme');
  });

  it('never shows the same creative in two slots', async () => {
    setLanguage('en');
    await render(
      <>
        <SponsorSlot placement="footer" />
        <SponsorSlot placement="analysis" />
      </>
    );
    const shown = ['footer', 'analysis'].filter((placement) =>
      slot(placement).textContent?.includes('Acme')
    );
    expect(shown).toHaveLength(1);
  });

  it('does not fetch while the cached feed is fresh', () => {
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('SupportCard', () => {
  it('shows the thank-you, the donation links and the no-paywall promise', async () => {
    setLanguage('en');
    await render(<SupportCard />);
    const text = container.textContent ?? '';
    expect(text).toContain('Thanks for using Acorn Collector!');
    expect(text).toContain('Every feature stays free.');
    const links = [...container.querySelectorAll('a')].map((a) => ({
      text: a.textContent,
      href: a.getAttribute('href'),
    }));
    // Buy Me a Coffee has no default handle, so only GitHub Sponsors shows.
    expect(links).toEqual([
      {
        text: 'GitHub Sponsors (opens in a new tab)',
        href: 'https://github.com/sponsors/jay05410',
      },
    ]);
  });
});
