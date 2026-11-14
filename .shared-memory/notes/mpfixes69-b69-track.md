# Batch 69 mpfixes69: pistons break hanging entities, summon tag coordinates in the End, eggs past the mob cap, sleeper posY

## Summary
- `src/piston-push.js` `pistonPushExtras`: paintings, item frames (`game.hanging()` = the dimension's `Hanging`, `Hanging.push` kills with `onBroken(null)`; `game.hangingDrops()` drains) and leash knots (`mobs.knotList`, `knotKill`) are pushable entries. Any non-zero delta breaks them. `src/multiplayer/server-pistons.js` passes `hanging`/`hangingDrops` (the dimension's `sim.vehicles.hanging`); `src/main.js` passes `hanging: () => hanging` (one property; the frame loop already drains the drops).
- `src/multiplayer/server-summon.js`: `tagToLocal(tag, ox, oz)` copies the data tag and maps `TileX/TileZ`, the `Leash` compound's `X/Z` and `xTile/zTile` (not when -1) by the End origin, also down the `Riding` chain. Y is not shifted. Overworld and Nether (origin 0) pass the tag through.
- `src/multiplayer/server-use.js` and `server-dispense.js`: the `MOB_LIMIT` refusal is gone for spawn eggs (block click and dispenser). The new mob gets `summonKeep` (use: `mobSpawned` hook; dispenser: the returned entity). Unsupported kinds still refuse.
- `src/sleeper-eye.js` `aimOriginY`; `src/multiplayer/simulation.js` (`aimCell`, `edit`): a sleeper's server ray starts at posY (minY + 0.2); the dig and place distance gates get posY (`serverPosY`). `src/ai.js`: `PlayerView.posY` (minY + 0.2 lying); `distSq(o)` and `closestVulnerablePlayer` read it.
- Test: `src/mpfixes69-b69.test.js` (9 tests).

## Evidence
- Bytecode-read (1.7.10 jar, `javap -c -p`): `ss` (EntityHanging) `g(DDD)` (moveEntity) and `d(DDD)` (addVelocity): if not `world.isRemote`, not dead and dx*dx+dy*dy+dz*dz > 0: `setDead()` then `onBroken(null)`. `su` (EntityLeashKnot) onBroken is empty (b68 note), so a knot drops nothing. EntityPainting/EntityItemFrame onBroken drops, as `Hanging.broken` already ports. TileEntityPiston moves every entity in the box (b67 read, no type filter).
- Bytecode-read: `nh.a(ji)` (C07 digging, status 0): d = (posX - (x+.5), posY - (y+.5) + 1.5, posZ - (z+.5)), refused above 36.0: posY of the player, constant 1.5, no 1.62. `nh.a(jo)` (C08 place): `mw.e(x+.5, y+.5, z+.5) < 64.0` (getDistanceSq from posY). So the gates read posY; for a sleeper posY = minY + 0.2 (`yz.a(III)` yOffset 0.2, b68 read). The port's `digAllowed`/`placementOutcome` already take the player position, so only the argument was wrong.
- Bytecode-read: `sv.l(float)` (getPosition) returns (posX, posY, posZ) at partial 1.0. The native client's ray (EntityRenderer mouse over) starts there, and the client's posY is its eye (yOffset 1.62) standing and 0.2 above the box while lying. The port's server ray is the stand-in for the client aim, so a sleeper's ray origin is posY (minY + 0.2), not minY + 1.62. The previous batch note said a native client ray had no server counterpart; the origin is now matched.
- Recalled (not re-read): `ItemMonsterPlacer.spawnCreature` and `BehaviorDispenseSpawnEgg` call `ItemMonsterPlacer.spawnCreature`, which has no natural spawn cap test (the cap lives in `SpawnerAnimals`). `CommandSummon` reads tag keys through the entity classes' readEntityFromNBT, which use the tag values as absolute native coordinates.
- Not executed: no new Java probe.

## Verification
- `node --test src/mpfixes69-b69.test.js`: 9 pass. One at a time: `mppaintings-b68` 12, `summon2-b68` 8, `pistons5-b68` 12, `fixes68-b68` 7, `mppistons-b66` 8, `ai` 12, `piston-live` 193, `mpsleep-b66` 17, `mpsleep2-b67` 5, `mpsummon-b67` 15, `mpdispense-b61` 15, `mpuse2-b65` 27, `spawn-eggs` 15, `mpspawners2-b65` 9, `player-throw-replay` 2: all pass. Full npm test not run (batch rule). No browser check.

## Follow-ups
- Mob distance for a sleeper: only `distSq` and `closestVulnerablePlayer` read posY. Box-based checks (attack reach, sweeps) still use the 0.2 box at minY, which is native (box-based).
- Entity clicks (`server-vehicles.js` and `server-mobs.js` reach) still measure from `position.y + 1.62`; native `C02` uses `getDistanceSqToEntity` (posY to posY). Not changed here.
- A boat pushed by a piston is not blocked by hanging entities (native `EntityBoat.getCollisionBox` returns any entity's box); not modelled.
- Summon `xTile/zTile` mapping and the leash knot mapping are covered by unit tests only (arrows stuck in the End were not run end to end).
- Only a browser would show: a frame popping off a pushing piston, the item entities appearing.
