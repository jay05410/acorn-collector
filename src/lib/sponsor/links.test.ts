import { afterEach, describe, expect, it, vi } from 'vitest';
import { openExternal, withUtm } from './links';

const TAGS = 'utm_source=acorn-collector&utm_medium=sidepanel';

describe('withUtm', () => {
  it('adds the tags to a URL without a query', () => {
    expect(withUtm('https://acme.example/pens', 'footer')).toBe(
      `https://acme.example/pens?${TAGS}&utm_campaign=footer`
    );
  });

  it('appends to an existing query without re-encoding it', () => {
    expect(withUtm('https://acme.example/s?q=a%20b&tag=x+y', 'analysis')).toBe(
      `https://acme.example/s?q=a%20b&tag=x+y&${TAGS}&utm_campaign=analysis`
    );
  });

  it('keeps the fragment after the query', () => {
    expect(withUtm('https://acme.example/p#reviews', 'settings')).toBe(
      `https://acme.example/p?${TAGS}&utm_campaign=settings#reviews`
    );
    expect(withUtm('https://acme.example/p?id=1#top', 'footer')).toBe(
      `https://acme.example/p?id=1&${TAGS}&utm_campaign=footer#top`
    );
  });

  it('handles a dangling ? or &', () => {
    expect(withUtm('https://acme.example/p?', 'footer')).toBe(
      `https://acme.example/p?${TAGS}&utm_campaign=footer`
    );
    expect(withUtm('https://acme.example/p?a=1&', 'footer')).toBe(
      `https://acme.example/p?a=1&${TAGS}&utm_campaign=footer`
    );
  });

  it("keeps the sponsor's own utm values", () => {
    expect(withUtm('https://acme.example/?utm_campaign=autumn', 'footer')).toBe(
      `https://acme.example/?utm_campaign=autumn&${TAGS}`
    );
  });

  it('leaves mailto and invalid links alone', () => {
    expect(withUtm('mailto:ads@acme.example', 'footer')).toBe(
      'mailto:ads@acme.example'
    );
    expect(withUtm('not a url', 'footer')).toBe('not a url');
  });
});

describe('openExternal', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens a tab through chrome.tabs', () => {
    const create = vi.fn(() => Promise.resolve({}));
    const open = vi.fn();
    vi.stubGlobal('chrome', { tabs: { create } });
    vi.stubGlobal('window', { open });
    openExternal('https://acme.example/');
    expect(create).toHaveBeenCalledWith({ url: 'https://acme.example/' });
    expect(open).not.toHaveBeenCalled();
  });

  it('falls back to window.open without chrome.tabs', () => {
    const open = vi.fn();
    vi.stubGlobal('chrome', undefined);
    vi.stubGlobal('window', { open });
    openExternal('https://acme.example/');
    expect(open).toHaveBeenCalledWith(
      'https://acme.example/',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('falls back to window.open when chrome.tabs fails', async () => {
    const open = vi.fn();
    vi.stubGlobal('chrome', {
      tabs: { create: () => Promise.reject(new Error('no tabs')) },
    });
    vi.stubGlobal('window', { open });
    openExternal('https://acme.example/');
    await vi.waitFor(() => expect(open).toHaveBeenCalledOnce());
  });
});
