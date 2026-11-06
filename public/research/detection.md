# Player visibility and mob targeting

Target is Minecraft Java 1.7.10. Full parity is not claimed. Code: `MobAI.closestVulnerablePlayer` and the `PlayerView` state in `src/ai.js`; evidence: `public/research/detection-reference.json`, written by `tools/verify-detection.mjs` from `tools/probes/DetectionProbe.java` and replayed by `src/detection.test.js`.

## What the native classes do (unchanged 1.7.10 classes, javap and the probe)
- `World.getClosestVulnerablePlayerToEntity` (ahb.b(sa, D)) calls `b(DDDD)`: players with `capabilities.disableDamage` (creative) or not alive are skipped; the range is multiplied by 0.800000011920929 when `isSneaking`, then by `(double)(0.7f * max(0.1f, getArmorVisibility()))` when `isInvisible` (armour visibility = worn pieces / 4); the nearest player with distance squared below range squared wins. `World.getClosestPlayer` (ahb.a) does neither (it is the look-at, avoid and despawn lookup).
- `EntityAINearestAttackableTarget` (vo) has NO sneaking or invisibility scaling. Its selector (vp) calls `EntityAITarget.isSuitableTarget(target, false)` (vu.a): not itself, alive, class allowed, tamed-owner rules, a player with `disableDamage` is refused, inside the home area, and (zombie, creeper, skeleton, witch) in sight. The search box is follow range x 4 x follow range. The probe shows a sneaking or invisible player is accepted out to the same follow range (16.5 for follow range 16, the box half widths added; 6 blocks above or below is out of the box).
- Users of the scaled lookup (`findPlayerToAttack` / `updateEntityActionState`): EntityMob (16, plus canEntityBeSeen; used by an angry zombie pigman here), EntitySpider and cave spider (16, brightness below 0.5), EntitySilverfish (8), EntityEnderman (64, then the stare test), EntitySlime and magma cube (16), EntityGhast (100).
- Task based (no scaling): zombie (follow range 40), creeper, skeleton, wither skeleton, witch, blaze here (its task list approximates the legacy flow).

## Live
- `PlayerView` reads invisibility (`survival.effects`), the worn armour pieces (`survival.inventory.armor`) and a sneaking flag set by `living-simulation.js` (`state.sneaking`, from `motion.sneaking`).
- Spider and cave spider, silverfish, slime and magma cube, ghast, enderman and angry pigman use `ai.closestVulnerablePlayer(mob, range)`.

## Gaps
- The probe replaces `World.selectEntitiesWithinAABB` with a scripted lookup; entity chunk lookup is not native-run. Enderman and ghast bR/bq bodies are covered through the shared lookup and their ranges, not by running those methods.
- The browser has one player; ordering among several players is not exercised.
- Blaze targeting stays on the task list approximation (native is legacy flow), so it has no scaling.
