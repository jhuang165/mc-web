# Batch 67 mpvehiclehits: lightning on vehicles, snowballs on players, explosive silverfish, golem dust

## Summary
- `src/weather-simulation.js`: new `strikeThings({ items, orbs, minecarts, boats, hanging, arrows }, bolt)`: every thing in the bolt's box takes Entity.onStruckByLightning. `tickWeatherSimulation` takes an optional `things()` hook (single player: `main.js` passes items, orbs, minecarts, boats, hanging, arrows). The server calls it from `server-lightning.js` (its own item and orb lines moved into it).
- `src/explosion.js`: `explodeBlocks` returns `released` (the monster eggs it breaks, only when smoking). `explosion-simulation.js` (single player, and every caller with `mobs.spawnSilverfishAt`) and `server-mobs.js explode` spawn a silverfish at (x + 0.5, y, z + 0.5) for each.
- `src/mooshroom-golem-live.js` + `server-golems.js`: a golem snowball is stopped by a player on the server (`playerTargets` hook) and does nothing to it.
- `src/multiplayer/client-golems.js` (`golemDust`), `remote-mobs.js`, `main.js` (two `RemoteMobs` fx objects gain `blockParticle`): the walking dust of a remote golem copy.
- Test: `src/mpvehiclehits-b67.test.js` (8 tests). No new wire messages.

## Evidence
- Bytecode-read (javap, 1.7.10 jar): `sa.a(xh)` is dealFireDamage(5) (`sa.f`: attackEntityFrom(ro.a = inFire, 5) unless fire-immune), `++fire`, setFire(8) at 0. Boat `xi.a(ro,float)` and cart `xl.a(ro,float)`: damage += 10 x amount, break above 40 or by a Creative player, so 50 breaks both at once; the source is inFire and no player. The boat drops its item (`ade.az`), the cart `a(ro)`. TNT cart: EntityMinecartTNT.killMinecart explodes for fire damage (existing `killExtras`, source string `inFire`). Only `sa`, `wo`, `xz` override onStruckByLightning (batch 66).
- Bytecode-read: thrown entities (`zk` and subclasses) have no `a(ro,float)`, so `sa`'s runs: setBeenAttacked, returns false. Fireballs (`ze.a(ro,float)`) return false when the source has no entity. Arrows (`zc`) have no override. So "lightning hurts thrown projectiles" is found wrong: they take nothing; an arrow only gets the fire counter (fresh arrow: 1, not burning; implemented, harmless).
- Bytecode-read: paintings and frames (`ss.a(ro,float)` breaks on any damage; `st.a` drops a frame's item first) are broken by a bolt. Not in the brief; done for single player (`hanging.attack`). The server has no hanging entities.
- Bytecode-read: EntitySnowball.onImpact `zj.a(azu)` calls `attackEntityFrom(causeThrownDamage, 0)` (3 for `xx` blaze), 8 snowballpoof, setDead. `EntityPlayer.attackEntityFrom` (`yz.a(ro,float)`) has `if (amount == 0.0F) return false` after the difficulty scaling, before the super call, so a player takes no damage, no hurt time, no knockback and no velocity packet. The brief's "native knockback with zero damage" is a later version: found wrong. The server's thrown-ball hit already returned false for players; what was missing is that a golem ball flew through the player (native: collides, is consumed). Fixed.
- Bytecode-read: explosions do release silverfish. `agw` (Explosion) doExplosionB calls `aji.a(agw)` (canDropFromExplosion, `iconst_1`; `amb` does not override) then `aji.a(ahb,IIIIFI)` dropBlockAsItemWithChance for each block; `amb.a(ahb,IIIIFI)` spawns `yk` (silverfish) at (x + 0.5, y, z + 0.5), world.d(entity), then `yk.s()` (status 20 puff), when not remote, whatever the chance. So the batch 66 gap was right and the single player path missed it too. Fixed in both. The puff for the explosion case is sent by the server's `spawnSilverfishAt` wrapper as for player breaks.
- Bytecode-read: `wt.e()` (EntityIronGolem.onLivingUpdate tail) reads motionX/Z and Entity.rand with no isRemote test, and spawns `blockcrack_<id>_<meta>`; the client's motion is the S12 value with drag and the 0.005 clamp (ClientEntity.step), which is what `golemDust` reads.
- Executed: none new (no new probe); the single-player rules involved already have executed records (weather, silverfish, iron golem).

## Verification
- `node --test src/mpvehiclehits-b67.test.js`: 8 pass.
- One at a time: mplightning-b66 7, mpgolems-b66 13, silverfish 75, iron-golem 12, mpdispense-b61 15, weather-simulation 2, explosion 9, explosion-simulation 2, mooshroom-golem 9, explosion-entities 5, mpvehicles-b61 10, mpvehicles3-b63 13, mpmobs-b59 10, mob-lightning-b52 5, weather 25: all pass.
- `node --check` on every touched file. Full npm test not run (batch rule).

## Follow-ups
- A TNT cart killed by a bolt needs the cart's `host` (set by its first tick); a cart that never ticked kills without exploding (cannot happen on the live server).
- Single player and server arrows only get the counter; a thrown ball and fireballs are untouched (found wrong, above).
- Only a browser would show: the dust particles under a walking remote golem, the snowball vanishing at a player, silverfish puffs after a blast, a boat breaking in a storm.
