/**
 * Extension-side client for the native CLI bridge. Analyze requests share one
 * long-lived port (chrome.runtime.connectNative), which also keeps an MV3
 * service worker alive while a job runs; the port is reopened on demand after
 * a disconnect and closed again when idle. status() uses a one-shot
 * sendNativeMessage so it works without an open port.
 */
import { AIError } from '@/lib/ai/types';
import { bridgeError, fromHostError, fromRuntimeError } from './errors';
import {
  BRIDGE_HOST_NAME,
  BRIDGE_PROTOCOL_VERSION,
  isBridgeAnalyzeResult,
  isBridgeResponse,
  isBridgeStatus,
  type BridgeAnalyzeRequest,
  type BridgeAnalyzeResult,
  type BridgeRequest,
  type BridgeStatus,
} from './protocol';

/** The subset of chrome.runtime.Port the client uses. */
export interface BridgePort {
  postMessage(message: BridgeRequest): void;
  disconnect(): void;
  onMessage: { addListener(callback: (message: unknown) => void): void };
  onDisconnect: { addListener(callback: () => void): void };
}

/** The subset of chrome.runtime the client uses. */
export interface NativeMessagingRuntime {
  connectNative(application: string): BridgePort;
  sendNativeMessage(application: string, message: BridgeRequest): Promise<unknown>;
  readonly lastError?: { message?: string };
}

export interface BridgeClientOptions {
  /** Defaults to chrome.runtime (requires the nativeMessaging permission). */
  runtime?: () => NativeMessagingRuntime;
  /**
   * A pending request fails with 'timeout' if the host sends nothing for it
   * this long. The host sends heartbeats every 5 s while a job is pending.
   */
  silenceTimeoutMs?: number;
  /** Close the port (and the host process) after this long without requests. */
  idleDisconnectMs?: number;
  /** Upper bound for status(), which runs `claude auth status` and friends. */
  statusTimeoutMs?: number;
}

const DEFAULTS = {
  silenceTimeoutMs: 20_000,
  idleDisconnectMs: 30_000,
  statusTimeoutMs: 25_000,
};

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: AIError): void;
  timer: ReturnType<typeof setTimeout>;
  cleanup(): void;
}

function chromeRuntime(): NativeMessagingRuntime {
  const runtime = typeof chrome === 'undefined' ? undefined : chrome.runtime;
  if (typeof runtime?.connectNative !== 'function') {
    throw bridgeError('not_configured', 'bridge_permission_missing');
  }
  return runtime;
}

function cancelledError(): AIError {
  return bridgeError('cancelled', 'cancelled');
}

export class BridgeClient {
  #runtime: () => NativeMessagingRuntime;
  #options: typeof DEFAULTS;
  #port: BridgePort | null = null;
  #pending = new Map<string, PendingRequest>();
  #idleTimer: ReturnType<typeof setTimeout> | null = null;
  #sequence = 0;

