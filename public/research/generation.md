# Java world generation (WORLD-02c)

The live game offers finite 128 × 128 × 256 Java worlds (generation version 9, GEN-01 through GEN-03). Existing worlds and legacy landscape choices retain custom 128 × 128 × 64 terrain (versions 1–8). Generation ports are replayed against unchanged 1.7.10 classes; population, structures and streamed-world integration remain unfinished.

| Slice | Scope | Status |
| --- | --- | --- |
| GEN-01 | Biome layers (`GenLayer.initializeAllBiomeGenerators`), the `BiomeGenBase` registry, `WorldChunkManager` | Done, wired into Java worlds |
| GEN-02 | Noise octaves and `ChunkProviderGenerate` terrain density, biome surface blocks, sea level 63 | Done, wired into Java worlds |
| GEN-03 | `MapGenCaves`, `MapGenRavine` | Done, wired into Java worlds |
| GEN-04 | `populate`: lakes, dungeons, `BiomeDecorator` ores/plants/trees, snow and ice | Partial: GEN-04a population seeding/base ores, GEN-04b lakes, GEN-04c dungeons and the GEN-04d pre-decoration provider stage replay exactly; standalone, not wired into Java worlds |
| GEN-05 | Structures (villages, strongholds, mineshafts, temples) | Open |
| GEN-06 | Integration: streamed world, new generation version, seed entry | Partial: version 9 is playable at 256 height; finite viewport, no streaming |

## GEN-01: biome layers

`tools/probes/BiomeLayerProbe.java` and `tools/verify-biome-layers.mjs` run the unchanged classes from the SHA-1-pinned client after `Block.registerBlocks` and write [biome-layers-reference.json](biome-layers-reference.json), with the sha256 and MCP name of every class used. `src/biome-layers.test.js` replays it.

| Record | Count | What is checked |
| --- | --- | --- |
| biomes | 1 | Every occupied `BiomeGenBase` slot (61): id, name, class, temperature, rainfall, root height, height variation, temperature category, snow flags, integer rainfall, top block and metadata, filler block; the 40 static fields by letter |
| graph | 3 | The whole layer object graph for seed 8675309 as default, largeBiomes and default_1_1 (44/48/44 layers): class, base seed, world seed after init, inputs, Edge mode and `getInts(-6, -6, 12, 12)` of every layer |
| ints | 24 | River-mix and voronoi output over four areas each (negative, far and ±30,000,000 coordinates, odd sizes) for ten seeds (0, ±1, `Long.MIN/MAX_VALUE`, `"Overworld".hashCode()`, others), default and largeBiomes; default_1_1 and amplified for two of them |
| manager | 6 | `WorldChunkManager`: `getBiomesForGeneration`, `getBiomeGenAt` with and without the cache, single-block lookups, `getRainfall`, `areBiomesViable`, `findBiomePosition` with `new Random(seed + i)` (result and the next `nextLong`) |

Everything matches exactly.

### What exists

