# Batch 58 savedorder6: seated taker, away falling stamps, chunk load history

## Summary
- `src/mob-riding.js` (`releaseStaleRiders`), `src/entities.js` (one call after `releaseDead`), `src/boats.js` (`mount`): clicking a boat that carries a mob now seats the player (b57 freed the mob and seated nobody). At the mob's turn the stale pair is cleared (`boat.passenger`, `mob.ridingEntity`) and the boat's rider slot is dropped. The player is let go in the same pass when the mob is before him in the list (`EntityWorld.beforePlayer`), one pass later when he is before the mob.
- `src/away-entities.js`, `src/away-world.js`, `src/saved-order.js` (`restoreExtraOrder`): the away run's falling blocks join the stamped groups (`attachFalling`; `finish().falling` carries the stamped records; away-world saves those instead of a fresh `falling.serialize()`). Their records' stamps are restored on the next run.
- `src/saved-order.js` (`trackChunkLoads`), `src/entities.js` (one call per tick): the chunks the player's movement loads are numbered in load order (view square x outer, z inner; a chunk that left and returns takes a new place). The save walk ranks a chunk outside the login frame by that number, before the old first-entity fallback.
- `tools/probes/SavedOrderLoginProbe.java` (`moveX/moveZ`, 4 `saved-order6` scenarios), `tools/verify-saved-order.mjs` -> `public/research/saved-order6-reference.json`, replayed by `src/savedorder6-b58.test.js`. `src/saved-order-b57.test.js` and `src/vehicle-riders.test.js` updated for the seated taker.

## Evidence
- Executed: `b58so-move-east`, `-east-sections`, `-move-diagonal`: login, then the real `PlayerManager.updateMountedMovingPlayer` (mq.d) over the unchanged ChunkProviderServer; the new square's chunks load x outer, z inner and append to loadedEntityList. Executed: `b58so-away-falling` (grid, nobody logged in, falling blocks among the kinds, filed by section).
- Bytecode-read (b57, reused): World.updateEntities clears `mount.riddenByEntity` and `entity.ridingEntity` for an entity whose mount does not list it. The player is in the same loadedEntityList, so he is let go at his own turn; same-pass versus next-pass follows the list order. Not executed (the player is a stand-in in the probes).
- Recalled: nothing relied on. Not modelled: the port frees the player at the start of the pass, not at his exact turn; unloading a chunk (the port keeps those entities) and the 100-ticks-per-pass unload queue.
- Gap (3) as worded was right for chunks the player moved into; for the reload natively only the login frame loads, so the order of later chunks only matters for the live list.

## Verification
- `node tools/verify-saved-order.mjs`: 7 + 13 + 9 + 10 + 10 + 4 scenarios; the b52 to b57 references regenerate unchanged.
- `node --test src/savedorder6-b58.test.js` 9/9 (falling stamp, reload restore, 3 move scenarios, re-entry, 3 seat cases).
- `node --test src/mob-*.test.js src/entities*.test.js src/boats*.test.js src/saved-order*.test.js src/savedorder6-b58.test.js src/away-*.test.js src/vehicle-riders.test.js src/dimension-*.test.js src/vehicle-sim*.test.js src/streaming-*.test.js`: all pass (447 in the main run).
- `npm run build` ok. Full npm test not run (batch rule).

## Follow-ups
- The player's exact turn inside the pass (he is freed at the pass start).
- Chunk unloading is not modelled in the load history; entities of a left chunk keep their old rank.
- The away-reload test's cow does not survive the bare test world (harness, unrelated).
