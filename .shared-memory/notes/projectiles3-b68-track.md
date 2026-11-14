# Batch 68 projectiles3: firework rocket collisions, mob and EntityPlayerMP throws at item frames

## Summary
- `tools/probes/FireworkCollideProbe.java` + `tools/verify-firework-collide.mjs` -> `public/research/firework-collide-reference.json` (31 records): the unchanged `EntityFireworkRocket` on the ParticleProbe world double with blocks (stone ceiling, upper and lower slab, fence, cobweb above and at the start, glass ceiling, six wall seeds per axis, void), server and client copies.
- `src/firework-rocket.js`: a rocket below y -64 is killed at the start of its update (`Entity.onEntityUpdate` void test), with no explosion and no status 17. Everything else already replayed exactly.
- `tools/probes/EntityListProbe.java`: additive `mthrow` spec kind (EntityThrowable built with a living mob as thrower) and `mthrow(...)` builder. `tools/probes/EntityThrowMobProbe.java` + `tools/verify-entity-throw-mob.mjs` -> `public/research/entity-throw-mob-reference.json` (12 records): mob-thrown snowball, egg, pearl, potion and exp bottle at an empty or loaded frame, plus a real `EntityPlayerMP` pearl at an empty or loaded frame.
- `src/entity-list-replay.js`: replays `mthrow` (additive; old records unchanged, b67 frame tests still pass). `src/projectiles3-b68.test.js`: 47 tests.
- `public/research/fireworks.md`: the "collisions are approximate" line replaced with the executed result.

## Evidence
- Executed: rocket against ceilings, slabs, fence, cobweb, walls (both axes, both signs), void: the port's particle mover matched every row at 1e-12 except the void. The rocket does collide (it is not noClip): it uses `moveEntity`, stops under a ceiling (motionY zeroed each tick), slides along walls, is slowed by a web, and still explodes at `life > lifetime`. A rocket hanging under a ceiling still draws its trail and bursts there.
- Executed: the void case. Native kills the rocket before its move on the tick it starts below -64 (record `void-edge` starts at -64.04: dead after one tick, the move still happens, state list empty so no 17).
- Executed: a living mob's snowball, egg and pearl at a frame: a held item is knocked out and the frame stays; an empty frame breaks and drops itself. The same as a dispenser's or a Survival player's. Potions (a witch's) and exp bottles splash at the frame and never touch it (held item stays, empty frame stays). The port already matched (snow golem snowballs go through `vehicleThrownHit` with no thrower).
- Executed: an `EntityPlayerMP` pearl at a frame: the frame outcome is the Survival one (item out / empty breaks), the thrower is put at the pearl's pre-move position (0.5, 3.2029850338063035, 1.5396019586102596 in the record) and takes 5.0 fall damage. The port already matched.
- Bytecode-read (batch 67 note, not redone): potion and exp bottle `onImpact` never call `attackEntityFrom`.
- Not probed: rockets in flowing water or lava (the world double has no fluids; `handleMaterialAcceleration` would push a rocket in flowing water) and rockets against boat or cart boxes. Recalled only: `Entity.onEntityUpdate` lava sets fire, and `attackEntityFrom` on a rocket does nothing.
- The cow shell stands in for a witch or snow golem as thrower: `EntityThrowable` and `EntityPotion` read only that the thrower is an `EntityLivingBase` (recalled/bytecode-read b67), so AI differences cannot change the frame outcome.

## Verification
- `MC_PROBE_LIBS=<netty-all 4.0.10, guava 17, log4j-api 2.8.1, commons-lang3 3.5> node tools/verify-firework-collide.mjs`: 31 records. `node tools/verify-entity-throw-mob.mjs`: 12 records.
- `node --test src/projectiles3-b68.test.js src/fireworks.test.js src/entityprobes2-b67.test.js src/entity-list.test.js src/away-throws.test.js src/ring-events.test.js src/object-tracker-extras.test.js src/mpprojectiles2-b63.test.js`: 217 pass, 0 fail.
- `node --check` on the touched JS; `npm run build` see the lead report. Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Rockets in flowing water and lava, and rockets against boat/cart boxes, still unprobed.
- Server frames (mppaintings) can reuse `entity-throw-mob-reference.json` as the expected outcomes for mob and player balls at frames.
