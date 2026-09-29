import type { MessageTable } from '../../define';

/**
 * Analysis failures, chosen by AIError.code or, for the local CLI bridge, by
 * the stable bridge message code (see src/lib/ai/error-messages.ts).
 */
export default {
  notConfiguredTitle: 'No AI provider connected',
  notConfiguredBody:
    'Choose a provider and add your API key in Settings to extract items from images.',
  authTitle: 'API key not accepted',
  authBody:
    'The provider rejected your API key. Check or replace it in Settings.',
  rateLimitTitle: 'Too many requests',
  rateLimitBody:
    'The provider is limiting requests right now. Wait a moment and try again.',
  quotaTitle: 'Usage limit reached',
  quotaBody:
    'Your provider account is out of credit or over its limit. Check your plan, or switch providers in Settings.',
  networkTitle: 'Connection problem',
  networkBody:
    "Couldn't reach the AI provider or load the images. Check your connection and try again.",
  timeoutTitle: 'Took too long',
  timeoutBody:
    "The model didn't finish in time. Try again, or use accurate mode for busy price lists.",
  cancelledTitle: 'Analysis stopped',
  cancelledBody: 'Nothing was lost. You can start it again at any time.',
  badResponseTitle: "Couldn't read the result",
  badResponseBody:
    "The model's answer wasn't a usable price list. Accurate mode often does better.",
  refusedTitle: 'The model declined',
  refusedBody:
    'The model would not analyze this content. Try accurate mode or other images.',
  unavailableTitle: 'Service unavailable',
  unavailableBody:
    'The AI service is temporarily unavailable. Try again in a moment.',
  unknownTitle: 'Analysis failed',
  unknownBody: 'Something went wrong while analyzing. Please try again.',
  bridgeNotInstalledTitle: 'Local bridge not installed',
  bridgeNotInstalledBody:
    'Install the bridge on this computer to analyze with Claude Code or Codex. Setup steps are in Settings.',
  bridgeForbiddenTitle: 'Bridge blocks this extension',
  bridgeForbiddenBody:
    'The installed bridge does not allow this extension. Run the installer again from Settings.',
  bridgeDisconnectedTitle: 'Bridge disconnected',
  bridgeDisconnectedBody: 'The local bridge stopped unexpectedly. Try again.',
  bridgePermissionMissingTitle: 'Permission needed',
  bridgePermissionMissingBody:
    'Allow the extension to talk to the local bridge in Settings, then try again.',
  bridgeUnresponsiveTitle: 'Bridge not responding',
  bridgeUnresponsiveBody: 'The local bridge stopped answering. Try again.',
  bridgeOutdatedTitle: 'Bridge needs an update',
  bridgeOutdatedBody:
    'The installed bridge does not match this version of the extension. Reinstall it from Settings.',
  bridgeProtocolErrorTitle: 'Unexpected bridge reply',
  bridgeProtocolErrorBody:
    'The local bridge sent something unexpected. If this keeps happening, reinstall it from Settings.',
  bridgeBusyTitle: 'Bridge is busy',
  bridgeBusyBody:
    'The local CLI is still working on another request. Try again shortly.',
  bridgeBadRequestTitle: 'Request too large',
  bridgeBadRequestBody:
    "This request couldn't be sent to the local CLI, usually because the images are too large. Include fewer images and try again.",
  bridgeInternalTitle: 'Bridge error',
  bridgeInternalBody: 'The local bridge hit an internal error. Try again.',
  cliNotInstalledTitle: 'CLI not found',
  cliNotInstalledBody:
    'Claude Code or Codex is not installed, or the bridge cannot find it. Check Settings.',
  cliNotLoggedInTitle: 'Sign in to the CLI',
  cliNotLoggedInBody:
    'Sign in to Claude Code or Codex in your terminal, then try again.',
  cliRateLimitedTitle: 'CLI usage limit reached',
  cliRateLimitedBody:
    'Your Claude Code or Codex plan has hit its usage limit. Try again later or switch providers.',
  cliTimeoutTitle: 'CLI took too long',
  cliTimeoutBody: "The local CLI didn't finish in time. Try again.",
  cliFailedTitle: 'CLI run failed',
  cliFailedBody:
    'The local CLI exited with an error. Check the selected model in Settings and try again.',
  cliBadOutputTitle: "Couldn't read the CLI result",
  cliBadOutputBody:
    "The CLI's answer didn't match the price-list format. Try again.",
  cliStatusCheckFailedTitle: "Couldn't check the CLI",
  cliStatusCheckFailedBody:
    'The bridge could not check whether the CLI is signed in. Try again.',
  actionOpenSettings: 'Open Settings',
  actionRetry: 'Try again',
  actionRetryAccurate: 'Try accurate mode',
} satisfies MessageTable;
