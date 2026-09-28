// @ts-check
/**
 * Minimal environment for CLI children. Built from an allowlist so that API
 * keys (which would switch Claude Code from the subscription to API billing),
 * nested-session markers and unrelated secrets never reach the CLI.
 */

const POSIX_KEYS = [
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TMPDIR',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TZ',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'XDG_STATE_HOME',
  'XDG_CACHE_HOME',
  'XDG_RUNTIME_DIR',
  'https_proxy',
  'http_proxy',
  'no_proxy',
];

const WINDOWS_KEYS = [
  'USERPROFILE',
  'USERNAME',
  'HOMEDRIVE',
  'HOMEPATH',
  'APPDATA',
  'LOCALAPPDATA',
  'PROGRAMDATA',
  'SYSTEMROOT',
  'WINDIR',
  'COMSPEC',
  'PATHEXT',
  'TEMP',
  'TMP',
  'PROCESSOR_ARCHITECTURE',
  'NUMBER_OF_PROCESSORS',
  'OS',
];

/** Needed on every platform: custom CLI config dirs, proxies, private CAs. */
const SHARED_KEYS = [
  'CLAUDE_CONFIG_DIR',
  'CODEX_HOME',
  'HTTPS_PROXY',
  'HTTP_PROXY',
  'NO_PROXY',
  'NODE_EXTRA_CA_CERTS',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
];

/** Chrome may start the host with no PATH at all (e.g. launched from the Dock). */
const FALLBACK_POSIX_PATH = [
  '/usr/local/bin',
  '/opt/homebrew/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
];

/**
 * @typedef {Record<string, string | undefined>} EnvSource
 */

/**
 * @param {EnvSource} source Usually process.env.
 * @param {object} options
 * @param {NodeJS.Platform} options.platform
 * @param {string[]} [options.pathDirs] Directories put first on PATH (node,
 *   the CLI's own directory).
 * @returns {Record<string, string>}
 */
export function buildChildEnv(source, { platform, pathDirs = [] }) {
  const windows = platform === 'win32';
  const normalize = windows
    ? (/** @type {string} */ key) => key.toUpperCase()
    : (/** @type {string} */ key) => key;
  const allowed = new Set(
    [...(windows ? WINDOWS_KEYS : POSIX_KEYS), ...SHARED_KEYS].map(normalize)
  );

  /** @type {Record<string, string>} */
  const env = {};
  /** @type {string | undefined} */
  let inheritedPath;
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === '') continue;
    const name = normalize(key);
    if (name === 'PATH') inheritedPath = value;
    else if (allowed.has(name)) env[key] = value;
  }

  const delimiter = windows ? ';' : ':';
  const inherited = inheritedPath
    ? inheritedPath.split(delimiter).filter(Boolean)
    : windows
      ? []
      : FALLBACK_POSIX_PATH;
  env.PATH = [...new Set([...pathDirs, ...inherited])].join(delimiter);
  if (!windows) env.TERM = 'dumb';
  return env;
}
