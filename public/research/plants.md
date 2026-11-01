# Sugar cane, cactus, beaches and falling sand/gravel (1.7.10)

Evidence: `javap -p -c` on the 1.7.10 client JAR (SHA-1 `e80d9b3bf5085002218d4be59e668bac718abbc6`, names mapped
through `joined-1.7.10.srg`) and `tools/probes/PlantProbe.java`, which runs the unchanged original classes on a
map-backed `World` double (original block ids; `setBlock` is a plain write without neighbour notifications;
spawned entities and scheduled updates are recorded). `MC_RESEARCH=... node tools/verify-plants.mjs` regenerates
`public/research/plant-reference.json` (356 records, with the SHA-256 of every class used); `src/plants.test.js`
and `src/falling.test.js` replay it against `src/plants.js` and `src/falling.js`. `tools/plant-fixtures.mjs` holds
the shared original-to-game id map and the test world double.

**probe** = the original classes were executed and the port matches their output; **bytecode** = transcribed
from `javap` only.

## Original classes

| Obfuscated | Name | Used for |
| --- | --- | --- |
| `ane` | BlockReed (id 83, "reeds") | `c` canPlaceBlockAt, `j` canBlockStay, `func_150170_e` check-and-drop, `a` updateTick, bounds |
| `ajt` | BlockCactus (id 81) | `j` canBlockStay, `c` canPlaceBlockAt, `a` updateTick, collision/selection boxes, `onEntityCollidedWithBlock` |
| `akx` / `anh` / `ali` | BlockFalling / BlockSand (12) / BlockGravel (13) | `onBlockAdded`/`onNeighborBlockChange` scheduling, `func_149831_e` canFallBelow, `func_149830_m` fall, gravel `getItemDropped` |
| `xj` | EntityFallingBlock | `h` onUpdate: gravity, drag, source removal, landing, drops |
| `abi` | ItemReed | `onItemUse`: target cell and placement |
| `ash` / `arh` / `asj` | WorldGenReed / WorldGenCactus / WorldGenSand | world generation |
| `aia` | BiomeDecorator | sand discs (`sandPerChunk2` 3), `reedsPerChunk` + 10, `cactiPerChunk` |
| `ro.g` | DamageSource.cactus | 1 point, armour applies |
| `xk` / `sq` | EntityItem / EntityXPOrb | `attackEntityFrom`: 5 health, so cactus destroys them |
| `afa` / `afe` | FurnaceRecipes / CraftingManager | cactus green, paper, sugar, book |

## Internal ids

| Thing | Original | This build |
| --- | --- | --- |
| Sand (BlockSand, falls) | block 12 | block **6** (unchanged id, now falls) |
| Gravel (BlockGravel, falls) | block 13 | block **25** (unchanged id, now falls) |
| Cactus | block 81 | block **53** (creative Decorations, also its own item) |
| Sugar cane block | block 83 | block **54** (hidden; placed by the item) |
| Sugar cane item (Items.reeds) | item 338 | item **327** |
| Paper | item 339 | item **328** |
| Sugar | item 353 | item **329** |
| Book | item 340 | item 314 (existing) |
| Cactus green | dye 351:2 | dye 351:2 |

## Ported

### Sugar cane (BlockReed)

- **Placement and support** (probe, 171 cases): on sugar cane, or on grass, dirt or sand with water (still or
  flowing) on one of the four sides of that soil block. `canPlaceBlockAt` and `canBlockStay` are the same test;
  there is no check of the cell itself, so `ItemReed` adds the replaceable-cell check (air, water, lava, fire,
  tall grass, snow layer).
- **ItemReed.onItemUse** (probe, 10 cases): a one-layer snow cell (meta & 7 < 1) or tall grass is replaced in place,
  any other clicked block places on the clicked face. The item is used up outside Creative.
- **Breaking**: hardness 0, drops one sugar cane item. A neighbour change runs `func_150170_e`
  (`dropBlockAsItem` and `setBlockToAir`, with no particles), so breaking the bottom of a column brings the rest down
  one at a time. Removing the water only notifies the water's six neighbours. A cane diagonal to the water is not
  among them, so it waits for its random tick, which also runs `func_150170_e` (probe, the running-world test).
- **Growth** (probe, 13 cases): it ticks randomly. If the cell above is air and the column below is under 3 high,
  the age (meta) counts up to 15. At 15 a new cane goes on top and the age returns to 0. The age write uses flag 4,
  which sends no notification.
- **Shape**: no collision box. Block bounds 0.125–0.875 on x and z apply to rays and the outline. It renders crossed,
  tinted with the biome grass colour, as does its item icon. Sounds use the grass step sound. Mining uses
  Material.plants (axe and sword speed, as in `mining-reference.json`).

### Cactus (BlockCactus)

- **Support** (probe, 97 cases): breaks when any of the four sides holds a solid material (`Material.isSolid`,
  which is true for leaves, glass, ice, cobwebs and cactus, and false for torches, ladders, plants and snow layers),
  or when the block below is not cactus or sand. A neighbour change runs `func_147480_a` (the full break, with
  particles and a cactus drop). Placement needs a replaceable cell and the same rules.
- **Growth** (probe): the same age-15, height-3 rule as sugar cane. After growing, `onNeighborBlockChange` runs on
  the new block, so a cactus that grows next to something solid breaks at once.
- **Boxes** (probe and bytecode): the collision box is inset 1/16 on the four sides and the top. The selection outline
  is inset on the sides only and keeps the full height. `BlockCactus` never calls `setBlockBounds`, so rays
  (`collisionRayTrace`) hit the full cube.
