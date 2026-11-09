# walkperf2 (batch 32)

## Summary
Goal: the open stalls from batch 31 (ring-light `search`, window-shift relight, Teleporter second fetch, worker cap). No game rule or light value changed; no Java probes (nothing native was re-derived).

- Ring-light search (`src/headless-columns.js`): `RingLight.search` now skips work it can prove useless, with the same answer. Per held column (cached by stamp, `info()`): lowest height-map value and "holds an emitter". If every height map in the 3 x 3 chunks is above `qy + 14`, no sky can arrive; if no emitting chunk holds an emitter, no block light can arrive; if neither is possible the cell is answered at once. Otherwise the reverse Dijkstra stops as soon as `15 - acc` cannot beat the found sky and block values (the first sky cell found is the best). `light.fast = false` is the plain search for tests. Resident chunks are not scanned (they count as "may have both").
- Window shift (`src/lighting.js`): `LightVolume.relightSteps` fills the air above each column in one call, compares columns four cells at a time before the cell-by-cell box scan, computes edge inflow with per-column neighbour offsets instead of a closure, and decodes queue indices with shifts and masks when `H` and `SIZE` are powers of two. `column()` reads `columnBlocks` through the opacity table. Same light, same returned box.
- Teleporter (`src/dimension-live.js`, `src/travel-loading.js`): finding for seed `walkperf31`. On the return trip the target window is already held (the resident cell the presolve fetched at the old overworld position), so there is nothing to merge with. The exit is built up to 16 blocks away and its window crossed into one more population cell (8 chunks of cell (0,-1)), which only `warmer.window(p)` in `main.js` asked for after the Teleporter had run (1.1-1.3 s). `window(x, z, spread)` now also asks, in lanes the needed units leave spare (max 3 lanes total, nearest to the target first), for the cells round every window an exit within `spread` (18) blocks could use. The fetch moves from after the Teleporter to before it; the second fetch is now 0 ms on all three seeds. The wall time does not shrink by much (the cell still takes about 1.2 s to generate; only the Teleporter's ~60 ms overlaps). A real cut needs the cell generated before the trip (during the portal wait) and kept across worlds, which was not attempted (cells are mutable world state; sharing them needs a proof they stay pristine).
- Worker cap (`src/mesh-pool.js`): re-measured, default `min(3, cores-2)` kept.

## Verification
`npm test`: 4874 tests, 4874 pass, 0 fail (load average about 30-50 at that moment). `npm run build`: built OK (chunk-size warning only). `git diff --check` clean.
New tests: `ring-light-search.test.js` (1,500 random cells, interior and rim columns, torches in a few columns: fast search equals plain search; also requires block-lit, sky-lit and rim cells in the sample), `relight-box.test.js` (random worlds with missing columns, torches, water, leaves: relight box equals a cell-by-cell diff and the relit area plus 14 equals a fresh build), `travel-loading.test.js` (+1, spread asks for neighbouring cells in spare lanes only). A one-off comparison of the old and new `relightSteps` over 3 random worlds, 6 random boxes and 4 border strips each: 0 mismatches in light and box.

Walk (`artifacts/b32-walkperf2/walk.mjs`, seed `walkperf31`, W held 120 blocks toward -x as batch 31 ran it, 1-minute load average from `uptime` at the start):
| run | load | frames over 50 ms | over 34 ms | max frame | ms in `shift` (CPU profile, whole walk) |
|---|---|---|---|---|---|
| before 1 | 4.9 | 1 | 1 | 50 | 151 |
| after 1 | 9.8 | 0 | 0 | 33 | 98 |
| after 2 | 8.9 | 0 | 0 | 33 | 98 |
`shift` is 7 shifts per walk, so about 21 ms each before and about 14 ms after (the relight part 87 ms to 63-70 ms). Node timing of one 31-column strip relight on a synthetic world: 31 ms before, 18-21 ms after. Total CPU in `RingLight.search` over the walk did not drop (910 ms before, 1090-1280 ms after; sampling noise and different mob positions): the walk's search cost is mob brightness reads at surface cells (`brightness` in `ai.js`) and bulk column light, which the shortcuts barely touch. In node, on the test world, the plain search takes 0.12 ms per surface cell (same with shortcuts) and 0.01 ms per underground cell (shortcuts: 2-4x faster). I did not reproduce the 25-35 ms `search` spikes at load 5-10; only one single batch 31 run had them.

Teleporter, seeds walkperf31, a2, b3, 4 trips each, `trip.mjs` (second fetch = `windowed - arrived`), return trips to the Overworld (the no-saved-portal case):
| | load | walkperf31 return | a2 return | b3 return |
|---|---|---|---|---|
| before | 60 / 43 / 33 | second fetch 1316 ms, wall 1.85 s | 1 ms, 1.84 s | 1 ms, 1.65 s |
| after | 21 / 18 / 17 | second fetch 0 ms, wall 1.75 s | 1 ms, 1.95 s | 0 ms, 1.54 s |
(another after run at load 100-145 gave walls of 2.2-2.7 s on all seeds: load, not the change.) The Nether trips still show a 0.55-1.1 s page-thread window build (no worker, noPrefetch); not touched.

Worker count (`workers.mjs`, 18 cores, load average 6.5-7.1 throughout, the lowest this shared machine reached; not idle), remeshing 64 columns, two rounds: 1 worker 712/677 ms, 2: 406/358, 3: 263/256, 4: 224/205, 6: 153/153, 8: 153/155. New-world load wall 1.56-1.77 s for every N. Cap of 3 kept: 4-6 workers would save 50-100 ms of a remesh that happens off the critical path, at more CPU contention with generation workers.

## Follow-ups (proposed gap lines)
- Ring-light bulk column light and mob-brightness `search` reads still cost about 0.3 ms per frame on average while walking (about 600 ms and 1000 ms of a 120-block walk); no spike above 34 ms reproduced at load 5-10.
- Teleporter exit without a saved portal still waits about 1.2 s for the exit's population cell; the cell can only be hidden by generating it during the portal wait and keeping it across worlds.
- Nether arrival windows (no worker) build on the page thread in slices, 0.55-1.1 s.
- Worker cap re-measured at load about 7 (not idle, 18 cores); no idle machine was available.
