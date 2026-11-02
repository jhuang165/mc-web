# Raw Java 1.7.10 NBT foundation (WORLD-03a)

`src/nbt.js` provides a standalone, browser-compatible binary codec for the eleven payload tag types in the pinned Java 1.7.10 client. `src/nbt-compression.js` adds bounded gzip/zlib wrappers (WORLD-03b). This advances the roadmap's registry/NBT foundation. It is not connected to inventories, the live world or browser saves; these modules do not change the app or generation version. Anvil regions, tile-entity/item adapters and complete Java save interoperability remain open.

## API and representation

```js
import {NBT, encodeNbt, decodeNbt} from './nbt.js';

const document = {
  name: '',
  tag: {type: NBT.COMPOUND, value: new Map([
    ['LastUpdate', {type: NBT.LONG, value: 9007199254740993n}],
    ['Sections', {type: NBT.LIST, value: {elementType: NBT.COMPOUND, items: []}}],
  ])},
};
const bytes = encodeNbt(document); // Uint8Array, uncompressed
const decoded = decodeNbt(bytes); // {name, tag, bytesRead}
```

Every tag has `{type, value}`. Numeric types use Number except Long, which requires signed 64-bit BigInt; callers must explicitly convert longs when crossing JSON boundaries. ByteArray uses Int8Array and IntArray uses Int32Array. String uses Java UTF-16 code units. Compound uses Map from string names to tags, preserving names such as `__proto__` safely. List payloads use `{elementType, items}` with payload values, rather than named/tag-wrapped items. End only terminates compounds and identifies empty lists; tag ID 12 (LongArray) is absent in this target and is rejected.

Streams are big-endian named compounds, matching the root type accepted by CompressedStreamTools. Names are retained even though native CompressedStreamTools discards the root name. Arrays are copied on decode. Compound writing follows Map insertion order; this does not reproduce Java HashMap iteration for independently constructed compounds. Repeated names overwrite the previous value. Float/double NaNs are written in Java's canonical quiet-NaN form, signed zero survives, and writing an empty list resets its element type to End as NBTTagList.write does. Byte identity is not promised for duplicate names, noncanonical NaN bits, overlong modified UTF-8 or typed empty lists.

Strings use DataInput/DataOutput modified UTF-8, including two-byte NUL, three-byte surrogate halves and a 65,535-byte encoded limit. Four-byte standard UTF-8 is rejected. The reader accepts Java's literal NUL and overlong two/three-byte encodings; the writer emits canonical modified UTF-8.

## Bounds and deliberate differences

Both APIs accept `maxBytes` (default 16 MiB), `maxElements` (default 1,000,000 aggregate compound entries, list items and array elements) and `maxDepth` (default and maximum 512). These are browser resource limits, not a port of NBTSizeTracker's accounting. Depth is checked for every payload; Java checks container depth. Lengths and remaining array bytes are checked before allocation. Cyclic write input fails at the depth bound. Writer input values are validated instead of silently wrapping out-of-range integers.

The reader rejects trailing bytes by default. `decodeNbt(bytes, {allowTrailing: true})` decodes one document and returns the consumed length. The input-size limit still applies to the full provided view. Negative lengths, nonempty End lists and unknown empty-list types are rejected deliberately; native malformed-input behavior is not reproduced. No compression/decompression is attempted by this codec.

## Evidence and validation

`node tools/verify-nbt.mjs` executes original NBT constructors, payload writers and CompressedStreamTools.read(DataInput, NBTSizeTracker) from client SHA-1 `e80d9b3bf5085002218d4be59e668bac718abbc6`. Set `MC_RESEARCH` to the JAR directory when needed; `MC_PROBE_LIBS` can supply Guava, log4j-api and commons-lang3. The extracted classes remain unchanged. Class SHA-256 hashes and the probe method are recorded in [nbt-reference.json](nbt-reference.json).

The 73 native records cover signed numeric endpoints, longs beyond Number's exact range, float/double subnormals, infinities, NaNs and signed zero; empty/signed arrays; every list payload type; names and strings containing NUL, encoding boundaries, supplementary characters and unpaired surrogates; maximum encoded string lengths; special compound keys; a section/chunk-shaped compound; and nesting depths 1, 16, 128 and 512. The section-shaped fixture is synthetic, not an Anvil file exported by the game. Typed trees come from native accessors and reflection over NBTTagList's private storage. Normalized input/output trees agree; native equals itself returns false for NaN.

`src/nbt.test.js` independently encodes expected typed trees to the exact native bytes, decodes every stream and re-encodes it. Separate port regressions cover view offsets, copied arrays, duplicate names, malformed strings, all truncation points of three representative documents, invalid types/lengths, canonicalization and resource limits. Those rejection tests are not evidence of native malformed-input acceptance. No whole-game, save-file or browser UI acceptance is claimed.

## Compressed NBT (WORLD-03b)

```js
import {encodeCompressedNbt, decodeCompressedNbt} from './nbt-compression.js';

const compressed = await encodeCompressedNbt(document); // gzip by default
const loaded = await decodeCompressedNbt(compressed);
const regionPayload = await encodeCompressedNbt(document, {format: 'zlib'});
```

The wrappers require the browser's CompressionStream/DecompressionStream APIs and use gzip or zlib-wrapped DEFLATE (`format: 'gzip' | 'zlib'`). The zlib option maps to the stream API's `deflate` format; raw DEFLATE is not accepted. There is no format guessing or silent fallback when browser APIs are absent. These wrappers operate on one NBT document, without region headers, sectors or chunk compression IDs.

`maxCompressedBytes` bounds the supplied compressed view and encoded output (default 16 MiB). `maxBytes` bounds encoded raw NBT and collected decompressed output (default 16 MiB); `maxElements`, `maxDepth` and `allowTrailing` pass through to the raw codec. Decompression validates the complete stream before parsing, so a decoded compound is never returned before the stream's checksum/trailer is checked. `bytesRead` measures decompressed NBT bytes, not compressed bytes. The compressed input view is snapshotted before asynchronous reads. Over-limit streams are cancelled before the final output array is allocated. Browser compression engines can allocate internal buffers before producing a chunk; these limits bound application collection, not engine internals or total process memory. No unbounded response.arrayBuffer() is used.

`node tools/verify-nbt-compression.mjs` regenerates [146 native compressed fixtures](nbt-compression-reference.json) from the 73 raw fixtures. It executes unchanged CompressedStreamTools gzip byte-array writing/reading, plus JDK DeflaterOutputStream/InflaterInputStream around original raw NBT methods for zlib. Every native compressed result decodes in JS; every JS gzip/zlib result then reads natively and reserializes to the expected native raw bytes. This executes stream interoperability, not the original RegionFile or Anvil save system. Native writing resets root names to empty; JS writing retains provided names. Compressed byte identity is not required: headers and compressor choices may differ across engines/JDKs, while the uncompressed NBT remains identical.

`src/nbt-compression.test.js` replays all native inputs and checks all 146 JS outputs with independent Node zlib, preserving named roots. Eight test groups also cover offsets/snapshot ownership, truncated or corrupt headers/checksums/trailers, wrong formats, independent input/output/expansion bounds, raw parser validation and unavailable browser APIs. A separate headless Chrome smoke read all 146 native streams, completed 146 encode/decode round trips and checked bounds/corruption for both formats; its 146 compressed outputs were also read by the original NBT classes. No gameplay save/import/export UI has been added.

Next steps: typed item/NBT integration with migration, tile-entity payloads, chunk serialization, then region/file round trips and integrated acceptance. These tranches avoid runtime void and biome decorator work, and leave shared roadmap/PROJECT edits to their current owners.
