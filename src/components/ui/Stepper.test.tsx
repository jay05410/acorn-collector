// @vitest-environment happy-dom
import { act, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Field } from './Field';
import { Stepper } from './Stepper';
import { byRole, cleanup, click, press, render } from './test-utils';

afterEach(cleanup);

function Controlled({ initial = 1 }: { initial?: number }) {
  const [value, setValue] = useState(initial);
  return (
    <Field label="Quantity" group>
      <Stepper value={value} onChange={setValue} min={1} max={5} />
    </Field>
  );
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
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      setter?.call(input, '42');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    press(input, 'Enter');
    expect(spin().value).toBe('5');
  });
});
