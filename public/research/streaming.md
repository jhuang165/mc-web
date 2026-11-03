# Live Java terrain streaming (WORLD-02d to 02h, app 0.31.0)

Create New World → **Java streaming preview** selects generation version 13 (`javaStreamed`): the default Java biome, terrain, surface, cave and ravine ports (the version-12 terrain preview, WORLD-02d) plus per-area Java population from the seed (WORLD-02e, below). Worlds saved as version 12 keep their terrain-only generator and are never populated retroactively. The finite v9/v10/v11 and legacy generators retain their terrain and save representation. This is an incremental release, not full WORLD-02 or native streaming parity.

## Population (generation 13)

A streamed column is regenerated from the seed every time it returns to the working set, and only the player's edits are replayed over it. Population therefore has to be a pure function of the seed: journaling generated writes (about 3,000 per column) was rejected. `src/streaming-population.js` computes it per **population cell**, 8×8 columns aligned to the generator origin in local chunk coordinates (negative cells floor like chunk coordinates, so the first 8×8 window is exactly cell 0,0). One cell runs the existing finite-v11 chain (`PopulationArea` in `population-world.js`: mineshaft start search, then `populateBeforeDecoration` and `populateTail` for structures, lakes, dungeons, ores, trees, flowers, animals and snow, x outer and z inner) with a one-chunk margin on the −x/−z side, so every kept column also receives the writes of the populate calls that overlap it. The +x/+z halo terrain is read lazily and its writes discarded. Cells are cached (least recently used, over 192 cached original-ID terrain chunks) and rebuilt on demand; each costs roughly 0.6–1.2 s of generation, which since 0.29.0 normally happens in a worker ahead of the player (below).

Neighbouring cells are computed independently. A populate call on a shared border runs once in each cell with that cell's own earlier writes, so a feature straddling a border can differ from native in rare overlaps (a tree against a vein, say). Native order dependence on chunk-load order is replaced by a fixed per-cell order; the result for a column never depends on which columns were explored earlier. This is a labelled approximation of native on-demand population, not an exact replay.

Chests with dungeon loot, animals (pig, cow, sheep, chicken), spawners, mineshaft chest carts and generation-time liquid ticks are listed per column in world-local coordinates. A column hands its records to the live runtime once, the first time it is resident (`World.claimFreshColumns`, `restorePopulationColumns`); the world remembers claimed columns as a 64-bit mask per cell (`populatedColumns`, saved with the record and sanitized on import). Looted chests and killed animals are never refilled, and animals in not-yet-resident columns appear when their column first loads. If a cell cannot be generated it falls back deterministically to terrain, caves and ravines only, with a `console.error` and a `failed` flag on the cell. Villages, strongholds and temples still perform no draws or writes. Horses and other animals without a live entity type are skipped.

## Asynchronous generation and light shifts (WORLD-02f, 0.29.0)

`src/streaming-worker.js` is a module Web Worker that runs the same chain as the page (`streamedSource` in `java-world.js`: terrain, caves and ravines for generation 12; `StreamingPopulation` for 13). `StreamPrefetch` (`src/streaming-generator.js`) asks it, one request at a time and nearest first, for every population cell (13) or terrain column (12) holding a non-resident column within two chunks of the resident square. Cells arrive with their column buffers transferred and join the page's cell cache (nine cells, enough for the 12-column lead span); a cell the page already built is never replaced. Generation-12 columns wait in `world.pregenerated`, are used once and are trimmed when they fall out of the lead span. Because a column is a pure function of the seed, a worker column equals one built on the page; nothing depends on which side built it or when it arrived.

While the next square still needs a cell the worker is building, `movementTick` holds the window shift as long as the player is inside the ticking area (the inner 6×6 columns). Past that, or with no usable worker (no `Worker`, an `onerror`, or an error reply, each logged with `console.error`), the square is generated synchronously as before. Loading a world and the first square still generate on the main thread, before the worker starts.

