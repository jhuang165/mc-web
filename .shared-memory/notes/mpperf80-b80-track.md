# Batch 80 mpperf80: path search and mob move speed-ups, wire compression/TLS measured

## Summary
- `src/mpperf80-fast.js` (`MC_MPPERF80=on|off|verify`): (1) `pathCell`, the PathFinder cell test (`getVerticalOffset`, ayg static) through a per-id kind table and a direct chunk-column read (resident columns kept for one search), default classifier only; doors, trapdoors, fence gates, rails and unknown ids send the whole cell to the old function. (2) `safeTries`, `maxSafePointTries()` asked once per search instead of once per fall step (pure: target, health, difficulty). (3) `edgeClamp`, the `moveWith` world-edge clamp without per-call closures. (4) `originalIdOf`, step-block.js `toOriginal(id,0)[0]` through a per-id table.
- Call swaps in `src/pathfinding.js` (kind function, `beginMemo`/`endMemo` hooks), `src/entities.js` (`moveWith`), `src/step-block.js`.
- `tools/bench-path80.mjs` (path-heavy scenes, `--pillar`, `--state`, `--searches` replay A/B), `tools/bench-sockets78.mjs --wire` (deflate and TLS cipher cost per tick, measurement only), `src/mpperf80-b80.test.js` (6 tests), section in `public/research/server-performance.md`.

## Evidence
- Executed: CPU profiles. In 16 spread / 300 mobs pathfinding is only 2.4% (GC 19%, `walk` 31% inclusive); with 8 players on 2-block pillars and 200 zombie/skeleton/creeper every search floods its range and path is about 42% of the tick.
- Executed (seeded, A/B do identical work): pillar path 2.82-3.38 -> 2.09-2.27 ms/tick (-26 to -33%), whole tick 5.92-7.58 -> 5.14-5.90 ms (-13 to -22%). Search replay: flood 136-149 -> 102-111 ms (-25 to -30%), 739 small searches 18.8-20.2 -> 14.2-16.1 ms (about -20%). 16 spread / 300 whole tick: no measurable change (path is 0.2 ms/tick there).
- Executed: `--state` hashes equal across original HEAD source, off, on, verify: pillar `c59515eecc6ec4d0 c3e0ace6509ce0ee 71b9dff24a8412cc`; 16 spread / 300 and 32 cluster seed 4 equal the b79 hashes; Nether 8 / 200 equals b77.
- Port-read: the kind loop returns exactly what getVerticalOffset returns for every non-metadata id (air/passable continue, water -1/flag, solid 0, renderType 11/32 -3, lava -2 unless inLava); nulls and undefined cells fall back to `world.get`.
- Wire (executed, 16 clients): 200 mobs 180 KB/s per player; per-message deflate level 1 cuts to 29% of raw at 1.9 ms/tick, context takeover (dictionary model) 11% at 3.5 ms/tick; 400 cows 289 KB/s, level 1 22% / takeover 17%. AES-128-GCM 0.23-0.33 ms/tick, ChaCha20 0.31-0.41 ms/tick. Server has `perMessageDeflate: false`; nothing changed.

## Verification
- `node --test src/mpperf80-b80.test.js src/pathfinding.test.js src/mob-steps.test.js src/steps71-b71.test.js`: 32 pass, 0 fail.
- 87 neighbour files under `MC_MPPERF80=verify` (`--test-concurrency=4`): 1217 tests, 1203 pass, 14 fail; the 14 are `creeperwitch-b45.test.js` and fail identically at HEAD and with `MC_MPPERF80=off` (pre-existing). No full npm test, no browser.

## Follow-ups
- Not gains: binary heap with typed totals (tried, removed). Cross-search memo not attempted (the world changes between searches).
- Remaining tick cost is diffuse: GC about 19%, moveEntity allocations, blockBoxes, the A* core (safePoint/dequeue/addToPath).
- Compression would cut bytes 70-90% for 1.4-5 ms/tick of deflate if synchronous (ws runs it on the threadpool); a product decision, not done. creeperwitch-b45 failures need an owner.
