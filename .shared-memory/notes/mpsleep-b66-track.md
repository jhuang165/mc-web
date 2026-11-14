# Batch 66 mpsleep: beds and sleeping on the dedicated server

## Summary
- `src/multiplayer/server-sleep.js` (new): `ServerSleep` (`sim.sleep`) and `resetRainAndThunder(weather)`. Bed click (`use`), lying down (`enter`), `wake`, C0B 3 (`leave`), the all-asleep night skip (`worldTick`), the sleep timer (`tickPlayer`), damage wake (`attacked`, wrapped around `Survival.damage` in `join`), logout wake, `respawnPoint` (bed check at respawn), bobber targets (`fishTargets`, `fishHit`) and the presence field (`field`).
- `src/multiplayer/client-sleep.js` (new): `SLEEP_TYPES`, `remoteSleepPose` (renderer `sleeping` option for other players), `clientSleepTick`, `clientWake`, `sleepText`.
- `src/bed.js`: `ENTITY_MOB` and `mobInBox`. Single player used the wrong mob list (it blocked sleep for slimes and magma cubes, and missed blaze and wither). `main.js` `useBed` now calls `mobInBox`.
- `src/multiplayer/simulation.js`: one-line hooks only: `this.sleep`, `join`, `logout`, `worldTick` (right after `weather.tick`), `tickPlayer`, the bed click in `edit` before `containers.use`, `spawnForced` in add/save, `presence` field.
- `src/multiplayer/server-survival.js`: `respawn` uses `sleep.respawnPoint`; `tickPlayerEnvironment` gets `sleeping`. `server-end.js` `exitSpot` uses `respawnPoint`. `servercommands-b59.js`: `/spawnpoint` sets `spawnForced = true`.
- `src/multiplayer/server-mobs.js` `explode`: honours `ev.flaming` (fire on the opaque floor, one in three) for the Nether/End bed blast.
- `src/multiplayer/server-fishing.js`, `src/fishing-simulation.js`: other players are bobber targets; a zero-damage hit wakes a sleeper and never hooks.
- `server/server.js`: `sleepLeave`. `src/multiplayer/client.js`: queue and dispatch `SLEEP_TYPES` (`onSleep`). `presence.js`: `sleeping` pose. `src/main.js`: `client.onSleep = mpSleepMessage`, `bedWake` sends `sleepLeave` in multiplayer, `clientSleepTick` instead of `tickBed`, reset on connect.
- Wire messages: server to client `sleepIn {x,y,z,facing}` (S0A), `sleepWake {}` (S0B animation 2), `sleepMsg {key}` (`noSleep`, `notSafe`, `occupied`, `notValid`); client to server `sleepLeave` (C0B action 3). Other players see `sleep: [x,y,z,facing]` in the presence rows.
- For the `mplightning` neighbour: the night skip calls `resetRainAndThunder(sim.weather)` (exported from `server-sleep.js`). It uses `weather.resetRainAndThunder()` if the weather object has one, else sets `rainTime`, `thunderTime`, `raining`, `thundering` (never the strength fields `rain` and `thunder`, as `WorldInfo`). For `mpvillage`: no door code touched.

## Evidence
- Bytecode-read (javap on the 1.7.10 jar): `BlockBed.onBlockActivated` (head redirect, explosion branch `!canRespawnHere`, power 5 flaming and smoking at the head centre, occupied check against sleepers' bed locations, status to message mapping, TOO_FAR_AWAY and OTHER_PROBLEM silent); `EntityPlayerMP.sleepInBedAt` and `wakeUpPlayer` (S0A to trackers then self; S0B animation 2); `WorldServer.tick` (`areAllPlayersAsleep`, time `(t+24000) - (t+24000)%24000` only with doDaylightCycle, `wakeAllPlayers` = `wakeUpPlayer(false,false,true)`, `resetRainAndThunder`); wake flags (morning and leave bed set the spawn, damage and missing bed do not); `NetHandlerPlayServer` C0B action 3 and movement ignored while sleeping; `EntityPlayer.attackEntityFrom` (a sleeper is woken before the zero-amount refusal, so a bobber wakes it; spawn protection and `canAttackPlayer` refuse earlier); `ServerConfigurationManager.respawnPlayer` (`verifyRespawnCoordinates`, `+0.1` y, notValid via S2B 0, spawn dropped); `EntityMob` class hierarchy (slime, magma cube and ghast are not EntityMob).
- Found wrong in this port: single player blocked sleep for slimes and magma cubes and let blaze and wither sleep through; a `/spawnpoint` respawn used y exactly (native adds 0.1); the server had no beds at all (a bed click did nothing).
- Recalled, not read: mob targeting has no sleeping check (mobs target a lying player like a standing one, within the 8 x 5 x 8 refusal rule only for lying down); the Entity.yOffset and eye details of the lying box (the single-player mattress height 0.5625 is reused); the login wake of a saved sleeper.
- Executed: none (no Java probe this batch). The tests replay the bytecode-read rules against the port.

## Verification
- `node --test src/mpsleep-b66.test.js`: 17 pass, 0 fail (mob spawning is off in the fixture; a night mob made it flaky before). `npm run build`: ok.
- `node --test src/bed.test.js`: 7 pass. `src/mpstate-b59.test.js`: 12 pass. `src/tracker-respawn-b54.test.js`: 5 pass. `src/servercommands-b59.test.js`: 11 pass. `src/mpend-b63.test.js`: 5 pass.
- `node --check` on every touched file: ok. Every identifier the `main.js` hooks read (`bedSleep`, `hideBedScreen`, `enterSleep`, `thirdPersonView`, `saved`, `lastHealth`, `containerView`, `resume`, `screen`, `showChatLine`, `multiplayer`, `updateBedFade`) is module scope and already used by `useBed`/`bedWake`.
- Full npm test not run (batch rule).

## Follow-ups
- Weather order: the port runs the skip right after `weather.tick`, as native does, but the weather tick here re-rolls a zero rain or thunder time at once, where native rolls on the next tick. The clock is corrected (`nextMorning(time - 1) + 1`) so the result is 24001 as native.
- Nether and End players do not count toward the all-asleep rule (native: separate world, `playerEntities` of the Overworld only); a sleeper in another dimension cannot occur because beds explode there.
- A sleeping player's block clicks are not refused (native refuses most through `isMovementBlocked`); mob AI against sleepers is unchanged.
- Only a browser could show: the lying camera and fade timing on a connected client, the Leave Bed button and chat on the sleep screen, the remote player's lying model on a bed, the explosion fire and smoke of a Nether bed.
