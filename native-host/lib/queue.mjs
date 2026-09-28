// @ts-check
/**
 * FIFO job queue running at most one CLI job at a time. A job's promise
 * settles as soon as it is cancelled or times out, but its slot stays taken
 * until the task itself has finished (i.e. the CLI process has exited), so two
 * CLI processes never overlap.
 */
import { HostError } from './errors.mjs';

export const HEARTBEAT_MS = 5000;
export const JOB_TIMEOUT_MS = 180_000;
/** Queued plus running jobs. */
export const MAX_JOBS = 8;

/** @typedef {'queued' | 'running'} JobState */

/**
 * @template T
 * @typedef {object} Job
 * @property {string} id
 * @property {(signal: AbortSignal) => Promise<T>} task
 * @property {AbortController} controller
 * @property {(value: T) => void} resolve
 * @property {(error: unknown) => void} reject
 * @property {boolean} settled
 */

/**
 * @typedef {object} JobQueueOptions
 * @property {(id: string, state: JobState) => void} onState Called when a job
 *   is queued or starts, and every `heartbeatMs` while it is pending.
 * @property {number} [heartbeatMs]
 * @property {number} [timeoutMs] Per-job run time limit.
 * @property {number} [maxJobs]
 */

export class JobQueue {
  /** @type {Job<any>[]} */
  #queued = [];
  /** @type {Job<any> | null} */
  #running = null;
  /** @type {ReturnType<typeof setInterval> | null} */
  #heartbeat = null;
  /** @type {(() => void)[]} */
  #idleWaiters = [];
  #onState;
  #heartbeatMs;
  #timeoutMs;
  #maxJobs;

  /** @param {JobQueueOptions} options */
  constructor(options) {
    this.#onState = options.onState;
    this.#heartbeatMs = options.heartbeatMs ?? HEARTBEAT_MS;
    this.#timeoutMs = options.timeoutMs ?? JOB_TIMEOUT_MS;
    this.#maxJobs = options.maxJobs ?? MAX_JOBS;
  }

  /**
   * @template T
   * @param {string} id Request id; must not be pending already.
   * @param {(signal: AbortSignal) => Promise<T>} task Must stop promptly and
   *   reject once the signal aborts.
   * @returns {Promise<T>}
   */
  enqueue(id, task) {
    if (this.#find(id)) {
      return Promise.reject(new HostError('bad_request', `request ${id} is already pending`));
    }
    const pending = this.#queued.length + (this.#running ? 1 : 0);
    if (pending >= this.#maxJobs) {
      return Promise.reject(new HostError('busy', `${pending} jobs are already pending`));
    }
    return new Promise((resolve, reject) => {
      /** @type {Job<T>} */
      const job = {
        id,
        task,
        controller: new AbortController(),
        resolve,
        reject,
        settled: false,
      };
      this.#queued.push(job);
      if (this.#running) this.#onState(id, 'queued');
      this.#pump();
      this.#syncHeartbeat();
    });
  }

  /**
   * Cancel a queued or running job. Its promise rejects with 'cancelled'.
   * @param {string} id
   * @returns {boolean} Whether a pending job was found.
   */
  cancel(id) {
    const index = this.#queued.findIndex((job) => job.id === id);
    if (index >= 0) {
      const [job] = this.#queued.splice(index, 1);
      if (job) this.#abort(job, new HostError('cancelled', 'cancelled by the extension'));
      this.#syncHeartbeat();
      return true;
    }
    if (this.#running && !this.#running.settled && this.#running.id === id) {
      this.#abort(this.#running, new HostError('cancelled', 'cancelled by the extension'));
      this.#syncHeartbeat();
      return true;
    }
    return false;
  }

  /** Cancel every job (host shutdown). */
  cancelAll() {
    for (const job of this.#queued.splice(0)) {
      this.#abort(job, new HostError('cancelled', 'bridge is shutting down'));
    }
    if (this.#running) {
      this.#abort(this.#running, new HostError('cancelled', 'bridge is shutting down'));
    }
    this.#syncHeartbeat();
  }

  /** @returns {Promise<void>} Resolves once no task is running or queued. */
  idle() {
    if (!this.#running && this.#queued.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.#idleWaiters.push(resolve));
  }

  /**
   * @param {string} id
   * @returns {Job<any> | undefined}
   */
  #find(id) {
    if (this.#running && !this.#running.settled && this.#running.id === id) {
      return this.#running;
    }
    return this.#queued.find((job) => job.id === id);
  }

  #pump() {
    if (this.#running) return;
    const job = this.#queued.shift();
    if (!job) {
      for (const resolve of this.#idleWaiters.splice(0)) resolve();
      return;
    }
    this.#running = job;
    this.#onState(job.id, 'running');
    const timer = setTimeout(() => {
      this.#abort(
        job,
        new HostError('timeout', `CLI did not finish within ${this.#timeoutMs / 1000} s`)
      );
      this.#syncHeartbeat();
    }, this.#timeoutMs);

    Promise.resolve()
      .then(() => job.task(job.controller.signal))
      .then(
        (value) => this.#settle(job, () => job.resolve(value)),
        (error) => this.#settle(job, () => job.reject(error))
      )
      .finally(() => {
        clearTimeout(timer);
        this.#running = null;
        this.#pump();
        this.#syncHeartbeat();
      });
  }

  /**
   * @param {Job<any>} job
   * @param {HostError} reason
   */
  #abort(job, reason) {
    if (job.settled) return;
    job.controller.abort(reason);
    this.#settle(job, () => job.reject(reason));
  }

  /**
   * @param {Job<any>} job
   * @param {() => void} finish
   */
  #settle(job, finish) {
    if (job.settled) return;
    job.settled = true;
    finish();
  }

  #syncHeartbeat() {
    const active =
      (this.#running !== null && !this.#running.settled) || this.#queued.length > 0;
    if (active && !this.#heartbeat) {
      this.#heartbeat = setInterval(() => this.#beat(), this.#heartbeatMs);
    } else if (!active && this.#heartbeat) {
      clearInterval(this.#heartbeat);
      this.#heartbeat = null;
    }
  }

  #beat() {
    if (this.#running && !this.#running.settled) {
      this.#onState(this.#running.id, 'running');
    }
    for (const job of this.#queued) this.#onState(job.id, 'queued');
  }
}
