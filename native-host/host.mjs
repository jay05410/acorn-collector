#!/usr/bin/env node
// @ts-check
/**
 * Acorn Collector CLI bridge: Chrome Native Messaging host entry point.
 *
 * The browser starts this process with the caller's origin
 * (chrome-extension://<id>/) as the first argument and talks over
 * stdin/stdout. stdout carries protocol frames only; diagnostics go to stderr.
 */
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'node:util';
import { runAnalyzeJob } from './lib/analyze.mjs';
import { configPath, isAllowedOrigin, loadConfig } from './lib/config.mjs';
import { runCli, stopAllNow } from './lib/process.mjs';
import { createBridgeServer } from './lib/server.mjs';
import { collectStatus } from './lib/status.mjs';
import { removeJobDirsSync, sweepStaleJobDirs } from './lib/tempdir.mjs';
import {
  FrameDecoder,
  FrameError,
  encodeFrame,
  flushStream,
} from './protocol.mjs';

const HOST_DIR = dirname(fileURLToPath(import.meta.url));
/**
 * Longest shutdown. CLI process groups get SIGTERM at once and SIGKILL after
 * 500 ms, so the host exits within about a second of the port closing.
 */
const EXIT_DEADLINE_MS = 1000;
/** Set to 1 to copy raw Claude Code output lines to stderr. */
const DEBUG = process.env.ACORN_BRIDGE_DEBUG === '1';

/** @param {unknown[]} args */
function log(...args) {
  process.stderr.write(`[acorn-bridge] ${format(...args)}\n`);
}

/** @param {Record<string, unknown>} message */
function send(message) {
  let frame;
  try {
    frame = encodeFrame(message);
  } catch (error) {
    if (!(error instanceof FrameError)) throw error;
    frame = encodeFrame({
      id: message.id ?? null,
      status: 'error',
      error: {
        code: 'bad_output',
        message: 'response exceeds the 1 MB native messaging limit',
      },
    });
  }
  process.stdout.write(frame);
}

async function main() {
  const origin = process.argv[2] ?? '';
  const config = await loadConfig(configPath(process.env, HOST_DIR));
  if (!isAllowedOrigin(origin, config)) {
    log('refusing caller origin', JSON.stringify(origin));
    // Tell the extension this is permanent (not a crash worth retrying).
    // The process exits once the frame is flushed.
    send({
      id: null,
      status: 'error',
      error: {
        code: 'origin_not_allowed',
        message:
          'this extension is not allowed to use the bridge; re-run install.mjs with its --extension-id',
      },
    });
    process.exitCode = 1;
    return;
  }
  // Last resort if the process exits through another path.
  process.on('exit', () => removeJobDirsSync());

  sweepStaleJobDirs().then(
    (removed) => removed > 0 && log(`removed ${removed} stale job dir(s)`),
    (error) => log('temp dir sweep failed:', error)
  );

  const platform = process.platform;
  const server = createBridgeServer({
    send,
    analyze: (request, signal) =>
      runAnalyzeJob(request, signal, {
        cliPaths: config.cliPaths,
        env: process.env,
        platform,
        run: runCli,
        debug: DEBUG
          ? (line) => log('claude:', line.slice(0, 4000))
          : undefined,
      }),
    status: () =>
      collectStatus({
        cliPaths: config.cliPaths,
        env: process.env,
        platform,
        run: runCli,
      }),
  });

  let closing = false;
  /**
   * The browser may kill the host soon after the port closes, and CLI
   * children run in their own process groups, so nothing here waits for a
   * graceful CLI exit: stop every CLI group now, drop queued jobs, delete job
   * dirs synchronously, then exit within EXIT_DEADLINE_MS.
   * @param {number} code
   */
  const shutdown = (code) => {
    if (closing) return;
    closing = true;
    const stopped = stopAllNow();
    // Cancels every job; their final 'cancelled' frames are flushed below.
    const idle = server.shutdown().then(() => flushStream(process.stdout));
    removeJobDirsSync();
    void Promise.race([
      Promise.all([stopped, idle]),
      new Promise((resolve) => setTimeout(resolve, EXIT_DEADLINE_MS)),
    ]).then(() => {
      // Dirs created while CLIs were stopping (a job between mkdtemp and spawn).
      removeJobDirsSync();
      process.exit(code);
    });
  };

  const decoder = new FrameDecoder();
  process.stdin.on('data', (/** @type {Buffer} */ chunk) => {
    if (closing) return;
    let messages;
    try {
      messages = decoder.push(chunk);
    } catch (error) {
      log('protocol error:', error instanceof Error ? error.message : error);
      shutdown(1);
      return;
    }
    for (const message of messages) void server.handle(message);
  });
  // The browser closes stdin when the port disconnects or after a one-shot
  // sendNativeMessage reply.
  process.stdin.on('end', () => shutdown(0));
  process.stdout.on('error', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));
  process.on('SIGINT', () => shutdown(0));
}

main().catch((error) => {
  log('fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
