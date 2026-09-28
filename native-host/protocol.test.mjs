import { describe, expect, it } from 'vitest';
import {
  FrameDecoder,
  FrameError,
  HEADER_BYTES,
  MAX_OUTGOING_BYTES,
  encodeFrame,
} from './protocol.mjs';

describe('encodeFrame', () => {
  it('prefixes the UTF-8 body with its byte length', () => {
    const frame = encodeFrame({ text: '新刊' }, { littleEndian: true });
    const body = Buffer.from(JSON.stringify({ text: '新刊' }), 'utf8');
    expect(frame.readUInt32LE(0)).toBe(body.length);
    expect(frame.subarray(HEADER_BYTES)).toEqual(body);
  });

  it('honours big-endian headers', () => {
    const frame = encodeFrame({ a: 1 }, { littleEndian: false });
    expect(frame.readUInt32BE(0)).toBe(7);
  });

  it('rejects messages over the 1 MB host -> extension limit', () => {
    const big = { data: 'x'.repeat(MAX_OUTGOING_BYTES) };
    expect(() => encodeFrame(big)).toThrow(FrameError);
  });

  it('rejects values JSON cannot represent', () => {
    expect(() => encodeFrame(undefined)).toThrow(FrameError);
  });
});

describe('FrameDecoder', () => {
  const messages = [
    { id: '1', op: 'ping' },
    { id: '2', op: 'analyze', text: 'アクリルスタンド ¥1500' },
    { id: '3', op: 'status', nested: { list: [1, 2, 3] } },
  ];
  const stream = Buffer.concat(messages.map((m) => encodeFrame(m)));

  it('round-trips several frames delivered in one chunk', () => {
    expect(new FrameDecoder().push(stream)).toEqual(messages);
  });

  it('reassembles frames split at every possible byte boundary', () => {
    for (let cut = 1; cut < stream.length; cut += 1) {
      const decoder = new FrameDecoder();
      const out = [
        ...decoder.push(stream.subarray(0, cut)),
        ...decoder.push(stream.subarray(cut)),
      ];
      expect(out).toEqual(messages);
      expect(decoder.hasPartialFrame).toBe(false);
    }
  });

  it('handles one-byte chunks, including split headers', () => {
    const decoder = new FrameDecoder();
    const out = [];
    for (const byte of stream) out.push(...decoder.push(Buffer.from([byte])));
    expect(out).toEqual(messages);
  });

  it('reports a partial frame until it completes', () => {
    const frame = encodeFrame({ id: 'x' });
    const decoder = new FrameDecoder();
    expect(decoder.push(frame.subarray(0, 2))).toEqual([]);
    expect(decoder.hasPartialFrame).toBe(true);
    expect(decoder.push(frame.subarray(2, 6))).toEqual([]);
    expect(decoder.hasPartialFrame).toBe(true);
    expect(decoder.push(frame.subarray(6))).toEqual([{ id: 'x' }]);
    expect(decoder.hasPartialFrame).toBe(false);
  });

  it('rejects a header announcing more than the limit', () => {
    const header = Buffer.alloc(HEADER_BYTES);
    header.writeUInt32LE(1025, 0);
    const decoder = new FrameDecoder({ maxBytes: 1024, littleEndian: true });
    expect(() => decoder.push(header)).toThrow(/exceeds/);
  });

  it('rejects a body that is not JSON', () => {
    const body = Buffer.from('{nope', 'utf8');
    const header = Buffer.alloc(HEADER_BYTES);
    header.writeUInt32LE(body.length, 0);
    const decoder = new FrameDecoder({ littleEndian: true });
    expect(() => decoder.push(Buffer.concat([header, body]))).toThrow(
      FrameError
    );
  });

  it('decodes a large frame fed in small chunks', () => {
    const payload = { id: 'big', base64: 'A'.repeat(3 * 1024 * 1024) };
    const frame = encodeFrame(payload, { maxBytes: 4 * 1024 * 1024 });
    const decoder = new FrameDecoder();
    const out = [];
    for (let i = 0; i < frame.length; i += 65536) {
      out.push(...decoder.push(frame.subarray(i, i + 65536)));
    }
    expect(out).toEqual([payload]);
  });
});
