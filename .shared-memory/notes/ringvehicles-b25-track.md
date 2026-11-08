# Ring vehicles and block ticks track (batch 25, branch batch25-ringvehicles)

## Summary
- Minecarts, boats and dimension-live portal travel tick in the headless ring through `ringEntityActive` (the 32-block rule). Ring carts are no longer clamped to the resident window.
- Fireballs and wither skulls were ungated. They now freeze when inactive and die where 1.7.10 `World.blockExists` fails (y outside 0..255, or a streamed column neither resident nor held), as `EntityFireball.onUpdate` does.
- Fluid and redstone scheduled ticks run in ring columns through the new `ringBlockTickActive` (`streaming-ticks.js`). A ring column qualifies when it takes writes (`HeadlessColumns.writable`: resident, or held and hydrated) and its eight neighbour chunks are resident or held (`blockTicks`, a port guard against reading missing columns as air).
- `redstone-live.js`: storage reads and writes ring cells during `ringReads`, and the 100-tick sensor scan includes ring columns, cached per column on a new write `stamp`.
- Native evidence: `tools/verify-ring-ticks.mjs` runs javap on unchanged ahb/mt/sa/xl/xi/ze/zg/zi/zp and writes `public/research/ring-ticks-reference.json`. The docs are natural-spawning.md "Round 7" and the parity.md line plus a reference entry.

## Verification
- New `src/ring-ticks.test.js` (8 tests). The 320-tick replay runs at 12 ring spots, ring-backed vs all-resident, and the logs and final blocks match: 1,917 cart-ticks, 960 boat-ticks, 554 fluid changes, 64 redstone changes, 286 ball-ticks, 8 explosions. Restoring HEAD `minecarts.js`, `boats.js`, `fluids.js` or `redstone-live.js` makes it fail. Fireball gating has its own test, because the replay cannot see it.
- Node bench: 120 carts, 60 boats and 80 spreading fluids in the ring, 600 ticks. Median 1.4 ms, p95 10 ms, max 52 to 59 ms (fluid spread ticks; window-only equivalent 18 ms). Redstone ring scan: 25 ms cold, 8 to 9 ms warm, every 100 ticks.
- No browser check was run.
- `npm test` / `npm run build` results are in the finish_work handoff.

## Follow-ups
- Random ticks (crops, fire, leaves, lava ignition, redstone ore) and fire scheduled ticks are still window-only. Native random ticks cover the view-distance activeChunkSet.
- Carts have no portal travel (`xl.h` has its own portal section). Hopper and chest carts cannot reach ring containers. Ring pistons were not replayed.
- Ring updates wait at the outer rim (8-neighbour guard) and in unhydrated columns. Ring edits get no mesh or light until resident.
- Ring reads miss `World.chunkAt` before the ring lookup. A miss cache in world.js would cut the fluid peak.
- Fireball `blockExists` applies only to streamed worlds.
