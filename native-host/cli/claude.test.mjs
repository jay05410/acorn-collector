import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  CLAUDE_MAX_TURNS,
  ClaudeStreamParser,
  buildClaudeArgs,
  buildClaudeInput,
  interpretClaudeResult,
  parseClaudeAuthStatus,
  runClaude,
} from './claude.mjs';

/** Sanitized stream-json from a live Claude Code 2.1.283 run (2026-09-29). */
const FIXTURE = readFileSync(
  new URL('./fixtures/claude-stream-success.jsonl', import.meta.url)
);

const SCHEMA = { type: 'object', properties: { items: { type: 'array' } } };
const jpeg = { mimeType: 'image/jpeg', base64: '/9j/4AAQ' };

/** @param {() => unknown} fn */
function hostError(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected a HostError');
}

describe('buildClaudeArgs', () => {
  const args = buildClaudeArgs({
    model: 'sonnet',
    system: 'Be precise.',
    schema: SCHEMA,
  });

  it('uses the verified print-mode route', () => {
    expect(args.slice(0, 12)).toEqual([
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose',
      '--safe-mode',
      '--no-session-persistence',
      '--permission-mode',
      'dontAsk',
      '--max-turns',
      String(CLAUDE_MAX_TURNS),
    ]);
    expect(args).toContain(`--json-schema=${JSON.stringify(SCHEMA)}`);
    expect(args).toContain('--model=sonnet');
    expect(args).toContain('--system-prompt=Be precise.');
  });

  it('offers the model only the StructuredOutput tool', () => {
    const index = args.indexOf('--tools');
    expect(args[index + 1]).toBe('StructuredOutput');
    // The next argument must be another flag so the variadic list ends.
    expect(args[index + 2]?.startsWith('--')).toBe(true);
  });

  it('never uses --bare or pairs stream-json input with json output', () => {
    expect(args).not.toContain('--bare');
    expect(args.join(' ')).not.toMatch(/--output-format json/);
  });

  it('passes the prompt only via stdin, never as a positional argument', () => {
    for (const arg of args) {
      const isFlag = arg.startsWith('-');
      const isFlagValue = [
        'stream-json',
        'dontAsk',
        String(CLAUDE_MAX_TURNS),
        'StructuredOutput',
      ].includes(arg);
      expect(isFlag || isFlagValue).toBe(true);
    }
  });

  it('binds values that start with a dash to their flag', () => {
    const risky = buildClaudeArgs({
      model: '',
      system: '--dangerously-skip-permissions',
      schema: SCHEMA,
    });
    expect(risky).toContain('--system-prompt=--dangerously-skip-permissions');
    expect(risky).not.toContain('--dangerously-skip-permissions');
    expect(risky.some((arg) => arg.startsWith('--model'))).toBe(false);
  });
});

describe('buildClaudeInput', () => {
  it('writes one JSONL user message with images before text', () => {
    const line = buildClaudeInput({
      text: '価格表',
      images: [jpeg, { ...jpeg, mimeType: 'image/png' }],
    });
    expect(line.endsWith('\n')).toBe(true);
    expect(line.trim().split('\n')).toHaveLength(1);
    expect(JSON.parse(line)).toEqual({
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: '/9j/4AAQ',
            },
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: '/9j/4AAQ',
            },
          },
          { type: 'text', text: '価格表' },
        ],
      },
      parent_tool_use_id: null,
    });
  });

  it('omits the text block when there is no text', () => {
    const { message } = JSON.parse(
      buildClaudeInput({ text: '', images: [jpeg] })
    );
    expect(message.content).toHaveLength(1);
  });
});

describe('ClaudeStreamParser', () => {
  it('extracts the model and final result from a real run, split into odd chunks', () => {
    for (const size of [1, 7, 64, 4096]) {
      const parser = new ClaudeStreamParser();
      for (let i = 0; i < FIXTURE.length; i += size)
        parser.push(FIXTURE.subarray(i, i + size));
      parser.end();
      expect(parser.model).toBe('claude-sonnet-5');
      expect(parser.result).toMatchObject({
        type: 'result',
        subtype: 'success',
        is_error: false,
      });
    }
  });

  it('keeps the last result line and ignores non-JSON noise', () => {
    const parser = new ClaudeStreamParser();
    parser.push(
      Buffer.from('warning: something\n{"type":"result","subtype":"a"}\n')
    );
    parser.push(Buffer.from('{"type":"result","subtype":"b"}'));
    parser.end();
    expect(parser.result).toEqual({ type: 'result', subtype: 'b' });
  });

  it('reports raw lines to the debug tap', () => {
    const onLine = vi.fn();
    const parser = new ClaudeStreamParser(onLine);
    parser.push(Buffer.from('{"type":"system"}\n\n'));
    expect(onLine).toHaveBeenCalledWith('{"type":"system"}');
  });
});

