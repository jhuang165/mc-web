# Mob heads, wither skeleton and the Wither (batch 6, wither track)

Facts below are bytecode-derived (javap of the unchanged 1.7.10 jar: BlockSkull `anl`, TileEntitySkull `apn`, ItemSkull `aeb`, TileEntitySkullRenderer `bms`, EntitySkeleton `yl`, EntityWither `xc`, EntityWitherSkull `zp`). No probe record exists yet.

## Done
- **Mob heads.** Original block 144 is internal 172, item 397 is internal 2050 (damage 0 skeleton, 1 wither skeleton, 2 zombie, 3 player, 4 creeper). `ItemSkull.onItemUse`: not the bottom face, clicked block must be solid, no replaceable check, floor rotation `floor(yaw*16/360+0.5)&15`, facing meta 1 floor / 2-5 wall. Bounds per facing, drops by tile type (none in Creative), renderer with the original textures (zombie model 64x64, others 64x32). SkullType and Rot live in a tile store (`skull.js` `Skulls`, saved as `skulls`), because world edits keep only 4 meta bits. Region export/import round-trip the `Skull` tile; `/setblock` creates it.
- **Wither T-shape** (`BlockSkull.func_149965_a`): wither skull row of three on four soul sand, y >= 2, not Peaceful. Clears seven cells, spawn point (x+0.5, y-1.45, z+i+1.5) yaw 90 for a z row, (x+i+1.5, y-1.45, z+0.5) yaw 0 for an x row. The spawn goes through the `spawnWither` hook, which main.js does not supply yet.
- **Wither skeleton** (type `wither_skeleton`, sharing the skeleton code through the same lists): 0.72 x 2.34, stone sword melee task (AttackOnCollide 1.2), attack damage 4, Wither effect 200 ticks on hit, coal `nextInt(3+looting)-1` and bones, 2.5% skull (damage 1), `SkeletonType` read by `/summon` and written on export, `wither_skeleton.png` at scale 1.2.
- `wither-rules.js`: constants of EntityWither and EntityWitherSkull.
- Sound regex: `wither` added to `tools/import-vanilla-media.mjs` (importer not run).

## Gaps
- The Wither entity is not implemented: no EntityWither AI, flight, three heads, wither skulls in flight, block breaking, armour phase, spawn explosion, boss bar, renderer, nether star drop, `/summon WitherBoss`.
- No `WitherProbe.java`, `verify-wither.mjs` or `wither-reference.json`; `skull.test.js` checks bytecode-derived values only.
- Heads in the helmet slot and on the player/paper doll; head drop from charged creeper kills; pick-block damage; player-head owner skins; wither skeleton stone sword model; Nether Fortress spawning (no nether here).
- Wither skeleton is not imported from region files (Skeleton entities are not imported at all).
