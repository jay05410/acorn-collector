import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  configPath,
  isAllowedOrigin,
  loadConfig,
  parseConfig,
} from './config.mjs';

const ORIGIN = `chrome-extension://${'abcdefghijklmnop'.repeat(2)}/`;
const valid = {
  version: 1,
  allowedOrigins: [ORIGIN],
  cliPaths: { claude: '/Users/me/.local/bin/claude', codex: null },
};

describe('parseConfig', () => {
  it('accepts the installer format', () => {
    expect(parseConfig(valid)).toEqual({
      allowedOrigins: [ORIGIN],
      cliPaths: { claude: '/Users/me/.local/bin/claude', codex: null },
    });
  });

  it('treats missing or empty CLI paths as not installed', () => {
    expect(
      parseConfig({ ...valid, cliPaths: { claude: '' } }).cliPaths
    ).toEqual({
      claude: null,
      codex: null,
    });
  });

  it('rejects other versions, malformed origins and missing cliPaths', () => {
    expect(() => parseConfig({ ...valid, version: 2 })).toThrow(/version/);
    expect(() =>
      parseConfig({ ...valid, allowedOrigins: ['https://evil.example/'] })
    ).toThrow(/allowedOrigins/);
    expect(() =>
      parseConfig({ ...valid, allowedOrigins: [`${ORIGIN}*`] })
    ).toThrow();
    expect(() => parseConfig({ ...valid, cliPaths: undefined })).toThrow(
      /cliPaths/
    );
    expect(() => parseConfig(null)).toThrow();
  });
});

describe('isAllowedOrigin', () => {
  const config = parseConfig(valid);

  it('requires an exact allowlisted extension origin', () => {
    expect(isAllowedOrigin(ORIGIN, config)).toBe(true);
    expect(
      isAllowedOrigin(`chrome-extension://${'a'.repeat(32)}/`, config)
    ).toBe(false);
    expect(isAllowedOrigin(ORIGIN.slice(0, -1), config)).toBe(false);
    expect(isAllowedOrigin('', config)).toBe(false);
    expect(isAllowedOrigin('--parent-window=0', config)).toBe(false);
  });
});

describe('configPath and loadConfig', () => {
  it('defaults to config.json next to the host, overridable by env', () => {
    expect(configPath({}, '/opt/acorn')).toBe(
      join('/opt/acorn', 'config.json')
    );
    expect(
      configPath({ ACORN_BRIDGE_CONFIG: '/tmp/c.json' }, '/opt/acorn')
    ).toBe('/tmp/c.json');
  });

  it('reads and validates the file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'acorn-config-test-'));
    try {
      const file = join(dir, 'config.json');
      await writeFile(file, JSON.stringify(valid));
      await expect(loadConfig(file)).resolves.toEqual(parseConfig(valid));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
