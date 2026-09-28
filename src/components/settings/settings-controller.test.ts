import { describe, expect, it, vi } from 'vitest';
import { applySettingsPatch, createDefaultSettings, type SettingsPatch } from '@/lib/storage';
import type { AppSettings } from '@/lib/settings-types';
import {
  createSettingsController,
  rollbackPatch,
  type SettingsBackend,
} from './settings-controller';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function base(): AppSettings {
  return { ...createDefaultSettings(), language: 'en' };
}

/**
 * In-memory storage. Saves are queued; each one resolves or rejects when the
 * test says so, like a slow chrome.storage.
 */
function manualBackend(initial: AppSettings) {
  let stored = initial;
  const listeners = new Set<(settings: AppSettings) => void>();
  const saves: { patch: SettingsPatch; done: Deferred<void> }[] = [];
  const backend: SettingsBackend = {
    load: vi.fn(async () => stored),
    save: vi.fn(async (patch: SettingsPatch) => {
      const done = deferred<void>();
      saves.push({ patch, done });
      await done.promise;
      stored = applySettingsPatch(stored, patch);
      for (const listener of listeners) listener(stored);
      return stored;
    }),
    watch: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    backend,
    saves,
    get stored() {
      return stored;
    },
    /** Another extension page writes settings. */
    external(patch: SettingsPatch) {
      stored = applySettingsPatch(stored, patch);
      for (const listener of listeners) listener(stored);
    },
  };
}

function setup(initial = base()) {
  const store = manualBackend(initial);
  const onChange = vi.fn<(settings: AppSettings) => void>();
  const onError = vi.fn<(error: unknown) => void>();
  const controller = createSettingsController(store.backend, { onChange, onError });
  return { store, controller, onChange, onError };
}

describe('rollbackPatch', () => {
  it('restores the fields a failed patch set', () => {
    const before = base();
    const patch: SettingsPatch = {
      colorTheme: 'pink',
      ai: { provider: 'openai', openai: { apiKey: 'sk-test' } },
    };
    const current = applySettingsPatch(before, patch);
    expect(rollbackPatch(current, before, patch)).toEqual(before);
  });

  it('keeps fields a later change replaced, and unrelated later changes', () => {
    const before = base();
    const failed: SettingsPatch = { colorTheme: 'pink', ai: { tier: 'accurate' } };
    const afterFailed = applySettingsPatch(before, failed);
    // Later optimistic changes: theme again, and an unrelated field.
    const current = applySettingsPatch(afterFailed, {
      colorTheme: 'sky',
      ai: { autoAnalyze: false },
    });
    const rolled = rollbackPatch(current, before, failed);
    expect(rolled.colorTheme).toBe('sky');
    expect(rolled.ai.tier).toBe('fast');
    expect(rolled.ai.autoAnalyze).toBe(false);
  });

  it('restores nested provider fields one by one', () => {
    const before = applySettingsPatch(base(), {
      ai: { openrouter: { apiKey: 'sk-or-old', connectedVia: 'manual' } },
    });
    const failed: SettingsPatch = {
      ai: { openrouter: { apiKey: 'sk-or-new', connectedVia: 'oauth' } },
    };
    const current = applySettingsPatch(before, failed);
    expect(rollbackPatch(current, before, failed).ai.openrouter).toEqual(
      before.ai.openrouter
    );
  });
});

describe('createSettingsController', () => {
  it('loads the stored settings', async () => {
    const { controller, onChange } = setup();
    await flush();
    expect(controller.get()).toEqual(base());
    expect(onChange).toHaveBeenCalledWith(base());
  });

  it('shows a change before it is saved, then keeps it', async () => {
    const { store, controller } = setup();
    await flush();
    const result = controller.update({ colorTheme: 'lavender' });
    expect(controller.get()?.colorTheme).toBe('lavender');
    store.saves[0]?.done.resolve();
    await expect(result).resolves.toBe(true);
    expect(controller.get()?.colorTheme).toBe('lavender');
    expect(store.stored.colorTheme).toBe('lavender');
  });

  it('rolls back and reports when saving fails', async () => {
    const { store, controller, onError } = setup();
    await flush();
    const result = controller.update({ ai: { provider: 'anthropic', tier: 'accurate' } });
    expect(controller.get()?.ai.provider).toBe('anthropic');
    const failure = new Error('QUOTA_BYTES exceeded');
    store.saves[0]?.done.reject(failure);
    await expect(result).resolves.toBe(false);
    expect(controller.get()?.ai.provider).toBeNull();
    expect(controller.get()?.ai.tier).toBe('fast');
    expect(onError).toHaveBeenCalledWith(failure);
  });

  it('keeps a later successful change when an earlier one fails', async () => {
    const { store, controller } = setup();
    await flush();
    const first = controller.update({ colorTheme: 'pink' });
    const second = controller.update({ ai: { autoAnalyze: false } });
    store.saves[0]?.done.reject(new Error('boom'));
    await expect(first).resolves.toBe(false);
    expect(controller.get()?.colorTheme).toBe('acorn');
    expect(controller.get()?.ai.autoAnalyze).toBe(false);
    await flush();
    store.saves[1]?.done.resolve();
    await expect(second).resolves.toBe(true);
    expect(controller.get()?.ai.autoAnalyze).toBe(false);
    expect(controller.get()?.colorTheme).toBe('acorn');
  });

  it('ignores storage echoes while its own writes are pending', async () => {
    const { store, controller } = setup();
    await flush();
    const first = controller.update({ colorTheme: 'pink' });
    const second = controller.update({ colorTheme: 'sky' });
    // The first write lands and echoes 'pink' while 'sky' is still pending.
    store.saves[0]?.done.resolve();
    await first;
    expect(controller.get()?.colorTheme).toBe('sky');
    await flush();
    store.saves[1]?.done.resolve();
    await second;
    expect(controller.get()?.colorTheme).toBe('sky');
  });

  it('follows changes made by other pages when idle', async () => {
    const { store, controller } = setup();
    await flush();
    store.external({ language: 'ja' });
    expect(controller.get()?.language).toBe('ja');
  });

  it('stops calling back after stop()', async () => {
    const { store, controller, onChange } = setup();
    await flush();
    onChange.mockClear();
    controller.stop();
    store.external({ language: 'ko' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('starts from given settings without loading', () => {
    const store = manualBackend(base());
    const initial = { ...base(), colorTheme: 'sky' as const };
    const controller = createSettingsController(
      store.backend,
      { onChange: vi.fn(), onError: vi.fn() },
      initial
    );
    expect(controller.get()).toBe(initial);
    expect(store.backend.load).not.toHaveBeenCalled();
  });
});
