// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field } from './Field';
import { SegmentedControl } from './SegmentedControl';
import { byRole, cleanup, click, press, render } from './test-utils';

afterEach(cleanup);

type Sort = 'order' | 'number' | 'name';

const OPTIONS = [
  { value: 'order', label: 'By order' },
  { value: 'number', label: 'By number' },
  { value: 'name', label: 'By name' },
] as const;

function Controlled({
  initial = 'order',
  onChange,
}: {
  initial?: Sort;
  onChange?: (value: Sort) => void;
}) {
  const [value, setValue] = useState<Sort>(initial);
  return (
    <SegmentedControl
      aria-label="Sort"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        onChange?.(next);
        setValue(next);
      }}
    />
  );
}

function radios(): HTMLElement[] {
  return byRole('radio');
}

function checkedLabel(): string | null | undefined {
  return radios().find((r) => r.getAttribute('aria-checked') === 'true')
    ?.textContent;
}

describe('SegmentedControl', () => {
  it('is a labelled radiogroup with one tab stop on the checked option', () => {
    render(<Controlled initial="number" />);
    const group = byRole('radiogroup')[0];
    expect(group?.getAttribute('aria-label')).toBe('Sort');
    expect(radios().map((r) => r.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    expect(radios().map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('moves selection and focus with arrow keys, wrapping at the ends', () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const [first, , last] = radios();
    first?.focus();

    press(first ?? null, 'ArrowRight');
    expect(checkedLabel()).toBe('By number');
    expect(document.activeElement?.textContent).toBe('By number');

    press(document.activeElement, 'ArrowDown');
    expect(checkedLabel()).toBe('By name');

    press(document.activeElement, 'ArrowRight');
    expect(checkedLabel()).toBe('By order');
    expect(document.activeElement).toBe(first);

    press(first ?? null, 'ArrowLeft');
    expect(document.activeElement).toBe(last);
    expect(onChange.mock.calls.map(([value]) => value)).toEqual([
      'number',
      'name',
      'order',
      'name',
    ]);
  });

  it('jumps with Home and End and ignores other keys', () => {
    const onChange = vi.fn();
    render(<Controlled initial="number" onChange={onChange} />);
    const middle = radios()[1] ?? null;
    press(middle, 'End');
    expect(checkedLabel()).toBe('By name');
    press(document.activeElement, 'Home');
    expect(checkedLabel()).toBe('By order');
    press(document.activeElement, 'a');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('selects on click and moves the tab stop', () => {
    render(<Controlled />);
    click(radios()[2] ?? null);
    expect(checkedLabel()).toBe('By name');
    expect(radios().map((r) => r.tabIndex)).toEqual([-1, -1, 0]);
  });

  it('takes its name from a surrounding group Field', () => {
    render(
      <Field label="Badge" group>
        <SegmentedControl
          variant="chips"
          options={OPTIONS}
          value="order"
          onChange={() => {}}
        />
      </Field>
    );
    const group = byRole('radiogroup')[0];
    const labelId = group?.getAttribute('aria-labelledby') ?? '';
    expect(document.getElementById(labelId)?.textContent).toBe('Badge');
  });
});