- **`src/java-long.js`.** 64-bit multiply and add on `[hi, lo]` int32 pairs, with results in the module's `H`/`L`; BigInt is used only for constructors and world seeds. `stringHash` is `String.hashCode`.
- **`src/java-biomes.js`.** The 256-slot biome list as data, `getBiome` (out-of-range ids give ocean), `isEqualTo` by class, and the `B` table of static biome ids.
- **`src/biome-layers.js`.** `GenLayer` (base seed, `initWorldGenSeed`, `initChunkSeed`, `nextInt`, `selectRandom`, `selectModeOrRandom`), all 21 layer classes, `initializeAllBiomeGenerators(seed, type)` returning `[riverMix, voronoi, riverMix]`, and `WorldChunkManager`. World types are `"default"`, `"largeBiomes"` (biome size 6), `"amplified"` and `"default_1_1"` (the old warm list).
- Cost: about 1.6 ms per chunk for the 10 × 10 generation read plus a 16 × 16 voronoi read, without the cache (Node on the owner's Mac).

### Quirks kept

- Slot 161 holds a biome whose own id is 160 ("Mega Spruce Taiga"): the layers emit 161, and the manager hands out the id-160 object.
- `GenLayerHills` does not override `initWorldGenSeed`, so the two zoom layers on its river input keep world seed 0.
- The first voronoi column in each row uses the unmasked parent value; later ones are `& 255`.

### Not done

- GEN-02 and GEN-03 consume these modules; version 9 now wires them into playable Java worlds. Streaming remains open.
- `BiomeCache` never expires blocks (the client drops ones unused for 30 s); this does not change any value.
- Version 9 now accepts full signed-long seeds and Java string hashes; blank entries use the browser's existing surprise-seed source rather than native `GuiCreateWorld` RNG.

## GEN-02: terrain shape and biome surfaces

`src/noise.js` ports the pinned 1.7.10 `NoiseGeneratorImproved`, `NoiseGeneratorOctaves`, `NoiseGeneratorSimplex` and `NoiseGeneratorPerlin`. `src/terrain-generator.js` exposes `ChunkProviderGenerate(seed, type, biomeState?)`: `generateTerrain`, `density`, `replaceBlocksForBiome` and `provideChunk`. World types are `default`, `amplified` and `largeBiomes`; amplified changes positive biome height/variation during density blending, while largeBiomes changes only the GEN-01 layers.

`provideChunk(x, z)` returns `{x, z, blocks, metadata, biomes}` **before `MapGenCaves`**. Blocks are original numeric IDs in a `Uint16Array(65536)` (air 0), metadata is `Uint8Array(65536)`, and biome IDs are `Uint8Array(256)`. Block index is `(localX * 16 + localZ) * 256 + y`; biome index is `localX + localZ * 16`. Water occupies density-empty cells below y=63. As of 0.23.0, the version-9 Java-world adapter calls this module; existing worlds keep their original generator. Caves/ravines, structures, population, lighting and chunk construction are outside this slice.

`tools/probes/TerrainProbe.java` and `tools/verify-terrain.mjs` execute the unchanged classes from client SHA-1 `e80d9b3bf5085002218d4be59e668bac718abbc6`. Research inputs remain ignored. The probe's constructor-free World double supplies seed, real WorldChunkManager and WorldInfo type; the original provider constructor, density and surface methods run normally. [terrain-reference.json](terrain-reference.json) includes class SHA-256s, SRG SHA-256 and mapped class/member symbols. `src/terrain-generator.test.js` replays every record exactly, with no numeric tolerance.

| Evidence | Count | Checks |
| --- | --- | --- |
| Noise | 15 | Five seeds (including both long extrema), 2D fast path, 3D Y-cache path, negative/far areas; Improved, four Improved octaves, four Simplex-based Perlin octaves, scalar Simplex and scalar Perlin |
| Constructor | 4 | All seven noise fields in original draw order (16/16/8 Improved, 4 Simplex, 10/16/8 Improved), all 25 parabolic float values and next Random.nextLong |
| Chunks | 62 | Default/amplified/largeBiomes, four seeds, negative coordinates and chunk ±1,874,999; all 825 density doubles, native chunk seed, complete pre-surface block hash, complete post-surface block/metadata hashes, all biome IDs, five full columns and post-surface RNG |
| Biome surfaces | 976 | Sixteen fixtures for every occupied biome slot: sea floors, cold water/ice, sandstone, cavities, high surfaces, surface-noise thresholds, negative/far columns, explicit-air Swamp water/lily-pad branches and null-air behavior; full column IDs/metadata and nextLong |
| Mesa sequence | 3 | One singleton Bryce biome reused across world seeds 23 → 42 → 0, with complete block/metadata hashes |

Natural chunk samples include ocean, Extreme Hills (including mutations), swamp, mega/mega spruce taiga, mutated savanna/plateau, Mesa/Bryce/forested plateau and Ice Plains Spikes. Block SHA-1 input is one little-endian uint16 original block ID per cell, with null and air both encoded 0. Metadata SHA-1 input is the unmodified byte array. Hashes cover all 65,536 cells; columns are additional inspectable evidence.

Bytecode details preserved:

- Java float arithmetic rounds each density-blending operation and the top fade; the 25 parabolic weights use float-rounded square roots. Double interpolation keeps the original evaluation order. Improved noise retains its fractional-Y gradient cache; Simplex's helper subtracts one at nonpositive exact integers. Octaves wrap integer X/Z offsets using Java signed remainder modulo 16,777,216.
- Surface reseeding is `x * 341873128712L + z * 132897987541L`, with signed long overflow and no world-seed XOR. All bedrock and surface draws use that stream.
- The surface pass transposes coordinates: it reads biomes/noise at `z + x * 16` and each biome writes blocks at `(z * 16 + x) * 256 + y`. Extreme Hills Edge and Extreme Hills+ have the stone-override exemption; mutated hills can use gravel. Mega taiga uses coarse dirt/podzol, mutated savanna stone/coarse dirt. Generic mutated biomes delegate surface generation to their parent.
- Swamp skips explicit `Blocks.air` but stops on **null**, so normal generated null air stops its scan at y=255. `surfaceColumn` accepts an optional explicit-air mask for the standalone fixtures; normal chunk generation needs none.
- Mesa clay-band offset samples X twice (Z is unused). On a world-seed change, Bryce pillar/roof noise is constructed from the previous stored seed, initially zero; band noise uses the new seed. Default generators share `BiomeTerrainState` like the native biome singletons. Pass a fresh state to model a fresh registry, or the same state to preserve cross-world history. This is intentional 1.7.10 behavior.

Performance: Node 20.20.2 on the owner's Mac, 24 warmup chunks followed by 128 generated chunks per type, excluding hashing: default **4.319 ms/chunk**, amplified **4.463 ms/chunk**, largeBiomes **4.419 ms/chunk**. Constructor time is excluded. These measurements describe this standalone port, not integrated browser frame time or full generation.

Validation: `npm test` **662/662**, `npm run build` passed, memory bridge **5/5** tests passed. No browser/server session was needed.

GEN-03 below now applies caves/ravines to these arrays. GEN-04/05 add population and structures; GEN-06 still needs streaming. No full-generation or full-game parity is claimed.

## GEN-03: caves and ravines (0.23.0)

`src/mapgen.js` ports 1.7.10 `MapGenBase`, `MapGenCaves` and `MapGenRavine` from `aqx`, `aqw` and `aqs`, using the pinned client and `javap`. `generate(chunkX, chunkZ, blocks)` mutates the original-ID 16 × 16 × 256 block array in place; metadata is untouched. The runtime calls caves, then ravines, after GEN-02 surfaces. `ChunkProviderGenerate.provideChunk` itself still returns the pre-cave stage, preserving the GEN-02 API and reference.

`tools/probes/CarverProbe.java` and `tools/verify-carvers.mjs` execute the unchanged native base driver and protected tunnel methods, and build complete terrain/surface/cave/ravine chunks. The probe reuses `TerrainProbe`'s pinned-World helpers; neither file patches game classes. [carver-reference.json](carver-reference.json) records class SHA-256s, SRG identities, full block hashes and the complete changed-cell lists, with these 218 records:

| Kind | Count | Evidence |
| --- | --- | --- |
| base | 12 | All 289 neighbor source coordinates and first random longs, four seeds including both long extrema, negative and far target chunks; 3,468 source-seed checks |
| tunnel | 108 | Caves and ravines, six seeds, branching tunnels and rooms, dry material stripes, both water-ID vetoes, low lava, surface grass restoration, negative chunks and stone-filled far/ceiling fixtures exercising the y=248 cap |
| viewport | 9 | Native spawn-biome search determines the finite runtime origin for three seeds × default/amplified/largeBiomes |
| chunk | 89 | Native input, cave-only and cave+ravine hashes; complete changed-cell lists and metadata hash; 62 GEN-02 chunk cases plus 27 viewport samples. Sixteen cases have ravine changes |

`src/mapgen.test.js` exactly replays the native data. Every float update uses Java rounding and the existing MathHelper sine/cosine table. Kept details include signed-long neighbor seed XOR, the eight-chunk range, nested cave-count rolls, recursive split draw order, the water scan's interior skip and room-path continuation after a water veto, only stone/grass/dirt being replaceable, and grass-top restoration from the biome's most recently selected surface block. Geometry uses Y one below the array write index. Caves write still lava (11), ravines flowing lava (10), at geometric Y < 10; upper carving is capped at 248. No structures, population, decoration or Nether carvers are included.

Performance on the owner's Mac/Node 20.20.2, 24 warmup chunks followed by 128 chunks: GEN-02 terrain/surface **4.765 ms/chunk**, caves **0.887 ms/chunk**, ravines **0.150 ms/chunk**, combined **5.802 ms/chunk**, excluding hashing, copying to runtime IDs and rendering.

## Playable Java worlds (generation version 9)

The owner requested runtime integration before the remaining generation slices. **Create New World** now defaults to **Java Overworld** and Creative, with **Java Amplified** and **Java Large Biomes** alternatives. These worlds run GEN-01 through GEN-03 in the live game, in a finite **128 × 128 × 256** viewport. Existing worlds and the Meadow/Highlands/Island/Snowy Tundra choices keep their original generation versions, 64-block height and edit/queue indexing. No saved terrain moves onto another generator.

`src/java-world.js` parses full signed-long seeds (text uses Java UTF-16 `String.hashCode`), uses native spawn-biome search to choose a chunk-aligned viewport around the seed's origin, then generates all 64 columns. Viewport origin is deterministic and exposed as `world.originX/Z`; local game coordinates are viewport coordinates, not the Java absolute coordinates. A safe local spawn prefers dry land with headroom. The runtime uses fresh biome singleton state per world load so the generated baseline is reproducible on save/reload. This finite adapter is **partial GEN-06**, not streamed infinite chunks or native WorldServer spawn logic.

The adapter maps native surface IDs to runtime IDs, adds sandstone (56), mycelium (57), stained clay (58) and lily pad (59), and preserves dirt/podzol, red sand and stained-clay metadata with original textures. The existing fluid model combines native flowing/still IDs; `runtimeSha1` normalizes 8→9 and 10→11 for that explicit mapping. Carver hashes retain their original IDs. Basic surface mining/collision/rendering exists; complete new-block behavior (mycelium spread, lily-pad placement/boats, all metadata/item rules) is not certified. The Creative catalogue is unchanged; surface blocks can be picked from terrain.

World columns, snapshots, light maps, player limits, mob reload, AI/arrow checks, weather, fire, farming and tree height limits now use each world's height. Java light-height maps use uint16 so a roof at 255 produces height 256 without wrapping. `JavaRandom` moved verbatim to a leaf module to avoid circular initialization, retaining its `lighting.js` re-export. Surface overrides retain their current top-block state for cave grass restoration. Biome temperatures and storm/snow eligibility read the Java biome; grass/foliage tint and rain rendering still have preset-level adaptations.

`src/java-world.test.js` checks 27 independently probed viewport chunk hashes/metadata, origin selection, full signed seeds, high edit and pending-tick JSON reloads, mobs above y=63, the y=255 light-map boundary and original surface textures. Existing legacy terrain/light fingerprints remain unchanged. Native shadow/isNormalCube probes were extended for the four new surface blocks. An existing limb-interpolation test now disables unrelated random sunlight ignition, avoiding intermittent hurt-swing failures.

Browser QA uses a separate local server with AudioContext stubbed before startup. A scratch Java world launches; a stone platform at y=180 and player position at y=181 survive save/title/page-reload/resume. The test page and server are closed afterwards. No Site publication.

Trees, ores, lakes, springs, decoration and initial snow population are **GEN-04**; structures are **GEN-05**. Java worlds are currently undecorated, so Creative is recommended. Streaming, per-chunk lighting/saves, exact biome tinting and broader integrated acceptance remain GEN-06. No full-generation or full-game parity is claimed.

0.23.0 validation: `npm test` **671/671**, `npm run build` and **5/5** memory-bridge tests pass. Browser save/reload/resume at y=181 passes with no console warnings/errors and audio stubbed.

## GEN-04a: population seeding and base ore generation

`src/ore-generator.js` ports `WorldGenMinable.generate` and the base `BiomeDecorator.generateOres` phase. It consumes original numeric block IDs through a world adapter (`getBlock` / `setBlock`) and the caller's Random stream. The caller must supply the stream **after preceding population stages**; directly seeding the ore pass with the population seed would put ores in the wrong places. This tranche is standalone; version-9 worlds and the app version remain 0.23.0.

`populationSeed` matches `ChunkProviderGenerate.populate` reseeding: two signed `nextLong / 2 * 2 + 1` multipliers, chunk coordinates, signed-long overflow and world-seed XOR. Java division truncates toward zero, so replacing that operation with a bitwise odd-number mask would change negative values.

The base decorator runs these passes in this exact order:

| Deposit | Attempts | Vein size | Starting Y |
| --- | --- | --- | --- |
| Dirt | 20 | 32 | Uniform 0–255 |
| Gravel | 10 | 32 | Uniform 0–255 |
| Coal | 20 | 16 | Uniform 0–127 |
| Iron | 20 | 8 | Uniform 0–63 |
| Gold | 2 | 8 | Uniform 0–31 |
| Redstone | 8 | 7 | Uniform 0–15 |
| Diamond | 1 | 7 | Uniform 0–15 |
| Lapis | 1 | 6 | `nextInt(16) + nextInt(16)` (0–30) |

Each pass replaces only original stone. Coordinates are drawn X, Y, Z without an extra eight-block origin offset; the minable generator itself offsets its vein endpoints by eight. Vein size controls the path, not a guaranteed block count. The port retains Java float endpoint/trigonometric math, inclusive path and cell loops, strict ellipsoid tests, X/Y/Z read order, metadata zero and update flag two, and unconditional true return even with no replacements. Bounds belong to the world adapter.

`tools/probes/PopulationProbe.java` and `node tools/verify-population.mjs` generate [population-reference.json](population-reference.json) from the unchanged SHA-1-pinned original classes, with class/SRG identities. Evidence includes:

- **24 population-seed records:** execute the real provider method up to its second `Random.setSeed`, then stop before features. Seeds include both signed-long extrema; chunks include negative and near-world-limit positions.
- **468 vein records:** six seeds, six sizes, solid/mixed materials, air/non-stone custom targets, same-target writes, crossing chunk boundaries, y=0/y=255 and both horizontal world edges. Every candidate read coordinate is SHA-1 hashed as three little-endian int32 values; every write records coordinates, block ID, metadata and flags in order, followed by the next random long.
- **42 complete base ore passes:** native constructor configuration and helper distributions, all 82 attempt positions, candidate reads, ordered writes and final Random state. Six cases run on 96 native terrain/surface/cave/ravine chunks, whose input hashes are independently replayed before applying ores. Their ore stream deliberately starts at 1234 to isolate this stage; it is not claimed to be the stream after lakes/dungeons.

`src/ore-generator.test.js` replays all 534 records exactly, including block query order and RNG. The native generator and decorator methods execute unchanged; World is a block-access double. Native Chunk mutation, lighting, notifications and whole-world population are not executed.

The verifier also records the full provider `populate` invocation order from `javap` bytecode, separately from execution: reseed; optional mineshaft/village/stronghold/scattered-feature population; conditional water and lava lakes; eight dungeon attempts; biome decoration; worldgen animals; ice/snow. Biome overrides may consume random draws before the base decorator's ore phase, and hills later add emeralds/monster eggs. An invocation listing does not prove execution of those branches.

Next GEN-04 work: lake and dungeon generators and their pre-decoration random consumption, followed by biome-specific decoration hooks, plants/trees/springs and snow/ice. Runtime integration needs a new generation version and cross-chunk population ownership so existing saves retain their baseline. GEN-05 structures and complete population-order/load-order acceptance remain open.

GEN-04a validation: `npm test` **675/675**, `npm run build` and **5/5** memory-bridge tests pass. Native reference regeneration is byte-identical. No browser QA was needed for this standalone module; live Java-world population is unchanged.

## GEN-04b: water and lava lakes

`src/lake-generator.js` ports unchanged 1.7.10 `WorldGenLakes.generate` (`arx`). It accepts original numeric water/lava IDs and a block-access adapter with material predicates, skylight, biome top block and freeze services. `isSolid` means `Material.isSolid`, not normal-cube or collision solidity. The caller owns bounds, neighboring chunks and the Random stream after provider gates. This standalone tranche keeps the runtime at 0.23.0 and generation version 9 unchanged.

`tools/probes/LakeProbe.java` and `node tools/verify-lakes.mjs` execute the SHA-1-pinned native lake class without modification. [lake-reference.json](lake-reference.json) records 516 cases: six seeds including both signed-long extrema; water/lava, flowing/still identity and material vetoes; solid/surface/dark/mycelium/cold/air/hollow/plant fixtures; descent and low/high Y; negative and horizontal world-edge coordinates. Twelve cases run across 48 native terrain/surface/cave/ravine chunks, with independently replayed input hashes. Their lake RNG starts at isolated seed 1234, not a claimed post-provider stream.

`src/lake-generator.test.js` exactly matches return values, every ordered setter call (coordinates, ID, metadata, flag two), the count and SHA-1 of ordered block/light/biome/freeze calls, and the following Random long. The reference also captures original material solidity/liquidity for numeric lookups 0–255 and class/SRG hashes, including material subclasses. Unregistered lookups resolve as the native registry does; this table does not enumerate additional registered blocks.

Preserved details: four to seven intersecting ellipsoids; X/Z/Y loop order; boundary validation before any carving; a second lower-boundary block lookup only for non-solid materials; exact block identity when retaining an existing liquid; grass/mycelium restoration only above lit dirt; lava rim random draws only on upper boundary cells (before checking solidity); water's 256 freeze-service calls at base+4, including columns outside the cavity. The cold fixture deliberately returns synthetic freeze decisions to verify caller behavior rather than certify native climate rules.

World services (skylight, biome top and freezing) are explicit fixtures even on native terrain inputs. The probe does not execute native Chunk storage, lighting, notifications or the full provider population method. No browser QA is needed for an unused module. Dungeons, provider gates and preceding RNG, biome overrides/decorators/trees/plants/springs/snow, structures and versioned cross-chunk runtime integration remain open. No live lake placement or complete population parity is claimed.

GEN-04b validation: `npm test` **678/678**, `npm run build` and **5/5** memory-bridge tests pass; native reference regeneration is byte-identical.

## GEN-04c: dungeons, chest loot and spawners

`src/dungeon-generator.js` ports unchanged 1.7.10 `WorldGenDungeons.generate` (`asd`) with its chest loot (`WeightedRandomChestContent`), the level-30 enchanted book (`ItemEnchantedBook.func_92114_b`, `EnchantmentHelper.buildEnchantmentList`) and the spawner mob pick. It uses original numeric IDs and a block-access adapter: block reads, `Material.isSolid` by ID, isAir, setters, setBlockToAir and tile lookup; chest tiles take `setSlot(index, stack)`, spawners `setEntityName`. Stacks are `[itemId, count, metadata, [[storedEnchantmentId, level], ...]]`. Runtime stays 0.23.0, generation version 9.

`tools/probes/DungeonProbe.java` and `node tools/verify-dungeons.mjs` execute the SHA-1-pinned classes unchanged. [dungeon-reference.json](dungeon-reference.json) holds 632 records: the native loot table, 24 enchantment level ranges and compatibility lists, and material solidity 0–255; enchantment candidate maps at levels 1–60; 256 seeded enchanted books with the next Random long; and 316 dungeon cases. These cover six seeds including both signed-long extrema across twelve synthetic fixtures (tunnel, solid, too many/five/six openings, floor and roof holes, unsupported floor, water, plants, missing chest/spawner tiles), 64 extra seeds, low/high/world-edge positions, and twelve rooms (six accepted) across 48 native terrain/surface/cave/ravine chunks with independently replayed input hashes.

`src/dungeon-generator.test.js` exactly matches return values, every ordered setter (coordinates, ID, metadata, flags), final chest slots and ordered slot writes with stored-enchantment tags, the spawner mob, the count and SHA-1 of ordered block/air/setter/tile calls, and the following Random long.

Preserved details: room half-sizes drawn before any lookup; floor/roof vetoes and the one-to-five two-high wall-opening count inside a single X/Y/Z scan; carving from y+3 down to y-1; boundary cells become air when the block below is not solid, else mossy cobblestone (3 in 4 on the floor) or cobblestone only where solid; two chests, three placement attempts each, requiring exactly one solid horizontal neighbour. The enchanted book is generated (two `nextInt(1)` enchantability draws, level, weighted picks over Java `HashMap` iteration order, compatibility filtering and halving extra-pick loop) before the tile lookup, so it consumes Random even when the chest tile is missing. Eight weighted picks overwrite random slots without merging. Rooms at y=1 lose their whole floor, because y=0 has no solid block below (reads below y=0 return air). A book with no candidates would stay a plain book (ID 340); this cannot happen at level 30.

No native Chunk mutations, neighbour/lighting notifications, live container acceptance, spawner ticking or provider placement are executed. Natural cases use isolated feature seeds (1000+), not post-lake provider streams. Provider placement and its RNG (eight dungeon attempts at x+nextInt(16)+8, nextInt(256), z+nextInt(16)+8 after the lakes), biome decorators/trees/plants/springs/snow, structures and versioned cross-chunk runtime integration remain open. The browser has no loot-chest generation, spawner block or enchanted books yet.

GEN-04c validation: `npm test` **682/682**, `npm run build` and **5/5** memory-bridge tests pass; native reference regeneration is byte-identical.

## GEN-04d: provider population up to biome decoration

`src/population-stage.js` (`populateBeforeDecoration`) ports `ChunkProviderGenerate.populate` from its first line to the `biome.decorate` call. It composes the GEN-04a seed and the GEN-04b/c generators in native order, over one world adapter covering both generators plus `biome(x, z)`:

1. Read the biome at (chunkX·16 + 16, chunkZ·16 + 16) before reseeding; then reseed with `populationSeed`.
2. Optional map features (`structures` callback): mineshaft, village, stronghold, scattered feature, on the same Random. Only the village result is kept.
3. Water lake: skipped without a draw in Desert or Desert Hills (compared by biome object, slots 2 and 17; mutated Desert M is not excluded) or after a village; otherwise `nextInt(4) == 0`, then X = x0 + nextInt(16) + 8, Y = nextInt(256), Z = z0 + nextInt(16) + 8 and `WorldGenLakes(Blocks.water)` (still water, ID 9).
4. Lava lake: skipped without a draw after a village; otherwise `nextInt(8) == 0`, then X, Y = `nextInt(nextInt(248) + 8)` (inner draw first), Z, and only at Y ≥ 63 a further `nextInt(10) == 0`. `WorldGenLakes(Blocks.lava)` (still lava, ID 11).
5. Eight dungeon attempts, each X = x0 + nextInt(16) + 8, Y = nextInt(256), Z = z0 + nextInt(16) + 8, even after a village.

The Random is then left exactly at the decorator's input. The gate order was read from `javap` bytecode and is now executed.

`tools/probes/PopulationStageProbe.java` and `node tools/verify-population-stage.mjs` run the unchanged native method on a Random subclass that throws at the first draw whose stack holds any BiomeGenBase or BiomeDecorator class (24 classes). World calls from those frames stop it the same way. Decorator state is cleared afterwards. [population-stage-reference.json](population-stage-reference.json) has 77 records on 308 native terrain/surface/cave/ravine chunks, with input hashes for three world seeds:

- chunks −1..2 squared per seed;
- three chunks per seed in "stubs" and "village" map-feature modes, where stand-ins log their order and coordinates and draw nothing;
- the nearest Desert and Desert Hills chunks per seed;
- searched chunks until three dungeons are accepted (five chests), plus an accepted lava lake and both outcomes of the Y ≥ 63 lava draw.

Six records place water lakes and two place lava lakes; others draw and reject them. `src/population-stage.test.js` replays every record exactly: the biome, the provider's own ordered `nextInt` bound/value draws, structure call order, write count/SHA-1/ID histogram, final chest slots/NBT and spawner names, 59,679 ordered block/light/biome/freeze/tile calls (count and SHA-1) and the next Random long at the decorator's input.

Sky light and freeze results are explicit fixtures (`floorMod(31x + 7y + 17z, 5) == 0 ? 0 : 15`, `floorMod(7x + 13z, 11) == 0`), not native lighting or climate. Real structure generation and its Random consumption are GEN-05; the hook only fixes where it runs. Decoration (biome overrides, base decorator, trees, plants, springs), worldgen animals, snow/ice, native Chunk storage/lighting/notifications and live placement in Java worlds remain open. Runtime stays 0.23.0, generation version 9.

GEN-04d validation: `npm test` **684/684**, `npm run build` and **5/5** memory-bridge tests pass; native reference regeneration is byte-identical.
