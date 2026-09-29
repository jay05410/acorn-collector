/** Display names and connection-test messages for the AI providers. */
import { t, tp } from '@/i18n';
import type { ApiProviderId } from '@/lib/ai/models';
import type { AIError, ProviderId } from '@/lib/ai/types';
import type { CliTarget } from '@/lib/bridge/protocol';

export const PROVIDER_ORDER: readonly ProviderId[] = [
  'openrouter',
  'openai',
  'anthropic',
  'cli',
];

/** Brand names are the same in every language. */
const BRAND_NAMES: Readonly<Record<ApiProviderId, string>> = {
  openrouter: 'OpenRouter',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
};

export const CLI_NAMES: Readonly<Record<CliTarget, string>> = {
  claude: 'Claude Code',
  codex: 'Codex',
};

export const CLI_TARGETS: readonly CliTarget[] = ['claude', 'codex'];

/** Name given to keys created through OpenRouter sign-in. */
export const OPENROUTER_KEY_LABEL = 'Acorn Collector';

export function providerName(id: ProviderId): string {
  return id === 'cli' ? t('aiConnect', 'providerCli') : BRAND_NAMES[id];
}

/**
 * User-facing reason a connection test or key exchange failed; null for a
 * cancellation, which needs no message.
 */
export function connectionErrorMessage(
  error: AIError,
  provider: string
): string | null {
  switch (error.code) {
    case 'cancelled':
      return null;
    case 'auth':
      return t('aiConnect', 'errAuth');
    case 'quota':
      return t('aiConnect', 'errQuota');
    case 'rate_limit':
      return t('aiConnect', 'errRateLimit');
    case 'network':
      return tp('aiConnect', 'errNetwork', { provider });
    case 'timeout':
      return tp('aiConnect', 'errTimeout', { provider });
    case 'unavailable':
      return tp('aiConnect', 'errUnavailable', { provider });
    default:
      return t('aiConnect', 'errUnknown');
  }
}

/** Last four characters of a key, for "saved key ending in ...". */
export function keySuffix(key: string): string {
  return key.trim().slice(-4);
}
