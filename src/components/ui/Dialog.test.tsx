// @vitest-environment happy-dom
import { act, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog, Dialog } from './Dialog';
import { CoveredLayer } from './Layer';
import { byRole, byText, cleanup, click, press, render } from './test-utils';

afterEach(cleanup);

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <Dialog
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        title="Export"
        description="Pick a format"
        footer={<button type="button">last</button>}
      >
        <button type="button">first in body</button>
        <input aria-label="skipped" disabled />
      </Dialog>
    </>
  );
}

function openHarness(onClose?: () => void) {
  render(<Harness onClose={onClose} />);
  const opener = byText('open');
  opener.focus();
  click(opener);
  const dialog = byRole('dialog')[0];
  if (!dialog) throw new Error('dialog not rendered');
  return { opener, dialog };
}

describe('Dialog', () => {
  it('renders a labelled modal dialog in a portal', () => {
    const { dialog } = openHarness();
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const title = document.getElementById(
      dialog.getAttribute('aria-labelledby') ?? ''
    );
    expect(title?.textContent).toBe('Export');
    const description = document.getElementById(
      dialog.getAttribute('aria-describedby') ?? ''
    );
    expect(description?.textContent).toBe('Pick a format');
  });

  it('moves focus to the first focusable element of the body', () => {
    openHarness();
    expect(document.activeElement?.textContent).toBe('first in body');
  });

  it('keeps Tab focus inside, wrapping at both ends', () => {
    const { dialog } = openHarness();
    const last = byText('last');
    const close = dialog.querySelector<HTMLElement>('[aria-label="Close"]');
    expect(close).not.toBeNull();

    last.focus();
    press(last, 'Tab');
    expect(document.activeElement).toBe(close);

    press(close, 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('closes on Escape and restores focus to the opener', () => {
    const onClose = vi.fn();
    const { opener } = openHarness(onClose);
    press(document.activeElement, 'Escape');
    expect(onClose).toHaveBeenCalledOnce();
    expect(byRole('dialog')).toHaveLength(0);
    expect(document.activeElement).toBe(opener);
  });

  it('closes from the close button', () => {
    const onClose = vi.fn();
    const { dialog } = openHarness(onClose);
    click(dialog.querySelector('[aria-label="Close"]'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('locks body scroll while open', () => {
    document.body.style.overflow = 'auto';
    const { dialog } = openHarness();
    expect(document.body.style.overflow).toBe('hidden');
    press(dialog, 'Escape');
    expect(document.body.style.overflow).toBe('auto');
  });

  it('keeps an autofocused child focused and returns focus to the opener', () => {
    function AutoFocusHarness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            open
          </button>
          <Dialog open={open} onClose={() => setOpen(false)} title="Rename">
            <button type="button">before</button>
            <input aria-label="Name" autoFocus />
          </Dialog>
        </>
      );
    }
    render(<AutoFocusHarness />);
    const opener = byText('open');
    opener.focus();
    click(opener);
    const input = document.querySelector('input[aria-label="Name"]');
    expect(document.activeElement).toBe(input);
    press(input, 'Escape');
    expect(byRole('dialog')).toHaveLength(0);
    expect(document.activeElement).toBe(opener);
  });

  it('lets only the innermost of nested dialogs handle Escape', () => {
    const outerClose = vi.fn();
    const innerClose = vi.fn();
    render(
      <Dialog open onClose={outerClose} title="Outer">
        <button type="button">outer action</button>
        <Dialog open onClose={innerClose} title="Inner">
          <button type="button">inner action</button>
        </Dialog>
      </Dialog>
    );
    const inner = byText('inner action');
    expect(document.activeElement).toBe(inner);
    press(inner, 'Escape');
    expect(innerClose).toHaveBeenCalledOnce();
    expect(outerClose).not.toHaveBeenCalled();
  });
});

describe('Dialog under a covering layer', () => {
  function Covered({ covered }: { covered: boolean }) {
    return (
      <>
        <CoveredLayer covered={covered}>
          <Dialog open onClose={() => {}} title="Review">
            <button type="button">first</button>
            <button type="button">second</button>
          </Dialog>
        </CoveredLayer>
        {covered && (
          <div>
            <input aria-label="settings field" />
          </div>
        )}
      </>
    );
  }

  it('stays open but inert, leaves the focus to the layer on top, and takes it back after', () => {
    const { rerender } = render(<Covered covered={false} />);
    const second = byText('second');
    second.focus();
    rerender(<Covered covered />);
    const dialog = byRole('dialog')[0];
    expect(dialog?.closest('[inert]')).not.toBeNull();
    const field = document.querySelector<HTMLInputElement>('input[aria-label="settings field"]');
    act(() => field?.focus());
    expect(document.activeElement).toBe(field);

    rerender(<Covered covered={false} />);
    expect(dialog?.closest('[inert]')).toBeNull();
    expect(document.activeElement).toBe(second);
  });
});

describe('ConfirmDialog', () => {
  function Confirm({ onConfirm }: { onConfirm: () => void }) {
    const [open, setOpen] = useState(true);
    return (
      <ConfirmDialog
        open={open}
        title="Comiket 108"
        description="Delete this event?"
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onCancel={() => setOpen(false)}
      />
    );
  }

  it('is an alertdialog that starts on Cancel', () => {
    render(<Confirm onConfirm={() => {}} />);
    expect(byRole('alertdialog')).toHaveLength(1);
    expect(document.activeElement?.textContent).toBe('Cancel');
  });

  it('confirms with the destructive button', async () => {
    const onConfirm = vi.fn();
    render(<Confirm onConfirm={onConfirm} />);
    await act(async () => byText('Delete').click());
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