`StreamingLight.shift` replaces the full light rebuild on every window move. The overlap's light arrays are translated, and only two strips are relit with the existing `LightVolume.relight`: the new columns plus 15 blocks into the kept area, and the 16 blocks along the edge the removed columns leave (outside the volume reads as open sky, as in a fresh build). Light cannot carry 15 blocks, so cells outside those strips already hold their final values and relight's inflow from them is exact; diagonal moves and moves over 81 blocks relight everything. `VoxelScene.syncChunks(change)` then remeshes only new columns, the 3×3 neighbourhoods of added and removed columns, and columns overlapping a changed light box, nearest first.

Measured in Chrome on localhost (seed 17, generation 13, `?silent`, 27 window shifts over about 430 blocks in two directions, then a save, reload and 140 more blocks): no cell was generated on the main thread during travel, `World.streamAround` took 0–1 ms per shift (previously about 600 ms whenever a new cell was entered), and `syncChunks` took 93–110 ms (previously a full rebuild of about 265 ms plus remeshing all 64 columns). After the 27 shifts the scene's light arrays were identical to a freshly built volume. The remaining hitch was that relight on the main thread (below). The background preview tab throttled animation frames, so frame times were not measured.

## Cheaper relighting (WORLD-02g, 0.30.0)

`LightVolume.relight` (`src/lighting.js`) produces the same arrays as before at about a sixth of the cost per shift; the solver and its rules are unchanged.

