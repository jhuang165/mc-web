# Snow, ice and the cold biome (Minecraft Java 1.7.10)

Target: 1.7.10 only. This is not full parity; see "Differences and gaps" below.

## Method

Class names are the obfuscated ones in the 1.7.10 client JAR (SHA-1 `e80d9b3b...`), found with `javap -c -p` and cross-checked against `tools/research/joined-1.7.10.srg`. `tools/probes/SnowProbe.java` runs the unchanged original `World`, `BiomeGenBase`, `BlockSnow`, `BlockIce`, `BlockSnowBlock`, `BlockGrass` and `Material` classes on a fake world (allocated without constructors, like the weather probe), and `tools/verify-snow.mjs` compiles and runs it (`node tools/verify-snow.mjs`; needs a JDK and the ignored JAR in `tools/research/`) and writes `public/research/snow-reference.json` with SHA-256 digests of the 18 classes it read. `src/snow.test.js` replays the reference against `src/snow.js`, `src/world.js` and `src/weather.js`; `src/snow-integration.test.js` covers the survival, mining, creative, texture and friction wiring.

| 1.7.10 class | MCP name |
|---|---|
| `ahb` | World (`d` canBlockFreeze, `e` canSnowAt, `r`/`s` canBlockFreeze with `noWaterAdj` false/true, `h` getPrecipitationHeight, `b(ahn,III)` getSavedLightValue) |
| `ahu`, `aij` | BiomeGenBase, BiomeGenSnow (Ice Plains) |
| `aji`, `ajn` | Block, Blocks (`aC` snow_layer, `aD` ice, `aE` snow) |
| `ann` | BlockSnow (snow layer) |
| `alp` | BlockIce |
| `anm` | BlockSnowBlock (the "Snow block", internal id 23) |
| `alh` | BlockGrass (snowed side) |
| `aec`, `abe`, `abh` | ItemSnow, ItemBlockWithMetadata, ItemBlock |
| `ady` | ItemSpade (a shovel harvests snow) |
| `aqz` | ChunkProviderGenerate (`populate` freeze and snow pass) |
| `mt` | WorldServer (`func_147456_g`, the per-chunk weather tick) |
| `blt` | EntityRenderer (`e` renderRainSnow) |
| `awt` | Material |
| `aib` | WorldChunkManager |

## Ids in this build

| Block / item | Id | Notes |
|---|---|---|
| Snow layer | 46 (`SNOW_LAYER`), original 78 | metadata 0 to 7 = layers - 1, stored in the tracked edit as `block | meta << 8` |
| Ice | 47 (`ICE`), original 79 | |
| Snow block | 23 (already present), original 80 | `snow.png`, drops 4 snowballs with a shovel |
| Placeholder | 45 | hidden `Fire` entry reserved for the fire port; it is not a snow block |

## Ported, and how it is checked

Evidence key: **probe** = replayed against the original classes in `snow-reference.json`; **bytecode** = transcribed from `javap` output only, covered by behavioural tests but not by a probe replay.

