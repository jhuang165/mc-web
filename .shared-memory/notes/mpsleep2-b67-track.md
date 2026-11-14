# Batch 67 mpsleep2: sleeper actions, weather re-roll order, mobs and sleepers

## Summary
- `src/bed.js`: `BedSleep.boxY` = posY - yOffset = bed y + 0.7375 (was the mattress top 0.5625 in b66).
- `src/multiplayer/server-sleep.js`, `src/main.js` `enterSleep`: the lying player is placed at `boxY`.
- `src/ai.js` `PlayerView`: `sleeping` flag; width and height 0.2 while lying (0.6 x 1.8 otherwise). Set by `server-mobs.js` (`p.sleeping`) and by `living-simulation.js` from `state.sleeping` (`main.js` passes `bedSleep.sleeping`).
- `src/mpsleep-b66.test.js`: the position assertion follows the new height.
- New `src/mpsleep2-b67.test.js` (5 tests). No weather code changed. No new wire messages.

## Evidence
- Bytecode-read: `NetHandlerPlayServer` (`nh`) has no `isPlayerSleeping` test in C07 digging, C08 placement, C02 use entity, C09 held item, C0E window click or chat. The only tests are in the C03 movement handler (a sleeper's packet only runs `onUpdateEntity` and resets the position; the fly and moved-wrongly checks are skipped) and C0B action 3. The callers of `Entity.isPlayerSleeping` in the jar: `EntityPlayer.isMovementBlocked`, `attackEntityFrom`, `onUpdate`, `sleepInBedAt`, `BlockBed`, `EntityPlayerMP.wakeUpPlayer`, `EntityTrackerEntry`, `WorldServer`, `NetHandlerPlayServer` C03, and client classes (GuiSleepMP opening, renderers). `isMovementBlocked` is read only in `EntityLivingBase.onLivingUpdate` (zero strafe, forward, jump).
- Bytecode-read: `EntityPlayer.onUpdate` sleep branch wakes only for a missing bed (`wakeUpPlayer(true,true,false)`) or daytime (`(false,true,true)`); no monster test. `trySleep` is the only monster check (EntityMob in 8 x 5 x 8).
- Bytecode-read: no AI or `World.getClosestVulnerablePlayer` class calls `isPlayerSleeping`; mobs target a sleeper like any player. What differs is the size: `sleepInBedAt` does `setSize(0.2, 0.2)`, `yOffset = 0.2`, `setPosition(x+0.5.., y+0.9375, ..)`, so the box is y+0.7375 to y+0.9375.
- Bytecode-read: `World.updateWeather` (`ahb.o`): a time at or below 0 is re-rolled in that call and not decremented; otherwise it is decremented and the flag toggles at 0. `WorldServer.tick` (`mt.b`) calls `ahb.b` (which runs it) before the sleep skip. After the reset the next tick re-rolls, as the port does.
- Executed: none (no Java probe: updateWeather needs a World; the bytecode is short and fully read).

## Verification
- `node --test src/mpsleep2-b67.test.js`: 5 pass. `mpsleep-b66` 17, `bed` 7, `weather` 25, `weather-simulation` 2, `mplightning-b66` 7, `ai` 12, `living-simulation` 4: all pass, one file at a time.
- `node --check` on touched files ok (`bedSleep` is module scope in `main.js`). `npm run build` ok. Full npm test not run (batch rule).

## Follow-ups
- Gap 1 found wrong: native does not refuse a sleeper's block clicks, digging, item use or attacks on the server (the client simply has the sleep screen open). Only movement is refused, and the port already did that (`movePlayer` sleeping branch, the server holds the body still).
- Gap 2 found wrong: the port already re-rolls on the tick after the reset, same as native. The b66 note's claim was mistaken.
- Gap 3: no sleeper-specific mob AI exists natively; the port now gives mobs the 0.2 x 0.2 box and position. Mob attack reach and line of sight use `PlayerView.width/height/y`; other call sites that hard-code 1.8 for the player (explosion box in `server-mobs.explode`, bobber boxes already 0.2) are not changed.
- `PlayerView.y` still trails the client by the C03 packet rule; the eye height stays 1.62 above `y` (EntityPlayerMP.getEyeHeight is a fixed virtual).
- Only a browser could show: the lying model height and camera after the 0.175 rise of the body position, and zombies' reach on a sleeper in play.
