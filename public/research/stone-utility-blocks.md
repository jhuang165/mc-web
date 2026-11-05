# Stone utility blocks

Internal blocks 101-106 map to 1.7.10 ids as follows.

| Internal | Original | Block |
| --- | --- | --- |
| 101 | 98 | Stone bricks (metadata 0-3) |
| 102 | 43 | Double stone slab (no item) |
| 103 | 44 | Stone slab (bit 8 = top half) |
| 104 | 120 | End portal frame |
| 105 | 118 | Cauldron |
| 106 | 140 | Flower pot |

Evidence: `tools/probes/StoneUtilityProbe.java` runs the unchanged 1.7.10 classes; `tools/verify-stone-utility.mjs` writes `public/research/stone-utility-reference.json`; `src/stone-utility.test.js` replays those rows against `src/stone-utility.js` and its callers. Old sandstone slabs (internal 82, plus 103:1 / 103:9 / 102:1) keep their item 82.

## Item ids

Internal ids 100-127 are tools, so these blocks use `1000 + blockId` as items: 1101 stone bricks, 1103 stone slab (damage = type), 1104 end portal frame, 1105 cauldron, 1106 flower pot. Saves and exports map them to the true ids 98, 44, 120, 380 and 390. The double slab has no item.

## Behaviour implemented

- Slab placement and merging (`planSlabUse`) follow `ItemSlab.onItemUse`, including the top-texture rule for double slabs with metadata 8/9 and creative merging. The hit height reuses the stairs agent's `hit: [x, y, z]` target field.
- End portal frame: facing from yaw, 13/16 collision box plus the eye box, unbreakable (hardness Infinity, no drop), comparator output, solid top for fences, rails and torches.
- Cauldron: water bucket fills to 3 (an empty bucket is returned in Survival), empty hand is handled, rain fills by `nextInt(20)` rolls, and a burning entity is extinguished using one level.
- Flower pot: contents live in `world.pots` and fall back to the metadata, are saved with the world, drop with the pot (nothing in Creative), and need a solid top below.

## Limits

- Eye insertion and portal activation are not implemented.
- Glass bottles and armour washing are not implemented (no bottle item).
- Slab types 6 (nether brick) and 7 (quartz) are craftable and listed in Creative; see nether-blocks.md.
- Invalid brick metadata 4-15 is clamped to 0-3 for icons and drops; native keeps the raw value for drops.
- The frame selection box is 13/16 high, but the native raw block field stays 1.0; the single collision box reports the union when an eye is set.
- 103:1 exports as 44:0, and 44:9 is a sandstone top slab here.
- Pot metadata quirks are simplified; pots are not handled in explosions; the FlowerPot tile entity is not written by region export.
- The pot plant is drawn as crossed quads; slabs are drawn as full cubes in first person and as drops.
