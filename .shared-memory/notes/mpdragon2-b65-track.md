# Batch 65 mpdragon2: dragon and eye of ender loose ends on the server

## Summary
- Crystal fire (found wrong in single player): `ender-crystal-mobs.js` now explodes with `flaming: false` (comments in `ender-crystal.js` too). `end.test.js` updated. The server already set no fire (its explode path ignores `flaming`), so the server was right by accident; single player had set fire in the blast.
- Dragon egg on the server: new `src/multiplayer/server-egg.js` (`serverDragonEgg`, uses `teleportEgg` from `dragon-egg.js`). Hooks in `simulation.js`: right click in `edit()` (not when sneaking with an item), and a Survival punch in `handleDig` status 0. Works in any dimension (it uses the clicker's world).
- Particle trail for the egg: NOT sent (native does not send it, see Evidence). The clicking client already draws its own trail (`clientDragonEgg`).
- Dragon block destruction: no break particles to send (found wrong, see Evidence). No code change.
- Credits wait: `server-end.js` `conquer` calls `removePlayer` on the End's mobs. The waiting player is out of the End mobs' views (no targets, no explosion or wing hit, no dragon push) until `finishCredits` moves them.
- Eye of ender: `ChunkProviderHell`/`End` return null, so the existing "Overworld only" rule in `server-eyes.js` is right (no edit there). The trail: `client-dispense.js` calls a new `eyeTrail` hook for every `eyeOfEnder` row each tick (motion = position delta); `eye-of-ender-live.js` `spawnEyeTrail` draws the portal particle (or 4 bubbles in water); `main.js` hook line plus import.
- Test: `src/mpdragon2-b65.test.js` (5).

## Evidence
- bytecode-read (javap on the 1.7.10 jar, obf names): EntityEnderCrystal.attackEntityFrom (`wz.a`) calls `ahb.a(Lsa;DDDFZ)` = World.createExplosion, which is `newExplosion(..., flaming false, smoking flag)` (`ahb.a(sa,D,D,D,F,Z)` pushes iconst_0 before the `ZZ` call). The old comment said `newExplosion(..., true, true)`.
- bytecode-read: BlockDragonEgg `akp.m` (func_150018_e): 1000 tries, nextInt(16)-nextInt(16), nextInt(8)-nextInt(8), nextInt(16)-nextInt(16); first cell with Material.air; `if (!world.isRemote)` setBlock(meta, flags 2) + setBlockToAir, `else` 128 "portal" particles (client world only, from the client's own random). `onBlockActivated` (`a(ahb,III,yz,I,F,F,F)`) and `onBlockClicked` call `m`. Particles are never sent by the server, and other players see none.
- bytecode-read: `ItemInWorldManager.func_73074_a` (`mx.a(IIII)V`): in Creative it returns early (tryHarvestBlock) before `onBlockClicked`; Survival calls it. So only a Survival punch moves the egg.
- bytecode-read: EntityDragon.func_70972_a (`xa.a(azt)Z`) clears cells with `ahb.f` (setBlockToAir) after the mobGriefing check; there is no `playAuxSFX`/`func_147480_a` call. Only a `largeexplode` `spawnParticle` (a no-op on the server). So no break particles natively; listed gap found wrong.
- bytecode-read: `EntityPlayerMP.func_71027_c` (`mw.b(I)V`), branch dimension 1 to 1: awards theEnd2, `ahb.e(this)` (World.removeEntity), sets `playerConqueredTheEnd`, sends S2B state 4. `removeEntity` also removes the player from `playerEntities`. A removed entity is not ticked by the world, so mobs cannot see or hit it.
- bytecode-read: `aqv.a` (ChunkProviderHell) and `ara.a` (ChunkProviderEnd) `func_147416_a` are `aconst_null; areturn`.
- bytecode-read: EntityEnderEye.onUpdate (`zd.h`): the homing motion is behind `isRemote == false`; the bubble/portal particle code follows on both sides (the server's spawnParticle does nothing), so the client copy draws the trail.
- executed here: only the JS tests below. No new Java probe (facts above are read from bytecode, not run).
- recalled: nothing new.

## Verification
- `node --test src/mpdragon2-b65.test.js`: 5 pass. `mpdragon-b64` 6, `mpend2-b64` 6, `b64-lead` 1, `end` 12, `crystal-fire-b57` 3, `mpend-b63` 5, `mpdispense-b61` 15: all pass (one file per command). `npm run build` ok. `node --check` ok on touched files. Full npm test not run (batch rule).
- `main.js` scope: `spawnEyeTrail` is imported from `eye-of-ender-live.js` (exports it), `scene` is module scope.

## Follow-ups
- The conquered player is not ticked natively at all; here only the End mobs' views drop them (other damage such as a void fall still applies to the waiting player).
- The eye copy's trail uses the position delta as motion and ignores water (portal particles only). A browser would show the trail's look and density.
- Dragon kills still feed no statistics beyond the b64 lead's onDeath chain.
