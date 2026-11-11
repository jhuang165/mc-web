# Achievements (Java 1.7.10)

Evidence: `tools/probes/AchievementProbe.java` loads the unchanged `AchievementList` (pc) from the 1.7.10 client jar (sha1
`e80d9b3b...`) and `tools/verify-achievements.mjs` writes `public/research/achievements-reference.json` (33 achievements with
column, row, icon, parent, special flag, the explorable biome set, en_US strings, and the toast and screen constants read
from the `beh` / `bei` / `pq` / `aax` / `aak` bytecode). Regenerate with
`MC_RESEARCH=<tools/research> node tools/verify-achievements.mjs`. `src/achievements.test.js` replays it.

## Implemented

- `src/achievements.js`: all 33 achievements, the `StatFileWriter` rules (a trigger with a locked parent is ignored, depth counts
  locked ancestors, Creative awards too), the exploreAllBiomes set (36 names, sampled every 20 ticks, kept while locked), the
  onARail 1,000,000 squared-distance start cell and the fullBeacon level 4 rule. Saved per world as `record.achievements`.
- `src/achievements-live.js` + hooks in `main.js`: openInventory (inventory key, not a workbench), mineWood / killCow (leather) /
  diamonds / blazeRod (item pickup), crafting slots (workbench, pickaxe, better pickaxe, hoe, sword, bread, cake, enchanting table,
  bookshelf, furnace), smelting (iron ingot, cooked fish), potion (taking a potion from a brewing stand bottle slot), killEnemy
  (IMob killed by the player), ghast (player fireball), snipeSkeleton (arrow kill, >= 50 blocks in x and z), overkill (landed hit
  of >= 18.0 after crit and enchantments), breedCow (cow or mooshroom), flyPig (pig fall > 5 with a rider), spawnWither, killWither,
  fullBeacon (player within 10/5/10 of a pyramid that reaches level 4), portal / theEnd / theEnd2 on dimension arrival.
- `src/achievements-ui.js`: the "Achievement get!" toast and the "Taking Inventory" hint (3 s, slide curve from `beh`), and the
  Achievements screen from the pause menu (256x202 frame, 224x155 view, drag, wheel zoom 1-2 in 0.25 steps, 0.85 easing, scroll
  bounds, random block background seeded by the player name, links and arrows, node brightness by depth, tooltips, Done button).
  The Statistics button stays disabled.

## Gaps (parity is not claimed)

- diamondsToYou needs another player to pick up a diamond you dropped; it cannot happen in singleplayer. The gun server awards it
  (EntityItem.onCollideWithPlayer: the Q-dropped item's Thrower, found by name in the picker's world, not the picker); death,
  window and creative drops carry no thrower, as in 1.7.10.
- The gun server's Beaconator follows TileEntityBeacon.func_146003_y (a check that takes the pyramid from below 4 to 4 levels,
  players meeting the beacon cell grown by 10, 5 below to 1 above) and The Beginning? follows BlockSkull.func_149965_a (players
  meeting the Wither's box grown by 50). Singleplayer uses the same beacon transition.
- No Statistics screen and no stats file: general statistics are not recorded, and the "Downloading statistics" loading state is
  skipped. The region export (`region-*.js`) does not write `stats/<uuid>.json`; it is owned by other work and was left alone.
- Event approximations: onARail counts the rider's position each tick instead of `addMovementStat` increments; ghast does not
  distinguish small and large fireballs; killWither fires on a player-sourced death; breedCow in singleplayer does not check who fed the animals (the gun server credits the feeder kept by
  EntityAnimal.func_146082_f, else the mate's, as EntityAIMate.spawnBaby does);
  snipeSkeleton uses the player's position at the skeleton's death, not at the arrow's launch; mobs killed by the player count
  by this build's type names (IMOB list).
- The biome set depends on this build's Java biome generator naming the 36 biomes like 1.7.10; a world that cannot produce all of
  them cannot unlock exploreAllBiomes.
- The screen and toast reuse the already-bundled `gui/achievement/achievement_background.png` sprite sheet and the block textures
  from `public/media/1.7.10`; nothing new was copied. Link arrows and node frames are tinted on canvas, not by GL colour state.
- The chat announcement uses the vanilla format with a plain green or dark purple `[name]`, without the hover tooltip.
