# Light engine audit (batch 20)

Compares how the port computes sky and block light with the unchanged 1.7.10 `World.updateLightByType` / `computeLightValue` and the Chunk light code. Opacity and emission per block were already probed (`block-light-reference.json`); this covers the propagation. Evidence: `tools/probes/LightEngineProbe.java`, driver `tools/verify-light-engine.mjs`, `light-engine-reference.json`, replayed by `src/light-engine.test.js`.

## Port light code

- `src/lighting.js` `LightVolume`: a 128 x 128 x height volume of sky and block nibbles (`Uint8Array`) plus a `heights` map (`y + 1` of the topmost cell with light opacity > 0, like `Chunk.heightMap`; 256 in a no-sky world). `column(x, z)` recomputes one height; `relight(x0, x1, z0, z1)` solves the whole box as a bucketed flood fill: sky 15 at and above the height map, block light from emitters, each cell `max(neighbour) - max(1, opacity)` (opacity 255 blocks, an emitter that is also opaque costs 1). Light entering from outside the box is read from the cells next to it; outside the volume reads as open sky (0 with no sky). `update(x, y, z)` = `column` + `relight` of the +-15 box.
- `src/streaming-light.js` `StreamingLight`: the same solver over the resident chunk square; `shift()` slides the window and relights only the new strips.
- `src/scene.js` `applyChanges` (the `light.column` / `light.relight` block): per changed cell, skips when opacity and emission are unchanged, otherwise recomputes the column height and relights the +-15 box; overlapping boxes merge; the changed box drives mesh rebuilds. `resetLight` builds the volume (`world.streaming` picks `StreamingLight`); powered repeaters emit 9 and lit furnaces 13 through the emission callback.
- Consumers: `skyAt`, `blockAt`, `packed` (`getLightBrightnessForSkyBlocks`, with `useNeighborBrightness`), `level` (`getBlockLightValue`, mob spawning), smooth lighting/AO in `smoothFace`.

## What was probed (executed natively) and bytecode-read

Probed: the unchanged `World` (`ahb`) over a provider of real `Chunk` (`apx`) objects with `ExtendedBlockStorage` sections, chunks -2..2 (80 x 80 blocks). `World.setBlock` runs `Chunk.func_150807_a` (relightBlock / propagateSkylightOcclusion / generateSkylightMap inside) then `World.updateAllLightTypes` -> `updateLightByType`. Fresh chunks go through `Chunk.generateSkylightMap`; "settled" sets `isTerrainPopulated` and ticks `Chunk.func_150804_b(false)` (recheckGaps, `func_150809_p` checkLight of the gaps) with isRemote false. After every edit one such chunk tick runs, as `WorldServer` does each tick. 18 scenarios, 1,000+ snapshots of sha256 digests of the whole 48 x 48 x 256 interior (sky, block, heightMap) plus nibble regions. `World` is allocated without its constructor and isRemote is true during `setBlock`, so block add/break callbacks (drops, fluid ticks) do not run; the light code does not use them.

Bytecode-read: the method structure of `func_150804_b`, `func_150809_p`, `func_150811_f`, the `recheckGaps` isRemote early return, and the `updateLightByType` queue (17-block distance test, `doChunksNearChunkExist`, removal pass that only clears neighbours equal to the removed value minus opacity).

Scenarios: torch, emitters (glowstone, lava, adjacent pairs), cave torch, 1-wide shaft dug 16 deep and re-covered, 9 x 9 roof placed block by block with holes, water/leaves/ice/glass columns (opacity 3/1/3/0), a sunken water basin, a sealed tunnel opened under an overhang, a chunk border at x = 16 (torches, glowstone, roof, shaft, lava), the loaded-area edge, a Nether volume, three fresh terrains, and three seeded 220-edit random stress runs (stone, planks, water, leaves, glass, torch, glowstone, lava, ice, dirt, air).

## Result

The port's fixed point equals the native light after every edit once the chunk tick has run: all sky, block and heightMap digests match in 12 scenarios and 660 stress edits, and the settled state of flat ground equals it (and so does a fresh `generateSkylightMap` of flat ground). No port bug was found, so `lighting.js` is unchanged.

## Documented differences (each pinned by a test)

1. **Transient and stale native light.** Natively an edit leaves cells wrong until the next chunk tick (`recheckGaps` / propagateSkylightOcclusion), and a floating opaque block set into a section that does not exist yet (no block above the highest section of that chunk) runs `generateSkylightMap` instead of `relightBlock`, which leaves the cells under it at their old sky light (15) while the port gives 14 (`null-section`, step 0; the next edit of those cells makes native agree). The port is always at the fixed point at once.
2. **Fresh chunks are lit eagerly.** Natively `generateSkylightMap` only lights columns vertically (15 above the height map, then -1 per cell, minus opacity, below it) and leaves block emitters unlit; lateral skylight under overhangs, trees and cliffs and emitter light appear only when the chunk is populated, ticked or a neighbour changes, so native terrain keeps dark pockets (terrain scenarios: 44-80 differing cells in a 17 x 17 x 25 region, all darker natively). The port propagates everything when the volume is built or a column streams in. Heights agree.
3. **Unloaded neighbours.** `updateLightByType` returns without doing anything when any chunk within 17 blocks is not loaded (`loaded-edge`: a torch 20 blocks from the loaded edge has no effect natively). The port has no unloaded chunks inside the resident square, so the same edit lights.
4. **No-sky worlds keep height 256** in `heights` (the native heightMap holds the real top); block light matches exactly in the Nether scenario.
5. **Timing.** The port relights the whole +-15 box synchronously; natively the incremental queue is bounded (32,768 entries, 17-block Manhattan distance) and spread over `setBlock` and the chunk tick.

Not covered: End/Nether worlds with real generated terrain, lighting across the 128-block volume edge and `StreamingLight.shift` (covered by `streaming-light.test.js`), `Chunk.func_150809_p` neighbour-chunk population ordering, and the rare queue overflow case.

## Regenerating

`MC_RESEARCH=<research dir> node tools/verify-light-engine.mjs` (needs a JDK; compiled output goes in `<research dir>/lightengine-probe/`).
