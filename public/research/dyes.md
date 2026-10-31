# Flowers, dyes and wool dyeing (1.7.10)

Evidence: `javap` on the 1.7.10 client JAR (names mapped through `joined-1.7.10.srg`) and
`tools/probes/DyeProbe.java`, which runs the unchanged original classes. `node tools/verify-dyes.mjs`
regenerates `public/research/dyes-reference.json`; `src/dyes.test.js` replays it against the port.

## Original classes

| Obfuscated | Name | Used for |
| --- | --- | --- |
| `acj` | ItemDye | `a` names, `b` texture names, `itemInteractionForEntity` `a(add,yz,sv)` |
| `aex` | RecipesDyes | the dye and wool recipes (`a(afe)`) |
| `afe`/`afh`/`afi` | CraftingManager / ShapedRecipes / ShapelessRecipes | recipe matching |
| `aka` | BlockColored | `b(int)` = `func_150032_b`, `~meta & 15` |
| `ajr`/`alc` | BlockBush / BlockFlower | bounds, canBlockStay, names `a`/`b`, `e(String)`, `f(String)` |
| `alh` | BlockGrass | `b(ahb,Random,I,I,I)` = `func_149853_b` (bone meal) |
| `ahu`/`aip` | BiomeGenBase / BiomeGenPlains | `a(Random,III)` = `func_150572_a`, noise `ad` |
| `awl`/`awo` | NoiseGeneratorPerlin / Simplex | plains flower noise |
| `aia`/`aro` | BiomeDecorator / WorldGenFlowers | flower loop |
| `blm` | RenderBlocks | crossed squares (`l`) |

## Ported

- **Flowers.** Block `Dandelion` (yellow_flower) and `Red flower` (red_flower, metadata 0-8: poppy,
  blue orchid, allium, azure bluet, red/orange/white/pink tulip, oxeye daisy). Crossed quads, no collision,
  hardness 0 (instant break), drop themselves (the species rides in the stack damage and is restored by
  middle-click pick), grass step sound. Bounds `0.3..0.7` wide, `0.6` high (`BlockBush(0.2)`), checked
  against `shadow-reference.json`. Render offset is `(hash - 0.5) * 0.3` sideways, none vertically (`blm.l`),
  from the same coordinate hash as tall grass.
- **canBlockStay / canPlaceBlockAt.** Ground must be grass, dirt or farmland; the cell needs full block light
  >= 8 or sky access. Neighbour changes drop the flower as an item (`watchFlowers` in `main.js`, which wraps
  `world.onChange` after `Fluids` takes it). Water washes flowers away and drops them.
- **Worldgen** (generation version 4; older saves keep their terrain). `BiomeDecorator`'s flower loop
  (`flowersPerChunk` times per chunk: x, z in `chunk*16 + nextInt(16) + 8`, `y = nextInt(heightValue + 32)`),
  then `WorldGenFlowers` (64 attempts at `+-nextInt(8)`, `+-nextInt(4)`, `+-nextInt(8)`, air and canBlockStay).
  Chunk Random uses the `ChunkProviderGenerate.populate` seed formula. Flower choice is `func_150572_a`:
  base biome dandelion 2/3, poppy 1/3; plains uses the Perlin noise at `(x/200, z/200)` (< -0.8 gives a
  tulip `4 + nextInt(4)`, otherwise `nextInt(3) > 0` gives poppy/azure bluet/oxeye, else dandelion).
  The Java `Random`, the simplex and Perlin noise are ported (`src/flowers.js`) and the choice for
  4000 seeded draws per biome plus 1500 noise values match the probe exactly.
- **Bone meal on grass** (`func_149853_b`): 128 random walks of `l/16` steps, tall grass 7/8 and the biome
  flower 1/8 on air above grass, via `growGrass`. Crops still use `Farming.fertilize`. One bone meal is used
  per click on grass (the original always consumes it there); Creative keeps the stack.
- **Dyes.** ItemDye is item 351 with damage 0-15. The 16 texture names equal `acj.b`. The old internal
  bone meal (item 310) is removed: saves migrate `{id: 310}` to `{id: 351, damage: 15}` when an inventory
  is read (`PlayerInventory.read`), so held stacks, chests and drops all migrate. `tools/inventory-replay.mjs`
  maps Minecraft 351 to this item (damage kept, as for wool 35) and no longer has the `351:15` special case.
- **Recipes** (shapeless, exact multiset, damage-aware, in the original order and counts): wool + dye
  (`15 - dye` colour; the wool ingredient is damage 0 only), 4 magenta, 3 light gray (ink + 2 bone meal),
  3 magenta, 2 pink/orange/lime/gray/light gray/light blue/cyan/purple/magenta, dandelion to yellow, poppy,
  the nine red flowers to their dyes, and bone to 3 bone meal. The probe enumerates every 1-3 item grid over
  44 items (dyes, flowers, wool, bone, stone) and all four-dye grids; the port matches all dye and wool results.
- **Sheep dyeing** (`EntityWorld.dye`, `acj.a(add,yz,sv)`): after shears and wheat decline, a dye whose
  colour `~damage & 15` differs from an unsheared sheep's sets it and loses one dye; lambs count; the
  click is handled for any sheep; Creative keeps the stack.
- **Creative and icons.** Decorations lists dandelion then the nine red flowers (after tall grass, before
  torches); Materials ends with the 16 dyes; the search tab follows registry order. Flower icons are the
  `blocks/flower_*.png` sprites; dyes use `items/dye_powder_*.png`, in hand, as drops, in third person and in
  inventories.

## Not ported

- Cactus smelting (no cactus), and sources for ink sacs (squid), cocoa beans and lapis (lapis ore). The items
  exist for Creative only; the lapis block recipe is also absent.
- String and the 4-string wool recipe; carpet, stained clay, stained glass and panes (the dye recipes for them).
- Double plants (sunflower, lilac, rose bush, peony) and their dye recipes; bone meal on a double plant or
  turning tall grass into a double plant.
- Bone meal particles and the aux 2005 sound; planting cocoa beans.
- Per-biome flowers: meadow stands in for plains (4 flowers per chunk, plains chooser); alpine and island use
  the default biome (2 per chunk, base chooser). Flower forests, swamps' blue orchids and the sunflower plains
  are not modelled. Decoration uses its own Random stream, so positions differ from a real seed's.
- Light is the sky light left after the opacity above the cell, or a torch within six blocks; lateral light
  spill is not modelled. Flowers have no random-tick `checkAndDropBlock`, only neighbour updates.
- `DyeProbe` does not run `BlockGrass.func_149853_b` or the decorator (they need a live `World`); the bone
  meal and decoration code follows the bytecode and is covered by behavioural tests, not by a replay.
- Third-person held flowers draw the flat sprite rather than ItemBlock's block transform.

## Merge notes

Flowers are appended to `BLOCKS` and referenced by `YELLOW_FLOWER` / `RED_FLOWER` (looked up by name), so other
blocks may be appended before them. `tools/verify-shadows.mjs` maps game ids by number (`42:37, 43:38`);
adjust it if the ids move, and regenerate `shadow-reference.json`.
