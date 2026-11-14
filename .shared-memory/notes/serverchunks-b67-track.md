# Batch 67 serverchunks: per-player active chunks on the dedicated server

## Summary
- `src/multiplayer/server-chunks.js` (new): `ChunkSet` builds World.activeChunkSet (radius 10 square per player, x outer, in player-list order, then HashSet bucket order through `java-hashset-order.js` with the retained table size) and clips it to the server's finite window; `ServerChunkSets` makes one per dimension (0, -1, 1) from the players of that dimension.
- `src/weather.js`: `Weather.tick` and `tickDimension` use `this.activeChunkSource?.(world)` when set, else the old `Weather.activeChunks` (single player unchanged). This drives the lightning roll, ice and snow roll, cauldron fill, cave mood draw and the three random block ticks per section (they share `tickChunk`).
- Hooks: `simulation.js` (import, `this.chunkSets`, Overworld source), `server-nether.js` `buildNetherSystems` (source for `n.dim`; covers the Nether and the End).
- Result: a world with no player in a dimension ticks no chunk; a chunk beyond every player's radius gets no random tick. In a 128 x 128 window (8 x 8 chunks) radius 10 still reaches every chunk from any player, so the visible change there is "nobody online, nothing ticks"; the 256 End window clips for real.
- No new wire messages.

## Evidence
- Bytecode-read (`javap -c -p` on `ahb`, `mt`, `agu`): `ahb.C` (setActivePlayerChunksAndCheckLight) clears `F` (a HashSet of `agu`), then per player in list order adds [-r, r] x [-r, r] around (floor(posX/16), floor(posZ/16)), r = `p()`; `mt.p()` returns `oi.s()` (the configured view distance, default 10), so the brief's radius 7 is wrong for the server. `mt.g` iterates `F` directly, so the visit order is HashSet order. `agu.hashCode` = (1664525*x + 1013904223) ^ (1664525*(z ^ -559038737) + 1013904223).
- Executed: `tools/probes/ActiveChunksProbe.java` (real `agu` in a real HashSet filled as `ahb.C` does, reused across ticks) via `tools/verify-active-chunks.mjs` -> `public/research/active-chunks-reference.json` (JDK 19). `ChunkSet` replays one player, negative chunks, two far players, the table kept across clear(), and radius 3 exactly.
- Executed and a limit: two overlapping players give bins of 9 or more nodes at table size 1024; Java 8 HashMap treeifies them and the order inside such a bin differs. The model keeps list order. The test checks the bucket sequence and each bucket's members equal the executed set and only treeified bins differ. One player and far-apart players are exact.
- Recalled: 1.7.10 ran on Java 6/7/8; the reference models Java 8+ ("java8"), as batch 49 did.
- Recalled: for the legacy 128 End window (x origin 25) the native chunk is approximated as the local chunk plus floor(origin / 16).

## Verification
- `node --test src/serverchunks-b67.test.js`: 7 pass. One at a time: mplightning-b66 7, weather-simulation 2, weather 25, snow 14, multiplayer 5, mpnether-b61 7 pass mpnether2-b62 7, mpend-b63 5, mpend2-b64 6, mpend3-b66 4, mpendwindow-b65 5, mpsleep-b66 17, dimension-random-ticks 2 pass. `mpnether3-b63.test.js` did not finish in 60 s, and did not finish either with my two hooks commented out (so not caused by this change; possibly just slow under the load of ten tracks): not counted.
- `node --check` on every touched file. Full npm test not run (batch rule).

## Follow-ups
- Treeified HashMap bins (overlapping players) keep list order, not native tree order.
- Farming growth (`Farming.tick`) and Fire/Trees own scans are not per-chunk on the server; only the weather loop is.
- Only a browser would show: nothing here is visible in a client; a joined client sees crops, ice and snow change only near players.