  constructor(options: BridgeClientOptions = {}) {
    this.#runtime = options.runtime ?? chromeRuntime;
    this.#options = {
      silenceTimeoutMs: options.silenceTimeoutMs ?? DEFAULTS.silenceTimeoutMs,
      idleDisconnectMs: options.idleDisconnectMs ?? DEFAULTS.idleDisconnectMs,
      statusTimeoutMs: options.statusTimeoutMs ?? DEFAULTS.statusTimeoutMs,
    };
  }

  /** Run one analysis on the user's CLI. Rejects with AIError. */
  async analyze(
    request: BridgeAnalyzeRequest,
    signal?: AbortSignal
  ): Promise<BridgeAnalyzeResult> {
    const result = await this.#request(request, signal);
    if (!isBridgeAnalyzeResult(result)) {
      throw bridgeError('bad_response', 'bridge_protocol_error', 'malformed analyze result');
    }
    return result;
  }

  /** Installed/logged-in state of each CLI. Rejects with AIError. */
  async status(): Promise<BridgeStatus> {
    const runtime = this.#runtime();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(bridgeError('timeout', 'bridge_unresponsive')),
        this.#options.statusTimeoutMs
      );
    });
    let response: unknown;
    try {
      response = await Promise.race([
        runtime.sendNativeMessage(BRIDGE_HOST_NAME, { id: 'status', op: 'status' }),
        timeout,
      ]);
    } catch (error) {
      if (error instanceof AIError) throw error;
      throw fromRuntimeError(error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timer);
    }

    if (!isBridgeResponse(response)) {
      throw bridgeError('bad_response', 'bridge_protocol_error', 'malformed status response');
    }
    if (response.status === 'error') throw fromHostError(response.error);
    if (response.status !== 'ok' || !isBridgeStatus(response.result)) {
      throw bridgeError('bad_response', 'bridge_protocol_error', 'malformed status result');
    }
    if (response.result.protocol !== BRIDGE_PROTOCOL_VERSION) {
      throw bridgeError(
        'unavailable',
        'bridge_outdated',
        `host protocol ${response.result.protocol}, extension ${BRIDGE_PROTOCOL_VERSION}`
      );
    }
    return response.result;
  }

  /** Reject everything pending and close the port. */
  dispose(): void {
    this.#teardown(cancelledError());
  }

  #request(request: BridgeAnalyzeRequest, signal?: AbortSignal): Promise<unknown> {
    if (signal?.aborted) return Promise.reject(cancelledError());
    const port = this.#connect();
    const id = `r${++this.#sequence}`;

    return new Promise<unknown>((resolve, reject) => {
      const onAbort = () => {
        this.#settle(id, (entry) => entry.reject(cancelledError()));
        this.#post({ id: `c${id}`, op: 'cancel', targetId: id });
      };
      this.#pending.set(id, {
        resolve,
        reject,
        timer: this.#silenceTimer(id),
        cleanup: () => signal?.removeEventListener('abort', onAbort),
      });
      signal?.addEventListener('abort', onAbort, { once: true });
      try {
        port.postMessage({ id, op: 'analyze', ...request });
      } catch (error) {
        const lastError = error instanceof Error ? error.message : undefined;
        this.#teardown(fromRuntimeError(lastError));
      }
    });
  }

  #connect(): BridgePort {
    if (this.#idleTimer) {
      clearTimeout(this.#idleTimer);
      this.#idleTimer = null;
    }
    if (this.#port) return this.#port;

    const runtime = this.#runtime();
    const port = runtime.connectNative(BRIDGE_HOST_NAME);
    port.onMessage.addListener((message) => this.#onMessage(message));
    port.onDisconnect.addListener(() => {
      // lastError must be read inside this callback.
      const error = fromRuntimeError(runtime.lastError?.message);
      if (this.#port === port) {
        this.#port = null;
        this.#rejectAll(error);
      }
    });
    this.#port = port;
    return port;
  }

  #onMessage(message: unknown): void {
    if (!isBridgeResponse(message) || message.id === null) return;
    const entry = this.#pending.get(message.id);
    if (!entry) return;
    switch (message.status) {
      case 'queued':
      case 'running':
        clearTimeout(entry.timer);
        entry.timer = this.#silenceTimer(message.id);
        return;
      case 'ok':
        this.#settle(message.id, (e) => e.resolve(message.result));
        return;
      case 'error':
        this.#settle(message.id, (e) => e.reject(fromHostError(message.error)));
        return;
    }
  }

  #silenceTimer(id: string): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      // The host stopped responding; a fresh port starts a fresh host.
      this.#settle(id, (entry) => entry.reject(bridgeError('timeout', 'bridge_unresponsive')));
      this.#teardown(bridgeError('unavailable', 'bridge_disconnected', 'host unresponsive'));
    }, this.#options.silenceTimeoutMs);
  }

  #settle(id: string, finish: (entry: PendingRequest) => void): void {
    const entry = this.#pending.get(id);
    if (!entry) return;
    this.#pending.delete(id);
    clearTimeout(entry.timer);
    entry.cleanup();
    finish(entry);
    if (this.#pending.size === 0) this.#scheduleIdleDisconnect();
  }

  #scheduleIdleDisconnect(): void {
    if (!this.#port || this.#idleTimer) return;
    this.#idleTimer = setTimeout(() => {
      this.#idleTimer = null;
      if (this.#pending.size === 0) this.#teardown(cancelledError());
    }, this.#options.idleDisconnectMs);
  }

  #post(message: BridgeRequest): void {
    try {
      this.#port?.postMessage(message);
    } catch {
      // The port is already gone; its onDisconnect handler reports the error.
    }
  }

  #rejectAll(error: AIError): void {
    for (const id of [...this.#pending.keys()]) {
      this.#settle(id, (entry) => entry.reject(error));
    }
  }

  #teardown(error: AIError): void {
    const port = this.#port;
    this.#port = null;
    if (this.#idleTimer) {
      clearTimeout(this.#idleTimer);
      this.#idleTimer = null;
    }
    this.#rejectAll(error);
    // disconnect() does not fire our own onDisconnect listener.
    port?.disconnect();
  }
}

let sharedClient: BridgeClient | null = null;

/** Client shared by the provider and the settings screen. */
export function getBridgeClient(): BridgeClient {
  sharedClient ??= new BridgeClient();
  return sharedClient;
}
