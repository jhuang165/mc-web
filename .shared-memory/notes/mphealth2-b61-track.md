# Batch 61 mphealth2: other players' hurt, client effects, saved effects, S1D burst, same-tick death, cursor and grid at death

## Summary
- `src/multiplayer/remote-hurt.js` (new) and `presence.js`: S19 status 2 on another player's copy sets `limbSwingAmount = 1.5` and `hurtTime = 10` before the copy's tick; the renderer tints while `hurtTime > 0` (9 rendered ticks). `simulation.js` `presence()` adds `hurt: true` for the tick of a fresh hit (read from `p.vitals.hurt`, which `outgoing` clears after the broadcast).
- Hurt sound for others: `ServerSurvival.takeHurt` queues an S29 (`game.player.die` if the hit killed, else `game.player.hurt`; volume 1, pitch `(r - r) * 0.2 + 1` from `sim.soundRand`) to everyone near except the victim, through `deliverSounds`. `main.js` `MP_SOUNDS` gets both names (one line).
- Same-tick death: `ServerSurvival.settle(p)` runs after the mobs and actions (`simulation.js`, one loop line before `deliverSounds`): drains hurt, calls `die` when health is 0. A mob blow landed after the player's own tick, so the die message, drops and S19 status 3 came one tick late.
- Saved effects: `vitalsOf` adds `effects` (Id, Amplifier, Duration, Ambient in HashMap order, `Effects.serialize`) and `absorption`. The Survival constructor already reads both back, so a rejoin keeps them and the welcome `self` carries them.
- S1D burst: `outgoing` walks `effects.ordered()` (HashMap order). A join starts with nothing sent, so its first `outgoing` is the burst. `ServerSurvival.resendEffects(p)` repeats the burst on the next `outgoing`; mpnether should call it after a dimension change. Respawn sends none (see Evidence).
- Cursor and 2x2 grid: `respawn` calls `discardWindow(p)`, which empties them without a drop (see Evidence: native does not drop at death).
- Wire: no new message names. Presence entries get an optional `hurt`; `sound` messages carry the two player sounds.
- Tests: `src/mphealth2-b61.test.js` (8).

## Evidence
- Bytecode-read (javap, 1.7.10 jar): `sv.a(byte)` status 2 (limbSwingAmount `aF` = 1.5, hurtTime `ay`/`ax` = 10, sound via `a(String,F,F)`); `EntityOtherPlayerMP` = `bll` (overrides only attackEntityFrom, onUpdate `h`, `e_`; no playSound); `yz.a(String,F,F)` -> `ahb.a(yz,String,F,F)` -> `bma` (RenderGlobal) `a(yz,String,DDDFF)` is an empty body, so the copy plays no hurt sound; the sound others hear is the server's own `sv.a(ro,F)` playSound (`aU` death sound if health <= 0, else `aT` hurt, `bf()` volume) = S29 to all near except the victim.
- Bytecode-read: `rv.a(sv,int)` (Potion.performEffect): regeneration and instant health call `sv.f(F)` (heal); poison, wither, instant damage call `sv.a(ro,F)`; saturation is guarded by `ahb.E` (isRemote). `bjk.f(float)` (EntityPlayerSP.heal) is an empty method; `sv.a(ro,F)` returns false when `ahb.E`. `sv.aO` (updatePotionEffects) removes a finished effect only when `!isRemote`; `rw.a(sv)` (PotionEffect.onUpdate) runs performEffect on isReady then counts down. `yz` calls `zr.a(yz)` (FoodStats.onUpdate) only when `!isRemote`. So the client's performEffect changes nothing visible (hunger's addExhaustion is the only effect and nothing reads that exhaustion on a client). Gap "the client does not run performEffect": found wrong in effect; the port's `tickClientHealth` (durations only) already matches. Pinned by a test.
- Bytecode-read: `oi.a(ej,mw)` (login) and `oi.a(mw,int)` (transferPlayerToDimension) each end with a loop over `mw.aQ()` (getActivePotionEffects) sending `in` (S1D); `oi.a(mw,int,boolean)` (respawnPlayer) has no such loop and `mw.a(yz,boolean)` (clonePlayer) copies no effects (it only resets lastExperience/lastHealth/lastFoodLevel to -1 so the next S06 is sent).
- Bytecode-read: `mw.a(ro)` (EntityPlayerMP.onDeath) and `yz.a(ro)` only call `yx.m` (dropAllItems: main and armour slots); `closeContainer` (`mw.m`) is called only from NetHandlerPlayServer (C0D and one more handler); `oi.a(mw,int,boolean)` does not call it. So native neither drops the cursor (`InventoryPlayer.itemStack`) nor the 2x2 grid at death or respawn: they are lost with the old entity's container. Gap "drop them via inv.close": found wrong; the port now discards them at respawn instead.
- Recalled (not read): the client death screen's container close (GuiContainer.onGuiClosed) drops client-side only and `EntityPlayerSP.joinEntityItemWithWorld` is empty; ActiveEffects NBT field types (Id byte, Amplifier byte, Duration int, Ambient byte); the port's save record is JSON with the same field meanings (as `Survival.save`).
- Not executed: no Java probe this track (an EntityPlayerSP needs a full client); everything above is bytecode reading and node tests.

## Verification
- `node --test src/mphealth2-b61.test.js`: 8 pass.
- 54 test files (those mentioning multiplayer/, server/server, server-broadcast, main.js, plus status-effects.test.js): 596 run, 596 pass.
- `node --check` on each touched file ok; `main.js` change is a string in an existing Set, no new identifier.
- `npm run build` ok. Full npm test not run (batch rule). No browser check (batch rule).

## Follow-ups
- Only a browser could show: the remote copy's red tint and arm swing after a hit, the heard hurt sound, the death tilt timing.
- An open chest or station window of a dead player is still kept by the port after respawn (natively it is orphaned with the old entity); only window 0's cursor and grid are discarded. The cursor held in a chest window is not discarded.
- mpnether: call `serverSurvival.resendEffects(p)` after a dimension change.
- The hurt sound pitch uses `sim.soundRand`, not a per-entity Random.
- Hunger's client-side exhaustion is not mirrored (invisible).
