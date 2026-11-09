# walkperf (batch 31)

## Summary
Goal: frame-time parity while walking and on dimension returns. No game rules or tick results changed; every change is performance-only. No Java probes were needed (nothing native was re-derived).

- Walk profile: `artifacts/b31-walkperf/walk.mjs` (outside Git, parent folder). Muted headless Chrome, seed `walkperf31`, survival, teleport to (100.5,100.5), 10 s settle, W+Space held toward -x for 120 blocks, CDP Profiler samples attributed to frames over 50 ms.
- Biome cache (`src/world.js`, `src/java-world.js`, `src/main.js`): the cache trim in `streamAround` kept only a 16-block halo, so ring chunks' random ice rolls (`canBlockFreeze` -> `temperatureAt` -> `biomeAt`) recomputed biome layers on the page thread (169-339 ms per walk). Halo is now `BIOME_HALO` (12 chunks) and `world.warmBiomes` fills ring tick chunks within a 3 ms budget each movement tick.
- Light flood (`src/lighting.js`): removed the per-entry closure in `relightSteps`; neighbour indices are computed inline. Results identical (light tests pass).
- Teleporter (`src/dimension-live.js`): when a saved portal exists, the first window fetch is round the nearest saved portal (the exit), so `main.js` no longer needs a second fetch.
- Worker count (`src/mesh-pool.js`): `?meshWorkers=N` (1-16) or localStorage `blockworld.meshWorkers`; default unchanged `min(3, cores-2)`.

## Verification
`npm test`: 4836 tests, 4836 pass, 0 fail (load average about 15). `npm run build`: built OK (chunk-size warning only). `git diff --check` clean. New tests: streaming-world (ring biome arrays kept and warmed), dimension-live (exit-window fetch), mesh-worker (`?meshWorkers=N`).

Walk, same script and seed, 1-minute load average from `uptime`:
| run | load | over 50 ms | over 34 ms | ms in long frames |
|---|---|---|---|---|
| before 1 | 8.7 | 7 | 17 | 450 |
| before 2 | 9.0 | 6 | 14 | 367 |
| before 3 | 7.9 | 5 | 9 | 333 |
| biome fix 1 | 8.1 | 0 | 1 | 0 |
| biome fix 2 | 19.5 | 3 | 8 | 183 |
| biome fix 3 | 25.2 | 2 | 8 | 134 |
| + lighting 1 | 8.1 | 0 | 1 | 0 |
| + lighting 2 | 8.6 | 0 | 1 | 0 |
| + lighting 3 | 10.0 | 4 | 24 | 217 |
A run at load 30-60 on the base code had 89 frames over 50 ms, so load inflates counts heavily; runs at similar load are the fair comparison. The 4-frame run's long frames were ring-light `search` (`headless-columns.js`) reached from weather/cave-ambience `skyAt`.

Teleporter, 3 seeds (walkperf31, a2, b3), 4 trips each, second fetch = `trip:windowed - trip:arrived`:
- Saved portal 60 blocks from the exit: before 0.82-1.35 s second fetch on all six returns (return wall 2.36-3.2 s, load 11-20); after 0-1 ms on all six (return wall 1.55-2.96 s, load 26-32).
- No saved portal (creation): unchanged, about 1.1-1.4 s on seed walkperf31, 0 ms on the other two.
- Rejected: area-first fetch (mean return wall about 2.7 s vs 2.03 s) and a merged request (did not fix creation, larger API).

Worker count (`?meshWorkers=N`, 18 cores, load about 7.5, not idle), remeshing 64 columns: 1 worker 723-726 ms, 2: 355-409, 3: 254-317, 4: 202-205, 6: 153. New-world load wall time 1.57-1.87 s for any N. Cap of 3 left unchanged.

## Follow-ups (proposed gap lines)
- Ring-light `search` through weather/cave-ambience `skyAt` still gives 25-35 ms spikes while walking (ring-light owner).
- Teleporter exit when no saved portal exists still pays a second window fetch of about 1.1 s on some seeds.
- `StreamingLight.shift` relight costs 30-54 ms per 16-block shift; slicing it would change the light state ticks see, so it was left.
- Worker cap of 3 was measured at load about 7.5 only; it needs a re-measure on an idle machine.
