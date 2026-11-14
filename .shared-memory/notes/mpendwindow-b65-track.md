# Batch 65 mpendwindow: the server End is the whole main island (256 x 256 window)

## Summary
- Design chosen: a bigger finite End, not a streamed one. The grid width became a property of the world (`World.size`, `LightVolume.size`, default 128), and a new End is 256 x 256. Streaming the End would need per-player windows, a sliding light grid and a changing wire; the size parameter is about thirty lines in files that already had `SIZE`.
- `src/world.js`: `this.size` (asked from `constructor.windowSize?.()`, default `SIZE`), used by the column loop, `index`, `inside`, `maxX/maxZ`, `snapshot`. `src/lighting.js`: `LightVolume` sizes its arrays and indexing from `this.size` (`const SIZE = this.size` inside each method). `src/fire.js` (scan, mark, endTick), `src/weather.js` (activeChunks, precipitationHeight, canSeeSky), `src/entities.js` (restore bound, spawn loaded check), `src/mesh-region.js` (light snapshot) read `world.size ?? SIZE`.
- `src/multiplayer/client-dimensions.js`: `END_WINDOWS` (`legacy` 128 at offset 25/96, `full` 256 at offset 128/128), `FiniteDimensionWorld(seed, dimension, window)`, `world.endWindow`, `originX/originZ` from the window (F3 still prints native coordinates), `spawn()` from the origin. `restoreDimensionReplica` passes `snapshot.window`.
- `src/multiplayer/server-end.js`: new End is `full`; `fillEnd` and `buildExitPortal` and `place` use the world's origin; `saveField` writes `window`. `src/multiplayer/server-dragon.js`: `setupEnd` takes centre, portal clamp and the crystal window from the world (`centreOf`); the portal clamp is now 6 blocks from the edge of the 256 window. `src/multiplayer/server-dimensions.js`: snapshot carries `window` for the End.
- Saved Ends from 0.93.0 (no `window` field) are read as the 128 window they were stored in (`legacy`), unchanged: edits, tiles, mobs and player positions stay valid with no migration. They keep the old limits (cut-off island, few crystals). A snapshot without `window` (older server) also reads as legacy. Only Ends never saved yet get the 256 window.
- Wire: new field `window` (`'full'` or `'legacy'`) on the End's world snapshot (welcome and `dimRespawn`). No new message type. A 256 End sends 256 columns instead of 64.
- Tests: `src/mpendwindow-b65.test.js` (5). Updated for the new layout: `mpend-b63`, `mpend2-b64`, `mpdragon-b64` (use `END_WINDOWS.full`, 256 columns; crystal upper bound removed).

## Evidence
- executed: the generator's island extent over four seeds (end stone from x -129..136, z -161..120, thin tails beyond 130 from the origin; most seeds inside +-128), the crystal list from `DimensionWorld.endCrystals` for the window (test compares the server's crystals with it), all the node tests below.
- found wrong in the brief: the 1.7.10 spikes are not a fixed ring of 10 pillars. The existing generator (WorldGenSpikes through the chunk decorator, executed earlier in end-reference.json) puts a spike in a chunk by a seeded roll; a 256 window gives 20 crystals for the test seed, b64's 128 window gave 3 to 10. The ring of ten is a later version (recalled).
- recalled: the native End platform at (100, 49, 0) and the portal at (0, 0).
- No new Java probe: no new native fact.

## Verification
- `node --test src/mpendwindow-b65.test.js`: 5 pass. `mpend-b63`: 5, `mpend2-b64`: 6, `mpdragon-b64`: 6, `b64-lead`: 1 (run one at a time). Also `lighting` 9, `fire` 21, `weather` 25, `world` 6, `mpnether-b61` 7, `b63-lead` 1.
- `light-slicing` 3, `mesh-worker` 4, `mpnether2-b62` 7 pass (`mpnether3-b63` started but stopped, machine busy). `node --check` ok on touched files; `npm run build` ok. Full npm test not run (batch rule).

## Follow-ups
- Only a browser could show: the client scene, chunk meshing and fog on a 256 replica (scene.js and the mesher read the world's chunk map and `LightVolume`; the mesh snapshot now reads `vol.size`), the load time of the first light flood (256 x 256 x 256 cells, built once per server start).
- The End is built once at about 2 s of generation in the tests; the light grid is 4x larger (33 MB for sky and block light).
- Legacy Ends are not migrated to 256; moving one needs a rewrite of every saved coordinate (tiles, mobs, items, players), not attempted.
- The dragon still flies and dies anywhere; far tails of some seeds (beyond 128 from the origin) are still cut.
