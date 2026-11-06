# Mob footsteps

Before this change (after 0.43.0, not yet released) only spiders played a step sound; every other mob walked silently. `src/mob-steps.js` now ports the tail of `Entity.moveEntity` and the per-class `func_145780_a` overrides, and `EntityWorld.walk` (entities.js) calls it right after each mob's `moveEntityWithHeading`.

## Rules ported

- `canTriggerWalking` and not riding. Only the silverfish turns it off (its own step override is dead code), so it stays silent.
- `distanceWalkedOnStepModified += sqrt(dx² + dy² + dz²) * 0.6` in float32, where `dy` counts only when the block 0.2 below the feet is a ladder (`countsVertical`). The mob's `nextStepDistance` starts at 1; neither value is saved (not in the NBT either).
- When the distance passes `nextStepDistance` and the cell at `floor(y - 0.2)` (yOffset 0 for mobs) is not air, `nextStepDistance = (int)distance + 1`. The distance keeps growing over air, so a landing steps at once.
- In water the mob plays its swim sound and then `func_145780_a` as well (bytecode: both calls are in `Entity.moveEntity`, the step is just silent over a liquid cell); the swim sound is: `game.hostile.swim` for `EntityMob` subclasses (`isEntityMob`: zombie, pigman, skeleton, wither skeleton, spiders, creeper, enderman, silverfish, witch, blaze, wither; not slime, magma cube, ghast or golems), `game.neutral.swim` otherwise, volume `min(1, sqrt(mx² * 0.2 + my² + mz² * 0.2) * 0.35)`, pitch `1 + (rand - rand) * 0.4` from the entity's own Random.
- On land: zombie `mob.zombie.step`, skeleton `mob.skeleton.step`, spider and cave spider `mob.spider.step`, pig/cow/sheep/chicken `mob.<name>.step`, all 0.15 at pitch 1; iron golem `mob.irongolem.walk` at volume 1. Creeper, villager and witch have no override, so they play `Entity.func_145780_a`: the SoundType of the stepped block at volume × 0.15 and its frequency, the snow type under a snow layer, nothing over liquids (`footstepSound` in block-sounds.js).

- Pigmen play the zombie step and wither skeletons the skeleton step (subclass / `EntitySkeleton` type 1). Horses (`horseStep`): wood blocks give `mob.horse.wood`, everything else `mob.horse.soft` (volume and pitch of the block's SoundType); a ridden horse, zombie horse or skeleton horse (not donkey or mule) counts steps in an unsaved counter: steps 1-5 `wood`, then `gallop` on every third step and silence between. The horse checks its own block for liquid, so a snow layer over water stays silent for horses but not for other mobs.

## Evidence

`tools/probes/MobStepProbe.java` + `tools/verify-mob-steps.mjs` write `mob-steps-reference.json` (1120 records, 32 mob kinds) from the unchanged client JAR (SHA1 `e80d9b3b...`): each mob is built by `EntityList.createEntityByName` and the probe records `canTriggerWalking` and the swim sound, `func_145780_a` on 13 blocks with and without a snow layer above, 200 ticks of the real `Entity.moveEntity` at 0.1 blocks/tick (the ticks that played a sound; every walking mob steps at ticks 16, 33, 50, 66 ... and ends at distance 12.0, nextStep 13) and `EntityLivingBase.fall` at seven distances. `src/mob-steps.test.js` replays all of it. Findings the old port had wrong: slime and magma cube are not `EntityMob` (neutral swim and fall sounds); the swim sound does not replace the step; pigmen, wither skeletons and horses had no step table entry (horses played the block sound); donkeys and mules never gallop.

Fall sounds (already in `damage-fx.js`, checked here): `ceil(distance - 3)` points; `game.hostile.hurt.fall.small` / `.big` for `EntityMob`, `game.neutral.hurt.fall.*` otherwise (big above 4 points; the reference samples 1, 2, 7 and 17 points, so the exact boundary is the existing `damage-fx.js` rule, not re-probed), volume and pitch 1, then the mob's hurt sound, then the landing block's step at volume x0.5 and pitch x0.75. Chicken, bat, ocelot, snow golem, iron golem and magma cube do not react to falls (confirmed silent in the reference). Horse falls stay in `horse-reference.json`.

## Limits

Not covered: the fence/wall/fence-gate rule (the step uses the block below those; fences are not blocks here), the swim bubbles/splash particles that accompany the in-water step, dying mobs moving through `dying()` (they step only when `walk` runs for them), step sounds while a mob rides a cart, and zombie steps on ladders beyond what `countsVertical` gives. Step volume is float32 0.15 (spider events were a double before). The volume sliders (Friendly/Hostile Creatures) apply through the manifest categories exactly as for other mob sounds.
