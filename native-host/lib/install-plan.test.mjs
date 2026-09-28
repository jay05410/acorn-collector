import { describe, expect, it } from 'vitest';
import {
  HOST_NAME,
  buildManifest,
  buildWrapper,
  extensionOrigin,
  installDir,
  isRuntimeFile,
  manifestLocations,
  pickWindowsExecutable,
  planInstall,
  planUninstall,
  shQuote,
} from './install-plan.mjs';

const ID = 'abcdefghijklmnopabcdefghijklmnop';
const ORIGIN = `chrome-extension://${ID}/`;
const mac = { platform: 'darwin', home: '/Users/me', env: {} };
const linux = { platform: 'linux', home: '/home/me', env: {} };
const win = {
  platform: 'win32',
  home: 'C:\\Users\\me',
  env: { LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local' },
};

describe('installDir', () => {
  it('uses a per-user app data directory on each platform', () => {
    expect(installDir(mac)).toBe('/Users/me/Library/Application Support/acorn-collector-bridge');
    expect(installDir(linux)).toBe('/home/me/.local/share/acorn-collector-bridge');
    expect(installDir({ ...linux, env: { XDG_DATA_HOME: '/data' } })).toBe('/data/acorn-collector-bridge');
    expect(installDir(win)).toBe('C:\\Users\\me\\AppData\\Local\\acorn-collector-bridge');
  });
});

describe('manifestLocations', () => {
  it('lists the per-user NativeMessagingHosts dirs on macOS', () => {
    const base = '/Users/me/Library/Application Support';
    const file = `NativeMessagingHosts/${HOST_NAME}.json`;
    expect(manifestLocations(mac).map((l) => [l.browser, l.manifestPath, l.verified])).toEqual([
      ['Google Chrome', `${base}/Google/Chrome/${file}`, true],
      ['Google Chrome for Testing', `${base}/Google/ChromeForTesting/${file}`, true],
      ['Chromium', `${base}/Chromium/${file}`, true],
      ['Microsoft Edge', `${base}/Microsoft Edge/${file}`, true],
      ['Brave', `${base}/BraveSoftware/Brave-Browser/${file}`, false],
      ['Naver Whale', `${base}/Naver/Whale/${file}`, false],
    ]);
  });

  it('lists ~/.config dirs on Linux and honours XDG_CONFIG_HOME', () => {
    expect(manifestLocations(linux).map((l) => l.root)).toEqual([
      '/home/me/.config/google-chrome',
      '/home/me/.config/chromium',
      '/home/me/.config/microsoft-edge',
      '/home/me/.config/BraveSoftware/Brave-Browser',
    ]);
    expect(manifestLocations({ ...linux, env: { XDG_CONFIG_HOME: '/cfg' } })[0].manifestPath).toBe(
      `/cfg/google-chrome/NativeMessagingHosts/${HOST_NAME}.json`
    );
  });

  it('has no file locations on Windows (registry instead)', () => {
    expect(manifestLocations(win)).toEqual([]);
  });
});

describe('extensionOrigin', () => {
  it('builds the origin and rejects anything that is not an ID', () => {
    expect(extensionOrigin(ID)).toBe(ORIGIN);
    expect(() => extensionOrigin('ABCDEFGHIJKLMNOPABCDEFGHIJKLMNOP')).toThrow();
    expect(() => extensionOrigin('abc')).toThrow();
    expect(() => extensionOrigin(`${ID}/`)).toThrow();
  });
});

describe('buildManifest', () => {
  it('follows the Chrome host manifest format', () => {
    expect(buildManifest({ wrapperPath: '/x/acorn-bridge.sh', origins: [ORIGIN] })).toEqual({
      name: 'com.acorn_collector.bridge',
      description: expect.any(String),
      path: '/x/acorn-bridge.sh',
      type: 'stdio',
      allowed_origins: [ORIGIN],
    });
    expect(HOST_NAME).toMatch(/^[a-z0-9_.]+$/);
  });
});

describe('buildWrapper', () => {
  it('execs node with the host and forwards arguments on POSIX', () => {
    const { fileName, content } = buildWrapper({
      platform: 'darwin',
      nodePath: '/opt/homebrew/bin/node',
      hostPath: "/Users/o'neil/Library/Application Support/acorn-collector-bridge/host.mjs",
    });
    expect(fileName).toBe('acorn-bridge.sh');
    expect(content.startsWith('#!/bin/sh\n')).toBe(true);
    expect(content).toContain(
      `exec '/opt/homebrew/bin/node' '/Users/o'\\''neil/Library/Application Support/acorn-collector-bridge/host.mjs' "$@"`
    );
  });

  it('writes a batch file on Windows', () => {
    const { fileName, content } = buildWrapper({
      platform: 'win32',
      nodePath: 'C:\\Program Files\\nodejs\\node.exe',
      hostPath: 'C:\\Users\\me\\100%\\host.mjs',
    });
    expect(fileName).toBe('acorn-bridge.bat');
    expect(content).toBe(
      '@echo off\r\n"C:\\Program Files\\nodejs\\node.exe" "C:\\Users\\me\\100%%\\host.mjs" %*\r\n'
    );
  });

  it('quotes shell strings safely', () => {
    expect(shQuote('a b')).toBe("'a b'");
    expect(shQuote("$(rm -rf ~)'")).toBe(`'$(rm -rf ~)'\\'''`);
  });
});

describe('pickWindowsExecutable', () => {
  it('prefers a native .exe over npm .cmd shims', () => {
    expect(
      pickWindowsExecutable('C:\\npm\\claude\r\nC:\\npm\\claude.cmd\r\nC:\\Users\\me\\.local\\bin\\claude.exe\r\n')
    ).toBe('C:\\Users\\me\\.local\\bin\\claude.exe');
    expect(pickWindowsExecutable('C:\\npm\\codex.cmd\r\n')).toBeNull();
  });
});

describe('isRuntimeFile', () => {
  it('ships runtime modules only', () => {
    expect(isRuntimeFile('host.mjs')).toBe(true);
    expect(isRuntimeFile('lib/queue.mjs')).toBe(true);
    expect(isRuntimeFile('package.json')).toBe(true);
    expect(isRuntimeFile('lib/queue.test.mjs')).toBe(false);
    expect(isRuntimeFile('scripts/e2e.mjs')).toBe(false);
    expect(isRuntimeFile('cli/fixtures/claude-stream-success.jsonl')).toBe(false);
    expect(isRuntimeFile('README.md')).toBe(false);
    expect(isRuntimeFile('config.json')).toBe(false);
  });
});

describe('planInstall', () => {
  const base = {
    sourceDir: '/src/native-host',
    sourceFiles: ['host.mjs', 'lib/queue.mjs', 'lib/queue.test.mjs', 'scripts/e2e.mjs', 'package.json'],
    nodePath: '/opt/homebrew/bin/node',
    cliPaths: { claude: '/Users/me/.local/bin/claude', codex: null },
    extensionIds: [ID, ID],
  };

  it('copies the runtime, writes config, launcher and manifests for detected browsers', () => {
    const dir = '/Users/me/Library/Application Support/acorn-collector-bridge';
    const chrome = '/Users/me/Library/Application Support/Google/Chrome';
    const actions = planInstall({ ...base, context: mac, existingRoots: new Set([chrome]) });

    expect(actions.filter((a) => a.kind === 'copy').map((a) => a.to)).toEqual([
      `${dir}/host.mjs`,
      `${dir}/lib/queue.mjs`,
      `${dir}/package.json`,
    ]);
    const writes = actions.filter((a) => a.kind === 'write');
    expect(writes.map((a) => [a.path, a.mode])).toEqual([
      [`${dir}/config.json`, 0o600],
      [`${dir}/acorn-bridge.sh`, 0o755],
      [`${chrome}/NativeMessagingHosts/${HOST_NAME}.json`, 0o644],
    ]);
    expect(JSON.parse(writes[0].content)).toEqual({
      version: 1,
      allowedOrigins: [ORIGIN],
      cliPaths: { claude: '/Users/me/.local/bin/claude', codex: null },
    });
    expect(JSON.parse(writes[2].content)).toMatchObject({
      path: `${dir}/acorn-bridge.sh`,
      allowed_origins: [ORIGIN],
    });
    expect(actions).toContainEqual({ kind: 'mkdir', path: `${chrome}/NativeMessagingHosts` });
  });

  it('does not copy files onto themselves when run from the install dir', () => {
    const actions = planInstall({
      ...base,
      sourceDir: installDir(linux),
      context: linux,
      existingRoots: new Set(),
    });
    expect(actions.some((a) => a.kind === 'copy')).toBe(false);
  });

  it('registers the manifest in the registry on Windows', () => {
    const dir = 'C:\\Users\\me\\AppData\\Local\\acorn-collector-bridge';
    const actions = planInstall({
      ...base,
      sourceDir: 'C:\\src\\native-host',
      nodePath: 'C:\\Program Files\\nodejs\\node.exe',
      context: win,
      existingRoots: new Set(),
    });
    expect(actions.filter((a) => a.kind === 'reg-add')).toEqual([
      {
        kind: 'reg-add',
        key: `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`,
        value: `${dir}\\${HOST_NAME}.json`,
      },
      {
        kind: 'reg-add',
        key: `HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\${HOST_NAME}`,
        value: `${dir}\\${HOST_NAME}.json`,
      },
    ]);
    const manifest = actions.find((a) => a.kind === 'write' && a.path.endsWith(`${HOST_NAME}.json`));
    expect(JSON.parse(manifest.content).path).toBe(`${dir}\\acorn-bridge.bat`);
  });

  it('requires at least one valid extension ID', () => {
    expect(() => planInstall({ ...base, extensionIds: [], context: mac, existingRoots: new Set() })).toThrow(
      /extension-id/
    );
    expect(() =>
      planInstall({ ...base, extensionIds: ['nope'], context: mac, existingRoots: new Set() })
    ).toThrow(/not an extension ID/);
  });
});

describe('planUninstall', () => {
  it('removes every manifest location and the install dir', () => {
    const actions = planUninstall(linux);
    expect(actions.filter((a) => a.kind === 'remove')).toHaveLength(5);
    expect(actions.at(-1)).toEqual({ kind: 'remove', path: installDir(linux) });
  });

  it('deletes the registry keys on Windows', () => {
    expect(planUninstall(win).map((a) => a.kind)).toEqual(['reg-delete', 'reg-delete', 'remove']);
  });
});
