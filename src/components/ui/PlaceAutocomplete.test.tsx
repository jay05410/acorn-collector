// @vitest-environment happy-dom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '@/i18n';
import { PlaceAutocomplete } from './PlaceAutocomplete';
import { byRole, cleanup, render } from './test-utils';

const never = new Promise<never>(() => {});

vi.mock('@/lib/kakao', () => ({
  hasKakaoApiKey: () => true,
  searchPlaces: () => never,
}));
vi.mock('@/lib/google-places', () => ({
  hasGooglePlacesApiKey: () => true,
  searchGooglePlaces: () => never,
}));

beforeEach(() => {
  vi.useFakeTimers();
  setLanguage('en');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function typeInto(input: HTMLInputElement, text: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;
    setter?.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('PlaceAutocomplete', () => {
  it('shows the loading status without adding anything to the flow', () => {
    render(<PlaceAutocomplete value="" onChange={() => {}} />);
    const input = byRole('combobox')[0] as HTMLInputElement;
    typeInto(input, 'Coex');
    act(() => vi.advanceTimersByTime(300));

    const status = byRole('status')[0];
    expect(status?.textContent).toBe('Loading...');
    const container = input.parentElement;
    expect(status?.parentElement).toBe(container);
    // The input is the only in-flow child: the icon and the status are
    // positioned over it, so the field keeps its height while loading.
    const inFlow = [...(container?.children ?? [])].filter(
      (child) => !child.classList.contains('absolute')
    );
    expect(inFlow).toEqual([input]);
  });
});
