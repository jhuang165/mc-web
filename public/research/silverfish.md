# EntitySilverfish and BlockSilverfish (monster egg), Minecraft Java 1.7.10

Native evidence: `public/research/silverfish-reference.json` (448 records), written by `node tools/verify-silverfish.mjs`
from the unchanged 1.7.10 client classes (`tools/probes/SilverfishProbe.java`, which drives the real `yk`
EntitySilverfish, `amb` BlockSilverfish, `ayg` PathFinder and the real `getClosestVulnerablePlayer`). The port is
`src/silverfish.js`; `src/silverfish.test.js` replays the reference.

## Records

facts 1, step 1, facing 6, model 1, pose 5, pathWeight 36, hurt 38, attack 160, attackAsMob 1, findPlayer 13,
chase 5 (open, open-diagonal, wall, creative, far; 60-120 ticks each), idle 5 (260 ticks over air/stone/cobble/brick/dirt),
hide 54 (9 floors x 6 seeds), wake 50 (24 seeds x griefing on/off plus single and none), canHide 32, eggBlock 8,
eggBlockFacts 1, break 24 (meta 0-5 x Creative/Survival/pickaxe/Silk Touch), dropWithChance 1, remoteBreak 1,
spawner scenarios 5 (spawner, lit, player-near, peaceful, encased).

## Facts

- 0.3 x 0.7, 8 health, speed 0.6, damage 1, follow range 16, not AI-enabled (legacy `updateEntityActionState`).
- `canTriggerWalking` false: no step sound is ever played (the step override is dead code). `isValidLightLevel` true.
- Sounds: say `mob.silverfish.say`, hurt `mob.silverfish.hit`, death `mob.silverfish.kill`.
- No drops (`getDropItem` 0), experience 5 (EntityMob), arthropod for Bane of Arthropods.
- Shadow size 0.3, death rotation 180 degrees.
- Path weight: stone below is 10, otherwise 0.5 minus the block brightness.
- Spawn: not Peaceful, EntityLiving box checks, path weight >= 0, no player within 5 blocks, no light rolls.

## Behaviour (all ported draw for draw)

`yk.bq` -> `td.bq` (target/path, the 1/20 repath, wander 1/180 and 1/120 while age < 100) -> `sw.bq` when there is
no path or `nextInt(100) == 0` (look target, random yaw, liquid jumping) -> summon cooldown countdown and the
monster-egg scan -> hiding. With no target and no path it picks one of six faces; if the cell is stone,
cobblestone or a stone brick it becomes a monster egg (`func_150195_a` metadata), 20 explosion puffs
(3 nextGaussian and 3 nextFloat each, drawn on Entity.rand) and the fish vanishes; otherwise it wanders.
A hit by an entity or by magic damage arms a 20 tick summon cooldown; at 0 the cells around the fish are scanned
(dy 0,1,-1..+-5; dx and dz 0,1,-1..+-10) and each monster egg is broken without drops (mobGriefing) or turned back
into its block, releases a silverfish at the cell centre, and a `nextBoolean` stops the scan.

BlockSilverfish: hardness 0.75, no item drop. `onBlockDestroyedByPlayer` releases one silverfish at (x + 0.5, y,
z + 0.5), yaw 0; `dropBlockAsItemWithChance` a second one. Creative stops after the first (1), Survival without Silk
Touch gets 2 (native, not a port bug), Silk Touch drops the stacked block (stone, cobblestone or the brick variant)
and one silverfish.

## Live

`src/entities.js` (`silverfishThink`, hurt hook, save/load, spawner `canSpawnHere`, `spawnSilverfishAt`),
`src/mob-spawner.js` (entityId `Silverfish`, so stronghold spawners work), `src/block-break-simulation.js` and
`src/main.js` (breaking an egg), `src/living-simulation.js` (`blockEdit` event), `src/mob-renderer.js` (ModelSilverfish
from `SILVERFISH_MODEL`, `entity/silverfish.png`, the `setRotationAngles` sway), `src/enchantment-effects.js` (Silk
Touch on eggs), `src/region-export.js` (`Silverfish`), audio under `public/audio/1.7.10/mob/silverfish`.

## Limits

- The replay test injects the recorded path results and positions. It proves decisions and Random consumption (state
  and call count) but not path geometry or physics; live pathing uses the existing PathFinder/navigator and
  physics, so routes and speed are approximate.
- `MathHelper.sin/cos` tables are not used: the model sway differs from the reference by under 1e-3.
- Batch 68 (docs sweep): `getClosestVulnerablePlayer` sneak/invisibility range scaling is now ported in `MobAI.closestVulnerablePlayer` (`src/ai.js`, sneaking x0.8, invisible x0.7 x armour visibility; replayed by `src/detection.test.js`), and `mobGriefing` now reads the gamerule (`entities.js` `silverfishThink` env, `get mobGriefing()`); the older lines that said otherwise were stale.
- Hide and wake edits do not feed block-update, light or fluid systems beyond redrawing the cell.
- Batch 68 (docs sweep): Java region import now converts mobs; `Silverfish` is in `JAVA_SUMMON_MOBS` (`src/java-mobs.js`, read by `region-import.js`), so imported silverfish become live mobs. Export writes id `Silverfish`.
- The save keeps 40 mobs: a release past that limit is skipped. Silverfish sound events were derived from the shipped
  files (hit1-3, kill, say1-4, step1-4); `sounds.json` itself is not in the local research cache.
- Native evidence has no multi-fish or collision-driven cases; sounds in the live path were not played in a browser.
