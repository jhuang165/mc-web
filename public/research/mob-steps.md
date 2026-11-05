# Mob footsteps

Before this change (after 0.43.0, not yet released) only spiders played a step sound; every other mob walked silently. `src/mob-steps.js` now ports the tail of `Entity.moveEntity` and the per-class `func_145780_a` overrides, and `EntityWorld.walk` (entities.js) calls it right after each mob's `moveEntityWithHeading`.

## Rules ported

- `canTriggerWalking` and not riding. Only the silverfish turns it off (its own step override is dead code), so it stays silent.
- `distanceWalkedOnStepModified += sqrt(dx² + dy² + dz²) * 0.6` in float32, where `dy` counts only when the block 0.2 below the feet is a ladder (`countsVertical`). The mob's `nextStepDistance` starts at 1; neither value is saved (not in the NBT either).
- When the distance passes `nextStepDistance` and the cell at `floor(y - 0.2)` (yOffset 0 for mobs) is not air, `nextStepDistance = (int)distance + 1`. The distance keeps growing over air, so a landing steps at once.
- In water the mob plays its swim sound instead: `game.hostile.swim` for monsters (the `HOSTILE` set), `game.neutral.swim` otherwise, volume `min(1, sqrt(mx² * 0.2 + my² + mz² * 0.2) * 0.35)`, pitch `1 + (rand - rand) * 0.4` from the entity's own Random.
- On land: zombie `mob.zombie.step`, skeleton `mob.skeleton.step`, spider and cave spider `mob.spider.step`, pig/cow/sheep/chicken `mob.<name>.step`, all 0.15 at pitch 1; iron golem `mob.irongolem.walk` at volume 1. Creeper, villager and witch have no override, so they play `Entity.func_145780_a`: the SoundType of the stepped block at volume × 0.15 and its frequency, the snow type under a snow layer, nothing over liquids (`footstepSound` in block-sounds.js).

## Evidence and limits

Port regression tests only (`src/mob-steps.test.js`: per-class events, step cadence, silverfish/riding/air, ladder dy, snow/liquid, swim volume/pitch). The override table comes from the 1.7.10 class behaviour recorded in the earlier sound notes (spider, silverfish, iron golem); no new probe was run against the JAR for the other mobs. Not covered: the fence/wall/fence-gate rule (the step uses the block below those; fences are not blocks here), the swim bubbles/splash particles that accompany the in-water step, dying mobs moving through `dying()` (they step only when `walk` runs for them), step sounds while a mob rides a cart, and zombie steps on ladders beyond what `countsVertical` gives. Step volume is float32 0.15 (spider events were a double before). The volume sliders (Friendly/Hostile Creatures) apply through the manifest categories exactly as for other mob sounds.
