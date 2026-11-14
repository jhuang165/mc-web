# Second redstone block family (blocks only, 0.39.0 tranche)

Target: Minecraft Java 1.7.10. No full-parity claim. This note covers the BLOCK side of internal ids 119-131 in
`src/redstone-blocks-2.js`; power behaviour (torch burnout, lamp switching, plates, comparators, sensor output) lives in
`redstone.js` / `redstone-live.js` and is documented separately.

## Evidence

`tools/probes/RedstoneBlocks2Probe.java` runs the unchanged classes from `minecraft-1.7.10.jar` (SHA1
`e80d9b3bf5085002218d4be59e668bac718abbc6`) on a world double, written by `tools/verify-redstone-blocks-2.mjs` to
`public/research/redstone-blocks-2-reference.json`. `src/redstone-blocks-2.test.js` replays it:

| Records | Count | Replayed against |
| --- | --- | --- |
| facts (hardness, resistance, light, opacity, normal cube, sound, tool, neighbour brightness, drop/pick) | 13 | block tables, lighting.js, explosion.js, MATERIALS, audio.js |
| drops (24 seeds x Fortune 0-3, `quantityDroppedWithBonus` then `getItemDropped`) | 13 | `redstoneDrops2` with `JavaRandom` (glowstone 2-4 dust) |
| bounds (16 metadata, bounds/collision/6 ray hits) | 208 | `redstoneBounds2`, `hasCollision2`, `solidBlock` |
| below (support per ground block id 0-175) | 171 | plates, comparators, sensor (`redstonePlacedMeta2`, `redstoneSupported2`) |
| sides (64 neighbour masks, torches and wooden button) | 3 | attachment, survival per metadata |
| place (ItemBlock/ItemReed over six faces, yaw sweep, two modes) | 360 | `redstonePlacedMeta` incl. comparator facing from yaw |
| recipe (CraftingManager) | 11 | `craftingResult` (10 craftable here); also `recipe-registry-reference.json` now samples 193 mapped recipes (1884 grids), up from 183 / 1764 |
| creative (tab positions) | 12 | `population-creative.js` order, search order |

## What now works

* Ids 119-131 map to original 75/76 torch, 123/124 lamp, 152 redstone block, 143 wooden button, 147/148 weighted
  plates, 149/150 comparator, 151 daylight sensor, 36 piston extension, 89 glowstone. Items are 1000 + block id
  (1120 torch, 1121 lamp, 1123 redstone block, 1124 button, 1125/1126 plates, 1129 sensor, 1131 glowstone); comparator
  381, nether quartz 382, glowstone dust 383 (original 404, 406, 348). Java item import/export reuse
  `POPULATION_ITEMS` (`REDSTONE2_ITEM_IDS`).
* Placement, support, drops (unlit torch drops the lit item, lit lamp the lamp, comparators item 381, glowstone 2-4
  dust with Fortune), hardness, tool rules (redstone block and weighted plates need a pickaxe), blast resistance, light
  emission/opacity, digging sounds, pick block and Creative/search placement follow the replayed records.
* Recipes: torch, lamp, block of redstone and its nine-dust reverse, comparator, repeater (C164, previously blocked on
  the torch), glowstone, both weighted plates, wooden button.
* Rendering uses the original block textures (already in `public/media/1.7.10`, provenance-checked): torch model with the
  lit/unlit texture, lamp/redstone block/glowstone cubes, 1/8 comparator slab with torches, 0.375 daylight sensor,
  button and plate boxes. Item icons: flat torch sprite, 3D blocks, `items/comparator`, `quartz`, `glowstone_dust`.
* Other fixes found while enabling the family: dust may stand on glowstone (`BlockRedstoneWire.canPlaceBlockAt`); fences
  connect to the block of redstone; shadows are skipped under the non-cube members; the block metadata catalogue and
  shadow reference were regenerated for the new ids.

## Approximated or not done

* The comparator's torch layout (two rear torches, front torch raised in subtract mode) is drawn from the class
  description, not replayed against the native renderer. Item icons for the button, plates and sensor are drawn as
  cubes (native `setBlockBoundsForItemRender` boxes are not replicated).
* The daylight sensor recipe (three glass, three quartz, three wooden slabs): Batch 69 (docs sweep): the wood slab (126) and the Nether exist now (`src/shaped-blocks.js`, `src/dimension-live.js`); whether the browser registers the recipe was not checked (the recipe catalogue row says no), so it is left open.
  slab block. Quartz is only obtainable from Creative (no Nether).
* Fortune on glowstone is implemented in `redstoneDrops2`; the live mining path does not yet pass the held Fortune level.
* Torch sprite wall variants rely on the existing torch model (metadata 1-4 lean, standing stored as 0).
