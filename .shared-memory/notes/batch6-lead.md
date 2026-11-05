# Batch 6 lead notes (2026-11-05, claude-lead)

Ten Sonnet tracks merged on main in worktrees `../wt6-*`: nether-melee, horse-gear, end-gen, wither, carts, nether-gen, fireball-mobs, maps-clock, beacon, fireworks. Track docs are in `public/research/{magma-pigman,horse-gear,end,wither,minecart-variants,nether,blaze-ghast,maps-clock,beacon,fireworks}.md` and `.shared-memory/notes/*-track.md`.

## Merge resolutions
- Hot files (main.js, world.js, entities.js, creative.js, commands, region-import, player-edit-simulation) were union-merged. `src/population-creative.js` and `public/research/block-metadata-catalogue.md` were regenerated from their generators after taking `--theirs`.
- dispense.js: `FIRE_CHARGE: 1952, FIREWORK: 2071` (internal ids, not original ids).
- fireworks.js: `SKULL_ITEM_IDS = new Set([2050])`.
- creative.js: carts are listed by the generated catalogue, so the hand-wired CART_CREATIVE import was removed (carts appeared twice).
- player-edit-simulation.js: the duplicate SOUL_SAND import was removed; the maps block is closed before the firework block.
- region-import.test.js: no registered block is unmapped any more, so the unmapped case was dropped and the raw section write moved after setBlockState.
- recipe-catalogue.test.js: 298 recipes, 2682 cells. shadows.test.js excludes 164, 170-173.
- Media: the importer rewrote the manifest with deletions and reordering; it was rebuilt additively (455 clips).

## Lead fixes (4d502e0)
- main.js: FireworkParticles gets a lazy effects proxy, because the scene only exists after start().
- maps-clock-live.js: freshly drawn clock slots get the current frame instead of the raw strip.
- region-import.js: item 397 keeps damage 0-4 (SkullType), item 358 keeps the map id.

## Tests
npm test 2924 pass, npm run build ok. Browser check on :5181 with ?silent.

## Next steps
1. Dimension travel: the Nether portal and End portal teleport to the generators added here; set `world.isEnd`/Nether flags and the per-dimension save.
2. Nether fortress structure and blaze spawners; live pigman portal spawning (`portalPigmanSpawn`).
3. Wither boss entity (supply `spawnWither` from main.js) and the ender dragon.
4. Wearable heads, first-person map render and item-frame maps.
5. `/summon FireworksRocketEntity`, command block cart behaviour, leash path-following.
