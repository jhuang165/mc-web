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
  - Batch 80 (potspacks80, 2026-11-18, bytecode-read `blm` pot path, `anz` BlockTallGrass, `ald` BlockFlowerPot): a pot read from NBT with tall grass (31) draws `BlockTallGrass.getIcon(0, Data)` (icons deadbush, tallgrass, fern; Data 3 and above -> icons[0], negative -> empty here since the client throws) and with cobweb (30) draws the crossed web; they are not plantable by click (`func_149928_a`). The plant colour is `colorMultiplier` at the pot cell, so tall grass is tinted only when the POT's metadata is not 0. Breaking drops `[Item, 1, Data]` and pick-block gives the same pair natively; the port does this when its item catalogue holds the stack (tall grass 0/1 now map to dead shrub / tall grass) and otherwise drops the drawn plant. Pots holding non-drawn items (stone, reeds, seeds...) still import as empty.

## Limits

- Eye insertion and portal activation are not implemented.
- Glass bottles and armour washing are not implemented (no bottle item).
- Batch 70 (docs sweep, 2026-11-14): closed. Eye insertion and portal activation: `useEyeOnFrame` in `src/eye-of-ender.js` sets the eye bit and writes the end portal cells, reached from `src/eye-of-ender-live.js` (ItemEnderEye on a frame, called by `src/player-edit-simulation.js`). Glass bottles: `useGlassBottle`/`bottleFromCauldron` in `src/potion-use.js`; armour and banner-style washing: `cauldronWash` in `src/stone-utility.js`, called at `src/player-edit-simulation.js` (cauldron branch). See [cauldron-wash](cauldron-wash.md). The two lines above are history.
- Slab types 6 (nether brick) and 7 (quartz) are craftable and listed in Creative; see nether-blocks.md.
- Invalid brick metadata 4-15 is clamped to 0-3 for icons and drops; native keeps the raw value for drops.
- The frame selection box is 13/16 high, but the native raw block field stays 1.0; the single collision box reports the union when an eye is set.
- 103:1 exports as 44:0, and 44:9 is a sandstone top slab here.
- Pot metadata quirks are simplified; pots are not handled in explosions; the FlowerPot tile entity is not written by region export.
- The pot plant is drawn as crossed quads; slabs are drawn as full cubes in first person and as drops.
- Batch 72 (flowerpots72, 2026-11-14): the pot is now swept over every registered item id 1-2300 at damage 0-15 in `pot-sweep-reference.json` (`tools/probes/PotSweepProbe.java`, `tools/verify-pot-sweep.mjs`, executed on the unchanged jar; replay in `src/flowerpots72-b72.test.js`). Native `BlockFlowerPot.func_149928_a` accepts only an ItemBlock of dandelion, red flower, sapling, cactus, brown/red mushroom or dead bush at any damage 0-15 (113 stacks) plus tall grass at damage 2, stores the held item and damage in the tile entity, sets the block metadata to the held damage, and drops that stack on breaking. Every stack the port can hold behaves the same (placement acceptance, tile, metadata, drops, `Item`/`Data` NBT: `potNbtOf` / `potFromNbt` in `src/stone-utility.js`); the other native stacks (dandelion damage 1-15, red flower 9-15, sapling 6-15, ...) have no browser item. `FLOWER_POT_CONTENTS` in `src/gen-world.js` is replayed against all 16 native metadata answers. The sweep found one real difference, fixed: a pot can stand on a redstone block (`solidTopSurface` in `src/doors-panes.js` now counts block 123). Chunk NBT keeps `TileEntities` as opaque lists, so there is still no pot-specific region import or export.
