// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { formatDate } from '@/i18n';
import { DatePicker } from './DatePicker';
import { Field } from './Field';
import { cleanup, render } from './test-utils';

afterEach(cleanup);

/** Accessible name from aria-labelledby, else a <label for>, else content. */
function accessibleName(el: HTMLElement): string {
  const ids = el.getAttribute('aria-labelledby');
  if (ids) {
    return ids
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ');
  }
  const label = el.id
    ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
    : null;
  return (label ?? el).textContent?.trim() ?? '';
}

function trigger(): HTMLButtonElement {
  const button = document.querySelector('button[aria-haspopup="dialog"]');
  if (!(button instanceof HTMLButtonElement)) throw new Error('no trigger');
  return button;
}

describe('DatePicker', () => {
  it('names the trigger with the field label and the chosen date', () => {
    render(
      <Field label="Event date">
        <DatePicker value="2026-10-17" onChange={() => {}} />
      </Field>
    );
    expect(accessibleName(trigger())).toBe(
      `Event date ${formatDate('2026-10-17')}`
    );
  });

  it('keeps the label as the target of label clicks', () => {
    render(
      <Field label="Event date">
        <DatePicker value="" onChange={() => {}} placeholder="Pick a date" />
      </Field>
    );
    const label = document.querySelector('label');
    expect(label?.getAttribute('for')).toBe(trigger().id);
    expect(accessibleName(trigger())).toBe('Event date Pick a date');
  });

  it('is named by its content outside a field', () => {
    render(<DatePicker value="2026-10-17" onChange={() => {}} />);
    expect(trigger().hasAttribute('aria-labelledby')).toBe(false);
    expect(accessibleName(trigger())).toBe(formatDate('2026-10-17'));
  });
});
