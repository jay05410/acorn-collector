import { describe, expect, it } from 'vitest';
import { MAX_INCOMING_BYTES, encodeFrame } from '../protocol.mjs';
import { HostError } from './errors.mjs';
import {
  MAX_IMAGES,
  MAX_IMAGE_BASE64_CHARS,
  MAX_PAYLOAD_BYTES,
  MAX_SCHEMA_CHARS,
  MAX_SYSTEM_CHARS,
  MAX_TEXT_CHARS,
  decodeImage,
  parseRequest,
  payloadBytes,
  requestIdOf,
  sniffImage,
} from './validate.mjs';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d,
]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x24, 0, 0, 0]),
  Buffer.from('WEBPVP8 '),
]);
const GIF = Buffer.from('GIF89a......');

const image = (bytes = JPEG, mimeType = 'image/jpeg') => ({
  mimeType,
  base64: bytes.toString('base64'),
});

const analyze = (overrides = {}) => ({
  id: 'r1',
  op: 'analyze',
  target: 'claude',
  model: 'sonnet',
  system: 'Extract items.',
  text: 'アクスタ 1500円',
  images: [image()],
  schema: { type: 'object' },
  ...overrides,
});

/** @param {() => unknown} fn */
function badRequest(fn) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(HostError);
    expect(error.code).toBe('bad_request');
    return error.message;
  }
  throw new Error('expected a bad_request HostError');
}

describe('parseRequest envelope', () => {
  it('accepts ping, status and cancel', () => {
    expect(parseRequest({ id: 'a', op: 'ping' })).toEqual({
      id: 'a',
      op: 'ping',
    });
    expect(parseRequest({ id: 'b', op: 'status' })).toEqual({
      id: 'b',
      op: 'status',
    });
    expect(parseRequest({ id: 'c', op: 'cancel', targetId: 'r1' })).toEqual({
      id: 'c',
      op: 'cancel',
      targetId: 'r1',
    });
  });

  it('rejects non-objects, missing ids and unknown ops', () => {
    badRequest(() => parseRequest(null));
    badRequest(() => parseRequest([]));
    badRequest(() => parseRequest({ op: 'ping' }));
    badRequest(() => parseRequest({ id: '', op: 'ping' }));
    badRequest(() => parseRequest({ id: 'x'.repeat(65), op: 'ping' }));
    expect(badRequest(() => parseRequest({ id: 'a', op: 'exec' }))).toMatch(
      /unknown op/
    );
    badRequest(() => parseRequest({ id: 'a', op: 'cancel' }));
  });

  it('recovers the id of a malformed request when it can', () => {
    expect(requestIdOf({ id: 'r9', op: 'nope' })).toBe('r9');
    expect(requestIdOf({ id: 5 })).toBeNull();
    expect(requestIdOf('garbage')).toBeNull();
  });
});

describe('parseRequest analyze', () => {
  it('normalizes a valid request and sniffs the image type', () => {
    const request = parseRequest(
      analyze({ images: [image(PNG, 'image/jpeg')] })
    );
    expect(request).toMatchObject({
      id: 'r1',
      op: 'analyze',
      target: 'claude',
      model: 'sonnet',
      system: 'Extract items.',
      text: 'アクスタ 1500円',
      schema: { type: 'object' },
    });
    expect(request.images[0]).toEqual({
      mimeType: 'image/png',
      extension: 'png',
      base64: PNG.toString('base64'),
    });
  });

  it('defaults optional strings and allows the CLI default model', () => {
    const request = parseRequest(
      analyze({
        model: undefined,
        system: undefined,
        images: undefined,
        target: 'codex',
      })
    );
    expect(request).toMatchObject({
      model: '',
      system: '',
      images: [],
      target: 'codex',
    });
  });

  it('rejects unknown targets', () => {
    badRequest(() => parseRequest(analyze({ target: 'gemini' })));
  });

  it('rejects models that could be read as flags or contain spaces', () => {
    badRequest(() =>
      parseRequest(analyze({ model: '--dangerously-skip-permissions' }))
    );
    badRequest(() => parseRequest(analyze({ model: 'sonnet; rm -rf ~' })));
    expect(parseRequest(analyze({ model: 'claude-opus-5-5[1m]' })).model).toBe(
      'claude-opus-5-5[1m]'
    );
  });

  it('requires some text or at least one image', () => {
    badRequest(() => parseRequest(analyze({ text: '  ', images: [] })));
    expect(
      parseRequest(analyze({ text: '', images: [image()] })).images
    ).toHaveLength(1);
  });

  it('limits the number of images', () => {
    const images = Array.from({ length: MAX_IMAGES + 1 }, () => image());
    expect(badRequest(() => parseRequest(analyze({ images })))).toMatch(
      /at most 6/
    );
  });

  it('requires an object schema of bounded size', () => {
    badRequest(() => parseRequest(analyze({ schema: undefined })));
    badRequest(() => parseRequest(analyze({ schema: [] })));
    badRequest(() =>
      parseRequest(
        analyze({ schema: { description: 'x'.repeat(MAX_SCHEMA_CHARS) } })
      )
    );
  });

  it('rejects wrongly typed fields', () => {
    badRequest(() => parseRequest(analyze({ text: 42 })));
    badRequest(() => parseRequest(analyze({ images: 'a.jpg' })));
  });
});

