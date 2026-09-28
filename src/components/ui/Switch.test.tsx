// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field } from './Field';
import { Switch } from './Switch';
import { byRole, cleanup, click, render } from './test-utils';

afterEach(cleanup);

function Controlled({ disabled = false }: { disabled?: boolean }) {
  const [on, setOn] = useState(false);
  return (
    <Field label="Analyze automatically">
      <Switch checked={on} onCheckedChange={setOn} disabled={disabled} />
    </Field>
  );
}

describe('Switch', () => {
  it('is a focusable native button with role switch', () => {
    render(<Controlled />);
    const toggle = byRole('switch')[0];
    // A <button type="button"> gets Space/Enter activation from the browser.
    expect(toggle?.tagName).toBe('BUTTON');
    expect(toggle?.getAttribute('type')).toBe('button');
    toggle?.focus();
    expect(document.activeElement).toBe(toggle);
  });

  it('is named by its Field label', () => {
    render(<Controlled />);
    const toggle = byRole('switch')[0];
    const label = document.querySelector('label');
    expect(label?.htmlFor).toBe(toggle?.id);
    expect(label?.textContent).toBe('Analyze automatically');
  });

  it('toggles aria-checked on activation', () => {
    render(<Controlled />);
    const toggle = byRole('switch')[0] ?? null;
    expect(toggle?.getAttribute('aria-checked')).toBe('false');
    click(toggle);
    expect(toggle?.getAttribute('aria-checked')).toBe('true');
    click(toggle);
    expect(toggle?.getAttribute('aria-checked')).toBe('false');
  });

  it('does not toggle when disabled', () => {
    render(<Controlled disabled />);
    const toggle = byRole('switch')[0] ?? null;
    click(toggle);
    expect(toggle?.getAttribute('aria-checked')).toBe('false');
  });

  it('respects a preventDefault from onClick', () => {
    const onCheckedChange = vi.fn();
    render(
      <Switch
        aria-label="Sync"
        checked={false}
        onCheckedChange={onCheckedChange}
        onClick={(event) => event.preventDefault()}
      />
    );
    click(byRole('switch')[0] ?? null);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
