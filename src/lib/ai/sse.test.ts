import { describe, expect, it } from 'vitest';
import { readSSE, SSEParser, type SSEMessage } from './sse';

function parseAll(chunks: string[]): SSEMessage[] {
  const parser = new SSEParser();
  return [...chunks.flatMap((c) => parser.push(c)), ...parser.end()];
}

describe('SSEParser', () => {
  it('parses named events and defaults to "message"', () => {
    expect(parseAll(['event: ping\ndata: {}\n\ndata: x\n\n'])).toEqual([
      { event: 'ping', data: '{}' },
      { event: 'message', data: 'x' },
    ]);
  });

  it('reassembles lines split at every byte, including CRLF pairs', () => {
    const stream = 'event: a\r\ndata: hello\r\n\r\nevent: b\rdata: world\r\r';
    expect(parseAll(stream.split(''))).toEqual([
      { event: 'a', data: 'hello' },
      { event: 'b', data: 'world' },
    ]);
  });

  it('joins multi-line data and strips exactly one leading space', () => {
    expect(parseAll(['data:  a\ndata:b\ndata\n\n'])).toEqual([{ event: 'message', data: ' a\nb\n' }]);
  });

  it('ignores comments, unknown fields and events without data', () => {
    const stream = ': OPENROUTER PROCESSING\n\nid: 7\nretry: 10\nevent: lonely\n\ndata: [DONE]\n\n';
    expect(parseAll([stream])).toEqual([{ event: 'message', data: '[DONE]' }]);
  });

  it('discards a final event that lacks its blank line (truncated stream)', () => {
    expect(parseAll(['data: tail'])).toEqual([]);
    expect(parseAll(['data: a\n\ndata: tail\n'])).toEqual([{ event: 'message', data: 'a' }]);
  });

  it('treats a CR at the very end of the stream as a line ending', () => {
    expect(parseAll(['data: x\r', '\r'])).toEqual([{ event: 'message', data: 'x' }]);
  });
});

function streamOf(parts: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

describe('readSSE', () => {
  it('decodes multi-byte UTF-8 split across chunks', async () => {
    const bytes = new TextEncoder().encode('data: 缶バッジ\n\n');
    const messages: SSEMessage[] = [];
    for await (const m of readSSE(streamOf([bytes.slice(0, 8), bytes.slice(8)]))) messages.push(m);
    expect(messages).toEqual([{ event: 'message', data: '缶バッジ' }]);
  });

  it('does not yield an event cut off before its blank line', async () => {
    const messages: SSEMessage[] = [];
    const body = streamOf([new TextEncoder().encode('data: 1\n\ndata: {"trunc')]);
    for await (const m of readSSE(body)) messages.push(m);
    expect(messages).toEqual([{ event: 'message', data: '1' }]);
  });

  it('cancels the body when the consumer stops early', async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode('data: 1\n\n'));
      },
      cancel() {
        cancelled = true;
      },
    });
    for await (const message of readSSE(body)) {
      expect(message.data).toBe('1');
      break;
    }
    expect(cancelled).toBe(true);
  });

  it('propagates read errors', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new TypeError('network down'));
      },
    });
    const drain = async () => {
      for await (const _ of readSSE(body)) void _;
    };
    await expect(drain()).rejects.toThrow('network down');
  });
});
