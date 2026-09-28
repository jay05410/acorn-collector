/**
 * Whether a provider can run an analysis with the current settings. API
 * providers only need a key; the local CLI also needs the optional
 * permission, the installed bridge and a signed-in CLI, which the settings
 * screen learns asynchronously (CliCheck).
 */
import type { ApiProviderId } from '@/lib/ai/models';
import { AIError, type ProviderId } from '@/lib/ai/types';
import type { BridgeStatus } from '@/lib/bridge/protocol';
import type { AISettings } from '@/lib/settings-types';

export type ProviderReadiness =
  | 'ready'
  | 'needs-key'
  | 'needs-permission'
  | 'needs-install'
  | 'cli-missing'
  | 'needs-login'
  /** CLI state not checked yet, or the check itself failed. */
  | 'unknown';

export interface CliCheck {
  /** null while the permission is being looked up. */
  permission: boolean | null;
  status: BridgeStatus | null;
  error: AIError | null;
}

export const EMPTY_CLI_CHECK: CliCheck = {
  permission: null,
  status: null,
  error: null,
};

/** Bridge failures that only a (re)install fixes. */
const INSTALL_ERRORS: ReadonlySet<string> = new Set([
  'bridge_not_installed',
  'bridge_forbidden',
  'bridge_outdated',
]);

export function isApiProvider(id: ProviderId): id is ApiProviderId {
  return id !== 'cli';
}

export function hasApiKey(ai: AISettings, id: ApiProviderId): boolean {
  return ai[id].apiKey.trim() !== '';
}

export function cliReadiness(
  ai: AISettings,
  check: CliCheck
): ProviderReadiness {
  if (check.permission === false) return 'needs-permission';
  if (check.error?.message === 'bridge_permission_missing') {
    return 'needs-permission';
  }
  if (check.error && INSTALL_ERRORS.has(check.error.message)) {
    return 'needs-install';
  }
  const target = check.status?.targets[ai.cli.target];
  if (!target) return 'unknown';
  if (!target.installed) return 'cli-missing';
  if (target.warnings.includes('status_check_failed')) return 'unknown';
  return target.loggedIn ? 'ready' : 'needs-login';
}

export function providerReadiness(
  ai: AISettings,
  id: ProviderId,
  cli: CliCheck = EMPTY_CLI_CHECK
): ProviderReadiness {
  if (isApiProvider(id)) return hasApiKey(ai, id) ? 'ready' : 'needs-key';
  return cliReadiness(ai, cli);
}

/**
 * True when an analysis can be attempted from settings alone: a provider is
 * chosen and, for API providers, has a key. The CLI is assumed usable; its
 * failures surface as bridge errors when it runs.
 */
export function canAttemptAnalysis(ai: AISettings): boolean {
  if (ai.provider === null) return false;
  return isApiProvider(ai.provider) ? hasApiKey(ai, ai.provider) : true;
}
