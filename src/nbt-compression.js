import {encodeNbt, decodeNbt} from './nbt.js';

const DEFAULT_BYTES = 16 * 1024 * 1024;
function byteLimit(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 0x7fffffff) throw new RangeError('Invalid NBT byte limit');
  return value;
}
function settings(options) {
  const format = options.format ?? 'gzip';
  if (format !== 'gzip' && format !== 'zlib') throw new TypeError('NBT compression format must be gzip or zlib');
  return {
    streamFormat: format === 'zlib' ? 'deflate' : 'gzip',
    maxBytes: byteLimit(options.maxBytes ?? DEFAULT_BYTES),
    maxCompressedBytes: byteLimit(options.maxCompressedBytes ?? DEFAULT_BYTES),
  };
}

async function collect(stream, maxBytes, label) {
  const reader = stream.getReader(), chunks = [];
  let length = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      if (value.byteLength > maxBytes - length) throw new RangeError(`NBT ${label} byte limit exceeded`);
      length += value.byteLength;
      chunks.push(value);
    }
    const result = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
    return result;
  } catch (error) {
    await reader.cancel(error).catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

/** Raw NBT limits also apply; format is gzip (default) or zlib, not raw DEFLATE. */
export async function encodeCompressedNbt(document, options = {}) {
  const {streamFormat, maxCompressedBytes} = settings(options);
  if (typeof globalThis.CompressionStream !== 'function') throw new Error('CompressionStream is unavailable');
  const raw = encodeNbt(document, options);
  const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream(streamFormat));
  return collect(stream, maxCompressedBytes, 'compressed');
}

/** Validate the complete compressed stream before parsing its bounded NBT output. */
export async function decodeCompressedNbt(bytes, options = {}) {
  const {streamFormat, maxBytes, maxCompressedBytes} = settings(options);
  if (!(bytes instanceof Uint8Array)) throw new TypeError('NBT input must be Uint8Array');
  if (bytes.byteLength > maxCompressedBytes) throw new RangeError('NBT compressed byte limit exceeded');
  if (typeof globalThis.DecompressionStream !== 'function') throw new Error('DecompressionStream is unavailable');
  // Blob snapshots the supplied view before the first await, including its offset.
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(streamFormat));
  const raw = await collect(stream, maxBytes, 'decompressed');
  return decodeNbt(raw, options);
}