| Part | File | Evidence |
|---|---|---|
| Biome facts of the four presets: temperature, rainfall, `canSpawnLightningBolt`, `getEnableSnow` (Plains 0.8/0.4, Extreme Hills 0.2/0.3, Ice Plains 0.0/0.5, snow on, no lightning) | `biomes.js` | **probe**: 40 biome rows |
| Block facts: light opacity (snow layer 0, ice 3), `renderAsNormalBlock`, `isOpaqueCube`, slipperiness (ice 0.98, else 0.6), `getTickRandomly`, `blocksMovement`, hardness (snow layer 0.1, ice 0.5, snow block 0.2) | `world.js`, `lighting.js`, `survival.js` | **probe**: 12 blocks |
| Snow layer boxes: collision `meta * 1/8` tall (none at meta 0), selection `(meta + 1) / 8` | `world.js` `blockBounds`, `snowSelectionHeight`, `solid`, `raycast`, `projectiles.js` | **probe**: 16 metadata values |
| `canBlockFreeze` (`d`, `r`, `s`): temperature over 0.15 fails, `0 <= y < 256`, block light under 10, a source water cell, and with `noWaterAdj` at least one non-water horizontal neighbour | `snow.js` | **probe**: 360 rows plus 7 heights |
| `canSnowAt` (`e`) and `BlockSnow.canPlaceBlockAt`: cold, dark, air cell, never on ice, leaves and a full layer accept snow, otherwise an opaque cube | `snow.js` | **probe**: 504 rows (14 supports, 3 cells) |
| Melting: a snow layer at block light over 11 becomes air, ice at over 8 becomes still water | `snow.js` `meltResult` | **probe**: all 16 light levels |
| `BlockSnow.onNeighborBlockChange`: a layer that can no longer stand disappears without a drop | `snow.js` `snowFalls`, `main.js` | **probe**: 14 supports |
| `ChunkProviderGenerate.populate` freeze and snow pass (`r`, then `e`) over every column, top block first, then lakes | `snow.js` `populateColumn`, `populateSnow`, `world.js` `generate` (version 6) | **probe** (fixture terrain, 247 events), loop from **bytecode** |
| `WorldServer.func_147456_g`: per chunk per tick, thunder roll, then `nextInt(16)` column with `s` (ice) and a rain-gated `canSnowAt` (snow), then three random ticks per 16-high section that holds ticking blocks, with `updateLCG = updateLCG * 3 + 1013904223` | `weather.js` `tickChunk` | **probe** rules, loop from **bytecode**: 133 events over 4 chunks and 600 ticks, two runs |
| `renderRainSnow` snow branch: columns drawn with `environment/snow.png` when the biome temperature is under 0.15 and the biome precipitates; seed `x*x*3121 + x*45238971 ^ z*z*418711 + z*13761`; scroll `((count & 511) + partial) / 512`; `u = nextFloat + (count + partial) * 0.01 * nextGaussian`, `v = nextFloat + (count + partial) * nextGaussian * 0.001`; alpha `((1 - d^2) * 0.3 + 0.5) * rain`; brightness `(light * 3 + 15728880) / 4` | `weather-renderer.js`, `lighting.js` `JavaRandom.nextGaussian` | **bytecode**; `nextGaussian` checked against `java.util.Random`; browser check (no rain splashes or rain sound while snowing) |
| Rain or snow is now chosen per column from the biome and temperature at that column (no longer one world-level choice), so streamed worlds snow only in cold biomes and desert/savanna/mesa columns get nothing | `weather.js` `precipitationKind`, `weather-renderer.js` | **bytecode** |
| `World.canLightningStrikeAt`: biomes with `getEnableSnow` never take lightning; no thunder roll effect in Ice Plains | `weather.js` | **probe** (weather probe biome table plus the snow biome rows) |
| Snow layer item: clicking a layer below full height with the snow item adds one layer (`(meta & 7) <= 6`), with sound `dig.snow` at 80% pitch; placing another block item on a one-layer snow replaces it; the layer needs `canPlaceBlockAt` | `main.js`, `snow.js` `stackedSnowMeta` | **bytecode** (`aec.onItemUse`, `abh.onItemUse`); unit test of the rules |
| Breaking: a snow layer harvested with a shovel drops `meta + 1` snowballs, nothing else drops it (`ItemSpade` effective on snow and snow block, material needs a tool); ice drops nothing and, without silk touch, leaves flowing water when the block below blocks movement or is liquid (survival only) | `main.js` `breakBlock`, `survival.js`, `mining.js` | tool speed, harvest and break ticks: original `ItemSpade`/`ItemPickaxe` classes via `tools/verify-mining.mjs` (snow layer and ice added to its mapping); drop and water rules **bytecode** |
| Slipperiness: the block under the feet scales friction for the player, mobs and item entities (`slipperiness * 0.91`, items `slipperiness * 0.98`) | `main.js`, `entities.js`, `item-entities.js` | **probe** (0.98) plus unit tests |
| Sounds: snow uses `step.snow`/`dig.snow`; ice breaks with `random.glass` and otherwise follows the glass entry | `audio.js`, `main.js` `sound` | **bytecode** (`soundTypeSnow`, `soundTypeGlass`); the 163 audio files of the manifest already contain them |
| Textures: `blocks/snow.png`, `blocks/ice.png`, `blocks/grass_side_snowed.png`, `environment/snow.png`; grass shows the snowed side when the block above is snow or a snow block, and its top and tint follow the preset's temperature and rainfall | `block-textures.js`, `scene.js` | provenance manifest; unit test |
| Rendering: a layer is drawn `(meta + 1) / 8` tall and its top is always drawn; ice is a translucent pass (depth pre-pass then blended colour, like water) with ice-to-ice faces culled | `scene.js` | browser check |
| Creative inventory: ice after diamond block in Building Blocks, snow layer after the furnace in Decoration Blocks, both in the search order | `creative.js`, `tools/inventory-replay.mjs` | original lists in `creative-reference.json`; `inventory-reference.json` regenerated |
| Shadows: snow layers and the fire placeholder take no shadow, ice takes one | `shadows.js`, `tools/verify-shadows.mjs` | **probe** (`shadow-reference.json` regenerated) |
| Preset `snowy` ("Snowy Tundra") and `generationVersion` 6; presets generated at versions 1 to 5 are unchanged, and meadow, alpine and island generate exactly as before at version 6 | `main.js`, `world.js` | unit test (4 seeds per preset) |

