# lighting2 (batch 25): native incremental light engine

## Summary
- New `src/native-light.js` (`NativeLight`) is a port of the 1.7.10 incremental light code. It covers:
  - `World.updateLightByType`: a 32,768 `Int32Array` queue; the removal pass checks `j < length` and the addition pass `j < length - 6`; 17-block Manhattan reach; dropped pushes are counted in `stats.overflow`.
  - `checkChunksExist` / `doChunksNearChunkExist(17)`: an edit near an unloaded chunk is skipped.
  - Chunk light with null sections: generateSkylightMap, relightBlock, propagateSkylightOcclusion, recheckGaps, func_150804_b, func_150809_p in bytecode order, enqueueRelightChecks with the 4096 counter, reset, and the populateChunk isTerrainPopulated/isLightPopulated sequence.
- New probe `tools/probes/LightEngine2Probe.java` and driver `tools/verify-light-engine2.mjs` write `public/research/light-engine2-reference.json` (9 scenarios, 170 snapshots):
  - queue-32768/4096/1024
  - unloaded-edge
  - fresh-spiral-301/302 and fresh-xmajor-301
  - relight-checks-303
  - null-sections
- `src/native-light.test.js` (32 tests) replays these and the 18 batch-20 `light-engine-reference.json` scenarios through `NativeLight`. All 27 match native digests exactly.
- **Not wired into the game.** `lighting.js`, `streaming-light.js`, `scene.js` and `main.js` are unchanged, and `native-light.js` is not in the bundle. Game play keeps the batch-20 fixed-point differences: no stale light, eager fresh-chunk light, no unloaded-neighbour skip, no queue bound.
- Findings:
  - The 32,768 queue never overflowed naturally (peak about 29k).
  - Overflow is verified with shortened queues: 4096 or 1024 changes 21 of 41 snapshots, and a reach of 30 changes 5 of 41.
  - The null-section dark chunk persists under server ticks. After a reset it is partly healed by enqueueRelightChecks at 32 ticks and fully at 512.

## Verification
- `node --test src/native-light.test.js`: 32 pass, 0 fail.
- `npm test`: 4495 tests, 4495 pass, 0 fail.
- `npm run build`: ok.
- Perf: no game code path changed, so new-world time and long tasks are unchanged by construction. There was no browser measurement and no browser check.

## Follow-ups
- Wire `NativeLight` into the overworld `LightVolume` / `StreamingLight`. This needs:
  - an initial mask and hmMin from the eager build;
  - an old-opacity hook in `scene.updateBlocks`;
  - a per-tick `tickChunk` (for example from `scene.setTime`);
  - `shift` support for the per-chunk arrays;
  - the resident-square edge treated as unloaded.
  Then measure the new-world time (about 1.5 s) and the longest long task (under 100 ms).
- The client-side relight-check scheduling (WorldClient.func_147456_g, 10 chunks per tick, isRemote recheckGaps) is bytecode-read only and not probed.
- The Nether and End have no NativeLight scenario with real terrain.
