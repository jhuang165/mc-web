import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync, deflateSync, deflateRawSync, gunzipSync, inflateSync} from 'node:zlib';
import {NBT, encodeNbt, decodeNbt} from './nbt.js';
import {encodeCompressedNbt, decodeCompressedNbt} from './nbt-compression.js';

const rawBytes = readFileSync(new URL('../public/research/nbt-reference.json', import.meta.url));
const rawReference = JSON.parse(rawBytes);
const reference = JSON.parse(readFileSync(new URL('../public/research/nbt-compression-reference.json', import.meta.url)));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const document = {name: 'root\0\ud83d\ude00', tag: {type: NBT.COMPOUND, value: new Map([
  ['counter', {type: NBT.LONG, value: 9007199254740993n}],
  ['bytes', {type: NBT.BYTE_ARRAY, value: new Int8Array([-128, 0, 127])}],
])}};

test('146 original gzip/zlib documents decode to native normalized NBT', async () => {
  assert.equal(reference.clientSha1, rawReference.clientSha1);
  assert.equal(reference.rawReferenceSha256, digest(rawBytes));
  assert.equal(reference.cases.length, 146);
  assert.equal(reference.jsToNativeDocuments, 146);
  for (const c of reference.cases) {
    const decoded = await decodeCompressedNbt(Buffer.from(c.hex, 'hex'), {format: c.format});
    assert.equal(decoded.name, '', c.id + ': native drops root name');
    assert.equal(digest(encodeNbt(decoded)), c.rawSha256, c.id + '/' + c.format);
    const expected = decodeNbt(Buffer.from(rawReference.cases[c.index].hex, 'hex'));
    expected.name = '';
    assert.deepEqual(encodeNbt(decoded), encodeNbt(expected), c.id + '/' + c.format);
  }
});

test('browser compression preserves every raw fixture, checked by independent zlib', async () => {
  for (const c of rawReference.cases) {
    const raw = Uint8Array.from(Buffer.from(c.hex, 'hex')), input = decodeNbt(raw);
    for (const format of ['gzip', 'zlib']) {
      const compressed = await encodeCompressedNbt(input, {format});
      const uncompressed = format === 'gzip' ? gunzipSync(compressed) : inflateSync(compressed);
      assert.deepEqual(new Uint8Array(uncompressed), raw, c.id + '/' + format);
      assert.deepEqual(encodeNbt(await decodeCompressedNbt(compressed, {format})), raw, c.id + '/' + format);
    }
  }
});

test('gzip is default; compressed views are snapshotted before asynchronous reads', async () => {
  const compressed = await encodeCompressedNbt(document);
  assert.deepEqual([...compressed.subarray(0, 2)], [0x1f, 0x8b]);
  const padded = new Uint8Array(compressed.length + 8); padded.set(compressed, 3);
  const loading = decodeCompressedNbt(padded.subarray(3, 3 + compressed.length));
  padded.fill(0);
  const result = await loading;
  assert.equal(result.name, document.name);
  assert.deepEqual(encodeNbt(result), encodeNbt(document));
  assert.equal(result.bytesRead, encodeNbt(document).length);
});

test('compressed NBT rejects corrupt, truncated, wrong-format and raw-DEFLATE data', async () => {
  const raw = encodeNbt(document);
  for (const format of ['gzip', 'zlib']) {
    const compressed = await encodeCompressedNbt(document, {format});
    for (const n of [0, 1, 2, 4, compressed.length - 8, compressed.length - 1]) {
      await assert.rejects(decodeCompressedNbt(compressed.subarray(0, n), {format}), undefined, format + '/' + n);
    }
    for (const index of [0, compressed.length - 1, compressed.length - 5]) {
      const corrupt = compressed.slice(); corrupt[index] ^= 255;
      await assert.rejects(decodeCompressedNbt(corrupt, {format}), undefined, format + '/' + index);
    }
    await assert.rejects(decodeCompressedNbt(compressed, {format: format === 'gzip' ? 'zlib' : 'gzip'}));
    await assert.rejects(decodeCompressedNbt(deflateRawSync(raw), {format}));
    await assert.rejects(decodeCompressedNbt(raw, {format}));
  }
});

test('compressed NBT bounds input, output and decompressed expansion independently', async () => {
  const raw = encodeNbt(document);
  for (const format of ['gzip', 'zlib']) {
    const compressed = await encodeCompressedNbt(document, {format});
    await assert.rejects(decodeCompressedNbt(compressed, {format, maxCompressedBytes: compressed.length - 1}), /compressed byte limit/);
    await assert.rejects(encodeCompressedNbt(document, {format, maxCompressedBytes: compressed.length - 1}), /compressed byte limit/);
    await assert.rejects(decodeCompressedNbt(compressed, {format, maxBytes: raw.length - 1}), /decompressed byte limit/);
    await assert.rejects(encodeCompressedNbt(document, {format, maxBytes: raw.length - 1}), /byte limit/);
    assert.deepEqual(encodeNbt(await decodeCompressedNbt(compressed, {
      format, maxBytes: raw.length, maxCompressedBytes: compressed.length,
    })), raw);
    const bomb = (format === 'gzip' ? gzipSync : deflateSync)(new Uint8Array(2 * 1024 * 1024));
    await assert.rejects(decodeCompressedNbt(bomb, {format, maxBytes: 1024}), /decompressed byte limit/);
  }
});

test('raw parser validation remains in force after decompressing the complete stream', async () => {
  const raw = encodeNbt(document);
  for (const format of ['gzip', 'zlib']) {
    const compress = format === 'gzip' ? gzipSync : deflateSync;
    const extra = compress(new Uint8Array([...raw, 99]));
    await assert.rejects(decodeCompressedNbt(extra, {format}), /Trailing/);
    assert.deepEqual(encodeNbt(await decodeCompressedNbt(extra, {format, allowTrailing: true})), raw);
    await assert.rejects(decodeCompressedNbt(compress(Uint8Array.of(12)), {format}), /root/);
    await assert.rejects(decodeCompressedNbt(compress(raw), {format, maxElements: 1}), /integer|element limit/);
    const deep = Buffer.from(rawReference.cases.find(c => c.id === 'depth/16').hex, 'hex');
    await assert.rejects(decodeCompressedNbt(compress(deep), {format, maxDepth: 15}), /depth/);
  }
});

test('compressed NBT validates explicit formats, byte limits and input types', async () => {
  for (const options of [
    {format: 'deflate'}, {format: 'auto'}, {format: 'brotli'},
    {maxCompressedBytes: 0}, {maxCompressedBytes: 1.5}, {maxCompressedBytes: Infinity},
    {maxBytes: -1}, {maxBytes: 0x80000000},
  ]) {
    await assert.rejects(encodeCompressedNbt(document, options));
    await assert.rejects(decodeCompressedNbt(new Uint8Array(), options));
  }
  await assert.rejects(decodeCompressedNbt(new ArrayBuffer(4)), /Uint8Array/);
});

test('compressed NBT reports unavailable browser compression APIs clearly', async () => {
  for (const name of ['CompressionStream', 'DecompressionStream']) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    try {
      Object.defineProperty(globalThis, name, {configurable: true, value: undefined});
      const operation = name === 'CompressionStream' ? encodeCompressedNbt(document) : decodeCompressedNbt(new Uint8Array());
      await assert.rejects(operation, new RegExp(name + ' is unavailable'));
    } finally { Object.defineProperty(globalThis, name, descriptor); }
  }
});