## Differences and gaps (not ported)

- **Terrain and trees.** The snowy preset reuses the meadow terrain, so there are oak trees rather than spruce, no ice spikes, no frozen rivers, and no passive-mob clearing for Ice Plains. Flowers and grass use the default decorator counts. Biome facts are those of Ice Plains (id 12); the other cold biomes (Taiga, Frozen Ocean, Frozen River, Ice Mountains) are not presets.
- **Populate order.** Vanilla runs the freeze and snow pass per chunk with an offset of 8 blocks and only after its decorators; here it runs over every column once after generation, and lakes (`WorldGenLakes`) never freeze (the cell it checks is air above the water in this build).
- **Random-tick set.** `Chunk` tick counts are approximated by the `ticksRandomly` table of this build's blocks; blocks it has no counterpart of (packed ice 174, fence 85) are not in the fixtures.
- **Light.** The freeze and melt rules read block light only (as `getSavedLightValue(Block)` does). At generation the block light is a lava breadth-first fill; in play it is the scene's light volume.
- **Temperature and height.** The 1.7.10 height term of `getFloatTemperature` never applies: the world is 64 blocks high.
- **Renderer.** The snow branch of `renderRainSnow` is from bytecode only (LWJGL is not available to execute it); the fast-graphics variant is not ported.
- **Stacking collision.** Adding a layer checks the player's box with `collides`, not every entity's box (`checkNoEntityCollision`).
- **Ice in creative.** Breaking ice in creative removes it without water, as the original does (`harvestBlock` is not called); the Nether (`isHellWorld`) rule does not apply.
- **Silk touch** is not in the game, so ice never drops itself and a snow layer or snow block is never kept whole.
- **Packed ice, snow golems, frostbitten mobs** are not implemented. `tools/verify-mining.mjs` has a wear check that already failed before this work (it reads a `durability` field `Survival` no longer has); its speed, harvest, progress and break-tick checks passed for the new blocks, but `mining-reference.json` was not regenerated.

## Regenerating the reference

```sh
node tools/verify-snow.mjs      # needs a JDK and tools/research/minecraft-1.7.10.jar
node tools/verify-shadows.mjs   # shadow-reference.json, with 45 to 47 in MC_BLOCKS
```
