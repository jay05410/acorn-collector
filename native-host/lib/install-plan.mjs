// @ts-check
/**
 * Pure planning for install.mjs: where the host is copied, which browser
 * manifest locations exist per platform, and the files and registry entries
 * to write. Nothing here touches the file system.
 *
 * Per-user manifest locations (Chrome docs, "Native messaging host location"):
 * macOS ~/Library/Application Support/<browser>/NativeMessagingHosts,
 * Linux ~/.config/<browser>/NativeMessagingHosts, Windows a registry key
 * whose default value is the manifest path.
 */
import path from 'node:path';

export const HOST_NAME = 'com.acorn_collector.bridge';
export const HOST_DESCRIPTION = 'Acorn Collector CLI bridge (Claude Code / Codex)';
export const INSTALL_DIR_NAME = 'acorn-collector-bridge';
const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;

/** @typedef {'darwin' | 'linux' | 'win32'} SupportedPlatform */

/**
 * @typedef {object} PlatformContext
 * @property {SupportedPlatform} platform
 * @property {string} home
 * @property {Record<string, string | undefined>} env
 */

/**
 * @typedef {object} ManifestLocation
 * @property {string} browser
 * @property {string} root Browser profile root; the browser counts as
 *   installed when it exists.
 * @property {string} manifestPath
 * @property {boolean} verified False where the location is documented by
 *   the vendor for Chrome only and not tested for this browser.
 */

/**
 * @typedef {{ kind: 'copy', from: string, to: string }
 *   | { kind: 'write', path: string, content: string, mode: number }
 *   | { kind: 'mkdir', path: string }
 *   | { kind: 'remove', path: string }
 *   | { kind: 'reg-add', key: string, value: string }
 *   | { kind: 'reg-delete', key: string }} Action
 */

/** @param {SupportedPlatform} platform */
function pathFor(platform) {
  return platform === 'win32' ? path.win32 : path.posix;
}

/**
 * @param {string} value
 * @returns {value is SupportedPlatform}
 */
export function isSupportedPlatform(value) {
  return value === 'darwin' || value === 'linux' || value === 'win32';
}

/**
 * Stable per-user location for the host files. Kept outside ~/Documents and
 * ~/Downloads, which macOS privacy controls may block for browser children.
 * @param {PlatformContext} context
 */
export function installDir({ platform, home, env }) {
  const p = pathFor(platform);
  if (platform === 'darwin') {
    return p.join(home, 'Library', 'Application Support', INSTALL_DIR_NAME);
  }
  if (platform === 'linux') {
    return p.join(env.XDG_DATA_HOME || p.join(home, '.local', 'share'), INSTALL_DIR_NAME);
  }
  return p.join(env.LOCALAPPDATA || p.join(home, 'AppData', 'Local'), INSTALL_DIR_NAME);
}

/**
 * Manifest locations on macOS and Linux (Windows uses the registry).
 * @param {PlatformContext} context
 * @returns {ManifestLocation[]}
 */
export function manifestLocations({ platform, home, env }) {
  const p = pathFor(platform);
  /** @type {Array<[string, string[], boolean]>} */
  let browsers;
  let base;
  if (platform === 'darwin') {
    base = p.join(home, 'Library', 'Application Support');
    browsers = [
      ['Google Chrome', ['Google', 'Chrome'], true],
      ['Google Chrome for Testing', ['Google', 'ChromeForTesting'], true],
      ['Chromium', ['Chromium'], true],
      ['Microsoft Edge', ['Microsoft Edge'], true],
      ['Brave', ['BraveSoftware', 'Brave-Browser'], false],
      ['Naver Whale', ['Naver', 'Whale'], false],
    ];
  } else if (platform === 'linux') {
    base = env.XDG_CONFIG_HOME || p.join(home, '.config');
    browsers = [
      ['Google Chrome', ['google-chrome'], true],
      ['Chromium', ['chromium'], true],
      ['Microsoft Edge', ['microsoft-edge'], true],
      ['Brave', ['BraveSoftware', 'Brave-Browser'], false],
    ];
  } else {
    return [];
  }
  return browsers.map(([browser, segments, verified]) => {
    const root = p.join(base, ...segments);
    return {
      browser,
      root,
      manifestPath: p.join(root, 'NativeMessagingHosts', `${HOST_NAME}.json`),
      verified,
    };
  });
}

/** HKCU keys whose default value points at the manifest (Windows). */
export const WINDOWS_REGISTRY_KEYS = [
  { browser: 'Google Chrome', key: `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}` },
  { browser: 'Microsoft Edge', key: `HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\${HOST_NAME}` },
];

/**
 * @param {string} id Extension ID as shown on chrome://extensions.
 * @returns {string} The origin the browser passes to the host.
 */
export function extensionOrigin(id) {
  if (!EXTENSION_ID_PATTERN.test(id)) {
    throw new Error(`"${id}" is not an extension ID (32 letters a-p)`);
  }
  return `chrome-extension://${id}/`;
}

/**
 * @param {{ wrapperPath: string, origins: string[] }} options
 */
export function buildManifest({ wrapperPath, origins }) {
  return {
    name: HOST_NAME,
    description: HOST_DESCRIPTION,
    path: wrapperPath,
    type: 'stdio',
    allowed_origins: origins,
  };
}

