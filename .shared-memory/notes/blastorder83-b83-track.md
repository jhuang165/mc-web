# Batch 83 blastorder83: a blast hurts one entity list in the world's list order

## Summary
- **One ordered list.** `Explosion.doExplosionA` (`agw.a()`) fetches one list (`World.getEntitiesWithinAABBExcludingEntity`, once) and walks it by index. Each entity gets its attackEntityFrom and then its push before the next entity starts. The port used to go kind by kind (mobs, then items, orbs, arrows, ...). It now builds one row list and sorts it with `candidate-order.js` `orderTargets`. The order is chunk x, then chunk z, then the vertical slice, then insertion order.
  - `src/explosion-extras.js`:
    - New helpers `blastNear`, `blastRow` and `runBlastRows`.
    - Row builders: `fireballRows`, `rocketRows`, `eyeRows`, `hookRows`, `knotRows`.
    - The b82 entry points (`explodeFireballs`, ...) remain as wrappers.
  - `src/explosion-simulation.js`:
    - New `mobRows`, `nonLivingRows`, `tntRows` and `finishBlastRows`, plus `vehicleRows`, which replaces `explodeVehicles`.
    - `applyExplosion` builds mob, non-living, TNT and player rows (the player is keyed `"player"`, with its eye at feet + 1.62f) and runs them in one pass.
    - `explodeNonLiving` and `explodeMobs` keep their signatures. Each runs its own rows in the same order.
  - `src/multiplayer/server-mobs.js` `explode`: the same single list, with one row per view's player (the hurt, the Blast Protection scale, `knock`).
  - Each row's run rechecks `dead` and computes its impact at run time.
    - A crystal or TNT cart earlier in the list explodes inline at its turn. Its nested blast reads the world as it is then.
    - The entities it kills are skipped later, because native code skips the hurt of dead non-living entities.
    - Entities born during the blast (a kill's loot, a broken cart's item) are not in the list, because rows are collected before the first hurt. This replaces the b82 `itemsBefore`/`orbsBefore`/`primedBefore` snapshots.
  - One `explodeOne` each was split out of `explode` in `item-entities.js`, `experience.js`, `bow.js`, `projectiles.js`, `falling.js` and `hanging.js`. Each `explode` now loops over `explodeOne`, and the behaviour is unchanged.
- **The walk's y for TNT and falling blocks.** The probe showed that the entity list files EntityTNTPrimed and EntityFallingBlock by posY, which is the box bottom + 0.49 (yOffset = height/2). `candidate-order.js` now has `walkedY`, used by `stampWalked`, which adds `Math.fround(0.49)` for those two shapes.
- **The away run.** `away-entities.js` `self.explode` now passes the run's `minecarts` and `boats`, plus `vehicleDrop: dropVehicle`, so a blast in the away run hurts, pushes and breaks carts and boats, and the drop appears at once. The run holds no eyes of ender (they stay in the dimension's saved record) and no fishing hooks (the angler is absent), so neither can be wired.
- **Replay fix.** EntityListProbe's world double keeps one flat list, so `entity-list-replay.js` `replayEntityList` sets `candidateOrder.flat` while it replays.
- **Old test updated.** `explosion-simulation.test.js` asserted the kind-by-kind order, and its "mob.damage" check was vacuous (an indexOf of -1). It now checks only what native code fixes: `player.damage < brokenTool < mob.hazard < burst`.

## Evidence
- **Executed:** `tools/probes/BlastOrderProbe.java`, run by `node tools/verify-blast-order.mjs`, writes `public/research/blast-order-reference.json` (400 records, with class sha256s).
  - It uses real chunks (`ChunkOrderProbe.CW`, apx with its 16 vertical lists) and the unchanged `agw.a()`.
  - The entities are real EntityItem, EntityXPOrb, EntityArrow, EntityTNTPrimed, EntityEnderCrystal and EntityPlayer, each logging when it is not dead and then calling the real attackEntityFrom.
  - `newExplosion` is overridden to run the crystal's nested doExplosionA one level deeper.
  - The scenes are random (`new Random(83)`): 3-8 entities near a chunk corner and a slice border, some resliced after they join.
  - 252 scenes nest a crystal blast, and 350 scenes break the old kind order.
- **Bytecode-read** (`javap -c -p`, 1.7.10 jar):
  - `agw.a()` 618-958 is one `ahb.b(Lsa;Lazt;)` call and an index loop with no isDead check of its own. Inside the loop: distance, eye, density, then `sa.a(ro, F)` and the motion push.
  - `wz.a(ro, F)`: if !isDead, setDead, then `ahb.a(Lsa;DDDFZ)` createExplosion(null, posX, posY, posZ, 6, true) inline.
- **Port-read:** the away run's systems (no eyes, no hooks), `server-hanging.js` (`this.h`, `drops()`), and `main.js` `explodeAt` (it already passes rockets, eyes, hooks, carts, boats and vehicleDrop).

## Verification
- `node --test --test-timeout=600000 src/blastorder83-b83.test.js`: 5 pass. The tests cover:
  - Every probe record replayed through `applyExplosion` with real port entities and nested size-6 crystal blasts, 0 mismatches. Two degenerate scenes are left out: a player whose eye sits exactly on a crystal centre, where the probe's EntityPlayer eye convention differs from the port's EntityPlayerMP.
  - The records discriminate: more than 100 scenes break the kind order.
  - A chunk -1 crystal hits before a chunk 0 item, and the item dies in the inner blast.
  - A server blast hits in the order TNT, player, item.
  - The away run breaks a cart and a boat with an immediate drop (a control without TNT keeps them). The test fails when the wiring is removed.
- Neighbour batches with `--test-concurrency=2`: 77 explosion, away, order, entity and replay files, 574/574 pass. A second batch of 1278 tests (mobs, server, vehicles, projectiles, the End, trackers) passes 1278/1278. The final blast and away set passes 141/141.
- `npm run build`: OK.
- No full `npm test`, and no browser checks.

## Follow-ups
- Port arrows do not set velocityChanged when a blast hits them. Native `sa.a` calls setBeenAttacked.
- The port's crystal uses `y` as posY. The probe's player is an EntityPlayer, not an EntityPlayerMP, which is the reason for the two excluded scenes.
- Hanging drops in single player are drained later in the tick, not at once. The server drains them at once.
- The dragon row sorts by the dragon's body position. Natively each part is its own list entry. The parts are not stamped.
- Entities that were never stamped (systems without a walk stamp) sort by a fallback sequence, which is kind order among themselves.
- Eyes of ender and fishing hooks are not in the away run.
- Browser-only: how chained crystal and TNT blasts and their pushes look, and in what order.
