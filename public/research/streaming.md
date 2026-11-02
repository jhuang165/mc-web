# Live Java terrain streaming (WORLD-02d, app 0.27.0)

Create New World → **Java streaming preview** selects generation version 12 (`javaStreamed`). It uses the existing default Java biome, terrain, surface, cave and ravine ports. Population is deliberately absent: no generated ores, trees, lakes, dungeons, mineshafts, animals or initial snow. The finite v9/v10/v11 and legacy generators retain their terrain and save representation. This is an incremental foundation release, not full WORLD-02 or native streaming parity.

## Runtime and storage

`World.streamAround` retains an 8×8 square of 16×16×256 `WorldChunk` columns around the player. Coordinates stay in the same axes throughout travel; no entity or edit rebasing occurs. Native generator coordinates remain local coordinates plus the saved seed's deterministic spawn-biome origin. Negative chunk addressing and the ±30,000,000 native border include that origin. The loaded window shifts before movement each tick. Overlapping columns retain identity; absent columns regenerate terrain and replay their own indexed edits. Generation completes before eviction, so a failed batch leaves the previous resident set intact. The biome cache also discards distant entries.

Only resident columns accept writes. Unloaded reads return air. A one-chunk halo leaves the inner 6×6 columns ticking. Fluids, fire and falling-block deadlines preserve their remaining delays outside that area; tie order and duplicate suppression survive JSON checkpoints. Mobs, drops, projectiles, arrows, carts, TNT, XP, farmland and furnaces pause outside it. Chests retain their inventories when unloaded. Entities and tile state still live in global runtime collections: this is activity gating, not complete chunk-owned entity storage.

`StreamingLight` translates absolute coordinates into the existing 128×128 light solver. Shifts rebuild the bounded light volume; `VoxelScene` disposes outgoing meshes, queues the resident square for rebuilding and prioritizes nearby columns. Existing finite light arrays and their regression fixtures remain unchanged. Rebuilding light synchronously and remeshing after each shift can produce a hitch; asynchronous generation and incremental chunk lighting remain open. The working set is fixed at eight chunks per axis and does not implement the render-distance option's native ticket policy.

Streamed world records use IndexedDB (`blockworld.storage.v1`, `worlds`). The existing localStorage shelf contains only their summary and ID. Save completion is displayed after the database transaction and shelf write succeed. Legacy records retain localStorage. Export is self-contained; imports validate all edits, including unloaded ones. Streamed imports allow up to 2,000,000 edits and 128 MiB files; finite edit limits stay at 100,000. The edit journal and all runtime state are still rewritten as one world record, loaded at startup and retained in memory. Incremental per-chunk transactions, recovery/version conflicts, cross-tab synchronization, arbitrary-size worlds and Java region saves remain open. Browser storage remains origin-specific, so keep exports when moving hosts/ports. Autosaves run every five seconds and on pause; an abrupt browser/process termination can lose unsaved work.

## Evidence

`src/streaming-world.test.js` contains seven acceptance regressions:

- Six independent original-class `carver-reference.json` default-seed-0 chunks, including negative coordinates and native chunk (1,874,999, −1,874,999), replay mapped block and metadata hashes exactly through the streamed loader.
- Eviction/return at negative, distant and former chunk-key collision coordinates preserves metadata, air edits and floor holes through JSON reload, with 64 resident columns and a bounded biome cache.
- Real fluid/fire/falling runtimes retain delays through 30 unloaded ticks and an unloaded JSON checkpoint, then resume; coordinate keys cannot alias the former flat-index positions.
- Torch light propagates across x=0, negative weather columns and active chunk enumeration work, and player movement crosses the former map edge.
- Real drops and furnaces retain unloaded state and resume on return.
- Mobs, thrown projectiles, arrows, carts, XP and primed TNT retain unloaded state, accept entity restoration and resume.
- A simulated generation failure leaves resident columns and bounds intact.

Chrome localhost:5182, isolated headless profile, `?silent`: created a seed-17 streaming world through the UI, walked from x=126.5 past x=129 using D, travelled to negative x/z, edited metadata, waited for 64 completed meshes, saved/reloaded, returned to a chest containing seven diamonds, exported and imported through the actual UI. A 6,291,456-byte test record round-tripped through IndexedDB with a 125-character shelf entry. Both scratch worlds and the large test record were deleted; console contained no application errors. Saved user options were untouched. Native biome/terrain probes verify only their documented scopes; unloading, storage and integrated runtime checks here are browser-port regressions, not execution of native chunk ownership or Java save interchange.

## Next work

Connect population and structures using persistent cross-chunk generation ownership and original population order. Replace the working-set activity policy with the existing native provider/player-manager lifecycle, move entities/tiles/pending work into chunk-owned durable records, and add incremental asynchronous generation, per-chunk lighting and storage. Preserve existing populated saves during that transition. No Site publication.
