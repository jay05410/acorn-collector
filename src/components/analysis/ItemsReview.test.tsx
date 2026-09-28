// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { act, useReducer } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@/components/ui/test-utils';
import type { ExtractedItem } from '@/lib/ai/types';
import { ItemsReview } from './ItemsReview';
import { reviewReducer, toItemRecords, type IncomingRow, type ReviewRow } from './items-review-state';

function item(name: string, price: number): ExtractedItem {
  return { name, originalName: null, price, category: 'other', options: [] };
}

let rows: ReviewRow[] = [];

function Harness({ incoming }: { incoming: IncomingRow[] }) {
  const [state, dispatch] = useReducer(reviewReducer, incoming, (initial) =>
    reviewReducer([], { type: 'sync', rows: initial })
  );
  rows = state;
  return (
    <ItemsReview
      rows={state}
      dispatch={dispatch}
      fallbackCurrency="KRW"
      badgeId="pickup"
      onBadgeChange={() => undefined}
      loading={false}
    />
  );
}

function currencySelects(): HTMLSelectElement[] {
  return [...document.querySelectorAll<HTMLSelectElement>('select')].filter((select) =>
    select.getAttribute('aria-label')?.startsWith('Currency of')
  );
}

afterEach(() => cleanup());

describe('ItemsReview currency', () => {
  it('marks a row whose currency is unknown and lets the user pick one', () => {
    render(
      <Harness
        incoming={[
          { key: 'a', item: item('Book', 800), currency: undefined },
          { key: 'b', item: item('Keyring', 5000), currency: 'KRW' },
        ]}
      />
    );
    // Only the unknown row gets a currency picker, preset to the event currency.
    const [select] = currencySelects();
    expect(currencySelects()).toHaveLength(1);
    expect(select?.getAttribute('aria-label')).toBe('Currency of Book');
    expect(select?.value).toBe('KRW');
    expect(document.body.textContent).toContain('Currency not detected. Saved in KRW');
    expect(document.body.textContent).toContain('?');

    act(() => {
      select!.value = 'JPY';
      select!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(document.body.textContent).not.toContain('Currency not detected');
    const records = toItemRecords(rows, { boothId: 'b1', eventCurrency: 'KRW', badgeId: 'x', now: 1 });
    expect(records.map((r) => [r.name, r.currency])).toEqual([
      ['Book', 'JPY'],
      ['Keyring', null],
    ]);
  });
});
