# Batch 72 projectiles6: native candidate order and the arrow trigger box

## Summary
- New `src/candidate-order.js`: the order `World.getEntitiesWithinAABBExcludingEntity` lists entities (chunk x, chunk z, vertical slice, insertion order). `stampEntity` models the re-slice after an entity's update (append to the new cell's list, including the unclamped-compare quirk above y 256 / below 0); `orderTargets` sorts candidates, stamping first-seen entities in list order and players ahead of everything. `candidateOrder.flat` is a test switch for replays of probes whose world double had one flat list.
- Hooks (small): `bow.js` (arrow sweep, `Arrows.collect`, `tickOne` stamp), `projectiles.js` (thrown sweep, `tickOne` stamp), `fireballs.js` (ball sweep, `pick`, `tickOne` stamp), `entities.js` (`EntityWorld.pick`, the mob punch pick).
- `Arrows.collect(box, survival, take, ridingBox)`: trigger box is the player's box grown (1, 0.5, 1), or with a living ridden entity the union grown (1, 0, 1); candidates are taken in native order. `entity-simulation.js collectArrows` passes the ridden cart/boat/mount box and uses the float box of `setSize(0.6F, 1.8F)` (`entity-simulation.test.js` expectation updated).
- Tests: `src/projectiles6-b72.test.js` (6). `projectiles5-b70.test.js` sets `candidateOrder.flat` for its flat-list pick replay.
- Probe/data: `tools/probes/ChunkOrderProbe.java`, `tools/verify-chunk-order.mjs`, `public/research/chunk-order-reference.json` (700 order scenes, 700 trigger scenes).
- Docs: Batch 72 lines in `bows.md` and `blaze-ghast.md`; Arrow and Fireball catalogue rows regenerated.

## Evidence
- Executed: unchanged `World.getEntitiesWithinAABBExcludingEntity` and `Chunk.getEntitiesWithinAABBForEntity` over real `Chunk` objects (real `addEntity` / `removeEntityAtIndex`); real `EntityFireball` boxes and `AxisAlignedBB`; real `EntityArrow.onCollideWithPlayer` on a real `EntityPlayer` and `InventoryPlayer`. Of 700 order scenes 517 are not in insertion order; the loop's pick is always the first candidate at equal distance.
- Bytecode-read (composed in the probe): the re-slice tail of `updateEntityWithOptionalForce` (`!addedToChunk || chunkX != floor(x/16) || chunkY != floor(y/16) || chunkZ != floor(z/16)` then remove + add) and `EntityPlayer.onLivingUpdate`'s trigger box (health > 0; ridden entity alive: `box.union(riding box).expand(1, 0, 1)`; else `expand(1, 0.5, 1)`); the `getMouseOver` entity loop.
- Found: `findSpecial` from a probe subclass calls the probe's super (a stub), so the real world method is reached through `privateLookupIn(ProbeWorld)`.
- Found: the player's native box starts `posY - 1.62f`, so a "feet" y carries a 5e-9 float offset; the replay applies it (the port's feet position has none).
- Found wrong (stale doc line): "fireball-versus-fireball collisions are not implemented" (`Fireballs.hitBall` exists).
- Recalled / not executed: order among other entity kinds sharing one pickup or sweep (items, orbs, vehicles).

## Verification
- `node --test src/projectiles6-b72.test.js` 6 pass; neighbours (bow, fireballs-*, blaze-ghast*, projectiles*, mpprojectiles*, pearl, entity-list, entity-simulation*, away-throws, player-throw*, skeleton-arrow-villager, object-tracker-hits and about 20 more) all pass; entities, entity-tracker and the pick tests (90) pass; catalogue-consistency + content-catalogue 6 pass.
- `node --check` on every touched file; `npm run build` once. Full npm test not run (batch rule).

## Follow-ups
- Server `collectArrows` (`server-dispense.js`) passes no ridden box; server players' vehicles are not wired.
- Mob cells are stamped lazily (at a projectile sweep or pick), not on every mob update; items, orbs and vehicles are not interleaved with arrows in one pickup order.
- Only a browser could show a punch or pickup tie in play.
