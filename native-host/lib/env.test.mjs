import { describe, expect, it } from 'vitest';
import { buildChildEnv } from './env.mjs';

const hostEnv = {
  HOME: '/Users/me',
  USER: 'me',
  LANG: 'ja_JP.UTF-8',
  TMPDIR: '/var/folders/x/T/',
  PATH: '/usr/bin:/bin',
  ANTHROPIC_API_KEY: 'sk-ant-secret',
  ANTHROPIC_AUTH_TOKEN: 'token',
  OPENAI_API_KEY: 'sk-proj-secret',
  CODEX_API_KEY: 'codex-secret',
  CLAUDECODE: '1',
  CLAUDE_CODE_ENTRYPOINT: 'cli',
  CLAUDE_CODE_SESSION_ID: 'abc',
  AWS_SECRET_ACCESS_KEY: 'aws',
  NODE_OPTIONS: '--require /tmp/evil.js',
  CLAUDE_CONFIG_DIR: '/Users/me/.claude-work',
  HTTPS_PROXY: 'http://proxy:8080',
};

describe('buildChildEnv', () => {
  it('keeps only allowlisted variables on POSIX', () => {
    const env = buildChildEnv(hostEnv, { platform: 'darwin' });
    expect(Object.keys(env).sort()).toEqual(
      [
        'CLAUDE_CONFIG_DIR',
        'HOME',
        'HTTPS_PROXY',
        'LANG',
        'PATH',
        'TERM',
        'TMPDIR',
        'USER',
      ].sort()
    );
    expect(env.TERM).toBe('dumb');
  });

  it('never passes API keys or nested-session markers', () => {
    for (const platform of ['darwin', 'linux', 'win32']) {
      const env = buildChildEnv(hostEnv, { platform });
      for (const key of [
        'ANTHROPIC_API_KEY',
        'ANTHROPIC_AUTH_TOKEN',
        'OPENAI_API_KEY',
        'CODEX_API_KEY',
        'CLAUDECODE',
        'CLAUDE_CODE_ENTRYPOINT',
        'CLAUDE_CODE_SESSION_ID',
        'AWS_SECRET_ACCESS_KEY',
        'NODE_OPTIONS',
      ]) {
        expect(env).not.toHaveProperty(key);
      }
    }
  });

  it('puts the given directories first on PATH without duplicates', () => {
    const env = buildChildEnv(hostEnv, {
      platform: 'linux',
      pathDirs: ['/opt/node/bin', '/usr/bin'],
    });
    expect(env.PATH).toBe('/opt/node/bin:/usr/bin:/bin');
  });

  it('falls back to standard directories when the browser gave no PATH', () => {
    const env = buildChildEnv({ HOME: '/Users/me' }, {
      platform: 'darwin',
      pathDirs: ['/Users/me/.local/bin'],
    });
    expect(env.PATH.split(':')).toEqual([
      '/Users/me/.local/bin',
      '/usr/local/bin',
      '/opt/homebrew/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
    ]);
  });

  it('matches Windows variable names case-insensitively', () => {
    const env = buildChildEnv(
      {
        Path: 'C:\\Windows\\system32;C:\\Windows',
        SystemRoot: 'C:\\Windows',
        USERPROFILE: 'C:\\Users\\me',
        LocalAppData: 'C:\\Users\\me\\AppData\\Local',
        Anthropic_Api_Key: 'secret',
      },
      { platform: 'win32', pathDirs: ['C:\\Program Files\\nodejs'] }
    );
    expect(env).toEqual({
      SystemRoot: 'C:\\Windows',
      USERPROFILE: 'C:\\Users\\me',
      LocalAppData: 'C:\\Users\\me\\AppData\\Local',
      PATH: 'C:\\Program Files\\nodejs;C:\\Windows\\system32;C:\\Windows',
    });
  });
});
