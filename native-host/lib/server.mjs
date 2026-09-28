// @ts-check
/**
 * Request dispatch, independent of stdio so it can be tested directly.
 *
 * Responses (host -> extension), all carrying the request id:
 *   { id, status: 'queued' | 'running' }          heartbeat, analyze only
 *   { id, status: 'ok', result }                  final
 *   { id, status: 'error', error: { code, message } }  final
 */
import { PROTOCOL_VERSION } from '../protocol.mjs';
import { toErrorPayload } from './errors.mjs';
import { JobQueue } from './queue.mjs';
import { parseRequest, requestIdOf } from './validate.mjs';

/**
 * @typedef {import('./validate.mjs').AnalyzeRequest} AnalyzeRequest
 * @typedef {import('./queue.mjs').JobQueueOptions} JobQueueOptions
 */

/**
 * @typedef {object} ServerDeps
 * @property {(message: Record<string, unknown>) => void} send
 * @property {(request: AnalyzeRequest, signal: AbortSignal) => Promise<unknown>} analyze
 * @property {() => Promise<unknown>} status
 * @property {Omit<JobQueueOptions, 'onState'>} [queue]
 */

/**
 * @param {ServerDeps} deps
 */
export function createBridgeServer({ send, analyze, status, queue: queueOptions }) {
  const queue = new JobQueue({
    ...queueOptions,
    onState: (id, state) => send({ id, status: state }),
  });

  /**
   * Handle one decoded message. Never throws; every outcome is sent.
   * @param {unknown} raw
   * @returns {Promise<void>}
   */
  async function handle(raw) {
    let request;
    try {
      request = parseRequest(raw);
    } catch (error) {
      send({ id: requestIdOf(raw), status: 'error', error: toErrorPayload(error) });
      return;
    }
    try {
      const result = await dispatch(request);
      send({ id: request.id, status: 'ok', result });
    } catch (error) {
      send({ id: request.id, status: 'error', error: toErrorPayload(error) });
    }
  }

  /**
   * @param {import('./validate.mjs').BridgeRequest} request
   * @returns {Promise<unknown>}
   */
  async function dispatch(request) {
    switch (request.op) {
      case 'ping':
        return { protocol: PROTOCOL_VERSION };
      case 'status':
        return status();
      case 'cancel':
        return { cancelled: queue.cancel(request.targetId) };
      case 'analyze':
        return queue.enqueue(request.id, (signal) => analyze(request, signal));
    }
  }

  /** Cancel all jobs and wait for their CLI processes to exit. */
  function shutdown() {
    queue.cancelAll();
    return queue.idle();
  }

  return { handle, shutdown };
}
