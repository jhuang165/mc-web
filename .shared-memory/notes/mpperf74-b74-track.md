# Batch 74 mpperf74: dedicated server tick time with several hundred mobs

## Summary
- `tools/bench-server-mobs.mjs` (new): runs `DedicatedSimulation` with 0/100/300/600 mobs, two players, chunkStream on and off, and prints ms per tick split by phase (wrapped method timers), p95, max, packets and JSON bytes per tick. `--state` prints a seeded determinism hash.
- `src/projectiles.js`: `rayTraceBlocks` NaN tests without closure calls; `rayBounds` id list as a Set. Same arithmetic.
- `public/research/server-performance.md` (new): the measured table and profile.

## Evidence
- Executed: the table in `server-performance.md` (600 mobs about 20 ms/tick, 300 about 7 ms, 100 about 2.3 ms, empty 0.1 ms; target 50 ms). 94% of the tick is the mob loop; chunkStream makes no difference.
- Executed: `node --cpu-prof` at 600 mobs: `push` (collideWithNearbyEntities, O(n^2)) about 34%, `rayTraceBlocks` about 12%.
- Executed determinism check (`--state`) identical before and after: `946bf454b2ab7503 f8ea0cd95773e9c5 7f8b6da45ddf1a7a`.
- Recalled: nothing.

## Verification
- `node --test src/projectiles.test.js src/village-fight.test.js src/webs.test.js src/buckets.test.js src/bed.test.js src/particles.test.js src/signs.test.js src/server-handlers.test.js src/mpspawn73-b73.test.js`: 91 pass, 0 fail.
- Benchmark run 4 times, one profile. Machine was under load 10-13, numbers noisy. Full npm test not run (batch rule). No browser checks. `npm run build` see commit message.

## Follow-ups
- `EntityMobs.push` spatial grid (see `server-performance.md` for why it was not done). A first micro-version of the push loop (hoisted reads) gave no measurable gain and was dropped.
- Not measured: real sockets, many players, Nether/End, spawnPass with spawning on.
