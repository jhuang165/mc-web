# Batch 70 particles70: snowshovel, cloud and footstep particles; witch sounds

## Summary
- `src/snow-cloud-particles.js` (new): EntitySnowShovelFX, EntityCloudFX and EntityFootStepFX (constructors, onUpdate, footprint alpha and quad).
- `src/fx.js`: `snowshovel`, `cloud` and `footstep` join `KINDS`/`make`/`step`; footstep is layer 3; snowshovel and cloud use the reddust render scale (`base * clamp(t * 32)`); new `closestPlayer` (optional `fx.nearestPlayer()` hook, 2-block test) for the cloud's pull.
- `src/mooshroom-golem-live.js`: `tryBuildGolem` spawns the 120 `snowshovel` of BlockPumpkin.onBlockAdded when a snow golem is built (World.rand = `fx.worldRandom`). No edit to `main.js`.
- `tools/probes/SnowCloudParticleProbe.java`, `tools/verify-snowcloud-particles.mjs`, `public/research/snowcloud-particle-reference.json`, `src/snow-cloud-particles-b70.test.js`.

## Evidence
- Executed (SnowCloudParticleProbe on the unchanged classes through RenderGlobal.doSpawnParticle, 17 records): 12 constructor and full-lifetime tracks (snowshovel x4, cloud x6 incl. 3 with a player in `World.playerEntities`, footstep x2), 4 renderParticle draw records (snowshovel, cloud), and the footstep lifetime (dies on its 200th update, never moves). The replay matches every tick and vertex.
- Probe found a mistake in my first reading: EntitySnowShovelFX passes its velocity to the EntityFX constructor and adds it again after `* 0.1F`; the cloud passes zeros. Fixed.
- Bytecode-read: snowshovel (bkw): grey `1 - (float)(Math.random() * 0.3F)`, scale `* 0.75F * arg` (arg 1), life `(int)((int)(8 / (r * 0.8 + 0.2)) * scale)`, texture 7 down to 0, gravity 0.03, drag 0.99, 0.7 on ground. Cloud (bks): same with scale 2.5F, life divisor `r * 0.8 + 0.3`, drag 0.96, no gravity, `getClosestPlayerToEntity(this, 2.0)` pulls posY by 0.2 of the gap to the box minY and motionY by 0.2 toward the player's. Footstep (bkg): `textures/particle/footprint.png`, layer 3, own counter to 200, `renderParticle` alpha `min(1, 2 - 2t^2) * 0.2`, flat 0.25 quad, colour = block brightness, blend 770/771 (draw needs GL, bytecode only; the asset `public/media/1.7.10/particle/footprint.png` exists).
- Callers, bytecode-read by scanning every class of the jar for the three strings: only `BlockPumpkin.onBlockAdded` (amw) names "snowshovel" (snow golem branch only, 120 times at `x + r, y - 2 + r * 2.5, z + r`). "cloud" and "footstep" appear only in `RenderGlobal.doSpawnParticle` (bma): no 1.7.10 code spawns them and there is no `/particle` command, so they are unreachable natively. They are ported and routable through `fx.spawn` but nothing calls them, correctly.
- Witch sounds, bytecode-read of EntityWitch (yp): living `mob.witch.idle`, hurt `mob.witch.hurt`, death `mob.witch.death`. The 1.7.10 asset index (`tools/research/assets-1.7.10.json`, 686 objects) has no witch entry, so those events resolve to nothing. The gap "witch is silent" is therefore not a port bug: the native witch is silent too (parity.md already said "1.7.10 ships no witch sounds"). No sound files added. Not touched: the `witchMagic` particle in EntityWitch.onLivingUpdate (also named in the sweep, outside this brief).

## Verification
- `node --test src/snow-cloud-particles-b70.test.js` 9/9 pass.
- `node --test` on extra-particles, fx-draw, fx, mooshroom-golem, mpgolems-b66, portal-particles, particles and the new file: 87/87 pass.
- `node --check` on fx.js, snow-cloud-particles.js, mooshroom-golem-live.js. `npm run build` run once (see lead report).
- Full npm test not run (batch rule). No browser checks.

## Follow-ups
- The footprint is not drawn: nothing spawns it, so no layer-3 mesh or texture binding exists (data model, alpha and quad are ported and tested).
- `fx.nearestPlayer` is not set by `main.js` (the cloud has no caller); set it if a caller appears.
- A browser could show the snow golem build burst (120 grey puffs on a 2.5-block column); not checked.
- `witchMagic` particle still absent.
