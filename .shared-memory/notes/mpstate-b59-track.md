# Batch 59 mpstate: Survival state for dedicated server players

## Summary
- `src/multiplayer/server-survival.js` (new): `ServerSurvival` runs each non-Creative server player's real `Survival` with the single-player code: `tickPlayerEnvironment` (Survival.tick: regeneration, starvation by difficulty, void, drowning, suffocation, fire, effects) and `finishPlayerMovement` (walk/sprint exhaustion, landing from the simulation's own `fallDistance`/`landedFall`, fall damage). Death builds the CombatTracker component (`deathComponent`) and queues `{type:'death', id, component}`. `finishEating` calls `Survival.eat` when the server's use timer ends. `respawn` resets vitals, effects, combat and position. `status` builds the S06-style `{type:'health', health, food, saturation, ate?}` message when health, food or "saturation is 0" changed. `applyHealthMessage` is the client half. `vitalsOf` is what the saved record carries.
- `src/multiplayer/simulation.js`: constructor option `difficulty` (default 2) and `serverSurvival`; the tick runs `serverSurvival.tick` after `movePlayer` (a dead player gets idle input and its queued actions are dropped); the old void teleport now applies only to Creative players; eating calls `finishEating`; `savePlayer` carries the vitals.
- `server/server.js`: `difficulty` option and `--difficulty`; routes `respawn`; sends `health` per tick.
- `src/server-broadcast.js`: `drain` passes the event's component to `death`.
- `src/multiplayer/client.js`: `onHealth`, `respawn()`, health is buffered while terrain loads.
- `src/main.js`: applies the message to the HUD (`renderVitals`), opens the death screen at health 0, sends respawn, keeps the inventory over a connection (no server drops yet).
- `src/mpstate-b59.test.js`: 12 tests.

## Evidence
- Bytecode-read (javap on `mw` = EntityPlayerMP): `onUpdateEntity` (`mw.i`) sends `ib` (S06: health, food, saturation) when getHealth, food level or (saturation == 0) differs from the stored last values, then stores them. `status` repeats that rule.
- Executed (existing, reused unchanged): the single-player rules carry executed records (player-damage, fall, starvation, FoodStats). No new Java probe, since the server code path is the same functions.
- Recalled: the S06 health-0 death screen on the client; C16 respawn handling.
- Found while testing: Peaceful with food 0 still takes starvation damage above 10 health in the port's rule (`starvationHurts`), offset by Peaceful regeneration; the test uses a full stomach for the Peaceful check.

## Verification
- `node --test src/mpstate-b59.test.js`: 12 pass.
- 115 test files that mention multiplayer, simulation, server-broadcast, server or main.js (including mpstate-b59): 1139 run, 1139 pass. `npm run build` ok. Full npm test not run (batch rule). No browser check.

## Follow-ups
- Only a browser could show the HUD hearts and food bar update, the death screen and the respawn button.
- No hurt sound, hurt tilt or heart blink on the client (those tick only in the local survival tick); no inventory or XP drop on death; no hunger/poison effects from food reaching the client; milk does not clear effects; no death handling for mobs (mpmobs).
- `ate` makes the client remove one eaten item. If mpitems makes the inventory server-authoritative, drop that field to avoid a double decrement.
- Dead players are not removed from other clients' presence.
- Live ledoge0 server not touched.
