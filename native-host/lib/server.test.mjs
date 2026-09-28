import { describe, expect, it, vi } from 'vitest';
import { HostError } from './errors.mjs';
import { createBridgeServer } from './server.mjs';

const JPEG_B64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64');
const analyzeRequest = (id = 'r1') => ({
  id,
  op: 'analyze',
  target: 'claude',
  model: 'sonnet',
  system: 'S',
  text: 'T',
  images: [{ mimeType: 'image/jpeg', base64: JPEG_B64 }],
  schema: { type: 'object' },
});

function setup(overrides = {}) {
  const sent = [];
  const deps = {
    send: (message) => sent.push(message),
    analyze: vi.fn(async () => ({
      output: { items: [] },
      model: 'claude-sonnet-5',
      usage: null,
    })),
    status: vi.fn(async () => ({
      protocol: 1,
      platform: 'darwin',
      targets: {},
    })),
    ...overrides,
  };
  return { server: createBridgeServer(deps), sent, deps };
}

describe('createBridgeServer', () => {
  it('answers ping with the protocol version', async () => {
    const { server, sent } = setup();
    await server.handle({ id: 'p', op: 'ping' });
    expect(sent).toEqual([{ id: 'p', status: 'ok', result: { protocol: 1 } }]);
  });

  it('answers status from the status provider', async () => {
    const { server, sent, deps } = setup();
    await server.handle({ id: 's', op: 'status' });
    expect(deps.status).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([
      {
        id: 's',
        status: 'ok',
        result: { protocol: 1, platform: 'darwin', targets: {} },
      },
    ]);
  });

  it('runs analyze through the queue with a running ack first', async () => {
    const { server, sent, deps } = setup();
    await server.handle(analyzeRequest());
    expect(sent).toEqual([
      { id: 'r1', status: 'running' },
      {
        id: 'r1',
        status: 'ok',
        result: {
          output: { items: [] },
          model: 'claude-sonnet-5',
          usage: null,
        },
      },
    ]);
    const [request, signal] = deps.analyze.mock.calls[0];
    expect(request.images[0].mimeType).toBe('image/jpeg');
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it('reports job failures with their code', async () => {
    const { server, sent } = setup({
      analyze: async () => {
        throw new HostError('not_logged_in', 'log in first');
      },
    });
    await server.handle(analyzeRequest());
    expect(sent.at(-1)).toEqual({
      id: 'r1',
      status: 'error',
      error: { code: 'not_logged_in', message: 'log in first' },
    });
  });

  it('hides unexpected exceptions behind an internal error', async () => {
    const { server, sent } = setup({
      status: async () => {
        throw new TypeError('x is undefined');
      },
    });
    await server.handle({ id: 's', op: 'status' });
    expect(sent).toEqual([
      {
        id: 's',
        status: 'error',
        error: { code: 'internal', message: 'x is undefined' },
      },
    ]);
  });

  it('rejects invalid requests without running anything', async () => {
    const { server, sent, deps } = setup();
    await server.handle({ ...analyzeRequest('bad'), target: 'gemini' });
    await server.handle({ id: 'x', op: 'shell', command: 'rm -rf ~' });
    await server.handle('not an object');
    expect(deps.analyze).not.toHaveBeenCalled();
    expect(sent.map((m) => [m.id, m.status, m.error?.code])).toEqual([
      ['bad', 'error', 'bad_request'],
      ['x', 'error', 'bad_request'],
      [null, 'error', 'bad_request'],
    ]);
  });

  it('cancels a running analyze and reports it to both requests', async () => {
    let started;
    const running = new Promise((resolve) => (started = resolve));
    const { server, sent } = setup({
      analyze: (_request, signal) =>
        new Promise((_resolve, reject) => {
          started();
          signal.addEventListener('abort', () => reject(signal.reason));
        }),
    });
    const job = server.handle(analyzeRequest('job'));
    await running;
    await server.handle({ id: 'c', op: 'cancel', targetId: 'job' });
    await job;
    expect(sent).toEqual(
      expect.arrayContaining([
        { id: 'c', status: 'ok', result: { cancelled: true } },
        {
          id: 'job',
          status: 'error',
          error: { code: 'cancelled', message: 'cancelled by the extension' },
        },
      ])
    );
  });

  it('shutdown cancels pending jobs and waits for them to stop', async () => {
    let stopped = false;
    const { server, sent } = setup({
      analyze: (_request, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () =>
            setTimeout(() => {
              stopped = true;
              reject(signal.reason);
            }, 5)
          );
        }),
    });
    const job = server.handle(analyzeRequest('job'));
    await Promise.resolve();
    await server.shutdown();
    await job;
    expect(stopped).toBe(true);
    expect(sent.at(-1)).toMatchObject({
      id: 'job',
      status: 'error',
      error: { code: 'cancelled' },
    });
  });
});
