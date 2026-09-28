/**
 * Minimal React DOM test harness for happy-dom tests (no testing-library).
 * Import only from *.test.tsx files that declare the happy-dom environment.
 */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: { root: Root; container: HTMLElement }[] = [];

export function render(ui: ReactNode): {
  container: HTMLElement;
  rerender: (next: ReactNode) => void;
} {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  act(() => root.render(ui));
  return {
    container,
    rerender: (next) => act(() => root.render(next)),
  };
}

/** Unmounts everything render() mounted; call from afterEach. */
export function cleanup(): void {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  document.body.innerHTML = '';
}

export function press(
  target: Element | null,
  key: string,
  options: KeyboardEventInit = {}
): void {
  if (!target) throw new Error(`press(${key}): no target`);
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...options,
      })
    );
  });
}

export function click(target: Element | null): void {
  if (!(target instanceof HTMLElement)) throw new Error('click: no target');
  act(() => target.click());
}

export function byRole(role: string, root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(`[role="${role}"]`)];
}

export function byText(text: string, root: ParentNode = document): HTMLElement {
  const match = [...root.querySelectorAll<HTMLElement>('*')].find(
    (el) => el.children.length === 0 && el.textContent === text
  );
  if (!match) throw new Error(`No element with text "${text}"`);
  return match;
}