describe('interpretClaudeResult', () => {
  const run = { exitCode: 0, stderrTail: '' };

  it('returns structured_output and usage from the live fixture', () => {
    const parser = new ClaudeStreamParser();
    parser.push(FIXTURE);
    parser.end();
    const { output, usage } = interpretClaudeResult(parser.result, run);
    expect(output.currency).toBe('JPY');
    expect(output.items).toHaveLength(6);
    expect(usage).toEqual({ inputTokens: 7149, outputTokens: 1282 });
  });

  it('treats success without structured_output as a bad response', () => {
    const error = hostError(() =>
      interpretClaudeResult(
        {
          type: 'result',
          subtype: 'success',
          is_error: false,
          result: 'Sure!',
        },
        run
      )
    );
    expect(error.code).toBe('bad_output');
  });

  it('maps error_max_structured_output_retries to a bad response', () => {
    const error = hostError(() =>
      interpretClaudeResult(
        {
          type: 'result',
          subtype: 'error_max_structured_output_retries',
          is_error: true,
        },
        run
      )
    );
    expect(error.code).toBe('bad_output');
    expect(error.message).toMatch(/schema/);
  });

  it('maps error_max_turns to a bad response', () => {
    const error = hostError(() =>
      interpretClaudeResult(
        { type: 'result', subtype: 'error_max_turns', is_error: true },
        run
      )
    );
    expect(error.code).toBe('bad_output');
  });

  it('classifies login and usage-limit failures', () => {
    const auth = hostError(() =>
      interpretClaudeResult(
        {
          type: 'result',
          subtype: 'success',
          is_error: true,
          result: 'Invalid API key · Please run /login',
        },
        run
      )
    );
    expect(auth.code).toBe('not_logged_in');

    const byStatus = hostError(() =>
      interpretClaudeResult(
        {
          type: 'result',
          subtype: 'success',
          is_error: true,
          api_error_status: 429,
          result: 'API Error',
        },
        run
      )
    );
    expect(byStatus.code).toBe('rate_limited');

    const byText = hostError(() =>
      interpretClaudeResult(
        {
          type: 'result',
          subtype: 'success',
          is_error: true,
          result: "You've hit your limit · resets 3pm",
        },
        run
      )
    );
    expect(byText.code).toBe('rate_limited');
  });

  it('reports other API errors as CLI failures', () => {
    const error = hostError(() =>
      interpretClaudeResult(
        {
          type: 'result',
          subtype: 'success',
          is_error: true,
          api_error_status: 529,
          result: 'Overloaded',
        },
        run
      )
    );
    expect(error.code).toBe('cli_failed');
    expect(error.message).toMatch(/Overloaded/);
  });

  it('uses stderr when the CLI exited without a result line', () => {
    expect(
      hostError(() =>
        interpretClaudeResult(null, {
          exitCode: 1,
          stderrTail: 'Not logged in',
        })
      ).code
    ).toBe('not_logged_in');
    const failed = hostError(() =>
      interpretClaudeResult(null, { exitCode: 2, stderrTail: 'segfault' })
    );
    expect(failed.code).toBe('cli_failed');
    expect(failed.message).toMatch(/code 2.*segfault/);
  });
});

describe('parseClaudeAuthStatus', () => {
  it('forwards only non-identifying fields', () => {
    const stdout = JSON.stringify({
      loggedIn: true,
      authMethod: 'claude.ai',
      apiProvider: 'firstParty',
      email: 'someone@example.com',
      orgId: 'org-1',
      orgName: 'Org',
      subscriptionType: 'max',
    });
    expect(parseClaudeAuthStatus(stdout, 0)).toEqual({
      loggedIn: true,
      authMethod: 'claude.ai',
      subscriptionType: 'max',
    });
  });

  it('is logged out on a non-zero exit or an explicit loggedIn false', () => {
    expect(parseClaudeAuthStatus('{"loggedIn":true}', 1).loggedIn).toBe(false);
    expect(parseClaudeAuthStatus('{"loggedIn":false}', 0).loggedIn).toBe(false);
    expect(parseClaudeAuthStatus('not json', 1)).toEqual({
      loggedIn: false,
      authMethod: null,
      subscriptionType: null,
    });
  });
});

describe('runClaude', () => {
  it('runs the CLI in the job dir with stdin input and parses the stream', async () => {
    const run = vi.fn(async (options) => {
      options.onStdout(FIXTURE);
      return { exitCode: 0, stdout: '', stderrTail: '' };
    });
    const signal = new AbortController().signal;
    const result = await runClaude({
      cliPath: '/Users/me/.local/bin/claude',
      request: {
        model: 'sonnet',
        system: 'S',
        text: 'T',
        images: [jpeg],
        schema: SCHEMA,
      },
      jobDir: '/tmp/acorn-bridge-x',
      env: { HOME: '/Users/me', PATH: '/usr/bin' },
      signal,
      run,
    });
    expect(result.model).toBe('claude-sonnet-5');
    expect(result.output.items).toHaveLength(6);
    const options = run.mock.calls[0][0];
    expect(options).toMatchObject({
      command: '/Users/me/.local/bin/claude',
      cwd: '/tmp/acorn-bridge-x',
      env: { HOME: '/Users/me', PATH: '/usr/bin' },
      signal,
    });
    expect(JSON.parse(options.input).message.content.at(-1)).toEqual({
      type: 'text',
      text: 'T',
    });
  });
});
