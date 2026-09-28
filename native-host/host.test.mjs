/**
 * Runs host.mjs as a child process, the way the browser does: caller origin
 * as the first argument, framed JSON over stdio.
 */
import { spawn } from 'node:child_process';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FrameDecoder, encodeFrame } from './protocol.mjs';

const HOST = fileURLToPath(new URL('./host.mjs', import.meta.url));
const ORIGIN = `chrome-extension://${'p'.repeat(32)}/`;
const JPEG_B64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64');

/** Stands in for `claude`: echoes what it received as structured output. */
const FAKE_CLAUDE = `#!/usr/bin/env node
let input = '';
process.stdin.on('data', (c) => (input += c)).on('end', () => {
  const content = JSON.parse(input).message.content;
  console.log(JSON.stringify({ type: 'system', subtype: 'init', model: 'fake-model' }));
  console.log(JSON.stringify({
    type: 'result', subtype: 'success', is_error: false,
    structured_output: {
      blocks: content.map((b) => b.type),
      apiKey: process.env.ANTHROPIC_API_KEY ?? null,
      args: process.argv.slice(2).filter((a) => a === '--bare' || a === '--safe-mode'),
    },
  }));
});
`;

let dir;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'acorn-host-test-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writeConfig(cliPaths = { claude: null, codex: null }) {
  const file = join(dir, 'config.json');
  await writeFile(file, JSON.stringify({ version: 1, allowedOrigins: [ORIGIN], cliPaths }));
  return file;
}

function startHost(origin, configFile) {
  const child = spawn(process.execPath, [HOST, origin], {
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? tmpdir(),
      ACORN_BRIDGE_CONFIG: configFile,
      ANTHROPIC_API_KEY: 'sk-ant-must-not-leak',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const decoder = new FrameDecoder();
  const messages = [];
  const waiters = [];
  child.stdout.on('data', (chunk) => {
    for (const message of decoder.push(chunk)) {
      messages.push(message);
      for (const waiter of waiters.splice(0)) waiter();
    }
  });
  const exited = new Promise((resolve) => child.once('exit', (code) => resolve(code)));
  return {
    child,
    messages,
    exited,
    send: (message) => child.stdin.write(encodeFrame(message)),
    /** Wait for the final (ok/error) response to `id`. */
    async final(id) {
      for (;;) {
        const found = messages.find(
          (m) => m.id === id && (m.status === 'ok' || m.status === 'error')
        );
        if (found) return found;
        await new Promise((resolve) => waiters.push(resolve));
      }
    },
  };
}

describe('host.mjs', () => {
  it('answers ping and exits cleanly when stdin closes', async () => {
    const host = startHost(ORIGIN, await writeConfig());
    host.send({ id: 'p1', op: 'ping' });
    expect(await host.final('p1')).toEqual({ id: 'p1', status: 'ok', result: { protocol: 1 } });
    host.child.stdin.end();
    expect(await host.exited).toBe(0);
  });

  it('refuses an origin that is not allowlisted, writing nothing to stdout', async () => {
    const host = startHost(`chrome-extension://${'a'.repeat(32)}/`, await writeConfig());
    host.send({ id: 'p1', op: 'ping' });
    expect(await host.exited).toBe(1);
    expect(host.messages).toEqual([]);
  });

  it('runs an analyze job on the configured CLI without leaking API keys', async () => {
    if (process.platform === 'win32') return;
    const fake = join(dir, 'claude');
    await writeFile(fake, FAKE_CLAUDE);
    await chmod(fake, 0o755);
    const host = startHost(ORIGIN, await writeConfig({ claude: fake, codex: null }));

    host.send({
      id: 'a1',
      op: 'analyze',
      target: 'claude',
      model: 'sonnet',
      system: 'S',
      text: 'T',
      images: [{ mimeType: 'image/png', base64: JPEG_B64 }],
      schema: { type: 'object' },
    });
    const response = await host.final('a1');
    expect(host.messages[0]).toEqual({ id: 'a1', status: 'running' });
    expect(response).toEqual({
      id: 'a1',
      status: 'ok',
      result: {
        output: { blocks: ['image', 'text'], apiKey: null, args: ['--safe-mode'] },
        model: 'fake-model',
        usage: null,
      },
    });
    host.child.stdin.end();
    expect(await host.exited).toBe(0);
  });

  it('reports a malformed request instead of crashing', async () => {
    const host = startHost(ORIGIN, await writeConfig());
    host.send({ id: 'bad', op: 'analyze', target: 'claude', text: '' });
    const response = await host.final('bad');
    expect(response.error.code).toBe('bad_request');
    host.child.stdin.end();
    expect(await host.exited).toBe(0);
  });
});
