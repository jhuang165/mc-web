# Batch 61 trackerorder: the away run's moving tracker ticks, and the entities of unloaded chunks

## Summary
- `src/away-trace.js` (new): `AwayTrace` samples every moving entity's tracker-visible fields (x, y, z, posY, mx..mz, vx..vz, yaw, pitch, rotationYaw/Pitch/Head, plus rises of airBorne and velocityChanged) after each entity tick of the away run, storing a sample only when something changed. `finish(pairs)` keys rows by the saved record's `ord`. `bindTrace`, `applyTick` and `restoreFinal` replay them on the main thread.
- `src/away-entities.js`: the run samples after each `tick()` and `finish()` returns `trace` (the groups/pairs are built before `stampSavedOrder`). `src/dimension-live.js`: `awayIdle` carries `trace`.
- `src/away-track.js`: `awayCatchUp` runs the first `trace.n` ticks with each entity in its state of that tick (entities not yet spawned are left out of that tick's lists, so an entity the run spawned gets its own age), then the rest of the trip at the final state, with the same long-trip reduction (`reduceIdleTicks`, exported from `entity-tracker.js`). `idleCatchUp` and `EntityWorld.idleTrack` take an optional `per(i)`.
- `src/saved-order.js`: `liveLists`; a thawed entity takes a new id (`renumber`: "mob-N", `entityId` or numeric `id`) in the stamp order. `src/entities.js` (3 one-line hooks): the mob tracker, the player push and `push` read `liveOrder(this, this.entities)`. `src/ai.js`: `entities()` is `liveOrder`. `src/main.js` (2 lines + import): `trackLists` and the `extraLists` hook go through `liveLists`.
- `tools/probes/SavedOrderLoginProbe.java`: `ids` (entityId before and after the path) for the saved-order8 scenarios; `public/research/saved-order8-reference.json` regenerated (other references unchanged).
- `src/trackerorder-b61.test.js` (new, 7 tests).

## Evidence
- Executed: SavedOrderLoginProbe `ids` on the unchanged classes. A chunk that is unloaded and loaded again gives every entity a new id, consecutive in the reloaded list's order (queue-delay 425..432 -> 433..440; limit 453.. -> 465..); a cancelled unload keeps all ids. Replayed by test 5.
- Executed (existing, b58): `idleUpdate` is the tracker tick with no player; the replay feeds it the per-tick states. Test 1 compares the replay with that tick run by hand over scripted per-tick states (entry counters, last sent x/y/z, yaw, pitch, head, motion, ages); the final-state run differs from it (the mutation).
- Bytecode-read (b58/b59/b60): MinecraftServer ticks every world's tracker; `mt.h` gates entities at 1200 ticks; World.unloadEntities removes the unloaded entities from loadedEntityList. Recalled: Chunk.onChunkUnload -> unloadEntities -> onEntityRemoved -> EntityTracker.untrackEntity (the destroy), and a reload's spawn packet through addEntityToTracker.
- Test 7 checks the port: the mob tracker drops frozen mobs and makes a new entry with the new id on return. The destroy is queued in the next tickMobs tracker pass (the port's "previous tick's end state" convention).

## Gap verdicts
- Tracker moving ticks: closed for the entities the worker moved and kept. Own age for entities spawned in the trip: closed (survivors only).
- Saved order, frozen entities in pushes, AI searches (`ai.entities()`) and the mob/object trackers: closed. New ids on reload: closed (the stamp order assigns them).

## Verification
- `MC_RESEARCH=.../tools/research node tools/verify-saved-order.mjs` -> all references written, earlier ones unchanged.
- `node --test src/trackerorder-b61.test.js` -> 7 pass.
- Targeted set (tracker*, dimension*, away-*, entity-tracker*, object-tracker*, trackeridle-b59, awaytracker-b60, saved-order*, savedorder*, ring*, mpmobs-b59, mpmobs2-b60, trackerorder-b61): 529 of 530 pass; the one failure was the 50 ms timing test of mpmobs-b59, which passes alone (10/10). Mob, ai, entities, dimension, village, boat and minecart globs: 851 of 852; `ai.test.js` "damaged cow flees" failed under parallel load and passes alone (12/12).
- `node --check` on each touched file; `liveLists` is imported at module scope in `main.js` and `mobs` is the function-scope variable the neighbouring hooks already read. `npm run build` ok. Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Entities that died during the trip are not replayed (they are not restored), so they take no HashSet slot. A rise of airBorne/velocityChanged is recorded only the first time (nothing in the run clears the flag). Hanging entities are static and not sampled. Entities the worker did not simulate (outside the 32-block rule, bosses, riders held back) keep final state, which is also theirs natively.
- Ids of a rider and its mount follow the stamp order, not the NBT creation order, when they sit in different sections.
- Frozen entities are still seen by arrows, explosions, item pickups and merges, cart/boat pushes, village searches and `withBalls` consumers other than the three paths above. Frozen mobs' pending leash or rider links are unchanged.
- Page reload keeps no trace and no frozen state (unchanged).
- Needs a browser look: first relative-move packets of a moving item or arrow after a Nether round trip; a mob at the unload edge disappearing and reappearing.
