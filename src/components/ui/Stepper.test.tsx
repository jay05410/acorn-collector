// @vitest-environment happy-dom
import { act, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field } from './Field';
import { Stepper } from './Stepper';
import { byRole, cleanup, click, press, render } from './test-utils';

afterEach(cleanup);

function Controlled({
  initial = 1,
  onChange,
}: {
  initial?: number;
  onChange?: (value: number) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Field label="Quantity" group>
      <Stepper
        value={value}
        onChange={(next) => {
          onChange?.(next);
          setValue(next);
        }}
        min={1}
        max={5}
      />
    </Field>
  );
}

function type(input: HTMLInputElement, text: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;
    setter?.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function buttons() {
  const [decrease, increase] = [
    ...document.querySelectorAll<HTMLButtonElement>('button'),
  ];
  if (!decrease || !increase) throw new Error('no step buttons');
  return { decrease, increase };
}

function spin(): HTMLInputElement {
  const input = byRole('spinbutton')[0];
  if (!(input instanceof HTMLInputElement)) throw new Error('no spinbutton');
  return input;
}

describe('Stepper', () => {
  it('exposes a labelled spinbutton with its range', () => {
    render(<Controlled initial={2} />);
    const input = spin();
    const label = document.getElementById(
      input.getAttribute('aria-labelledby') ?? ''
    );
    expect(label?.textContent).toBe('Quantity');
    expect(input.getAttribute('aria-valuenow')).toBe('2');
    expect(input.getAttribute('aria-valuemin')).toBe('1');
    expect(input.getAttribute('aria-valuemax')).toBe('5');
  });

  it('steps with arrow keys and clamps to the range', () => {
    render(<Controlled initial={4} />);
    press(spin(), 'ArrowUp');
    expect(spin().value).toBe('5');
    press(spin(), 'ArrowUp');
    expect(spin().value).toBe('5');
    press(spin(), 'Home');
    expect(spin().value).toBe('1');
    press(spin(), 'ArrowDown');
    expect(spin().value).toBe('1');
    press(spin(), 'End');
    expect(spin().value).toBe('5');
  });

  it('disables the buttons at the bounds', () => {
    render(<Controlled initial={1} />);
    const [decrease, increase] = [
      ...document.querySelectorAll<HTMLButtonElement>('button'),
    ];
    expect(decrease?.disabled).toBe(true);
    click(increase ?? null);
    expect(spin().value).toBe('2');
    expect(decrease?.disabled).toBe(false);
  });

  it('commits typed values on Enter, clamped', () => {
    render(<Controlled />);
    const input = spin();
    type(input, '42');
    press(input, 'Enter');
    expect(spin().value).toBe('5');
  });

  it('lets Enter submit the surrounding form after committing', () => {
    render(<Controlled />);
    const input = spin();
    type(input, '3');
    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      input.dispatchEvent(enter);
    });
    expect(enter.defaultPrevented).toBe(false);
    expect(spin().value).toBe('3');
    expect(spin().getAttribute('aria-valuenow')).toBe('3');
  });

  it('steps from the typed value when it is not committed yet', () => {
    render(<Controlled initial={1} />);
    type(spin(), '3');
    press(spin(), 'ArrowUp');
    expect(spin().value).toBe('4');
    type(spin(), '4');
    press(spin(), 'PageDown');
    expect(spin().value).toBe('1');
  });

  describe('with a stored value above max', () => {
    it('shows it untouched with a consistent range', () => {
      const onChange = vi.fn();
      render(<Controlled initial={150} onChange={onChange} />);
      const input = spin();
      expect(input.value).toBe('150');
      expect(input.getAttribute('aria-valuenow')).toBe('150');
      expect(input.getAttribute('aria-valuemax')).toBe('150');
      expect(buttons().increase.disabled).toBe(true);
      expect(buttons().decrease.disabled).toBe(false);

      // Focus in and out, End and ArrowUp: nothing changes the value.
      act(() => input.focus());
      act(() => input.blur());
      press(input, 'End');
      press(input, 'ArrowUp');
      expect(onChange).not.toHaveBeenCalled();
      expect(spin().value).toBe('150');
    });

    it('steps down by one instead of jumping to max', () => {
      render(<Controlled initial={150} />);
      press(spin(), 'ArrowDown');
      expect(spin().value).toBe('149');
      click(buttons().decrease);
      expect(spin().value).toBe('148');
      expect(spin().getAttribute('aria-valuemax')).toBe('148');
    });

    it('keeps a retyped stored value and clamps typed values to the range', () => {
      const onChange = vi.fn();
      render(<Controlled initial={150} onChange={onChange} />);
      type(spin(), '150');
      press(spin(), 'Enter');
      expect(onChange).not.toHaveBeenCalled();
      type(spin(), '900');
      press(spin(), 'Enter');
      expect(spin().value).toBe('150');
      type(spin(), '0');
      press(spin(), 'Enter');
      expect(spin().value).toBe('1');
    });
  });
});
