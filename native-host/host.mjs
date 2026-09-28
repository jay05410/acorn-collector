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
import { runCli } from './lib/process.mjs';
import { createBridgeServer } from './lib/server.mjs';
import { collectStatus } from './lib/status.mjs';
import { sweepStaleJobDirs } from './lib/tempdir.mjs';
import { FrameDecoder, FrameError, encodeFrame } from './protocol.mjs';

const HOST_DIR = dirname(fileURLToPath(import.meta.url));
/** Longest wait for CLI children to exit when the browser disconnects. */
const SHUTDOWN_GRACE_MS = 11_000;
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

/** Resolves once queued frames have been handed to the OS. */
function drainStdout() {
  return new Promise((resolve) => {
    if (process.stdout.writableLength === 0) resolve(undefined);
    else process.stdout.once('drain', () => resolve(undefined));
  });
}

async function main() {
  const origin = process.argv[2] ?? '';
  const config = await loadConfig(configPath(process.env, HOST_DIR));
  if (!isAllowedOrigin(origin, config)) {
    log('refusing caller origin', JSON.stringify(origin));
    process.exitCode = 1;
    return;
  }

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
  /** @param {number} code */
  const shutdown = async (code) => {
    if (closing) return;
    closing = true;
    await Promise.race([
      server.shutdown().then(drainStdout),
      new Promise((resolve) => setTimeout(resolve, SHUTDOWN_GRACE_MS)),
    ]);
    process.exit(code);
  };

  const decoder = new FrameDecoder();
  process.stdin.on('data', (/** @type {Buffer} */ chunk) => {
    if (closing) return;
    let messages;
    try {
      messages = decoder.push(chunk);
    } catch (error) {
      log('protocol error:', error instanceof Error ? error.message : error);
      void shutdown(1);
      return;
    }
    for (const message of messages) void server.handle(message);
  });
  // The browser closes stdin when the port disconnects or after a one-shot
  // sendNativeMessage reply.
  process.stdin.on('end', () => void shutdown(0));
  process.stdout.on('error', () => void shutdown(0));
  process.on('SIGTERM', () => void shutdown(0));
  process.on('SIGINT', () => void shutdown(0));
}

main().catch((error) => {
  log('fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
