# Batch 60 savedorder8: unload queue and the entities of unloaded chunks

## Summary
- `src/saved-order.js`: a chunk the player's square leaves is now only queued (`queue`, a `JavaHashSetOrder` keyed by the `Long.hashCode` x ^ z, inserted in the old square's x-outer / z-inner order). `unloadQueued` (ms.d) unloads at most 100 per call from the front of that set, marks them `out` and freezes the entities standing in them (`freeze`: a Set plus a per-chunk list; a mount and rider go together or not at all; what carries the player never freezes). A chunk that returns while still queued is taken off the queue and keeps its place (ms.c). One already unloaded reloads at the end (as in b59) and `thaw` re-stamps its entities in native order: chunks in load order, then section, then former list order, a rider with its mount (`loadOrder`), and re-files them as not moved. `liveOrder` drops frozen entities from the walk list. `trackChunkLoads` gets a 5th argument `flush` (default true: unloads at once, so older callers and tests are unchanged).
- `src/entities.js` (4 short hooks): `trackChunkLoads(..., false)`; `unloadQueued(this)` right after the spawner pass; `liveOrder` around the walk list; the spawner's mob count skips frozen entities.
- `tools/probes/SavedOrderLoginProbe.java`: `unloadMask` (skip the unload after chosen steps) and `recordSteps` (list after each step); three `saved-order8` scenarios. `tools/verify-saved-order.mjs` -> `public/research/saved-order8-reference.json`; earlier references regenerate unchanged.
- `src/savedorder8-b60.test.js`: replays the three scenarios and a 169-chunk queue check.

## Evidence
- Executed: real `PlayerManager.updateMountedMovingPlayer`, `ChunkProviderServer.unloadQueuedChunks` and the `removeAll` of `World.updateEntities`. queue-cancel: away and back before ms.d runs, nothing unloads. queue-delay: queued one step, unloaded the next, all back in load order. limit: view 6 and a teleport queue 169 chunks; the first ms.d call unloads 100 (entities of chunks 0..8 go, 9..11 stay), the second the rest; the port's HashSet model picks the same 100 (java8 HashMap; the JVM that ran the probe).
- Bytecode-read: `mt.b` (WorldServer.tick) runs the spawner (`aho.a`) and then `apu.d` (unloadQueuedChunks); `MinecraftServer` calls `mt.b`, then `mt.h` (updateEntities, which removes the unloaded list), then the tracker, per world. `ms.d` loops to 100 and takes `Set.iterator().next()` each time. `ms.c` (loadChunk) removes the key from `chunksToUnload`.
- Recalled: nothing relied on.

## Gap verdicts
- "Entities of an unloaded chunk are still kept and ticked": closed for ticking, counting (spawner cap) and walk order. The records stay in the port's lists, which is what the save writes, so a page reload keeps them.
- "The queue runs in the tick the chunk leaves, not the next": half wrong. Natively the move packet is handled in the network phase after the world tick, and the unload runs in the next tick's WorldServer.tick, after the spawner. The port's tickMobs sees the new position at the start of the same call that now runs the spawner and then the unload, so the entities are gone before the walk exactly as natively. What was missing is the 100 limit, the cancel on return and the position after the spawner; all added.

## Verification
- `node tools/verify-saved-order.mjs` (all earlier references unchanged, saved-order8 written).
- `node --test src/savedorder8-b60.test.js` 4/4. With saved-order, ring, dimension, entities, difficulty, tracker, spawner, headless, game-rules, spider and away tests: 425 pass, 0 fail. Mob, vehicle, boat, dimension, streaming globs: 603 pass, 0 fail. `npm run build` ok. Full npm test not run (batch rule). `server-mobs.js` has no test in this branch; it never sets `viewChunks`, so `trackChunkLoads` returns early and nothing freezes there.

## Follow-ups
- Not modelled: a frozen entity is still visible to collision pushes, AI target searches and the object tracker of a ticking neighbour near the boundary; the mob tracker still holds frozen mobs (they stand beyond the view square, so out of range for most view distances). Native sends a destroy and a new spawn packet and gives a reloaded entity a new id; the port keeps the id.
- The 100-per-call order assumes a Java 8+ HashMap; Java 6/7 iterate differently. `disableLevelSaving` and the dimension unload when no chunks remain are not modelled. The move rule's 8-block distance check (`managedPos`) is not modelled (b58 gap).
- Frozen state is not stored: after a page reload every saved entity loads (as the port always did), none is frozen.
- Browser checks: none run (batch rule); a long walk away and back with mobs left behind would show the live effect.
