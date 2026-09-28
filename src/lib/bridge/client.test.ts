import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIError } from '@/lib/ai/types';
import {
  BridgeClient,
  type BridgePort,
  type NativeMessagingRuntime,
} from './client';
import {
  BRIDGE_MAX_PAYLOAD_BYTES,
  type BridgeAnalyzeRequest,
  type BridgeRequest,
  type BridgeStatus,
} from './protocol';

class FakePort implements BridgePort {
  posted: BridgeRequest[] = [];
  disconnected = false;
  throwOnPost = false;
  #messageListeners: Array<(message: unknown) => void> = [];
  #disconnectListeners: Array<() => void> = [];

  constructor(private runtime: FakeRuntime) {}

  postMessage(message: BridgeRequest): void {
    if (this.throwOnPost)
      throw new Error('Attempting to use a disconnected port object');
    this.posted.push(message);
  }
  disconnect(): void {
    this.disconnected = true;
  }
  onMessage = {
    addListener: (cb: (message: unknown) => void) =>
      this.#messageListeners.push(cb),
  };
  onDisconnect = {
    addListener: (cb: () => void) => this.#disconnectListeners.push(cb),
  };

  /** Simulate a frame from the host. */
  reply(message: unknown): void {
    for (const cb of this.#messageListeners) cb(message);
  }
  /** Simulate the browser closing the port, optionally with lastError. */
  drop(lastError?: string): void {
    this.runtime.lastError = lastError ? { message: lastError } : undefined;
    for (const cb of this.#disconnectListeners) cb();
    this.runtime.lastError = undefined;
  }
  get lastPosted(): BridgeRequest {
    const last = this.posted.at(-1);
    if (!last) throw new Error('nothing posted');
    return last;
  }
}

class FakeRuntime implements NativeMessagingRuntime {
  ports: FakePort[] = [];
  lastError: { message?: string } | undefined;
  sendNativeMessage =
    vi.fn<(application: string, message: BridgeRequest) => Promise<unknown>>();

  connectNative(application: string): FakePort {
    expect(application).toBe('com.acorn_collector.bridge');
    const port = new FakePort(this);
    this.ports.push(port);
    return port;
  }
  get port(): FakePort {
    const port = this.ports.at(-1);
    if (!port) throw new Error('no port');
    return port;
  }
}

const REQUEST: BridgeAnalyzeRequest = {
  target: 'claude',
  model: 'sonnet',
  system: 'S',
  text: 'T',
  images: [{ mimeType: 'image/jpeg', base64: '/9j/' }],
  schema: { type: 'object' },
};

const RESULT = {
  output: { items: [] },
  model: 'claude-sonnet-5',
  usage: { inputTokens: 7149, outputTokens: 1282 },
};

const STATUS: BridgeStatus = {
  protocol: 1,
  platform: 'darwin',
  targets: {
    claude: {
      installed: true,
      loggedIn: true,
      authMethod: 'claude.ai',
      subscriptionType: 'max',
      warnings: [],
    },
    codex: {
      installed: false,
      loggedIn: false,
      authMethod: null,
      subscriptionType: null,
      warnings: [],
    },
  },
};

async function rejection(promise: Promise<unknown>): Promise<AIError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AIError);
    return error as AIError;
  }
  throw new Error('expected an AIError');
}

let runtime: FakeRuntime;
let client: BridgeClient;

