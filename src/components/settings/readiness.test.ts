import { describe, expect, it } from 'vitest';
import { AIError } from '@/lib/ai/types';
import { bridgeError } from '@/lib/bridge/errors';
import type { BridgeStatus, BridgeTargetStatus } from '@/lib/bridge/protocol';
import { DEFAULT_AI_SETTINGS, type AISettings } from '@/lib/settings-types';
import {
  cliReadiness,
  EMPTY_CLI_CHECK,
  providerReadiness,
  type CliCheck,
} from './readiness';

function ai(patch: Partial<AISettings> = {}): AISettings {
  return { ...structuredClone(DEFAULT_AI_SETTINGS), ...patch };
}

function target(patch: Partial<BridgeTargetStatus> = {}): BridgeTargetStatus {
  return {
    installed: true,
    loggedIn: true,
    authMethod: 'claude.ai',
    subscriptionType: 'max',
    warnings: [],
    ...patch,
  };
}

function status(claude: BridgeTargetStatus, codex = target()): BridgeStatus {
  return { protocol: 1, platform: 'darwin', targets: { claude, codex } };
}

function check(patch: Partial<CliCheck>): CliCheck {
  return { ...EMPTY_CLI_CHECK, permission: true, ...patch };
}

describe('providerReadiness', () => {
  it('needs a key for API providers', () => {
    const settings = ai();
    for (const id of ['openai', 'anthropic', 'openrouter'] as const) {
      expect(providerReadiness(settings, id)).toBe('needs-key');
    }
  });

  it('is ready once the provider has a non-blank key', () => {
    const settings = ai({ openai: { apiKey: '  sk-live  ', model: null } });
    expect(providerReadiness(settings, 'openai')).toBe('ready');
    const blank = ai({ anthropic: { apiKey: '   ', model: null } });
    expect(providerReadiness(blank, 'anthropic')).toBe('needs-key');
  });

  it('flags a saved key the provider rejected', () => {
    const settings = ai({ openai: { apiKey: 'sk-old', model: null } });
    expect(providerReadiness(settings, 'openai', EMPTY_CLI_CHECK, new Set(['openai']))).toBe(
      'key-rejected'
    );
    // No key at all is still "needs a key", rejected or not.
    expect(providerReadiness(ai(), 'openai', EMPTY_CLI_CHECK, new Set(['openai']))).toBe(
      'needs-key'
    );
  });

  it('delegates the CLI to the bridge check', () => {
    expect(providerReadiness(ai(), 'cli')).toBe('unknown');
    expect(providerReadiness(ai(), 'cli', check({ status: status(target()) }))).toBe(
      'ready'
    );
  });
});

describe('cliReadiness', () => {
  it('asks for the permission first', () => {
    expect(cliReadiness(ai(), check({ permission: false }))).toBe('needs-permission');
    const missing = bridgeError('not_configured', 'bridge_permission_missing');
    expect(cliReadiness(ai(), check({ error: missing }))).toBe('needs-permission');
  });

  it('asks for an install when the host is missing, foreign or outdated', () => {
    for (const message of ['bridge_not_installed', 'bridge_forbidden', 'bridge_outdated'] as const) {
      const error = bridgeError('not_configured', message);
      expect(cliReadiness(ai(), check({ error }))).toBe('needs-install');
    }
  });

  it('is unknown before a check and after a transient failure', () => {
    expect(cliReadiness(ai(), check({}))).toBe('unknown');
    const timeout = bridgeError('timeout', 'bridge_unresponsive');
    expect(cliReadiness(ai(), check({ error: timeout }))).toBe('unknown');
    expect(cliReadiness(ai(), check({ error: new AIError('network', 'x') }))).toBe(
      'unknown'
    );
  });

  it('reads the selected target', () => {
    const report = status(target({ installed: false }), target());
    expect(cliReadiness(ai(), check({ status: report }))).toBe('cli-missing');
    const codex = ai({ cli: { target: 'codex', model: null } });
    expect(cliReadiness(codex, check({ status: report }))).toBe('ready');
  });

  it('needs a login, unless the status check itself failed', () => {
    const loggedOut = status(target({ loggedIn: false }));
    expect(cliReadiness(ai(), check({ status: loggedOut }))).toBe('needs-login');
    const failed = status(
      target({ loggedIn: false, warnings: ['status_check_failed'] })
    );
    expect(cliReadiness(ai(), check({ status: failed }))).toBe('unknown');
  });
});