- **Damage** (probe): `Entity.doBlockCollisions` uses the entity box contracted by 0.001. A cactus in any cell it
  covers calls `attackEntityFrom(DamageSource.cactus, 1)`. The player and mobs take 1 point, with armour applied and
  the usual hurt cooldown. Items have 5 health and take 1 each tick, so they are destroyed. XP orbs also have 5 health and are destroyed the same way. Each cactus cell the box covers is a separate call, so an item across two cells loses 2 a tick; since 0.21.3 this runs in the shared `moveEntity` tail ([player step](player-step.md)).
- **Render**: `renderBlockCactusImpl`, with no ambient occlusion. The four sides are full faces moved 1/16 inwards,
  always drawn, in the cell's own light. Top and bottom are drawn unless covered by an opaque cube, in the light of
  the cell beyond. `cactus_side`, `cactus_top` and `cactus_bottom` come from the original textures. Hardness 0.4,
  cloth step sound.
- **Smelting** (probe): cactus gives cactus green (dye damage 2) with 0.2 experience.

### Recipes (probe, 12 crafting cases)

- Paper: `###` of sugar cane in any row gives 3.
- Sugar: one sugar cane, shapeless.
- Book: three paper and one leather, shapeless.

### Falling sand and gravel (BlockFalling, EntityFallingBlock)

- **Scheduling** (probe): `onBlockAdded` and `onNeighborBlockChange` schedule an update in tickRate 2. A second
  request for the same position and block is ignored.
- **canFallBelow**: air, fire, water or lava below.
- **Fall**: an `EntityFallingBlock` spawns at the block centre with its metadata. The source block stays until the
  entity's first tick, which removes it. If the block is no longer there, the entity dies.
- **Entity tick** (probe, 20 fall replays checked on every tick for posY, motionY, onGround and dead): gravity 0.04,
  `moveEntity` with a 0.98 × 0.98 box, drag 0.98. On landing it places itself if the cell is replaceable and there is
  nothing to fall into below; otherwise it drops as an item (`entityDropItem`, pickup delay 10), for example when
  it lands in a torch or flower cell. It also drops after 600 ticks, or after 100 ticks outside y 1–256.
  Sand keeps its metadata in the dropped item; gravel drops metadata 0.
- **Columns**: each block is still supported at its own update. Taking away the bottom reschedules the one above, so
  a column follows two ticks apart (running-world test).
- **Gravel flint**: `nextInt(10 - 3 * fortune)` (fortune capped at 3) gives flint (probe, 5 seeds). The browser's
  break path keeps its existing 1-in-10 roll, because no tool has fortune.
- **Rendering**: `renderBlockSandFalling`, a unit cube centred on posY, interpolated between ticks, in the light of
  the entity's cell.
- **Saves**: falling entities are saved and restored. Edited sand or gravel left unsupported in a save falls once
  the world loads (`wake`), because scheduled ticks are not saved.

### World generation (generation version 8, the new default)

- **WorldGenSand** (probe, 6 cases): only where the cell is water. A disc of radius `nextInt(radius - 2) + 2`
  (radius 7) turns dirt and grass from y − 2 to y + 2 into sand.
- **WorldGenReed** (probe, 6 cases): 20 tries up to 3 blocks away on x and z. An air cell with water beside the block
  below gets a column of `2 + nextInt(nextInt(3) + 1)`, with each level placed only where `canBlockStay` holds.
- **WorldGenCactus** (probe, 6 cases): ported and tested, but not called (see adaptations).
- **Decorator order**: three sand discs per chunk at `getTopSolidOrLiquidBlock`, before the trees. After the flowers
  come `reedsPerChunk` (0 outside deserts and swamps) + 10 `WorldGenReed` calls per chunk at
  `y = nextInt(getHeightValue * 2)`.
- **Old saves**: worlds made with versions 1–7 keep their terrain. The generation hashes of versions 4–7 are pinned
  in `src/plants.test.js`.

## Adaptations

- **Decorator randoms**: the decorators use one `java.util.Random` per 16 × 16 chunk, seeded from
  `ChunkProviderGenerate.populate`'s chunk seed with a "plants" salt. The original shares one stream across the whole
  decorator. The salt keeps the version-7 lakes, trees and flowers where they were. Positions and counts per chunk
  follow the original, but the draws do not line up with Java's.
- **World size**: the world is shallow (64 high, sea level 16) and finite (128 × 128). Chunks whose decoration area
  touches the world are decorated. A reed call whose column is outside the world (height 0) is skipped, where the
  original always has a height.
- **No cactus generation**: no preset is a desert (`cactiPerChunk` 10 is a BiomeGenDesert value), so
  `WorldGenCactus` never runs in generation.
- **Missing decorator steps**: the clay disc and gravel disc steps (`clayPerChunk`, `sandPerChunk`) are not ported,
  so they consume no draws.

## Gaps

- Falling blocks have no entity shadow. The instant fall (`fallInstantly`, used when nearby chunks are not loaded)
  is not ported.
- A falling block that lands inside the player is not pushed out or treated specially.
- Metadata changes with flag 4 (growth age) send no notification, as in the original. Other flag differences between
  the original `setBlock` calls and this build's `world.set` are not modelled.
- The cactus inventory icon is a plain isometric cube, not the inset item render.
- No desert biome, so no natural cactus. Swamp `reedsPerChunk` is unused.


## Falling-block blast deflection (0.22)

Falling sand/gravel now receive explosion knockback, without taking damage or immediately dropping their carried block. The blast direction uses posY at the 0.98F box centre and inherited eye height 0. Deflected velocity persists through save/load and continues through normal falling/landing rules. `ExplosionEntityProbe` replays 72 original falling-sand blast targets; sand and gravel share the same entity class. See [reference](explosion-entities-reference.json).
