# Structure start and piece NBT (GEN-05h)

`src/structure-nbt.js` ports Java 1.7.10 structure persistence as a standalone module: `MapGenStructureIO` (start and piece id registry), `StructureStart.func_143021_a/func_143020_a`, `StructureComponent.func_143010_b/func_143011_b` and every piece's own `func_143012_a/func_143011_a` fields, and `MapGenStructureData` (`data/<Name>.dat`). It is not wired into the live world, saves or the browser game, and does not change the app or generation version. Full 1.7.10 parity is not claimed.

## API

```js
import {encodeStructureData, encodeStructureDataDat, decodeStructureData, decodeStructureDataDat,
        loadStructureStarts, structureMapOf, startToNbt, startFromNbt, pieceToNbt, pieceFromNbt} from './structure-nbt.js';

const raw = encodeStructureData(generator);             // raw {"": {data: {Features}}} bytes; also accepts an array of starts
const dat = await encodeStructureDataDat(generator);    // gzip, as MapStorage writes data/<Name>.dat
const decoded = decodeStructureData(raw);               // {starts, skipped}, in Features key order
loadStructureStarts(generator, decoded);                // generator.structureMap.set per start, in that order
```

- Ids: `STRUCTURE_PIECE_IDS` (33 registered, ported pieces: MSRoom/MSCorridor/MSCrossing/MSStairs; ViStart, ViW, ViSR, ViL, ViBH, ViST, ViSH, ViSmH, ViPH, ViDF, ViF, ViS, ViTRH; SHStart, SHSD, SHS, SHPH, SHLT, SHRT, SHRC, SHSSD, SH5C, SHCC, SHLi, SHPR, SHFC; TeDP, TeJP, TeSH) and the four start ids `Mineshaft`, `Village`, `Stronghold`, `Temple`. `STRUCTURE_DATA_NAMES` maps the generators to the data names `Mineshaft`, `Village`, `Stronghold`, `Temple`. Native registers 5 starts and 48 pieces; the Fortress start and 15 `Ne*` pieces are listed in `UNSUPPORTED_*` because the Nether fortress generator is not ported.
- Tags are the raw `{type, value}` trees of `nbt.js`. Piece compounds hold `id, BB, O, GD` plus the piece's own fields; starts hold `id, ChunkX, ChunkZ, BB, Children` (villages also `Valid`).
- Compound key order: native `NBTTagCompound` is a `HashMap`, so tags are written in hash order. `javaHashMapOrder(keys)` and `compoundTag(entries)` reproduce Java 8+ iteration (table index `(h ^ h>>>16) & (cap-1)`, insertion order within a bucket, resize at 0.75 load or on a ninth chained node below capacity 64; treeified bins throw). The native probe ran on JDK 19. Java 6/7 used a different spread and are not modelled.
- Reload mirrors the original: `startFromNbt` returns `null` for unregistered ids and compounds without `ChunkX`/`ChunkZ` are skipped, unregistered piece ids are dropped from `Children`, missing scalar tags read as 0/false/"", and wrong tag types throw. Pieces are rebuilt without their generator constructors (the original uses the no-argument constructor plus `func_143009_a`), so no Random is consumed. The start map is rebuilt in Features key order, which fixes iteration order within a hash bucket (`structureMapOf`).

## Native evidence

`node tools/verify-structure-nbt.mjs` (needs the pinned client JAR in `tools/research`, SHA-1 `e80d9b3bf5085002218d4be59e668bac718abbc6`, a JDK, and the usual probe libraries; `MC_RESEARCH`/`MC_PROBE_LIBS` as in the other verifiers) compiles `tools/probes/StructureNbtProbe.java` and regenerates [structure-nbt-reference.json](structure-nbt-reference.json). The probe runs the unchanged `ChunkProviderGenerate.provideChunk` and populate with all four map generators and reads each generator's private `MapGenStructureData` (obfuscated `avj`, field `e` of `ave`):

1. the raw `{data:{Features}}` bytes right after the search (what `func_143026_a` saved when each start was created) and again after population (start NBT re-saved after `generateStructuresInChunk`), base64, with the Features key order, per-start SHA-256, start-map iteration order, the gzip `.dat` bytes, the ordered call/write hashes, the final chunk hash and both RNG streams;
2. a native read-back: the created state, gzip-compressed, is loaded by a fresh JVM through `CompressedStreamTools` and `MapGenStructureData.readFromNBT`, and the same population is repeated. The unchanged `func_143027_a` and `MapGenStructureIO` rebuild every start;
3. the same replay from the `.dat` files the JavaScript port wrote from its own starts, which the native reader loads, re-serialises to the same bytes, and populates to the same hashes as the native read-back.

Ten worlds are recorded: the five GEN-05g worlds (seeds/chunks of `structure-population-world-reference.json`: mineshaft, village, stronghold and temple starts, plus an empty one) and five census worlds found with the JS searchers to reach more piece ids (two larger villages, a swamp hut, two jungle pyramids). The record holds 10 starts (2 Mineshaft, 3 Village, 1 Stronghold, 4 Temple) and 371 pieces covering 31 of the 33 ported ids. Native never generates `ViW` (only the `ViStart` subclass is placed) or `SHRT` (the native RightTurn weight inherits LeftTurn's placement, see `stronghold-generator.js`), so those two have synthetic round trips only.

One world per JVM is used because native class statics make a second run in one process differ (seen for the jungle worlds, e.g. 992,908 versus 38,734 population calls for the same chunk); with one world per JVM all ten native read-backs equal their baselines.

## Replay (`src/structure-nbt.test.js`)

- JS encode equals the native bytes (tag types, order, names) for created state of all ten worlds and populated state of the five GEN-05g worlds; the JS start-map order equals the native map order.
- Native raw and gzip trees decode in JS, re-encode to identical bytes, and every native piece compound survives `pieceFromNbt`/`pieceToNbt` with the exact native key set. JS gzip `.dat` files round trip.
- Decoded starts rebuild the registered classes; the loaded start map order equals the native loaded order.
- Populating from reloaded starts (from the native bytes and from the JS `.dat` bytes), installed before the search as `MapStorage` does, gives the same ordered writes, call stream, RNG state and populated NBT as the original JS run and the native record.
- Unregistered ids, missing fields and wrong tag types behave as described above.

## Limits

- Fortress/Nether starts and pieces are not ported: decode skips them but cannot keep them.
- `ViW` and `SHRT` are covered only by synthetic round trips; the five census worlds are search-only on the JS side because JS village population is still missing door neighbour updates, so their populated NBT is native-only evidence.
- The temple world's native call stream is 319 calls longer than the port's (existing GEN-05g limit); its ordered writes and RNG streams agree.
- HashMap order is modelled for Java 8+ only. Failure behaviour of malformed data matches the accessors, not the native warning logs; `NBTSizeTracker` accounting is not ported (see `nbt.md`).
- No live save-folder, per-world `data/` wiring, chunk NBT or multi-chunk start sharing across chunk loads is implemented.
