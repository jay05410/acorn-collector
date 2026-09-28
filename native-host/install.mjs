#!/usr/bin/env node
// @ts-check
/**
 * Installs the Acorn Collector CLI bridge for the current user.
 *
 *   node install.mjs --extension-id <id> [--extension-id <id> ...] [--dry-run]
 *   node install.mjs --uninstall [--dry-run]
 *
 * Copies the host into a per-user directory, writes config.json (allowed
 * extension origins and absolute CLI paths), a launcher script, and the
 * native messaging manifest for every detected Chromium browser (registry
 * entries on Windows). No administrator rights are needed.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  chmod,
  copyFile,
  mkdir,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import {
  HOST_NAME,
  isSupportedPlatform,
  manifestLocations,
  pickWindowsExecutable,
  planInstall,
  planUninstall,
} from './lib/install-plan.mjs';

const run = promisify(execFile);
const SOURCE_DIR = dirname(fileURLToPath(import.meta.url));
const MIN_NODE_MAJOR = 20;

const USAGE = `Usage:
  node install.mjs --extension-id <id> [--extension-id <id> ...] [--dry-run]
  node install.mjs --uninstall [--dry-run]

Find the extension ID on chrome://extensions (Developer mode) or in the
extension's AI settings. Re-run after installing or updating claude/codex.`;

/**
 * @typedef {import('./lib/install-plan.mjs').Action} Action
 */

/**
 * Absolute path of a CLI as the user's shell resolves it, or null.
 * @param {string} name
 * @param {NodeJS.Platform} platform
 */
async function which(name, platform) {
  try {
    if (platform === 'win32') {
      const { stdout } = await run('where.exe', [name], { windowsHide: true });
      return pickWindowsExecutable(stdout);
    }
    const { stdout } = await run('sh', [
      '-c',
      'command -v -- "$1"',
      'sh',
      name,
    ]);
    const found = stdout.trim();
    return found.startsWith('/') ? found : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} root
 * @param {string} [dir]
 * @returns {Promise<string[]>} POSIX-style paths of all files, relative to root.
 */
async function listFiles(root, dir = root) {
  /** @type {string[]} */
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, full)));
    else if (entry.isFile())
      files.push(relative(root, full).split(sep).join('/'));
  }
  return files;
}

/** @param {Action} action */
function describe(action) {
  switch (action.kind) {
    case 'copy':
      return `copy    ${action.from} -> ${action.to}`;
    case 'write':
      return `write   ${action.path} (mode ${action.mode.toString(8)})`;
    case 'mkdir':
      return `mkdir   ${action.path}`;
    case 'remove':
      return `remove  ${action.path}`;
    case 'reg-add':
      return `reg add ${action.key} = ${action.value}`;
    case 'reg-delete':
      return `reg del ${action.key}`;
  }
}

/** @param {Action} action */
async function execute(action) {
  switch (action.kind) {
    case 'copy':
      await mkdir(dirname(action.to), { recursive: true });
      await copyFile(action.from, action.to);
      return;
    case 'write':
      await writeFile(action.path, action.content, { mode: action.mode });
      // writeFile's mode only applies to new files.
      await chmod(action.path, action.mode);
      return;
    case 'mkdir':
      await mkdir(action.path, { recursive: true, mode: 0o700 });
      return;
    case 'remove':
      await rm(action.path, { recursive: true, force: true });
      return;
    case 'reg-add':
      await run(
        'reg',
        ['add', action.key, '/ve', '/t', 'REG_SZ', '/d', action.value, '/f'],
        {
          windowsHide: true,
        }
      );
      return;
    case 'reg-delete':
      // Missing keys are fine when uninstalling.
      await run('reg', ['delete', action.key, '/f'], {
        windowsHide: true,
      }).catch(() => {});
      return;
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      'extension-id': { type: 'string', multiple: true },
      'dry-run': { type: 'boolean', default: false },
      uninstall: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return;
  }

  const platform = process.platform;
  if (!isSupportedPlatform(platform)) {
    throw new Error(
      `unsupported platform ${platform}; macOS, Linux and Windows are supported`
    );
  }
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    throw new Error('run the installer as your own user, not with sudo');
  }
  const major = Number(process.versions.node.split('.')[0]);
  if (major < MIN_NODE_MAJOR) {
    throw new Error(
      `Node.js ${MIN_NODE_MAJOR} or newer is required (found ${process.version})`
    );
  }
  const context = { platform, home: homedir(), env: process.env };

  /** @type {Action[]} */
  let actions;
  if (values.uninstall) {
    actions = planUninstall(context);
  } else {
    if (!values['extension-id']?.length)
      throw new Error('at least one --extension-id is required');
    const [claude, codex] = await Promise.all([
      which('claude', platform),
      which('codex', platform),
    ]);
    console.log(`claude: ${claude ?? 'not found'}`);
    console.log(`codex:  ${codex ?? 'not found'}`);
    if (!claude && !codex) {
      console.warn(
        'Neither claude nor codex was found on PATH. Install one, log in, then re-run.'
      );
    }
    const locations = manifestLocations(context);
    const existingRoots = new Set(
      locations
        .map((location) => location.root)
        .filter((root) => existsSync(root))
    );
    actions = planInstall({
      context,
      sourceDir: SOURCE_DIR,
      sourceFiles: await listFiles(SOURCE_DIR),
      nodePath: process.execPath,
      cliPaths: { claude, codex },
      extensionIds: values['extension-id'] ?? [],
      existingRoots,
    });
    const browsers = locations
      .filter((l) => existingRoots.has(l.root))
      .map((l) => l.browser);
    if (platform !== 'win32' && browsers.length === 0) {
      console.warn(
        'No supported browser profile was found; no manifest will be written.'
      );
    } else if (platform !== 'win32') {
      console.log(`browsers: ${browsers.join(', ')}`);
    }
  }

  for (const action of actions) {
    console.log(`${values['dry-run'] ? '[dry-run] ' : ''}${describe(action)}`);
    if (!values['dry-run']) await execute(action);
  }
  if (!values['dry-run']) {
    console.log(
      values.uninstall
        ? `Removed ${HOST_NAME}.`
        : `Installed ${HOST_NAME}. Restart the browser, then use "Test connection" in the extension.`
    );
  }
}

main().catch((error) => {
  console.error(
    `install failed: ${error instanceof Error ? error.message : error}`
  );
  if (
    !(error instanceof Error && error.message.startsWith('run the installer'))
  ) {
    console.error(USAGE);
  }
  process.exit(1);
});
