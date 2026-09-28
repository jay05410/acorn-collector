/**
 * The bridge needs the optional "nativeMessaging" permission, requested only
 * when the user turns the local CLI provider on.
 */
const BRIDGE_PERMISSION: chrome.permissions.Permissions = {
  permissions: ['nativeMessaging'],
};

export function hasBridgePermission(): Promise<boolean> {
  return chrome.permissions.contains(BRIDGE_PERMISSION);
}

/** Must be called from a user gesture (e.g. a click handler). */
export function requestBridgePermission(): Promise<boolean> {
  return chrome.permissions.request(BRIDGE_PERMISSION);
}
