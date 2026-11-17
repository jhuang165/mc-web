# Batch 78 mpperf78: tight push grid for dense clusters, real-socket benchmark

## Summary
- `src/push-grid.js`: `FineGrid` / `pushNear` (`MC_MPPERF78=on|off|verify`, `MC_MPPERF78_MIN` default 60): 2-block cells, candidates limited to what the pushing mob's grown box can reach, list order kept; `beginPushGrid`/`endPushGrid`/`markMoved` also handle the fine grid.
- `src/entities.js`: `push` asks `pushNear` first (falls back to the b75 grid, then the full list); `pushHalf` (half-width upper bound); `sections()` in `tickMobs` calls `markMoved(prevEntity)` so entities that move on a `continue` path are re-filed.
- `src/mpperf78-scene.js` (pen scene), `tools/bench-push78.mjs`, `tools/bench-sockets78.mjs` (real server, real WebSocket clients in a child process), `src/mpperf78-b78.test.js` (6 tests), `public/research/server-performance.md` (section).

## Evidence
- Executed: seeded `--state` hashes equal across `off`, `on`, `verify` in four pens (cows; mixed animals; zombie/spider/slime/villager/horse; cow/ghast/giant/golem with deaths). Numbers in server-performance.md.
- Executed: push 0.96-1.30 -> 0.24 ms (200 cows), 10.6-13.3 -> 0.9 ms (400 mixed), 5.8-8.5 -> 0.71 ms (600 cows); b75 grid is slower than the plain scan inside a pen.
- Executed: sockets bench 8 and 16 clients, 0-400 mobs: tick callback 2-12 ms, encode 0.2-0.8 ms, 92-292 KB/s per player, 19.6-19.8 ticks/s.
- Port-read: nothing about native order changes; the full scan walked `this.entities` in array order, and the grid keeps that order. Bound on box width: ENTITY_TYPES width x slime size; foal widths only grow to scale 1.

## Verification
- `node --test src/mpperf78-b78.test.js` (6 pass); b75 and b77 test files still pass. Related mob/rider/villager/golem/lead/ring/piston/horse/slime/fight set under `MC_MPPERF78=verify MC_PUSHGRID=verify MC_MPPERF77=verify`: 135 files, 1701 tests, 0 fail. No full npm test, no browser.

## Follow-ups
- Staleness risk: an entity whose position is written during another entity's turn without a `markMoved` would be filed wrong (verify throws on that); none found in the loop code read.
- The bench measures localhost only; bandwidth (JSON, no compression, `tick` carrying all players) is the larger cost than encode time.
- Lighting relight after explosions belongs to `mpexplosion78`.