/** A JPEG-signed base64 string of exactly `chars` characters. */
const jpegBase64 = (chars) => `/9j/${'A'.repeat(chars - 4)}`;

describe('request payload budget', () => {
  it('measures image base64 plus the UTF-8 JSON of text fields and schema', () => {
    expect(
      payloadBytes({
        system: 'S',
        text: '가',
        images: [{ base64: 'AAAA' }],
        schema: {},
      })
    ).toBe(4 + '"S"'.length + 5 + '{}'.length);
  });

  it('stays well inside the native messaging frame limit', () => {
    expect(MAX_PAYLOAD_BYTES).toBeLessThanOrEqual(MAX_INCOMING_BYTES / 2);
  });

  it('rejects images that fit one by one but not together', () => {
    const full = {
      mimeType: 'image/jpeg',
      base64: jpegBase64(MAX_IMAGE_BASE64_CHARS),
    };
    const images = Array.from({ length: MAX_IMAGES }, () => full);
    expect(badRequest(() => parseRequest(analyze({ images })))).toMatch(
      /payload of \d+ bytes exceeds/
    );
  });

  it('accepts a request at the budget, which then fits in one frame', () => {
    const full = {
      mimeType: 'image/jpeg',
      base64: jpegBase64(MAX_IMAGE_BASE64_CHARS),
    };
    // Worst-case JSON escaping for the text fields.
    const fields = {
      system: '"'.repeat(MAX_SYSTEM_CHARS),
      text: '\u0001'.repeat(MAX_TEXT_CHARS),
      schema: { type: 'object' },
    };
    const fixed = payloadBytes({
      ...fields,
      images: [full, full, full, full, full],
    });
    const rest = MAX_PAYLOAD_BYTES - fixed;
    const last = {
      mimeType: 'image/jpeg',
      base64: jpegBase64(rest - (rest % 4)),
    };
    const request = analyze({
      ...fields,
      images: [full, full, full, full, full, last],
    });

    expect(parseRequest(request).images).toHaveLength(6);
    const frame = encodeFrame(request, { maxBytes: MAX_INCOMING_BYTES });
    expect(frame.length).toBeLessThan(MAX_PAYLOAD_BYTES + 4096);

    const over = {
      mimeType: 'image/jpeg',
      base64: jpegBase64(rest - (rest % 4) + 4),
    };
    badRequest(() =>
      parseRequest(
        analyze({ ...fields, images: [full, full, full, full, full, over] })
      )
    );
  });
});

describe('decodeImage', () => {
  it('rejects invalid base64', () => {
    badRequest(() => decodeImage({ base64: 'not base64!' }, 0));
    badRequest(() => decodeImage({ base64: 'abc' }, 0));
    badRequest(() => decodeImage({ base64: '' }, 0));
    badRequest(() => decodeImage({}, 0));
  });

  it('caps each image at 5 MiB of base64 (3.75 MiB decoded)', () => {
    expect(MAX_IMAGE_BASE64_CHARS).toBe(5 * 1024 * 1024);
    expect(
      decodeImage({ base64: jpegBase64(MAX_IMAGE_BASE64_CHARS) }, 0).mimeType
    ).toBe('image/jpeg');
    const base64 = jpegBase64(MAX_IMAGE_BASE64_CHARS + 4);
    expect(badRequest(() => decodeImage({ base64 }, 2))).toMatch(
      /images\[2\] exceeds/
    );
  });

  it('keeps only the base64 and sniffs the format from the first bytes', () => {
    const webp = decodeImage({ base64: WEBP.toString('base64') }, 0);
    expect(webp).toEqual({
      mimeType: 'image/webp',
      extension: 'webp',
      base64: WEBP.toString('base64'),
    });
  });

  it('rejects formats other than JPEG, PNG and WebP', () => {
    expect(badRequest(() => decodeImage(image(GIF, 'image/jpeg'), 0))).toMatch(
      /not a JPEG, PNG or WebP/
    );
  });
});

describe('sniffImage', () => {
  it('identifies JPEG, PNG and WebP by magic bytes', () => {
    expect(sniffImage(JPEG)?.mimeType).toBe('image/jpeg');
    expect(sniffImage(PNG)?.mimeType).toBe('image/png');
    expect(sniffImage(WEBP)?.mimeType).toBe('image/webp');
    expect(sniffImage(GIF)).toBeNull();
    expect(sniffImage(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});
