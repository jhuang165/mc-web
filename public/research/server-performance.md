# Dedicated server tick time with many mobs (batch 74 mpperf74)

Measured with `node tools/bench-server-mobs.mjs` (executed, node 20, Apple Silicon Mac under load average 10-13 from parallel tracks, so absolute numbers are noisy by about 20%). The script builds a flat 116 x 116 world, two survival players 25 blocks apart, N persistent mobs (zombie, skeleton, pig, cow, sheep, chicken, creeper, spider, villager; seeded positions), natural spawning off, 20 warm-up ticks, then 200 timed ticks of `DedicatedSimulation.tick()`. Phases are wrapped method timers. Native target: 50 ms per tick.

| mobs alive | chunkStream | mean ms/tick | p95 | max | mob packets/tick | KB/tick (JSON) |
|---|---|---|---|---|---|---|
| 0 | on | 0.13 | 0.25 | 2.1 | 0 | 0.6 |
| 97 | on | 2.4 | 3.6 | 75.8 (first-tick outlier) | 44 | 3.6 |
| 299 | on | 6.6 | 9.8 | 13.0 | 109 | 5.5 |
| 599 | on | 19.5 | 32.7 | 45.3 | 173 | 8.3 |
| 0 | off | 0.11 | 0.18 | 2.2 | 0 | 0.6 |
| 98 | off | 2.2 | 3.1 | 27.4 | 44 | 3.0 |
| 293 | off | 6.9 | 10.8 | 27.3 | 111 | 7.0 |
| 598 | off | 20.6 | 33.3 | 53.8 | 181 | 8.9 |

(Some mobs die in the first ticks: zombies kill villagers, creepers blow up, so the live count is a little under the request.)

Phase split at 600 mobs: `mobs.entities.tick` (the mob loop, `tickMobs`) is 94% of the tick, `mobs.track` (the server tracker and packet queue) 3%, dispensers 0.7%, weather 0.4%, everything else (containers, chunk views, items, vehicles, falling blocks, pistons, serialising the tick message) under 0.2% each. Chunk streaming makes no measurable difference. Cost grows faster than linearly (100 to 300 mobs: 3x, 300 to 600: 3x).

CPU profile at 600 mobs (`node --cpu-prof`): `EntityMobs.push` (collideWithNearbyEntities) is about 34% of the run (inlined into `tickMobs`), the line-of-sight walk `rayTraceBlocks` about 12%, GC 5%, AI ticks about 2% each. `push` scans the whole entity list for every mob (O(n^2)), with a 12-block reject before the box test.

## Changes (no behaviour change)
- `src/projectiles.js`: `rayTraceBlocks` no longer builds closures for the NaN tests, and `rayBounds` uses a Set instead of an array literal built on every call. Same arithmetic, same results.
- A seeded determinism check (`node tools/bench-server-mobs.mjs --state`: 300 mobs, 150 ticks, `Math.random` replaced, mob state and packet hash every 50 ticks) gave identical hashes before and after: `946bf454b2ab7503 f8ea0cd95773e9c5 7f8b6da45ddf1a7a`.
- Gain is within the noise of the loaded machine; the profile shows `test` plus `rayTraceBlocks` dropping from about 12.8% to 12.8% of a smaller total (roughly 15% less time in them). Honest result: the 600 mob tick is already under the 50 ms target, and no large exact win was found.

## Not done, and why
- A spatial grid for `push` would cut the biggest cost, but it must keep list order and the exact candidate set. Entities are moved off their own turn (riders, pistons, carts, teleports, spawns and removals during the loop), so a grid needs a staleness guard that was judged too risky for a no-behaviour-change batch. Next step if 600+ mobs ever exceeds 50 ms: a per-tick grid keyed on (entities array identity, length) with a rebuild on any change and a brute-force check mode run against the existing mob-collision tests.
- Not measured: wire cost on a real socket, clients, mobs spread over several loaded areas with 10+ players, the Nether and End worlds, natural spawning cost with the cap reached (`spawnPass` ran only when spawning is on).
