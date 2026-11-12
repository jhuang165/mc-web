# Batch 48 pistonpush track

## Summary

Branch `batch48-pistonpush`, cut from 61e069a4a (release 0.76.0). Evidence labels: executed = run on the unchanged obfuscated 1.7.10 jar through `tools/probes/EndermanWolfProbe.java`; bytecode-read = read from the classes, not run.

- New record set `b48pp` (flag B48, `public/research/enderman-wolf-b48pp-reference.json`, 25 records, executed). The probe world holds a real `TileEntityPiston` (aps) in a `BlockPistonMoving` cell (script op `t piston x y z facing extending storedId storedMeta [renderHead]`), runs `tile.h()` after the mob updates and before the server copy's update (World.updateEntities, then the network tick), and records each tile's progress and lastProgress (row element 9). It reuses the b47sp harness (client position `cl`, C03 rule, server copy put back after its update, row element 8 = copy position).
- Mobs (executed): cow, pig, zombie, horse, calf, two mobs in one cell, a cow at the box edge, across two tiles, against a wall and a ceiling, lifted, pushed down, a retracting tile, a piston head as the stored block. Native timeline: the extending tile pushes 0.5625 on its first two ticks and 0.25 on its third (which uses the progress-0 box, so only an entity still in the cell is hit again); a retracting tile pushes only that last 0.25.
- Server copy (executed): a copy under a push is moved by the same tile loop (`aps.h` -> World.getEntitiesWithinAABBExcludingEntity includes the EntityPlayerMP copy, `sa.d` moves it). The port never pushed the copy; now `piston-live.js` `candidates()` adds `entities.serverPlayer()` and `piston-push.js` `pushServerPlayer` runs the shared `moveEntity` on it (sneak edge guard, wall stop, lift, motion and onGround written back). Its own `onGround` now persists from `serverPlayerUpdate` (executed: the sneak edge guard of the next push needs the flag the copy's last update left; the C03 flag only overrides it on a packet tick).
- `EntityWorld.tick` calls `this.afterEntities?.()` just before `serverPlayerUpdate`, so a harness (the b48pp replay) can run the tile loop between the entity updates and the copy's update.
- Replay (`src/enderman-wolf-replay.js`) drives a `RedstoneWorld` with `installPistons`, `setMovingBoxes` and puts the stored block back in the cell map when a tile finishes; the cell holds block 130 (world.js PISTON_MOVING) meanwhile so pathfinding sees it. Note `redstone.js` PISTON_MOVING is the original id 36, `world.js` PISTON_MOVING is the port id 130; tile.block is an original id.
- All 25 records replay with no divergence. Older sets b42, b43, b44, b45, b45cw, b46mp, b47sp, b47h dumped with the new probe are byte-identical to the dumps from the old probe.
- b46mp replay hacks (`hurtByTime = clock + 1`, `sent = null` for non-b47sp): kept. Dropping them needs b46mp regenerated with the b47 client separation and a counted ticksExisted, which rewrites all 19 records' scripts (its `move` ops place the copy itself) and gives records that are b47sp records by another name. Not worth the churn; the hacks are labelled in the replay.
- Row 6 (copy onGround at update start) in b48pp is read after the tile loop moved the copy, so the replay uses it only on ticks with no push; on push ticks the copy's own flag is the input.

## Verification

- `node --test src/pistonpush-b48.test.js`: 27 pass (25 records, coverage check, no-world push).
- Targeted `node --test` on ai, enderman-wolf-b42/b43/b44, entities, horse-ride-b47, mobpush-b46, piston-*, pistons, pistonpush-b48, serverplayer-b47, structure-*: see the commit message of the final commit for counts.
- Not run: full `npm test` (by instruction). No browser check: live piston behaviour is unchanged except the copy now being pushed (not visible).

## Follow-ups (proposed gap lines)

- Live tick order (bytecode-read): the port's `tickWorldSystems` runs the piston tile loop (main.js) before the mob update; the original runs entities, then tile entities. A mob standing in a moving cell therefore sees the push one update earlier live than in the b48pp records, which the replay orders correctly through `afterEntities`. Fixing it needs a main.js hook after `tickLivingSimulation` and a split of `endTick`.
- b48pp covers only the cell-by-cell push; mobs carried by a block they stand on (pistons moving a slime/honey-less block under a mob's feet) and the first-tick `getCollidingBoundingBoxes` with block 36 for large mobs (giants, dragon) are not recorded.
- Chest under a sitting cat (optional goal 4) was not done.
- b46mp stays on the hacks above; regenerating it is optional clean-up.
