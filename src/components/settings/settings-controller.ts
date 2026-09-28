/**
 * Optimistic settings state shared by the settings screen and the first-run
 * notice. A change shows at once, is written with updateSettings(), and is
 * rolled back (with an error callback) if the write fails.
 */
import {
  applySettingsPatch,
  getSettings,
  updateSettings,
  watchSettings,
  type AISettingsPatch,
  type SettingsPatch,
} from '@/lib/storage';
import type { AISettings, AppSettings } from '@/lib/settings-types';

export interface SettingsBackend {
  load(): Promise<AppSettings>;
  /** Resolves with the stored settings after the patch. */
  save(patch: SettingsPatch): Promise<AppSettings>;
  /** Changes written by any extension page, including this one. */
  watch(listener: (settings: AppSettings) => void): () => void;
}

export const chromeSettingsBackend: SettingsBackend = {
  load: getSettings,
  save: updateSettings,
  watch: watchSettings,
};

const TOP_LEVEL_KEYS = [
  'colorTheme',
  'language',
  'defaultSortBy',
  'noticeAcceptedAt',
] as const;
const AI_KEYS = ['provider', 'tier', 'autoAnalyze'] as const;
const AI_GROUPS = ['openai', 'anthropic', 'openrouter', 'cli'] as const;

type AIGroup = (typeof AI_GROUPS)[number];
type Loose = Record<string, unknown>;

/**
 * Undoes a failed patch on `current`: each field the patch set goes back to
 * its value in `before`, unless a later change already replaced it (then the
 * later value is kept).
 */
export function rollbackPatch(
  current: AppSettings,
  before: AppSettings,
  patch: SettingsPatch
): AppSettings {
  const after = applySettingsPatch(before, patch);
  const inverse: SettingsPatch = {};
  const undo = inverse as Loose;
  for (const key of TOP_LEVEL_KEYS) {
    if (key in patch && Object.is(current[key], after[key])) {
      undo[key] = before[key];
    }
  }

  const aiPatch = patch.ai;
  if (aiPatch) {
    const aiUndo: AISettingsPatch = {};
    for (const key of AI_KEYS) {
      if (key in aiPatch && Object.is(current.ai[key], after.ai[key])) {
        (aiUndo as Loose)[key] = before.ai[key];
      }
    }
    for (const group of AI_GROUPS) {
      const groupPatch = aiPatch[group] as Loose | undefined;
      if (!groupPatch) continue;
      const groupUndo = restoredFields(group, groupPatch, current.ai, after.ai, before.ai);
      if (groupUndo) (aiUndo as Loose)[group] = groupUndo;
    }
    if (Object.keys(aiUndo).length > 0) inverse.ai = aiUndo;
  }
  return applySettingsPatch(current, inverse);
}

function restoredFields(
  group: AIGroup,
  groupPatch: Loose,
  current: AISettings,
  after: AISettings,
  before: AISettings
): Loose | null {
  const now = current[group] as unknown as Loose;
  const patched = after[group] as unknown as Loose;
  const old = before[group] as unknown as Loose;
  const restored: Loose = {};
  for (const field of Object.keys(groupPatch)) {
    if (Object.is(now[field], patched[field])) restored[field] = old[field];
  }
  return Object.keys(restored).length > 0 ? restored : null;
}

export interface SettingsControllerOptions {
  onChange(settings: AppSettings): void;
  /** A write failed; its change has already been rolled back. */
  onError(error: unknown): void;
}

export interface SettingsController {
  /** null until the first load or change arrives. */
  get(): AppSettings | null;
  /** Resolves true when saved, false when rolled back. */
  update(patch: SettingsPatch): Promise<boolean>;
  /** Stops watching; no callbacks fire afterwards. */
  stop(): void;
}

/**
 * While a write of ours is pending, storage change events are ignored: they
 * can carry an older state than the one on screen. The last write's result
 * (read-modify-write in storage, so it includes other pages' changes)
 * replaces the local state when nothing is pending any more.
 */
export function createSettingsController(
  backend: SettingsBackend,
  { onChange, onError }: SettingsControllerOptions,
  initial: AppSettings | null = null
): SettingsController {
  let current = initial;
  let pending = 0;
  let stopped = false;

  const set = (next: AppSettings) => {
    current = next;
    if (!stopped) onChange(next);
  };

  const reconcile = () => {
    backend
      .load()
      .then((stored) => {
        if (pending === 0) set(stored);
      })
      .catch(() => undefined);
  };

  const unwatch = backend.watch((settings) => {
    if (pending === 0) set(settings);
  });

  if (current === null) {
    backend
      .load()
      .then((stored) => {
        // A change that arrived meanwhile is newer than this read.
        if (current === null) set(stored);
      })
      .catch((error: unknown) => {
        console.error('[settings] could not load settings', error);
      });
  }

  return {
    get: () => current,

    async update(patch) {
      const before = current;
      pending += 1;
      if (before) set(applySettingsPatch(before, patch));
      try {
        const saved = await backend.save(patch);
        pending -= 1;
        if (pending === 0) set(saved);
        return true;
      } catch (error) {
        pending -= 1;
        if (before && current) set(rollbackPatch(current, before, patch));
        if (!stopped) onError(error);
        if (pending === 0) reconcile();
        return false;
      }
    },

    stop() {
      stopped = true;
      unwatch();
    },
  };
}
