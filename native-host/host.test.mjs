/**
 * Runs host.mjs as a child process, the way the browser does: caller origin
 * as the first argument, framed JSON over stdio.
 */
import { spawn } from 'node:child_process';
import {
  chmod,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FrameDecoder, encodeFrame } from './protocol.mjs';

const HOST = fileURLToPath(new URL('./host.mjs', import.meta.url));
const ORIGIN = `chrome-extension://${'p'.repeat(32)}/`;
const JPEG_B64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString(
  'base64'
);

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

/**
 * Stands in for a `claude` run that is still working when the browser
 * disconnects: ignores SIGINT, records its pid, never finishes.
 * @param {string} pidFile
 */
const hangingClaude = (pidFile) => `#!/usr/bin/env node
process.on('SIGINT', () => {});
require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
setInterval(() => {}, 1000);
`;

/** @param {number} pid */
function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** @param {() => boolean | Promise<boolean>} check */
async function waitFor(check, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

let dir;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'acorn-host-test-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writeConfig(cliPaths = { claude: null, codex: null }) {
  const file = join(dir, 'config.json');
  await writeFile(
    file,
    JSON.stringify({ version: 1, allowedOrigins: [ORIGIN], cliPaths })
  );
  return file;
}

function startHost(origin, configFile) {
  const child = spawn(process.execPath, [HOST, origin], {
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? tmpdir(),
      // Job dirs land in the test dir, so leftovers can be checked.
      TMPDIR: dir,
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
  const exited = new Promise((resolve) =>
    child.once('exit', (code) => resolve(code))
  );
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
    expect(await host.final('p1')).toEqual({
      id: 'p1',
      status: 'ok',
      result: { protocol: 1 },
    });
    host.child.stdin.end();
    expect(await host.exited).toBe(0);
  });

  it('refuses an origin that is not allowlisted with one permanent error and exits', async () => {
    const host = startHost(
      `chrome-extension://${'a'.repeat(32)}/`,
      await writeConfig()
    );
    host.send({ id: 'p1', op: 'ping' });
    expect(await host.exited).toBe(1);
    expect(host.messages).toEqual([
      {
        id: null,
        status: 'error',
        error: { code: 'origin_not_allowed', message: expect.any(String) },
      },
    ]);
  });

  it('on disconnect stops a running CLI at once and removes its job dir', async () => {
    if (process.platform === 'win32') return;
    const pidFile = join(dir, 'cli.pid');
    const fake = join(dir, 'claude');
    await writeFile(fake, hangingClaude(pidFile));
    await chmod(fake, 0o755);
    const host = startHost(
      ORIGIN,
      await writeConfig({ claude: fake, codex: null })
    );
    host.send({
      id: 'a1',
      op: 'analyze',
      target: 'claude',
      model: 'sonnet',
      system: 'S',
      text: 'T',
      images: [],
      schema: { type: 'object' },
    });
    await waitFor(async () => {
      try {
        return (await readFile(pidFile, 'utf8')) !== '';
      } catch {
        return false;
      }
    });
    const pid = Number(await readFile(pidFile, 'utf8'));
    const jobDirs = async () =>
      (await readdir(dir)).filter((name) => name.startsWith('acorn-bridge-'));
    expect(await jobDirs()).toHaveLength(1);

    const t0 = Date.now();
    host.child.stdin.end();
    expect(await host.exited).toBe(0);
    // The CLI ignores SIGINT; the old 5 s SIGINT grace would show up here.
    expect(Date.now() - t0).toBeLessThan(3000);
    await waitFor(() => !isAlive(pid), 2000);
    expect(await jobDirs()).toEqual([]);
  });

  it('runs an analyze job on the configured CLI without leaking API keys', async () => {
    if (process.platform === 'win32') return;
    const fake = join(dir, 'claude');
    await writeFile(fake, FAKE_CLAUDE);
    await chmod(fake, 0o755);
    const host = startHost(
      ORIGIN,
      await writeConfig({ claude: fake, codex: null })
    );

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
        output: {
          blocks: ['image', 'text'],
          apiKey: null,
          args: ['--safe-mode'],
        },
        model: 'fake-model',
        usage: null,
      },
    });
    host.child.stdin.end();
    expect(await host.exited).toBe(0);
  });

  it('keeps stdout for frames: runtime modules never log or write to it directly', async () => {
    const root = fileURLToPath(new URL('.', import.meta.url));
    const runtime = ['host.mjs', 'protocol.mjs'];
    for (const sub of ['lib', 'cli']) {
      for (const name of await readdir(join(root, sub))) {
        if (name.endsWith('.mjs') && !name.endsWith('.test.mjs'))
          runtime.push(`${sub}/${name}`);
      }
    }
    for (const file of runtime) {
      const source = await readFile(join(root, file), 'utf8');
      expect(source, file).not.toMatch(/console\./);
      const writes = source.match(/process\.stdout\.write/g) ?? [];
      expect(writes.length, file).toBe(file === 'host.mjs' ? 1 : 0);
    }
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
