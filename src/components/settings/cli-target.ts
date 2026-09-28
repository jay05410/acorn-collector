/**
 * AISettings.cli.model is shared by Claude Code and Codex. Switching the
 * target clears a model the new CLI cannot run, so it falls back to that
 * CLI's default (null = default, per the settings contract).
 */
import { resolveCliModel } from '@/lib/bridge/provider';
import type { CliTarget } from '@/lib/bridge/protocol';
import type { CliBridgeSettings } from '@/lib/settings-types';

export interface CliTargetChange {
  patch: Partial<CliBridgeSettings>;
  /** The model that was cleared because `target` cannot use it. */
  clearedModel: string | null;
}

export function cliTargetChange(
  cli: CliBridgeSettings,
  target: CliTarget
): CliTargetChange {
  const model = cli.model?.trim() ?? '';
  if (model === '' || !resolveCliModel(target, model).replaced) {
    return { patch: { target }, clearedModel: null };
  }
  return { patch: { target, model: null }, clearedModel: model };
}

/** True when `model` is set but is not a name `target` accepts. */
export function isForeignCliModel(target: CliTarget, model: string): boolean {
  const trimmed = model.trim();
  return trimmed !== '' && resolveCliModel(target, trimmed).replaced;
}
