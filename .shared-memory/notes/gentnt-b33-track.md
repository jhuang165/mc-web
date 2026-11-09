# Batch 33 track gentnt: generated primed TNT and one shared tick tree

## Summary
- Primed TNT from generation: powered TNT in population callbacks (`tntPowered`, `world.primedTnt`) now becomes a live EntityTNTPrimed. The streamed cell records `primedTnt` (`{x, y (box centre), z, fuse}`); `restorePopulationColumns` / `claimFreshColumns` / `materializeFresh` hand it to the live `primed` list (buffered in `genPrimed` in `main.js` because the hand-off runs before the saved `tnt` list is read at load). Motion uses the port's own random through `primeTnt`; natively it is `Math.random` (bytecode-read), so nothing replayable exists and the record stores no motion. Saves and `exportJavaSave` use the existing `tnt` record (`PrimedTnt` with `Fuse`/`Pos`/`Motion`). Area and whole-save imports append the entities to `out.tnt`. No generated structure that primes TNT was found (callbacks searched, not every seed), so this is tested with synthetic population areas.
- One shared tick tree: `TickTree` / `attachTickTree` in `src/tile-ticks.js`. Fluids, fire, falling blocks, redstone and ForeignTicks keep their own lists but share one creation counter and are taken together in native tree order (time, priority, creation id) under one 1000 cap, take-all-then-run, as `WorldServer.tickUpdates` does. Each system was split into begin/take/run/end pieces; its standalone `tick()` is unchanged (away-world, multiplayer simulation and tests). `world-tick.js` uses `systems.tickTree` when given; `main.js` creates it after the redstone restore (4 small hunks).
- Saves: optional `n` (shared creation id) on fluid, fire and falling envelope entries only while the tree runs; `p` unchanged; older saves without `n` load and are numbered by (due time, priority, kind) at attach. `tileTickRows` breaks equal time/priority ties by `n` when present.
- Native evidence: `public/research/tile-ticks-reference.json` (6 `tick` cases, mixed kinds 8/12/51/93 in one real TreeSet) replayed through the coordinator; no new Java probe was needed. Block-tick bodies remain bytecode-read.
- Docs: Batch 33 paragraph in `public/research/region-import.md`.

## Verification
- Focused: tick-tree.test.js (7), generated-tnt.test.js (3), imported-population.test.js, fluids/fire/falling/redstone-live/redstone/tile-ticks/scheduled-ticks/world-tick/away-world/ring-ticks tests all pass (209 tests across those files before the last tileTickRows test).
- `npm test`: 4910 tests, 4910 pass, 0 fail. `npm run build`: succeeds (only the existing chunk size warning).
- Benchmark `artifacts/b33-gentnt/tick-tree-bench.mjs` (fluids + falling + fire, pending 0 to 8000): per-tick cost of the tree and of the separate ticks is equal within noise (machine was shared, runs varied by +-1 ms; e.g. 8000 pending: separate 1.9 / 2.1 / 1.9 ms, tree 1.7 / 2.3 / 2.0 ms). An early version was slower at big backlogs because of `Array.shift`; fixed with an index.
- Browser (muted headless Chrome, `?silent`, port 5355): new world loads, 70 ticks in 3.5 s, a sand block set 6 above ground fell and landed, water placed next to air spread, no page errors. One console "404" resource message appeared with no matching URL in the response log; not investigated.

## Follow-ups (proposed gap lines)
- Away-world still ticks fluids, fire, falling and redstone on their own lists, not through the shared tree.
- Fluid and fire scene observers flush when the running kind switches, not per native neighbour update.
- Redstone and foreign saved order across kinds relies on `n` only for fluid, fire and falling; redstone `serial` is not saved as `n` (its export order stays by list).
- Generated primed TNT is only tested synthetically; no generating structure was shown to produce it, and its motion cannot match native (Math.random).
- Render-side check of the shared tree on a world with more than 1000 simultaneous due entries was not done in the browser.
