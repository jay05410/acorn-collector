/**
 * Live state of the local CLI bridge for the settings screen: the optional
 * nativeMessaging permission and the host's status report. status() starts
 * the native host (which runs `claude auth status` and friends), so it only
 * runs when the CLI provider is active or the user asks.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toAIError } from '@/lib/ai/errors';
import { getBridgeClient } from '@/lib/bridge/client';
import {
  hasBridgePermission,
  requestBridgePermission,
} from '@/lib/bridge/permission';
import type { BridgeStatus } from '@/lib/bridge/protocol';
import { EMPTY_CLI_CHECK, type CliCheck } from './readiness';

export interface CliCheckDeps {
  hasPermission: () => Promise<boolean>;
  requestPermission: () => Promise<boolean>;
  status: () => Promise<BridgeStatus>;
}

const DEFAULT_DEPS: CliCheckDeps = {
  hasPermission: hasBridgePermission,
  requestPermission: requestBridgePermission,
  status: () => getBridgeClient().status(),
};

export interface CliCheckState {
  check: CliCheck;
  checking: boolean;
  /** The last permission request was declined. */
  denied: boolean;
  refresh: () => Promise<void>;
  /** Call directly from a click handler (needs a user gesture). */
  requestPermission: () => Promise<void>;
}

function permissionEvents():
  | Pick<typeof chrome.permissions, 'onAdded' | 'onRemoved'>
  | undefined {
  return typeof chrome === 'undefined' ? undefined : chrome.permissions;
}

export function useCliCheck(
  active: boolean,
  deps: CliCheckDeps = DEFAULT_DEPS
): CliCheckState {
  const [check, setCheck] = useState<CliCheck>(EMPTY_CLI_CHECK);
  const [checking, setChecking] = useState(false);
  const [denied, setDenied] = useState(false);
  const autoChecked = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const readPermission = useCallback(() => {
    deps
      .hasPermission()
      .then((permission) => {
        if (alive.current) setCheck((c) => ({ ...c, permission }));
      })
      .catch(() => {
        if (alive.current) setCheck((c) => ({ ...c, permission: false }));
      });
  }, [deps]);

  useEffect(() => {
    readPermission();
    // Also follow changes made on chrome://extensions.
    const events = permissionEvents();
    const onChange = () => readPermission();
    events?.onAdded?.addListener(onChange);
    events?.onRemoved?.addListener(onChange);
    return () => {
      events?.onAdded?.removeListener(onChange);
      events?.onRemoved?.removeListener(onChange);
    };
  }, [readPermission]);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const status = await deps.status();
      if (alive.current) setCheck((c) => ({ ...c, status, error: null }));
    } catch (error) {
      if (alive.current) {
        setCheck((c) => ({ ...c, status: null, error: toAIError(error, 'cli') }));
      }
    } finally {
      if (alive.current) setChecking(false);
    }
  }, [deps]);

  const requestPermission = useCallback(async () => {
    let granted = false;
    try {
      granted = await deps.requestPermission();
    } catch {
      granted = false;
    }
    if (!alive.current) return;
    setDenied(!granted);
    setCheck((c) => ({ ...c, permission: granted, error: null }));
    if (granted) await refresh();
  }, [deps, refresh]);

  // Check once when the CLI is the active provider and may be reached.
  useEffect(() => {
    if (!active || check.permission !== true || autoChecked.current) return;
    autoChecked.current = true;
    void refresh();
  }, [active, check.permission, refresh]);

  return { check, checking, denied, refresh, requestPermission };
}
