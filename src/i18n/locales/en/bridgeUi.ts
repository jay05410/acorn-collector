import type { MessageTable } from '../../define';

/**
 * Local CLI bridge setup (ACORN-7). CLI names (Claude Code, Codex) and shell
 * commands are not translated; they arrive as {cli} or are shown verbatim.
 */
export default {
  intro:
    'Runs analysis on the Claude Code or Codex CLI you are already signed in to on this computer, so no API key is needed.',
  pointSlower: 'Slower than an API key: about 10 seconds per image.',
  pointData:
    'Images and post text go to Anthropic (Claude Code) or OpenAI (Codex) under your own account and plan.',
  pointAdvanced:
    'For advanced users: needs Node.js 20 or later and a one-time install.',
  policyNote:
    "Check that your plan's terms allow this use. If you are unsure, use an API key instead.",
  targetLabel: 'CLI to use',
  permissionTitle: 'Allow native messaging',
  permissionBody:
    'Lets the extension talk to a small helper program on this computer. Chrome asks you to confirm.',
  permissionAllow: 'Allow',
  permissionGranted: 'Allowed',
  permissionDenied: "Permission wasn't granted. Select Allow to try again.",
  installTitle: 'Install the helper',
  installBody:
    'Download the source code, open its native-host folder in a terminal and run:',
  installAfter: 'Then restart the browser.',
  extensionId: 'Extension ID',
  copy: 'Copy command',
  copied: 'Copied',
  copyFailed: "Couldn't copy. Select the command and copy it yourself.",
  guide: 'Installation guide',
  statusTitle: 'Check the connection',
  check: 'Check',
  checkAgain: 'Check again',
  checking: 'Checking the helper...',
  inUse: 'In use',
  installed: 'Installed',
  notInstalled: 'Not installed',
  signedIn: 'Signed in',
  signedInDetails: 'Signed in ({details})',
  notSignedIn: 'Not signed in',
  hintInstallClaude: 'Install Claude Code, then run the installer again.',
  hintInstallCodex: 'Install Codex, then run the installer again.',
  hintSignInClaude: 'Run claude in a terminal once and sign in.',
  hintSignInCodex: 'Run codex login in a terminal.',
  warnApiKeyIgnored:
    'ANTHROPIC_API_KEY is set on this computer but ignored, so your Claude subscription is used.',
  warnStatusFailed:
    "Couldn't read the sign-in status. Run the CLI once in a terminal, then check again.",
  warnOther: 'Warning from the helper: {code}',
  errNotInstalled:
    "The helper isn't installed yet, or the browser hasn't been restarted since it was installed.",
  errForbidden:
    "The helper doesn't allow this extension yet. Run the installer again with the ID above.",
  errOutdated: 'The helper is out of date. Run the installer again.',
  errUnresponsive:
    "The helper didn't answer. Check again, or restart the browser.",
  errOther: "Couldn't reach the helper. Please check again.",
  readySummary: 'Ready: {cli} is installed and signed in.',
  modelCleared:
    '"{model}" does not work with {cli}, so the default model will be used.',
} satisfies MessageTable;
