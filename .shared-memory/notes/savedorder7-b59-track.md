# Batch 59 savedorder7: chunk unloading in the load history, the taker's exact turn

## Summary
- `src/saved-order.js`: `trackChunkLoads` takes a `keeps(cx, cz)` rule. A chunk the player's square leaves is marked unloaded unless `keeps` holds it (`nearSpawn`: centre within 128 blocks of the spawn on both axes, Overworld only; null for the Nether and End). An unloaded chunk that returns takes a new load number and joins `again`, which now outranks the login-frame rank in the save walk. A kept chunk keeps its old place on return (b58 wrongly renumbered it).
- `src/entities.js`: passes the rule (spawn point, cached) to `trackChunkLoads`; the stale-pair release moved from the pass start into the loop. At each mob's turn `clearStaleRider` clears its pair; at the player's place in the list (first entity not before him, else after the loop) `releaseSeats` frees the taker. A mob before him frees him in the same pass, one after him in the next.
- `src/mob-riding.js`: `clearStaleRider`, `releaseSeats` (`releaseStaleRiders` stays for the old tests).
- `tools/probes/SavedOrderLoginProbe.java`, `tools/verify-saved-order.mjs` -> `public/research/saved-order7-reference.json` (4 scenarios), replayed by `src/savedorder7-b59.test.js`.
- `src/savedorder6-b58.test.js`: the away-reload test shifts the chunks 3 east so the cow (x -14) stays inside the bare world; every order is now checked.

## Evidence
- Executed: walk far and back with the real `PlayerManager.updateMountedMovingPlayer`, `ChunkProviderServer.unloadQueuedChunks` (ms.d) and the `loadedEntityList.removeAll(unloadedEntityList)` of World.updateEntities. Spawn (170,0): chunks 0..2 unload and reload at the end (x outer, z inner), 3 and 4 keep their place. Spawn (0,0): nothing unloads. Nether-like provider: all five chunks reload.
- Bytecode-read: `ms.b` (unloadChunksIfNotNearSpawn: the 128 rule, only when the provider canRespawnHere), `ms.d` (up to 100 per call, skipped when level saving is disabled), `apx.d` (onChunkUnload hands each section list to World.unloadEntities), `ahb` removeAll at updateEntities, `mr.b` (PlayerInstance removal calls ms.b).
- Recalled: nothing relied on. The player stand-in stays in his first chunk in the probe, so it unloads with it (the `-1` is missing from those records; the test ignores it).

## Verification
- `node tools/verify-saved-order.mjs`: 7+13+9+10+10+4+4 scenarios; earlier references regenerate unchanged.
- `node --test src/savedorder7-b59.test.js` 7/7; with the mob, entities, boats, saved-order, away, vehicle, dimension, streaming test globs: 601 pass, 0 fail. `npm run build` ok. Full npm test not run (batch rule).

## Follow-ups
- The port keeps the entities of an unloaded chunk live and ticking (natively they leave the list, and the chunk is saved to disk); only their rank is modelled. The queue runs in the tick the chunk leaves (native: the next server tick, 100 per pass).
- The unload keeps no `disableLevelSaving` switch; the near-spawn rule uses the stored spawn, not a changed one mid-run.
- Not modelled: an entity of an unloaded chunk that is riding or being ridden across the boundary.
- Browser checks: none run (batch rule); a long walk away and back in a real world would show the live order.
