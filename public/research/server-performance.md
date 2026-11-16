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
- Gain is within the noise of the loaded machine (self time of `test` + `rayTraceBlocks` fell from about 1035 ms to 707 ms over a 150 vs 100 tick profile, per tick about 7.0 ms to 7.1 ms: no real change). Honest result: the 600 mob tick is already under the 50 ms target, and no large exact win was found.

## Batch 75 mppushgrid75: push grid (no behaviour change)
- `src/push-grid.js`: during the mob loop `EntityMobs.push` takes its candidates from 8-block cells (the entities within 12 blocks, the old reject, in exactly the order `entities` lists them) instead of scanning the whole list. Used from 200 entities up; smaller scenes keep the plain scan (measured: no gain at 100 and 300 mobs).
- Staleness guard: the grid is built at the first push of a loop and dropped when the loop ends; push re-files the mob, its mount and its rider; `markMoved` (seat in the loop, `endRidden`, `setLocationAndAngles` = dismount) re-files an entity moved off its own turn; a changed list length or a list slot that no longer holds the bucketed entity falls back to the full scan. `MC_PUSHGRID=off|verify` (and `pushGridConfig.mode`): `verify` runs both and throws on the first difference.
- Determinism (`--state`, now with `--seed --mobs --riders --pistons --rseed`) identical before and after for six scenes: default `946bf454b2ab7503 f8ea0cd95773e9c5 7f8b6da45ddf1a7a`; seed 3 / 200 mobs; seed 11 / 500 mobs / 20 rider pairs / 25 pistons; seed 5 / 120 / 10 / 10; seed 21 / 600 mobs; seed 8 / 40 / 6 / 8. Also identical with `MC_PUSHGRID=verify`.
- Measured (same machine, load 20-45, paired runs one process at a time, chunkStream on, 600 mobs): off 24.1, 24.8, 24.5 ms/tick; on 18.0, 18.3, 18.7 ms/tick (about 25% less). 300 mobs: 7.5 / 7.4 ms (the grid is not used below 200 entities, so no change), 100 mobs: unchanged. Several other runs were swamped by machine load (60+) and are not quoted.
- Profile after (600 mobs): `push` plus its inlined scan fell from about 3.3 s to about 1.2 s over 150 ticks; what is left is `rayTraceBlocks` / `test` (about 15%, line of sight), `tickMobs` itself, and GC.

## Not done, and why
- A spatial grid for `push` would cut the biggest cost, but it must keep list order and the exact candidate set. Entities are moved off their own turn (riders, pistons, carts, teleports, spawns and removals during the loop), so a grid needs a staleness guard that was judged too risky for a no-behaviour-change batch. Next step if 600+ mobs ever exceeds 50 ms: a per-tick grid keyed on (entities array identity, length) with a rebuild on any change and a brute-force check mode run against the existing mob-collision tests.
- Other per-mob box queries (`ai.nearby`, `nearby` player scans, the single-player player push at `entities.js` `serverPlayerUpdate`) did not show in the profile above 2%, so they still scan.
- Not measured: wire cost on a real socket, clients, mobs spread over several loaded areas with 10+ players, the Nether and End worlds, natural spawning cost with the cap reached (`spawnPass` ran only when spawning is on).

## Line-of-sight walk (batch 76 mplos76)
- `rayTraceBlocks` (projectiles.js) is the walk behind `EntitySenses.canSee`, arrows, explosions and fishing. The old body is kept as `rayTraceBlocksReference`; the live one is the same cell walk with the closures and the working array gone, the start vector in three locals, a direct read of the column's block array (only for a plain `World.get`, falling back to `world.get` for a non-resident column or an undefined cell) and an early `continue` for air. The stepping expressions are copied operation for operation, so every hit and null is bit-identical.
- `MC_RAYTRACE=verify` runs both on every call and throws on a difference; `off` uses the reference. `tools/bench-raytrace.mjs --scene=air|flat|mixed` verifies and then times both interleaved.
- Per-tick caching already matches native: `canSee` caches per target in `senseCache`, cleared once per AI tick (ai.js tick, entities.js think paths). The 600-mob bench casts about 2400 rays/tick, about 72 cells per ray; these are real native queries (target tasks, creeper swell, attack tasks), so the count was not reduced.
- Measured (executed, load average 10-13 so server ms/tick pairs were noise): CPU profile of the 600-mob bench, ray-walk self time 740 ms -> 446 ms over about 206 ticks (3.6 -> 2.2 ms/tick, share 15.9% -> 11.5%). Micro bench, us/ray reference -> fast: air 1.09 -> 0.77, flat 0.91 -> 0.67, mixed block soup 0.51 -> 0.45.
- Determinism hashes of two `--state` scenes identical before and after, also under `MC_RAYTRACE=verify`; 763 existing tests (projectiles, bow, fishing, explosions, fireballs, village fights, enderman, wither, buckets, server handlers, ai) pass under verify.
