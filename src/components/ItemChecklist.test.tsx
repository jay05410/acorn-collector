// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setLanguage } from '@/i18n';
import { db } from '@/lib/db';
import type { Item } from '@/types';
import { ItemChecklist } from './ItemChecklist';
import { ToastViewport } from './ui/ToastViewport';
import { clearToasts } from './ui/toast-store';
import { byRole, byText, cleanup, render } from './ui/test-utils';

const ITEM: Item = {
  id: 'i1',
  boothId: 'b1',
  name: 'Acrylic keyring',
  originalName: null,
  price: 5000,
  currency: null,
  category: null,
  option: null,
  badgeId: 'purchase',
  checked: true,
  quantity: 1,
  createdAt: 123,
};

async function waitFor(check: () => void, timeout = 2000): Promise<void> {
  const start = Date.now();
  for (;;) {
    try {
      check();
      return;
    } catch (error) {
      if (Date.now() - start > timeout) throw error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
  }
}

async function clickAsync(target: Element | null): Promise<void> {
  if (!(target instanceof HTMLElement)) throw new Error('click: no target');
  await act(async () => target.click());
}

function button(label: string): HTMLButtonElement {
  const found = document.querySelector(`button[aria-label="${label}"]`);
  if (!(found instanceof HTMLButtonElement)) throw new Error(`no ${label}`);
  return found;
}

async function renderChecklist(item: Item): Promise<void> {
  await db.items.put(item);
  render(
    <>
      <ItemChecklist boothId={item.boothId} currency="KRW" />
      <ToastViewport />
    </>
  );
  await waitFor(() => byText(item.name));
}

beforeEach(async () => {
  setLanguage('en');
  await db.items.clear();
});

afterEach(() => {
  act(() => clearToasts());
  cleanup();
});

describe('ItemChecklist', () => {
  it('deletes an item and puts it back from the Undo toast', async () => {
    await renderChecklist(ITEM);

    await clickAsync(button('Delete'));
    await waitFor(() => byText(`Deleted "${ITEM.name}"`));
    expect(await db.items.get(ITEM.id)).toBeUndefined();
    expect(() => byText(ITEM.name)).toThrow();

    await clickAsync(byText('Undo'));
    await waitFor(() => byText(ITEM.name));
    expect(await db.items.get(ITEM.id)).toEqual(ITEM);
  });

  it('keeps a stored quantity above the input limit when saved untouched', async () => {
    await renderChecklist({ ...ITEM, quantity: 1500 });

    await clickAsync(button('Edit'));
    const quantity = byRole('spinbutton')[0];
    expect(quantity?.getAttribute('aria-valuenow')).toBe('1500');
    expect(quantity?.getAttribute('aria-valuemax')).toBe('1500');

    await clickAsync(byText('Save'));
    await waitFor(() => expect(byRole('spinbutton')).toHaveLength(0));
    expect((await db.items.get(ITEM.id))?.quantity).toBe(1500);

    await clickAsync(button('Edit'));
    await clickAsync(button('Decrease'));
    await clickAsync(byText('Save'));
    await waitFor(() => expect(byRole('spinbutton')).toHaveLength(0));
    expect((await db.items.get(ITEM.id))?.quantity).toBe(1499);
  });
});