- **Sky seeds.** An open-sky cell (15) at or above the height of every in-box horizontal neighbour is surrounded by 15s, or at the column's lowest open cell by that cell's own value, so spreading it cannot raise anything. Only the open cells from a column's height up to its tallest in-box neighbour's height enter the flood, instead of every open cell (about 190 per column on seed 17).
- **Column reads.** `World.columnBlocks(x, z)` returns a view of a resident column's block ids; relight reads a column at a time instead of calling `World.get` per cell, and copies the old light with typed-array `set`. Worlds without `columnBlocks` (test doubles) still use `get`.
- **Tables.** Opacity comes from a 256-entry `lightOpacity` table, and the `emission` callback (which adds a lit furnace's position) is only asked about ids whose `lightEmission(b, true)` is non-zero. Block-light seeds are the emitters found while reading, not a scan of the box.
- **Inflow.** Light entering the box from outside is read without per-cell closures or arrays.

Checks: a scratch copy of the previous solver gave byte-identical sky and block light on 7 worlds across 420 edit relights; a new test compares `LightVolume` with a plain relaxation solver (every cell seeded, FIFO) on Java terrain before and after five edits, and fails when the neighbour-height condition is removed; the existing `streaming-light.test.js` equality tests pass. Node, seed 17 generation 12, 16 alternating shifts: about 15 ms per shift after warm-up (was 92 ms), a full 128×128 build about 80 ms (was 265 ms). Chrome on localhost (`?silent`, the modules imported into a blank tab): 12 shifts along +x took 19–23 ms each after a 41 ms first shift, a fresh build 95 ms, and the shifted arrays equalled freshly built ones. The full `syncChunks` (light plus remeshing the changed columns) was not re-measured in a running game. Light is still one 128×128 volume on the main thread, not per-chunk arrays.

## Runtime and storage

`World.streamAround` retains an 8×8 square of 16×16×256 `WorldChunk` columns around the player. Coordinates stay in the same axes throughout travel; no entity or edit rebasing occurs. Native generator coordinates remain local coordinates plus the saved seed's deterministic spawn-biome origin. Negative chunk addressing and the ±30,000,000 native border include that origin. The loaded window shifts before movement each tick. Overlapping columns retain identity; absent columns regenerate terrain and replay their own indexed edits. Generation completes before eviction, so a failed batch leaves the previous resident set intact. The biome cache also discards distant entries.

Only resident columns accept writes. Unloaded reads return air. A one-chunk halo leaves the inner 6×6 columns ticking. Fluids, fire and falling-block deadlines preserve their remaining delays outside that area; tie order and duplicate suppression survive JSON checkpoints. Mobs, drops, projectiles, arrows, carts, TNT, XP, farmland and furnaces pause outside it. Chests retain their inventories when unloaded. Entities and tile state still live in global runtime collections: this is activity gating, not complete chunk-owned entity storage.

`StreamingLight` translates absolute coordinates into the existing 128×128 light solver. Shifts move the bounded light volume incrementally (above; relighting cost reduced in 0.30.0); `VoxelScene` disposes outgoing meshes and queues only the columns a shift can change, nearby first. Existing finite light arrays and their regression fixtures remain unchanged. Light is still one 128×128 volume rather than per-chunk arrays. The working set is fixed at eight chunks per axis and does not implement the render-distance option's native ticket policy.

Streamed world records use IndexedDB (`blockworld.storage.v1`, `worlds`). The existing localStorage shelf contains only their summary and ID. Save completion is displayed after the database transaction and shelf write succeed. Legacy records retain localStorage. Export is self-contained; imports validate all edits, including unloaded ones. Streamed imports allow up to 2,000,000 edits and 128 MiB files; finite edit limits stay at 100,000. Since 0.31.0 the edit journal is stored per chunk column (below); the rest of the runtime state is still one world record, rewritten on each save. Every edit is still loaded when the world opens and kept in memory. Recovery/version conflicts, cross-tab synchronization, arbitrary-size worlds and Java region saves remain open. Browser storage remains origin-specific, so keep exports when moving hosts/ports. Autosaves run every five seconds and on pause; an abrupt browser/process termination can lose unsaved work.

## Per-chunk edit storage (WORLD-02h, 0.31.0)

The database (`blockworld.storage.v1`, now version 2) gains a `chunks` object store keyed by `[world, x, z]` with a `world` index. Each streamed world has one record per edited chunk column. It holds three typed arrays:

- `cells`: the local cell, as x << 12 | z << 8 | y;
- `values`: block | meta << 8, as in `World.edits`;
- `order`: each cell's position in the world's first-edit order.

The world record keeps the player, entities, pending ticks and the population mask, with `chunked: true` and no `edits` array.

`World.rememberEdit` marks the column dirty. `World.takeDirtyColumns` returns every column edited since the last save, each with all of its edits. `save()` passes those columns to `writeWorldShelf`, which writes them in the same transaction as the world records, so a save is atomic. If the write fails, the columns are marked dirty again (`markColumnsDirty`) and go out with the next save. An autosave therefore writes only what changed, instead of serialising every edit of the world (up to 2,000,000) every five seconds. Startup reads only the small world records; a world's column records are read when it is opened (`readChunkEdits`), sorted back into first-edit order and replayed through `World.restore`. That order is what iteration over `World.edits` sees, for example farmland and the legacy wake-ups, so it is the same before and after a reload.

Saves in the single-record form are converted on their first write, in one transaction: streamed records from 0.27.0–0.30.0, imported files and new worlds. A world opened from that form keeps every column dirty, and its fresh columns are queued after the converted copies, so the newer data wins. Until that write commits, the old record stays as it was. Exports remain self-contained: the active world exports `World.edits`, and a stored world reads its columns back into the file. Deleting a world removes its column records in the same transaction. Older app versions cannot open the version-2 database, so they cannot misread a chunked record.

Checks:

- `src/world-storage.test.js` runs against an in-memory IndexedDB with ordered requests, commit/abort and structured cloning. It covers:
  - column records round-tripping, negative coordinates included;
  - dirty-column tracking with whole-column records and first-edit order across re-edits;
  - unloaded columns and re-requeuing after a failure;
  - conversion of single-record saves, where the fresh columns win;
  - a save writing only the edited column;
  - an aborted transaction changing nothing and keeping the single-record copy;
  - deletion.
- Chrome on localhost:5181 with `?silent`, starting from a version-1 database seeded with a 0.30.0-style generation-13 record of four edits (including metadata), then:
  - opening it upgraded the database to version 2, with the old record untouched;
  - the first save moved its edits, plus the weather edits made at launch, into 26 column records, and the world record lost its `edits` array;
  - after more play and saves, 1,430 edits in 27 columns came back after a reload in the same order, with nothing dirty at launch and the metadata intact;
  - export from the pause menu and from the world list both produced 1,430-edit files without the `chunked` flag;
  - importing that file stored 27 column records;
  - deleting both worlds through Delete left 0 world and 0 chunk records;
  - the console showed no warnings or errors.

Still open:

- reading columns lazily as they load, instead of all edits on open;
- storing entities, tile state and pending ticks per chunk;
- cross-tab coordination and Java region (Anvil) saves.

## Evidence

`src/streaming-world.test.js` (pinned to generation 12) contains seven acceptance regressions:

- Six independent original-class `carver-reference.json` default-seed-0 chunks, including negative coordinates and native chunk (1,874,999, −1,874,999), replay mapped block and metadata hashes exactly through the streamed loader.
- Eviction/return at negative, distant and former chunk-key collision coordinates preserves metadata, air edits and floor holes through JSON reload, with 64 resident columns and a bounded biome cache.
- Real fluid/fire/falling runtimes retain delays through 30 unloaded ticks and an unloaded JSON checkpoint, then resume; coordinate keys cannot alias the former flat-index positions.
- Torch light propagates across x=0, negative weather columns and active chunk enumeration work, and player movement crosses the former map edge.
- Real drops and furnaces retain unloaded state and resume on return.
- Mobs, thrown projectiles, arrows, carts, XP and primed TNT retain unloaded state, accept entity restoration and resume.
- A simulated generation failure leaves resident columns and bounds intact.

`src/streaming-light.test.js` (two regressions) shifts a decorated generation-12 world along each axis, by three chunks and diagonally, with torches and roofs on both sides of each seam (unloaded columns replay theirs), and requires sky light, block light and heights to equal a freshly built volume; dropping the removed-edge strip fails it. `src/streaming-generator.test.js` (three regressions) runs the worker protocol in-process with structured-cloned, transferred messages: a worker-built generation-13 cell yields the same resident columns and population records as synchronous generation with no main-thread cell build, a pending cell is requested once and `ready` follows it, a late copy never replaces a cell built on the page, generation-12 columns are used once and trimmed, and a failed worker logs once, stops requesting and never holds the window.

`src/streaming-population.test.js` adds twelve regressions for generation 13: the first window equals cell 0,0 (81 populate calls) and differs from terrain-only; chest and spawner records sit under their blocks; columns and records are identical across request order and a one-cell cache that forces rebuilds; negative cell flooring and keys; once-only claiming, x-outer/z-inner order, saved-mask reload and window shifts; malformed mask rejection on load and import; edits replaying over populated columns without mutating the cached cell; generation 12 unchanged and unknown versions refused; deterministic loud fallback; an unmapped original block failing the cell; and records entering live chests, animals, spawners, carts and liquid ticks without refilling an emptied chest. The finite v11 fixtures (`population-world.test.js`) still pass with margin 0. There is no new native Java probe for the per-cell margin-1 arrangement: population itself is the existing ported chain, and its per-cell composition is browser-port regression evidence only.

Preview browser, localhost:5180, `?silent` (generation 13, seed 17): created a streamed creative world through the UI, crossed into four new cells within a five-second wait, found the 23 animals the records place in resident columns, saved and reloaded with identical claimed masks and no duplicated animals or chests, emptied a dungeon chest, travelled 700 blocks away and back and found it still empty, saw trees on the generated terrain, and deleted the world and its IndexedDB record afterwards; the console had no application errors.

Earlier (WORLD-02d) Chrome localhost:5182, isolated headless profile, `?silent`: created a seed-17 streaming world through the UI, walked from x=126.5 past x=129 using D, travelled to negative x/z, edited metadata, waited for 64 completed meshes, saved/reloaded, returned to a chest containing seven diamonds, exported and imported through the actual UI. A 6,291,456-byte test record round-tripped through IndexedDB with a 125-character shelf entry. Both scratch worlds and the large test record were deleted; console contained no application errors. Saved user options were untouched. Native biome/terrain probes verify only their documented scopes; unloading, storage and integrated runtime checks here are browser-port regressions, not execution of native chunk ownership or Java save interchange.

## Next work

Villages, strongholds and temples are still absent from streamed worlds, and population composes per cell rather than in native on-demand chunk order. Replace the working-set activity policy with the existing native provider/player-manager lifecycle, move entities/tiles/pending work into chunk-owned durable records, and move the remaining shift relight (about 15–20 ms since 0.30.0) off the main thread or into per-chunk light arrays, load stored columns lazily instead of all edits on open (0.31.0 stores edits per column), and record the claimed-column mask and runtime state per chunk instead of in the world record. Preserve existing populated and generation-12 saves during that transition. No Site publication.
