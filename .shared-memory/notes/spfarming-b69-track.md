# Batch 69 spfarming: single-player farming on the native random ticks

## Summary
- `src/main.js` (4 lines in the world-open block plus one import): `farming.sharedRandomTicks = true`, `farming.random = farming.stemRandom = weather.random`, `farming.drop` (cocoa drop), `farming.randomTick` added to `weather.blockTick`, and `weather.activeChunkSource = spActiveChunkSource(() => position, () => options.distance)`. The hash scan in `Farming.tick` no longer runs in single player; `tick` only drains.
- `src/sp-active-chunks.js` (new): the integrated server's active chunk set. Radius = the render distance option; the eligible chunks (`Weather.activeChunks`: resident ticking window plus the held ring) are visited in native HashSet order (`ChunkSet.order`, native coordinates, origin-aware).
- `src/farming.js`: `cocoaTick` (BlockCocoa.updateTick) and `randomTick` handles COCOA. Cocoa had no random tick anywhere (single player and server); it now ages and detaches. The server gets the growth too (its `blockTick` already calls `farming.randomTick`); it has no `drop` hook, so a detached pod there is removed without drops.
- `tools/probes/ActiveChunksProbe.java` + regenerated `public/research/active-chunks-reference.json`: new cases `sp2`, `sp5`, `sp16` (walking single player). The 11 older cases are byte-identical.
- `src/spfarming-b69.test.js` (5 tests). Reeds, cactus and nether wart were already on the shared loop (`plants`, `netherLive`); saplings, fire too.

## Evidence
- Bytecode-read (`javap -c` on the 1.7.10 client jar): `bsx.u` (IntegratedServer.tick) each unpaused tick compares `bao.u.c` (renderDistance option) with `oi.s()` and calls `oi.a(int)` when different, with no clamp; `oi.a` stores `q` (PlayerManagers clamp 3..20 separately); `mt.p()` returns `oi.s()`; `ahb.C` uses that as r. So the single-player radius is the option (2..16 chunks), not 10. `mobs.viewChunks = options.distance` already existed for the tracker.
- Bytecode-read: `ajz.a` (BlockCocoa.updateTick): unsupported pod (jungle log = block 4 type 3 in direction meta & 3) drops and is set to air (flag 2); else `rand.nextInt(5) == 0` and age < 2 gives age + 1 (flag 2). Drop count 3 at age 2, else 1 (from the existing `gen-world.js` port).
- Executed: sp2 / sp5 / sp16 HashSet orders (real `agu`, JDK 19), replayed exactly by the new source for a player crossing chunk borders (test 1, with a -640 origin so negative chunks keep their real hashes).
- Port replay (not a native execution): a seeded `Weather` + `Farming` loop through the new source shows farmland drying, wheat growing and nothing happening outside radius 2. A real seeded WorldServer replay of BlockCrops was not run; the draw order is the already-executed `tickChunk` loop and the b68 `Farming.randomTick`.
- Recalled: BlockFarmland, BlockCrops, BlockStem, BlockCocoa are `setTickRandomly(true)` blocks.

## Verification
- `node --test src/spfarming-b69.test.js`: 5 pass. One at a time: farming 7, crops 10, stems-cake 6, weather 25, chunkscan2-b68 8, serverchunks-b67 7, ring-random-ticks 8: all pass.
- `node --check` on main.js, farming.js, sp-active-chunks.js; every identifier the main.js hook reads (`position`, `options`, `items`, `makeStack`, `weather`, `farming`, `spActiveChunkSource`) is module scope or the import. `npm run build` ok. Full npm test not run (batch rule).

## Follow-ups
- The active set is only re-ordered for whole-chunk origins; an origin off the 16 grid returns the unordered set (single player never has one).
- The integrated server ignores a changing render distance only during pause (native too); the port reads the option every tick.
- Browser (not run): crops outside the render distance stop growing; a lower render distance shrinks the ticking area; cocoa now grows.
- Server cocoa detach has no drop hook.
