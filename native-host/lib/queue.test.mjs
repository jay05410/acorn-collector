import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JobQueue } from './queue.mjs';

/** A task that stays running until released, and honours abort. */
function controllableTask() {
  let release = () => {};
  const started = vi.fn();
  const task = vi.fn(
    (signal) =>
      new Promise((resolve, reject) => {
        started();
        release = (value) => resolve(value);
        signal.addEventListener('abort', () => {
          // Simulate the CLI taking a moment to exit after the signal.
          setTimeout(() => reject(signal.reason), 10);
        });
      })
  );
  return { task, started, release: (value) => release(value) };
}

/** Let pending promise callbacks run. */
const flush = () => vi.advanceTimersByTimeAsync(0);

describe('JobQueue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs jobs one at a time in FIFO order', async () => {
    const onState = vi.fn();
    const queue = new JobQueue({ onState });
    const a = controllableTask();
    const b = controllableTask();
    const first = queue.enqueue('a', a.task);
    const second = queue.enqueue('b', b.task);
    await flush();

    expect(a.started).toHaveBeenCalledTimes(1);
    expect(b.started).not.toHaveBeenCalled();
    expect(onState.mock.calls).toEqual([
      ['a', 'running'],
      ['b', 'queued'],
    ]);

    a.release('A');
    await expect(first).resolves.toBe('A');
    await flush();
    expect(b.started).toHaveBeenCalledTimes(1);
    b.release('B');
    await expect(second).resolves.toBe('B');
    await expect(queue.idle()).resolves.toBeUndefined();
  });

  it('sends heartbeats every interval while jobs are pending', async () => {
    const onState = vi.fn();
    const queue = new JobQueue({ onState, heartbeatMs: 5000 });
    const a = controllableTask();
    const b = controllableTask();
    void queue.enqueue('a', a.task);
    void queue.enqueue('b', b.task);
    await flush();
    onState.mockClear();

    await vi.advanceTimersByTimeAsync(5000);
    expect(onState.mock.calls).toEqual([
      ['a', 'running'],
      ['b', 'queued'],
    ]);

    a.release();
    await flush();
    b.release();
    await flush();
    onState.mockClear();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(onState).not.toHaveBeenCalled();
  });

  it('times out a job, aborts its task and keeps the slot until it exits', async () => {
    const queue = new JobQueue({ onState: () => {}, timeoutMs: 1000 });
    const a = controllableTask();
    const b = controllableTask();
    const first = queue.enqueue('a', a.task);
    void queue.enqueue('b', b.task);
    const outcome = first.catch((error) => error);
    await flush();

    await vi.advanceTimersByTimeAsync(1000);
    const error = await outcome;
    expect(error.code).toBe('timeout');
    const signal = a.task.mock.calls[0][0];
    expect(signal.aborted).toBe(true);
    // The aborted task has not exited yet, so the next job must wait.
    expect(b.started).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(10);
    expect(b.started).toHaveBeenCalledTimes(1);
  });

  it('cancels a queued job without running it', async () => {
    const queue = new JobQueue({ onState: () => {} });
    const a = controllableTask();
    const b = controllableTask();
    void queue.enqueue('a', a.task);
    const second = queue.enqueue('b', b.task).catch((error) => error);
    await flush();

    expect(queue.cancel('b')).toBe(true);
    expect((await second).code).toBe('cancelled');
    a.release();
    await flush();
    await flush();
    expect(b.task).not.toHaveBeenCalled();
  });

  it('cancels a running job immediately and aborts its signal', async () => {
    const queue = new JobQueue({ onState: () => {} });
    const a = controllableTask();
    const first = queue.enqueue('a', a.task).catch((error) => error);
    await flush();

    expect(queue.cancel('a')).toBe(true);
    expect((await first).code).toBe('cancelled');
    expect(a.task.mock.calls[0][0].aborted).toBe(true);
    expect(queue.cancel('a')).toBe(false);
    expect(queue.cancel('unknown')).toBe(false);
  });

  it('rejects duplicate ids and a full queue', async () => {
    const queue = new JobQueue({ onState: () => {}, maxJobs: 2 });
    void queue.enqueue('a', controllableTask().task);
    await expect(
      queue.enqueue('a', controllableTask().task)
    ).rejects.toMatchObject({
      code: 'bad_request',
    });
    void queue.enqueue('b', controllableTask().task);
    await expect(
      queue.enqueue('c', controllableTask().task)
    ).rejects.toMatchObject({
      code: 'busy',
    });
  });

  it('propagates task failures', async () => {
    const queue = new JobQueue({ onState: () => {} });
    await expect(
      queue.enqueue('a', () => Promise.reject(new Error('boom')))
    ).rejects.toThrow('boom');
  });

  it('cancelAll rejects everything and idle waits for the running task', async () => {
    const queue = new JobQueue({ onState: () => {} });
    const a = controllableTask();
    const first = queue.enqueue('a', a.task).catch((error) => error);
    const second = queue
      .enqueue('b', controllableTask().task)
      .catch((error) => error);
    await flush();

    queue.cancelAll();
    expect((await first).code).toBe('cancelled');
    expect((await second).code).toBe('cancelled');
    const idle = vi.fn();
    void queue.idle().then(idle);
    await flush();
    expect(idle).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10);
    expect(idle).toHaveBeenCalled();
  });
});
