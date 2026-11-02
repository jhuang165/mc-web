# Region containers (WORLD-03d)

`src/region-file.js` reads and compactly rebuilds Java 1.7.10 `.mca` containers. It composes with [chunk NBT](chunk-nbt.md); it does not connect Java saves to the running game or implement a filesystem, RegionFileCache, crash-safe saving or Java's in-place free-sector allocator.

```js
import {readRegion, writeRegion, regionSlot, encodeRegionChunk, decodeRegionChunk} from './region-file.js';

const entries = readRegion(fileBytes); // Map keyed by local x + z*32
const document = await decodeRegionChunk(entries.get(regionSlot(0, 0)));
entries.set(regionSlot(0, 0), await encodeRegionChunk(document, {x: 0, z: 0, timestamp: 123}));
const nextFileBytes = writeRegion(entries.values());
```

Entries contain `{x, z, timestamp, format, compressed}`. Local coordinates are 0–31. `regionAddress(chunkX, chunkZ)` uses Java signed shifts/masks for region coordinates and local slots, including negative chunks. Global chunk coordinates within NBT are not relocated or checked against the container slot. The eventual importer must validate region filenames, slots and payload coordinates together.

The two 4,096-byte headers contain big-endian 24-bit sector offsets/8-bit counts and unsigned timestamps. Records contain a big-endian length (including the compression ID), ID 1=gzip or 2=zlib, and compressed bytes. Modern external-chunk markers and other compression IDs are rejected. Reading copies compressed views and validates header size, alignment, occupied extents, record lengths and overlaps before returning entries. This is deliberately stricter than native malformed-file handling; there is no partial recovery mode.

Writing sorts by slot and rebuilds a dense image, zero-padding sectors and omitting unused space. It does not reproduce Java's fragmentation, reuse history or leftover bytes. Timestamps are explicit unsigned seconds and default to zero; the module never reads the system clock. Unused-slot timestamps are discarded. The native allocation formula `floor((compressedLength + 5)/4096) + 1` reserves an extra sector at an exact boundary. Counts of 256 or more are rejected (native silently declines the write). Duplicate slots are rejected. Empty files still have both headers.

Container APIs default to `maxBytes: 64 MiB`, checking limits before allocation. NBT helper calls have independent [compressed/decompressed caps](nbt.md) and validate complete compressed streams before parsing. `encodeRegionChunk` defaults to zlib. `readRegion` itself does not decompress or validate checksums; use the helper to load NBT safely. Allocation does not validate raw compressed bytes, so callers using low-level entries must supply valid compression streams.

## Native evidence

`node tools/verify-region-file.mjs` executes unchanged RegionFile (`aqh`) from the pinned 1.7.10 client against real temporary disk files. It requires the usual JDK/MC_RESEARCH/MC_PROBE_LIBS setup, including netty-all for the original clock helper's class dependencies. [region-file-reference.json](region-file-reference.json) records provenance, four file fixtures and five allocation probes. Native files cover empty, sparse, overwritten/fragmented and all 1,024 slots, with seeded arbitrary byte payloads. Timestamp tables are zeroed after close for reproducibility. A synthetic gzip entry is patched into one native fixture to test the original gzip reader; native writes use zlib. Original reads validate 1,037 payload lengths/hashes across the four files. JS compact rewrites reopen through original RegionFile with identical decompressed payloads. Exact-boundary and maximum 255-sector writes also execute natively.

Seven regression groups cover the fixtures, allocation probes, negative addresses, timestamps/view ownership, NBT/chunk composition for both compression IDs, malformed files and limits. The NBT composition is port evidence; the native container fixtures use arbitrary bytes rather than exported gameplay saves. Whole-game interchange remains open. Native reference regeneration is byte-identical on the same JDK; compressor bytes can vary between JDKs without changing format interoperability.

Headless Chrome also reads and hashes all 1,037 native payloads and rewrites all four containers. Those browser-written files pass the original RegionFile reader checks. No live save UI or Site publication is involved.

Next: actual save-file ingestion, coordinate validation and supported-content reporting; entity/tile factories, pending ticks, lighting and live chunk ownership; filesystem durability/recovery and integrated Java/browser round trips.