beforeEach(() => {
  vi.useFakeTimers();
  runtime = new FakeRuntime();
  client = new BridgeClient({
    runtime: () => runtime,
    silenceTimeoutMs: 20_000,
    idleDisconnectMs: 30_000,
    statusTimeoutMs: 25_000,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('BridgeClient.analyze', () => {
  it('posts an analyze request with an id and resolves with the result', async () => {
    const pending = client.analyze(REQUEST);
    const sent = runtime.port.lastPosted;
    expect(sent).toEqual({ id: expect.any(String), op: 'analyze', ...REQUEST });

    runtime.port.reply({ id: sent.id, status: 'running' });
    runtime.port.reply({ id: sent.id, status: 'ok', result: RESULT });
    await expect(pending).resolves.toEqual(RESULT);
  });

  it('routes responses by id across concurrent requests on one port', async () => {
    const first = client.analyze(REQUEST);
    const second = client.analyze({ ...REQUEST, target: 'codex', model: '' });
    expect(runtime.ports).toHaveLength(1);
    const [a, b] = runtime.port.posted;
    expect(a?.id).not.toBe(b?.id);

    runtime.port.reply({
      id: b?.id,
      status: 'ok',
      result: { ...RESULT, model: null },
    });
    runtime.port.reply({ id: a?.id, status: 'ok', result: RESULT });
    await expect(first).resolves.toEqual(RESULT);
    await expect(second).resolves.toMatchObject({ model: null });
  });

  it('keeps a request alive while heartbeats arrive', async () => {
    const pending = client.analyze(REQUEST);
    const { id } = runtime.port.lastPosted;
    for (let i = 0; i < 10; i += 1) {
      await vi.advanceTimersByTimeAsync(15_000);
      runtime.port.reply({ id, status: i < 3 ? 'queued' : 'running' });
    }
    runtime.port.reply({ id, status: 'ok', result: RESULT });
    await expect(pending).resolves.toEqual(RESULT);
  });

  it('times out a silent host and reconnects on the next request', async () => {
    const pending = rejection(client.analyze(REQUEST));
    const firstPort = runtime.port;
    await vi.advanceTimersByTimeAsync(20_000);
    const error = await pending;
    expect(error.code).toBe('timeout');
    expect(error.message).toBe('bridge_unresponsive');
    expect(error.provider).toBe('cli');
    expect(firstPort.disconnected).toBe(true);

    void client.analyze(REQUEST).catch(() => {});
    expect(runtime.ports).toHaveLength(2);
  });

  it('maps host errors to AIError codes and keeps the host detail as cause', async () => {
    const pending = rejection(client.analyze(REQUEST));
    const { id } = runtime.port.lastPosted;
    runtime.port.reply({
      id,
      status: 'error',
      error: { code: 'not_logged_in', message: 'Claude Code is not logged in' },
    });
    const error = await pending;
    expect(error.code).toBe('auth');
    expect(error.message).toBe('cli_not_logged_in');
    expect(error.cause).toBe('Claude Code is not logged in');
  });

  it('reports a missing host as a non-retryable bridge_not_installed, then reconnects', async () => {
    const pending = rejection(client.analyze(REQUEST));
    runtime.port.drop('Specified native messaging host not found.');
    const error = await pending;
    expect(error.code).toBe('not_configured');
    expect(error.message).toBe('bridge_not_installed');
    expect(error.retryable).toBe(false);

    const next = client.analyze(REQUEST);
    expect(runtime.ports).toHaveLength(2);
    runtime.port.reply({
      id: runtime.port.lastPosted.id,
      status: 'ok',
      result: RESULT,
    });
    await expect(next).resolves.toEqual(RESULT);
  });

  it('distinguishes a forbidden origin and a host that exited', async () => {
    const forbidden = rejection(client.analyze(REQUEST));
    runtime.port.drop(
      'Access to the specified native messaging host is forbidden.'
    );
    expect(await forbidden).toMatchObject({
      code: 'not_configured',
      message: 'bridge_forbidden',
      retryable: false,
    });

    const exited = rejection(client.analyze(REQUEST));
    runtime.port.drop('Native host has exited.');
    expect(await exited).toMatchObject({
      code: 'unavailable',
      message: 'bridge_disconnected',
      retryable: true,
    });
  });

  it('fails every pending request when the host refuses this extension', async () => {
    const first = rejection(client.analyze(REQUEST));
    const second = rejection(client.analyze(REQUEST));
    const port = runtime.port;
    // The host writes this, then exits (Chrome then reports "has exited").
    port.reply({
      id: null,
      status: 'error',
      error: { code: 'origin_not_allowed', message: 'not allowed' },
    });
    for (const error of [await first, await second]) {
      expect(error).toMatchObject({
        code: 'not_configured',
        message: 'bridge_forbidden',
        retryable: false,
        cause: 'not allowed',
      });
    }
    expect(port.disconnected).toBe(true);
    port.drop('Native host has exited.');

    void client.analyze(REQUEST).catch(() => {});
    expect(runtime.ports).toHaveLength(2);
  });

  it('rejects a request over the payload budget without contacting the host', async () => {
    const huge = {
      ...REQUEST,
      images: [
        {
          mimeType: 'image/jpeg' as const,
          base64: 'A'.repeat(BRIDGE_MAX_PAYLOAD_BYTES),
        },
      ],
    };
    const error = await rejection(client.analyze(huge));
    expect(error).toMatchObject({
      code: 'unknown',
      message: 'bridge_bad_request',
      retryable: false,
    });
    expect(runtime.ports).toHaveLength(0);
  });

  it('cancels on abort: rejects immediately and asks the host to stop', async () => {
    const controller = new AbortController();
    const pending = rejection(client.analyze(REQUEST, controller.signal));
    const { id } = runtime.port.lastPosted;
    controller.abort();
    const error = await pending;
    expect(error.code).toBe('cancelled');
    expect(runtime.port.lastPosted).toEqual({
      id: `c${id}`,
      op: 'cancel',
      targetId: id,
    });
    // A late result for the cancelled id is ignored.
    runtime.port.reply({ id, status: 'ok', result: RESULT });
  });

  it('rejects an already-aborted request without starting the host', async () => {
    const error = await rejection(client.analyze(REQUEST, AbortSignal.abort()));
    expect(error.code).toBe('cancelled');
    expect(runtime.ports).toHaveLength(0);
  });

  it('rejects a malformed result as a bad response', async () => {
    const pending = rejection(client.analyze(REQUEST));
    runtime.port.reply({
      id: runtime.port.lastPosted.id,
      status: 'ok',
      result: { output: 'x' },
    });
    const error = await pending;
    expect(error.code).toBe('bad_response');
    expect(error.message).toBe('bridge_protocol_error');
  });

  it('ignores frames that are not bridge responses', async () => {
    const pending = client.analyze(REQUEST);
    const { id } = runtime.port.lastPosted;
    runtime.port.reply('garbage');
    runtime.port.reply({ id, status: 'weird' });
    runtime.port.reply({ id: 'other', status: 'ok', result: RESULT });
    runtime.port.reply({ id, status: 'ok', result: RESULT });
    await expect(pending).resolves.toEqual(RESULT);
  });

  it('treats a failing postMessage as a disconnect', async () => {
    runtime.connectNative = function (this: FakeRuntime, name: string) {
      const port = FakeRuntime.prototype.connectNative.call(this, name);
      port.throwOnPost = true;
      return port;
    };
    const error = await rejection(client.analyze(REQUEST));
    expect(error.message).toBe('bridge_disconnected');
  });

  it('closes an idle port and dispose rejects pending requests', async () => {
    const first = client.analyze(REQUEST);
    runtime.port.reply({
      id: runtime.port.lastPosted.id,
      status: 'ok',
      result: RESULT,
    });
    await first;
    await vi.advanceTimersByTimeAsync(29_000);
    expect(runtime.port.disconnected).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(runtime.port.disconnected).toBe(true);

    const pending = rejection(client.analyze(REQUEST));
    client.dispose();
    expect((await pending).code).toBe('cancelled');
  });

  it('reports a missing nativeMessaging permission', async () => {
    vi.stubGlobal('chrome', { runtime: {} });
    const error = await rejection(new BridgeClient().analyze(REQUEST));
    expect(error.code).toBe('not_configured');
    expect(error.message).toBe('bridge_permission_missing');
  });
});

describe('BridgeClient.status', () => {
  it('uses a one-shot native message and returns the status', async () => {
    runtime.sendNativeMessage.mockResolvedValue({
      id: 'status',
      status: 'ok',
      result: STATUS,
    });
    await expect(client.status()).resolves.toEqual(STATUS);
    expect(runtime.sendNativeMessage).toHaveBeenCalledWith(
      'com.acorn_collector.bridge',
      {
        id: 'status',
        op: 'status',
      }
    );
    expect(runtime.ports).toHaveLength(0);
  });

  it('maps a missing host', async () => {
    runtime.sendNativeMessage.mockRejectedValue(
      new Error('Specified native messaging host not found.')
    );
    const error = await rejection(client.status());
    expect(error.message).toBe('bridge_not_installed');
    expect(error.code).toBe('not_configured');
  });

  it('maps a host that refuses this extension', async () => {
    runtime.sendNativeMessage.mockResolvedValue({
      id: null,
      status: 'error',
      error: { code: 'origin_not_allowed', message: 'not allowed' },
    });
    const error = await rejection(client.status());
    expect(error).toMatchObject({
      code: 'not_configured',
      message: 'bridge_forbidden',
    });
  });

  it('maps host errors and malformed replies', async () => {
    runtime.sendNativeMessage.mockResolvedValue({
      id: 'status',
      status: 'error',
      error: { code: 'internal', message: 'boom' },
    });
    expect((await rejection(client.status())).message).toBe('bridge_internal');

    runtime.sendNativeMessage.mockResolvedValue({
      id: 'status',
      status: 'ok',
      result: {},
    });
    expect((await rejection(client.status())).message).toBe(
      'bridge_protocol_error'
    );
  });

  it('flags a host speaking another protocol version', async () => {
    runtime.sendNativeMessage.mockResolvedValue({
      id: 'status',
      status: 'ok',
      result: { ...STATUS, protocol: 2 },
    });
    const error = await rejection(client.status());
    expect(error.code).toBe('not_configured');
    expect(error.message).toBe('bridge_outdated');
    expect(error.retryable).toBe(false);
  });

  it('times out when the host never answers', async () => {
    runtime.sendNativeMessage.mockReturnValue(new Promise(() => {}));
    const pending = rejection(client.status());
    await vi.advanceTimersByTimeAsync(25_000);
    const error = await pending;
    expect(error.code).toBe('timeout');
    expect(error.message).toBe('bridge_unresponsive');
  });
});
