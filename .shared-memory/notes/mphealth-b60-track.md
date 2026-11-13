# Batch 60 mphealth: hurt feedback, death drops, effects and the player list over a connection

Worked in the harness's own worktree (branch `worktree-agent-ab2fb7a15a815d946`, cut from 94684b989) because the sandbox refused git in `wt60-mphealth`; the branch name `batch60-mphealth` was already taken by that folder.

## Summary
- `src/multiplayer/client-health.js` (new): client half. `setClientHealth` is `EntityPlayerSP.setPlayerSPHealth` (first update only sets; a rise sets hurtResistantTime 10; a drop sets 20, applies the client `damageEntity(generic)` reduction by Resistance, protection enchantments and Absorption, and `hurtTime` 10). `applyHurtMessage` (S19 status 2 and 3: sounds, counters, and on death without keepInventory the client copy of inventory and XP is emptied). `applyEffectMessage` / `applyEffectEnd` (S1D / S1E). `tickClientHealth` runs the counters Survival.tick would (the connected client skips it): hurtTime, hurtResistantTime (heart blink), updateCounter, effect durations.
- `src/multiplayer/server-survival.js`: `outgoing(p)` returns `healthHurt`, `healthEffect`, `healthEffectEnd` messages; hurt sounds queued by `Survival.damage` are drained before the tick clears them. `dropOnDeath`: Notch apple, `InventoryPlayer.dropAllItems` through the single-player `ItemEntities.dropPlayer` (so `ServerItems` world drops), XP orbs at deathTime 20 (`min(level*7,100)`, doMobLoot, none under keepInventory, none if the player respawns first). `respawn` clears the pending XP and resets XP when keepInventory is off. `finishDrinking` (milk). `applyHealthMessage` now delegates to `setClientHealth`.
- `src/multiplayer/remote-death.js` (new) and `presence.js`: another player's copy tilts 20 ticks (renderer `deathTime`), draws the 20 explode particles and hides until the respawn.
- Hooks: `simulation.js` (presence `dead`, milk call), `server/server.js` (one send line), `server-items.js` (dead players collect no orbs and cannot pick up), `client.js` (`onHealthFx`, buffering), `main.js` (import, `applyHealthFx`, per-tick `tickClientHealth` line, XP/inventory death handling skipped locally over a connection).
- Wire messages: `healthHurt {hurt?, die?, keep?}`, `healthEffect {id, amplifier, duration, ambient}`, `healthEffectEnd {id}`.
- `src/mphealth-b60.test.js`: 18 tests.

## Evidence
- Bytecode-read (javap, 1.7.10 jar): `bjb.a(ib)` calls `bjk.n` (setPlayerSPHealth) then food level and saturation; `bjk.n` first-update branch and `blk.n` rules above; `sv.a(byte)` status 2 (limbSwingAmount 1.5, hurtResistantTime 20, hurtTime 10, hurt sound) and 3; `mn.b(sa, ft)` -> `my.b(ft)` sends S19 to the trackers and to the EntityPlayerMP itself; `yz.a(ro)` (EntityPlayer.onDeath: Notch apple, `yx.m` dropAllItems unless keepInventory, death motion); `yz.e(yz)` (0 under keepInventory) and `sv.aF` (onDeathUpdate: at deathTime 20, `!isRemote`, `doMobLoot`, XP split orbs at posX/Y/Z, then setDead).
- Player list: found wrong. `ho` (S38) is built only in `oi.c(mw)` (two sites), `oi.e(mw)` (logout) and `oi.e()` (ping update); `oi.a(mw,int,boolean)` (respawnPlayer) builds none. A dead player stays in the tab list natively. The port's list is `multiplayer.players` (presence), which was already right; what was wrong is that the dead model kept standing for others, now fixed.
- Recalled: EntityPlayer.damageEntity's order (resistance, enchantments, absorption) on the client; S1D / S1E timing (new, changed, every 600 ticks, finished); ItemBucketMilk.onEaten (bucket back, clearActivePotions). No Java probe was run (an `EntityPlayerSP` needs a full Minecraft instance).
- Not executed: the client `damageEntity` reduction. If the client's armour is not mirrored (mpinventory), protection enchantments cannot apply there yet.

## Verification
- `node --test src/mphealth-b60.test.js`: 18 pass.
- 61 test files that mention multiplayer/, server/server, server-broadcast or main.js (includes mpstate, mpitems, mpmobs, mpcontainers, mpsurvival): 535 run, 535 pass after moving the main.js hook onto its own line (`mpsurvival-b58` matches the dig line by text).
- `npm run build` ok. Full npm test not run (batch rule). No browser check (batch rule).

## Follow-ups
- Only a browser could show: the camera tilt, heart blink, hurt sound and effect HUD over a connection; the remote corpse tilt and poof.
- The client's S19 also sets limbSwingAmount 1.5 and the other-player hurt tint (status 2 for a remote player); not drawn.
- Beacon `effect` messages (old) still have no client handler, the new `healthEffect` diff covers beacons, eating, milk and `/effect`.
- Effect `performEffect` is not run on the client (regeneration and poison on the client copy would heal or hurt locally natively; the server health wins at the next S06).
- Dead server player: the port keeps the player entity; items thrown from other sources and the cursor stack are not dropped (the cursor is not mirrored yet). Death from a mob lags the die message by one server tick.
- Saved player records still carry no effects.
