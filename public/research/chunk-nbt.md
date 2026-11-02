# Chunk NBT storage adapter (WORLD-03c)

`src/chunk-nbt.js` connects standalone `Chunk` storage to Java 1.7.10's named `Level` compound format and composes with the [NBT codecs](nbt.md). The live world, browser saves, app version and generation version are unchanged. Region files and complete Java save interchange remain open.

## API

```js
import {chunkFromNbt, chunkToNbt} from './chunk-nbt.js';
import {decodeCompressedNbt, encodeCompressedNbt} from './nbt-compression.js';

const document = await decodeCompressedNbt(bytes, {format: 'zlib'});
const loaded = chunkFromNbt(document, {hasSky: true});
const next = chunkToNbt(loaded.chunk, {...loaded, lastUpdate: 1234n});
const output = await encodeCompressedNbt(next, {format: 'zlib'});
```

`chunkFromNbt` returns `{chunk, name, lastUpdate, entities, tileEntities, tileTicks, extensions}`. The chunk is standalone storage, not the game's live WorldChunk. Entity, tile and tick arrays contain opaque compound Maps in the NBT representation. `tileTicks: null` means absent; `[]` means explicitly empty. No factories, constructors, scheduling or world callbacks run. Tick `t` is the stored signed relative delay; an eventual loader must schedule it against the current world clock, not LastUpdate. Copying ticks does not implement native deadline subtraction or a unified scheduler.

Sections preserve original byte IDs, optional Add nibbles, metadata, block/sky light and native Y/Z/X order. Existing empty sections remain present. Unregistered IDs remain in raw arrays while registry lookups/counts treat them as air. Reading recounts block/random-tick references and keeps transient lifecycle fields at constructor defaults. Duplicate section Y uses the last entry. No-sky reads ignore SkyLight; writes include a zero-filled 2,048-byte SkyLight array, as natively.

Height/biome arrays, coordinates, terrain/light flags and long values are retained. Missing Biomes keeps the 256-byte -1 default; optional flags/longs default to false/zero. `lastUpdate` is BigInt sidecar data: native loading does not assign it to lastSaveTime. InhabitedTime uses Number when safely representable and BigInt otherwise. Existing provider arithmetic assumes Number, so eventual integration must handle exceptional large values before ticking those chunks. Writing accepts safe integer Numbers or signed 64-bit BigInts and rejects lossy numbers.

Unknown root/Level/section fields are copied into `extensions` for writing back; known fields take precedence. This retention is port policy, not native unknown-field behavior. Arrays and opaque payloads are copied. Writing is pure and does not reset hasEntities or run native entity serialization; the caller owns those lifecycle updates. V writes byte 1; sections sort by slot. Compound field order follows Maps, so semantic equality rather than Java HashMap wire order is the comparison criterion.

## Evidence and validation

`node tools/verify-chunk-nbt.mjs` uses the SHA-1-pinned client and records class hashes in [chunk-nbt-reference.json](chunk-nbt-reference.json). Reflection invokes unchanged private AnvilChunkLoader payload writer/reader methods. Real Chunk, ExtendedBlockStorage, NibbleArray and NBT gzip classes run. A constructor-free World supplies clock, sky capability, pending tick records and a recording schedule hook. RegionFile, asynchronous saves and World construction do not run.

Fourteen fixtures include missing/empty/all sixteen sections, y=255, negative/border chunk coordinates, invalid raw IDs/Add arrays, sky/no-sky, long endpoints and values beyond Number precision, absent/empty/nonempty ticks, missing biome/optional fields and duplicate section Y. Native signed/overflowing relative-delay writes and scheduling calls are captured. Entity/tile lists are empty in native cases. JS independently recreates each fixture and matches all native written fields, loaded storage counts/flags and complete rewritten typed documents. All 14 JS-loaded/serialized payloads then pass the original loader/writer with identical native storage, scheduling-hook calls and raw reserialization.

Seven regression groups cover that evidence, gzip/zlib composition, opaque payload/unknown-tag retention and ownership, empty sections/raw IDs, no-sky behavior and malformed shape rejection. Nonempty entity/tile retention is port-only evidence. Wrong types, invalid section indices and incorrect array lengths are rejected deliberately, without reproducing unsafe native malformed-input behavior. Decode untrusted bytes through the bounded NBT codec first.

A separate headless Chrome smoke loads all 14 native cases and completes 28 gzip/zlib round trips. Its 14 raw outputs also pass the original loader/writer check. This is module interoperability, not gameplay save UI acceptance.

Next: region headers/sectors/compression IDs and file round trips; then live chunk ownership, entity/tile instantiation, tick scheduling, lighting and scalable persistence with migrations. Full Java save compatibility remains open.
