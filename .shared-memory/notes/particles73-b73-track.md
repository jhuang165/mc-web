# Batch 73 particles73: fishing wake, mycelium/brewing/end portal display ticks, server crit animations

## Summary
- `src/wake-particles.js` (new) and `src/fx.js`: `wake` (EntityFishWakeFX). `src/fishing-simulation.js` no longer drops `wake`; the server fishing events (`fishFx`) now carry it to clients (comment in `server-fishing.js`).
- `src/block-display-b73.js` (new) plus one hook line in `src/display-ticks.js`: BlockMycelium `townaura`, BlockBrewingStand smoke, BlockEndPortal smoke.
- Dedicated server crit animations (S0B 4 and 5): `src/multiplayer/server-crit-fx.js`, `client-crit-fx.js`; wire message `pfx73` `{events:[{m,x,y,z,w,h,mx,my,mz}]}`. Hooks: `server-mobs.js attack` (also now passes the jump-attack `critical` so a server mob hit gets the native 1.5x damage, as single player already did), `server-pvp.js`, `client.js` (buffer plus `onCritFx73`), `main.js` (import and one `client.onCritFx73` line).
- Probe: `tools/probes/WakeParticleProbe.java`, `tools/verify-wake-particles.mjs` -> `public/research/wake-particle-reference.json`. Test: `src/particles73-b73.test.js`.

## Evidence
- Name list, bytecode-read (`javap -c` on `bma.class`, `doSpawnParticle`): hugeexplosion, largeexplode, fireworksSpark, bubble, suspended, depthsuspend, townaura, crit, magicCrit, smoke, mobSpell, mobSpellAmbient, spell, instantSpell, witchMagic, note, portal, enchantmenttable, explode, flame, lava, footstep, splash, wake, largesmoke, cloud, reddust, snowballpoof, dripWater, dripLava, snowshovel, slime, heart, angryVillager, happyVillager, plus the prefixes `iconcrack_`, `blockcrack_` and `blockdust_`. The brief's doubt is answered: `blockdust_` IS in 1.7.10 (it was already ported). Every name is now drawn by the port: only `wake` was missing (snowballpoof is in `object-tracker.js`, explosions in `explosion-particles.js`).
- Native callers, bytecode-read by scanning all 1789 classes for each string: `footstep` and `cloud` have no caller outside RenderGlobal (confirmed again, nothing to port); `wake` only in EntityFishHook; `snowshovel` only BlockPumpkin; `townaura` only BlockMycelium and RenderGlobal; `depthsuspend` WorldClient (already ported), `suspended` BlockLiquid (ported). Blocks overriding `randomDisplayTick` (`func_149734_b` in the srg): the port lacked Mycelium, BrewingStand and EndPortal; now added.
- Executed: WakeParticleProbe through the unchanged RenderGlobal.doSpawnParticle (6 records, every update to death); replay matches position, motion, texture (19 + k%4), box shrink, lifetime.
- Bytecode-read only (no probe): the three display ticks (draw order and float arithmetic from `amd.b`, `ajq.b`, `akt.b`); S0B 4/5 origin (EntityLivingBase.attackEntityFrom returns false on a client world, so the client never makes crits itself and NetHandlerPlayClient does it from the packet); `EntityCrit2FX`.
- Recalled: the S0B animation also goes to the attacker (func_151247_a sends to the tracker and the entity itself).

## Verification
- `node --test src/particles73-b73.test.js` 6/6. Neighbours (fishing-simulation, fishing, fx, fx-draw, mpmobs-b59, mpmobs2-b60, mpreach71-b71, particle-settings, snow-cloud-particles-b70, b64-lead, mpstats*, pvp-b63, void-fog): 138 pass, 0 fail.
- `node --check` on every touched file. `main.js` identifiers: `applyCritFx` (imported), `client`, `scene` (in scope at the neighbouring `client.onPiston` line).
- Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Server crit target is a snapshot (native Crit2FX follows the live entity for its 3 ticks).
- Server mob attacks still pass no sprint knockback or attacker slowdown (not in this brief).
- Browser only: the look of the wake sprites (particles.png 19..22) and the mycelium aura.
- The furnace display tick assumes the front faces +z (existing note in display-ticks.js), untouched.