/**
 * @param {{ origins: string[], cliPaths: { claude: string | null, codex: string | null } }} options
 */
export function buildConfig({ origins, cliPaths }) {
  return { version: 1, allowedOrigins: origins, cliPaths };
}

/**
 * Launcher the manifest points at: browsers need an executable, and the
 * absolute node path avoids depending on the browser's PATH.
 * @param {{ platform: SupportedPlatform, nodePath: string, hostPath: string }} options
 * @returns {{ fileName: string, content: string }}
 */
export function buildWrapper({ platform, nodePath, hostPath }) {
  if (platform === 'win32') {
    /** @param {string} value */
    const bat = (value) => `"${value.replace(/%/g, '%%')}"`;
    return {
      fileName: 'acorn-bridge.bat',
      content: `@echo off\r\n${bat(nodePath)} ${bat(hostPath)} %*\r\n`,
    };
  }
  return {
    fileName: 'acorn-bridge.sh',
    content: `#!/bin/sh\n# Generated by install.mjs. Re-run the installer instead of editing.\nexec ${shQuote(nodePath)} ${shQuote(hostPath)} "$@"\n`,
  };
}

/** @param {string} value */
export function shQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * First native .exe from `where` output. npm's .cmd shims cannot be spawned
 * without a shell, which the host never uses.
 * @param {string} whereOutput
 * @returns {string | null}
 */
export function pickWindowsExecutable(whereOutput) {
  const lines = whereOutput.split(/\r?\n/).map((line) => line.trim());
  return lines.find((line) => /\.exe$/i.test(line)) ?? null;
}

/**
 * Files copied to the install dir: the runtime modules and package.json
 * (tests, fixtures and dev scripts stay behind).
 * @param {string} relativePath POSIX-style path relative to the source dir.
 */
export function isRuntimeFile(relativePath) {
  if (relativePath === 'package.json') return true;
  if (!relativePath.endsWith('.mjs') || relativePath.endsWith('.test.mjs')) return false;
  return !relativePath.startsWith('scripts/');
}

/**
 * @typedef {object} InstallInput
 * @property {PlatformContext} context
 * @property {string} sourceDir Directory containing install.mjs.
 * @property {string[]} sourceFiles POSIX-style paths relative to sourceDir.
 * @property {string} nodePath
 * @property {{ claude: string | null, codex: string | null }} cliPaths
 * @property {string[]} extensionIds
 * @property {Set<string>} existingRoots Browser roots that exist.
 */

/**
 * @param {InstallInput} input
 * @returns {Action[]}
 */
export function planInstall(input) {
  const { context, sourceDir, sourceFiles, nodePath, cliPaths, extensionIds, existingRoots } = input;
  const p = pathFor(context.platform);
  const origins = [...new Set(extensionIds)].map(extensionOrigin);
  if (origins.length === 0) throw new Error('at least one --extension-id is required');

  const dir = installDir(context);
  /** @type {Action[]} */
  const actions = [{ kind: 'mkdir', path: dir }];
  if (p.resolve(sourceDir) !== p.resolve(dir)) {
    for (const file of sourceFiles.filter(isRuntimeFile)) {
      actions.push({
        kind: 'copy',
        from: p.join(sourceDir, ...file.split('/')),
        to: p.join(dir, ...file.split('/')),
      });
    }
  }

  const wrapper = buildWrapper({
    platform: context.platform,
    nodePath,
    hostPath: p.join(dir, 'host.mjs'),
  });
  const wrapperPath = p.join(dir, wrapper.fileName);
  actions.push(
    {
      kind: 'write',
      path: p.join(dir, 'config.json'),
      content: `${JSON.stringify(buildConfig({ origins, cliPaths }), null, 2)}\n`,
      mode: 0o600,
    },
    { kind: 'write', path: wrapperPath, content: wrapper.content, mode: 0o755 }
  );

  const manifest = `${JSON.stringify(buildManifest({ wrapperPath, origins }), null, 2)}\n`;
  if (context.platform === 'win32') {
    const manifestPath = p.join(dir, `${HOST_NAME}.json`);
    actions.push({ kind: 'write', path: manifestPath, content: manifest, mode: 0o644 });
    for (const { key } of WINDOWS_REGISTRY_KEYS) {
      actions.push({ kind: 'reg-add', key, value: manifestPath });
    }
  } else {
    for (const location of manifestLocations(context)) {
      if (!existingRoots.has(location.root)) continue;
      actions.push(
        { kind: 'mkdir', path: p.dirname(location.manifestPath) },
        { kind: 'write', path: location.manifestPath, content: manifest, mode: 0o644 }
      );
    }
  }
  return actions;
}

/**
 * Remove every manifest location this installer can write, the registry
 * keys on Windows, and the install dir.
 * @param {PlatformContext} context
 * @returns {Action[]}
 */
export function planUninstall(context) {
  /** @type {Action[]} */
  const actions = [];
  if (context.platform === 'win32') {
    for (const { key } of WINDOWS_REGISTRY_KEYS) actions.push({ kind: 'reg-delete', key });
  } else {
    for (const location of manifestLocations(context)) {
      actions.push({ kind: 'remove', path: location.manifestPath });
    }
  }
  actions.push({ kind: 'remove', path: installDir(context) });
  return actions;
}
