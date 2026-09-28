/**
 * Image preprocessing before upload: fetch, decode, downscale to the model's
 * limits, re-encode as JPEG only when needed, then base64 + SHA-256.
 * Decoding/encoding sit behind `ImageCodec` so Node tests can run without
 * createImageBitmap/OffscreenCanvas.
 */
import { bytesToBase64, sha256Hex, type Bytes } from './encoding';
import { abortedError, toAIError } from './errors';
import type { ImageLimits } from './models';
import { AIError, type ImageInput } from './types';

type ImageMime = ImageInput['mimeType'];

export interface DecodedImage {
  readonly width: number;
  readonly height: number;
  close(): void;
}

export interface ImageCodec<T extends DecodedImage = DecodedImage> {
  decode(blob: Blob): Promise<T>;
  encodeJpeg(image: T, width: number, height: number, quality: number): Promise<Blob>;
}

export const browserImageCodec: ImageCodec<ImageBitmap> = {
  decode: (blob) => createImageBitmap(blob),
  async encodeJpeg(bitmap, width, height, quality) {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    // JPEG has no alpha: paint transparent regions white instead of black.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.convertToBlob({ type: 'image/jpeg', quality });
  },
};

export const JPEG_QUALITY = 0.9;
/**
 * Originals up to this size are sent untouched. 3.75 MiB keeps the base64
 * payload under 5 MiB, the per-image limit of the Anthropic API.
 */
export const MAX_PASSTHROUGH_BYTES = 3.75 * 1024 * 1024;
const CONCURRENCY = 4;

export interface PrepareImageOptions<T extends DecodedImage = DecodedImage> extends ImageLimits {
  signal?: AbortSignal;
  codec?: ImageCodec<T>;
}

/** Identifies JPEG/PNG/WebP by magic bytes; Blob.type is often missing. */
export function sniffImageType(bytes: Uint8Array): ImageMime | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** Largest size within the limits that keeps the aspect ratio (never upscales). */
export function fitWithin(
  width: number,
  height: number,
  { maxEdge, maxPixels }: ImageLimits
): { width: number; height: number } {
  const scale = Math.min(
    1,
    maxEdge / Math.max(width, height),
    maxPixels ? Math.sqrt(maxPixels / (width * height)) : 1
  );
  if (scale === 1) return { width, height };
  return {
    width: Math.max(1, Math.floor(width * scale + 1e-9)),
    height: Math.max(1, Math.floor(height * scale + 1e-9)),
  };
}

async function fetchImage(url: string, signal: AbortSignal | undefined): Promise<Blob> {
  try {
    const response = await fetch(url, { signal, credentials: 'omit' });
    if (!response.ok) {
      throw new AIError(
        'network',
        `Image download failed (HTTP ${response.status})`,
        undefined,
        response.status
      );
    }
    return await response.blob();
  } catch (error) {
    throw toAIError(error, undefined, signal);
  }
}

async function decode<T extends DecodedImage>(codec: ImageCodec<T>, blob: Blob): Promise<T> {
  try {
    return await codec.decode(blob);
  } catch {
    throw new AIError('unknown', 'The image could not be decoded (unsupported or corrupt file)');
  }
}

export async function prepareImage<T extends DecodedImage = ImageBitmap>(
  source: string | Blob,
  options: PrepareImageOptions<T>
): Promise<ImageInput> {
  const { signal } = options;
  const codec = (options.codec ?? browserImageCodec) as ImageCodec<T>;
  const blob = typeof source === 'string' ? await fetchImage(source, signal) : source;
  const original: Bytes = new Uint8Array(await blob.arrayBuffer());
  if (signal?.aborted) throw abortedError(signal);

  const image = await decode(codec, blob);
  let bytes: Bytes;
  let mimeType: ImageMime;
  let size: { width: number; height: number };
  try {
    size = fitWithin(image.width, image.height, options);
    const sniffed = sniffImageType(original);
    const unchanged = size.width === image.width && size.height === image.height;
    if (unchanged && sniffed !== null && original.byteLength <= MAX_PASSTHROUGH_BYTES) {
      bytes = original;
      mimeType = sniffed;
    } else {
      const encoded = await codec.encodeJpeg(image, size.width, size.height, JPEG_QUALITY);
      bytes = new Uint8Array(await encoded.arrayBuffer());
      mimeType = 'image/jpeg';
    }
  } finally {
    image.close();
  }
  if (signal?.aborted) throw abortedError(signal);

  return {
    mimeType,
    base64: bytesToBase64(bytes),
    width: size.width,
    height: size.height,
    hash: await sha256Hex(bytes),
    ...(typeof source === 'string' && !source.startsWith('data:') ? { sourceUrl: source } : {}),
  };
}

/** Prepares images with bounded concurrency, preserving input order. */
export async function prepareImages<T extends DecodedImage = ImageBitmap>(
  sources: ReadonlyArray<string | Blob>,
  options: PrepareImageOptions<T>
): Promise<ImageInput[]> {
  const results: ImageInput[] = new Array<ImageInput>(sources.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < sources.length) {
      const index = next++;
      const source = sources[index];
      if (source === undefined) continue;
      try {
        results[index] = await prepareImage(source, options);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, sources.length) }, worker));
  return results;
}
