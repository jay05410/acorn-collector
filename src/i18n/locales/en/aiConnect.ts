import type { MessageTable } from '../../define';

/**
 * AI connection settings (ACORN-7): provider cards, API keys and the
 * OpenRouter sign-in. Provider brand names are not translated and are passed
 * in as {provider}.
 */
export default {
  providerGroup: 'AI service',
  providerCli: 'Local CLI',
  recommended: 'Recommended',
  advanced: 'Advanced',
  statusReady: 'Ready',
  statusNotConnected: 'Not connected',
  statusSetup: 'Setup needed',
  statusCheckKey: 'Check key',
  descOpenrouter:
    'Sign in with one click. Pay-as-you-go credits for many models.',
  descOpenai: 'Use your own OpenAI API key.',
  descAnthropic: 'Use your own Anthropic API key for Claude.',
  descCli:
    'Use the Claude Code or Codex CLI you are signed in to on this computer.',
  speedOpenrouter: 'Speed depends on the model',
  speedOpenai: 'About 2-4 s per image in our tests',
  speedCli: 'Slower: about 10 s per image',
  defaultModel: 'Default: {model}',
  costOpenrouter: 'Uses your OpenRouter credits',
  costOpenai: 'Billed to your OpenAI account',
  costAnthropic: 'Billed to your Anthropic account',
  costCli: 'No API key; runs on your CLI plan',
  summaryNone:
    'No AI service is connected. You can still add booths and items by hand.',
  summaryReady: 'Ready. Analysis uses {provider}.',
  summaryNotReady:
    '{provider} is not set up yet. Finish the steps below to analyze images.',
  summaryKeyRejected:
    '{provider} did not accept the saved key. Check or replace it below.',
  keyLabel: '{provider} API key',
  keyHint: 'Stored only in this browser and sent only to {provider}.',
  keySaved: 'Saved key ending in {last4}',
  changeKey: 'Change',
  removeKey: 'Remove',
  saveKey: 'Save key',
  showKey: 'Show key',
  hideKey: 'Hide key',
  keyRequired: 'Enter a key first.',
  keySavedToast: 'Key saved.',
  keyRemovedToast: 'Key removed.',
  getKey: 'Get an API key',
  testConnection: 'Test connection',
  testOk: 'Connected. {provider} accepted the key.',
  testFailed: 'Connection failed',
  errAuth:
    'The key was rejected. Check that you copied all of it and that it is still active.',
  errQuota: 'The account is out of credit or has reached its spending limit.',
  errRateLimit: 'Too many requests right now. Wait a moment and try again.',
  errNetwork: "Couldn't reach {provider}. Check your internet connection.",
  errTimeout: '{provider} took too long to answer. Please try again.',
  errUnavailable:
    '{provider} is temporarily unavailable. Please try again later.',
  errUnknown: 'Something went wrong. Please try again.',
  orIntro:
    'Sign in to OpenRouter and approve a key for this extension. The key belongs to your OpenRouter account and is saved only in this browser.',
  orConnect: 'Connect with OpenRouter',
  orUseCode: 'Use a code instead',
  orPasteKey: 'Paste an existing key',
  orRedirectFailed:
    "Sign-in didn't finish. Try again, or connect with a code instead.",
  orCodeTitle: 'Connect with a code',
  orCodeStep1: 'Approve access in the OpenRouter tab that just opened.',
  orCodeReopen: 'Open OpenRouter again',
  orCodeStep2:
    'Copy the code OpenRouter shows (or the page address) and paste it here.',
  orCodeLabel: 'Code from OpenRouter',
  orCodeSubmit: 'Connect',
  orCodeInvalid:
    "That doesn't look like an OpenRouter code. Paste the code or the full page address.",
  orCodeRejected:
    'OpenRouter did not accept the code. A code works once and expires after 10 minutes, so start again to get a new one.',
  orStartOver: 'Start again',
  orManualTitle: 'Paste an existing key',
  orConnectedOauth: 'Connected through OpenRouter sign-in',
  orConnectedManual: 'Connected with a pasted key',
  orKeyName: 'Key name',
  orLimit: 'Credit limit',
  orNoLimit: 'No limit',
  orRemaining: 'Remaining',
  orUsage: 'Used so far',
  orResets: 'Limit resets',
  resetDaily: 'Daily',
  resetWeekly: 'Weekly',
  resetMonthly: 'Monthly',
  orFreeTier: 'Free tier',
  orKeyInfoFailed: "Couldn't load the key's credit details.",
  orKeyInvalid: 'This key no longer works. Disconnect, then connect again.',
  orSaveFailed:
    "OpenRouter created your key, but it couldn't be saved in this browser. Retry the save before you leave this page, or you'll need to connect again.",
  orRetrySave: 'Retry save',
  orCodeStartFailed:
    "Couldn't start connecting with a code. Try again, or paste a key instead.",
  orManage: 'Manage keys on OpenRouter',
  refresh: 'Refresh',
  disconnect: 'Disconnect',
  connectedToast: '{provider} connected.',
  disconnectedToast:
    '{provider} disconnected. The key still exists in your {provider} account.',
} satisfies MessageTable;
