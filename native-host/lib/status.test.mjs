import { describe, expect, it, vi } from 'vitest';
import { collectStatus, environmentWarnings } from './status.mjs';

const cliPaths = { claude: '/Users/me/.local/bin/claude', codex: '/opt/homebrew/bin/codex' };

describe('collectStatus', () => {
  it('reports login state for each installed CLI', async () => {
    const run = vi.fn(async ({ command }) =>
      command.endsWith('claude')
        ? {
            exitCode: 0,
            stdout: JSON.stringify({
              loggedIn: true,
              authMethod: 'claude.ai',
              email: 'someone@example.com',
              subscriptionType: 'max',
            }),
            stderrTail: '',
          }
        : { exitCode: 1, stdout: 'Not logged in', stderrTail: '' }
    );
    const status = await collectStatus({
      cliPaths,
      env: { HOME: '/Users/me', ANTHROPIC_API_KEY: 'sk-ant-x' },
      platform: 'darwin',
      run,
      isExecutable: async () => true,
    });
    expect(status).toEqual({
      protocol: 1,
      platform: 'darwin',
      targets: {
        claude: {
          installed: true,
          loggedIn: true,
          authMethod: 'claude.ai',
          subscriptionType: 'max',
          warnings: ['anthropic_api_key_ignored'],
        },
        codex: {
          installed: true,
          loggedIn: false,
          authMethod: null,
          subscriptionType: null,
          warnings: [],
        },
      },
    });
    expect(JSON.stringify(status)).not.toContain('someone@example.com');

    const claudeCall = run.mock.calls.find(([options]) => options.command === cliPaths.claude)[0];
    expect(claudeCall.args).toEqual(['auth', 'status']);
    expect(claudeCall.env).not.toHaveProperty('ANTHROPIC_API_KEY');
    expect(claudeCall.signal).toBeInstanceOf(AbortSignal);
    const codexCall = run.mock.calls.find(([options]) => options.command === cliPaths.codex)[0];
    expect(codexCall.args).toEqual(['login', 'status']);
  });

  it('marks unconfigured or missing CLIs as not installed without running them', async () => {
    const run = vi.fn();
    const status = await collectStatus({
      cliPaths: { claude: '/gone/claude', codex: null },
      env: {},
      platform: 'linux',
      run,
      isExecutable: async () => false,
    });
    expect(status.targets.claude).toMatchObject({ installed: false, loggedIn: false });
    expect(status.targets.codex).toMatchObject({ installed: false, loggedIn: false });
    expect(run).not.toHaveBeenCalled();
  });

  it('flags a status command that could not run', async () => {
    const status = await collectStatus({
      cliPaths: { claude: cliPaths.claude, codex: null },
      env: {},
      platform: 'darwin',
      run: async () => {
        throw new Error('timeout');
      },
      isExecutable: async () => true,
    });
    expect(status.targets.claude).toEqual({
      installed: true,
      loggedIn: false,
      authMethod: null,
      subscriptionType: null,
      warnings: ['status_check_failed'],
    });
  });
});

describe('environmentWarnings', () => {
  it('warns about an Anthropic API key only for claude', () => {
    expect(environmentWarnings('claude', { ANTHROPIC_API_KEY: 'x' })).toEqual([
      'anthropic_api_key_ignored',
    ]);
    expect(environmentWarnings('codex', { ANTHROPIC_API_KEY: 'x' })).toEqual([]);
    expect(environmentWarnings('claude', {})).toEqual([]);
  });
});
