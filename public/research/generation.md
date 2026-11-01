# Java world generation (WORLD-02c)

The live game still generates its own finite 128 × 128 × 64 terrain (generation versions 1–8). WORLD-02c ports the 1.7.10 Overworld generator piece by piece as tested modules, then switches a new generation version to it once the chunk provider streams a 256-high world. Each piece is replayed against the unchanged client classes before anything uses it.

| Slice | Scope | Status |
| --- | --- | --- |
| GEN-01 | Biome layers (`GenLayer.initializeAllBiomeGenerators`), the `BiomeGenBase` registry, `WorldChunkManager` | Done, not wired in |
| GEN-02 | Noise octaves and `ChunkProviderGenerate` terrain density, biome surface blocks, sea level 63 | Done, not wired in |
| GEN-03 | `MapGenCaves`, `MapGenRavine` | Open |
| GEN-04 | `populate`: lakes, dungeons, `BiomeDecorator` ores/plants/trees, snow and ice | Open |
| GEN-05 | Structures (villages, strongholds, mineshafts, temples) | Open |
| GEN-06 | Integration: a streamed 256-high `World`, a new generation version, seed entry | Open |

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

- GEN-02 now consumes these modules for standalone terrain; there is no wiring into `World`, `main.js` or saves.
- `BiomeCache` never expires blocks (the client drops ones unused for 30 s); this does not change any value.
- No seed entry: `GuiCreateWorld`'s `Long.parseLong`, `hashCode` and random fallback come with GEN-06.

## GEN-02: terrain shape and biome surfaces

`src/noise.js` ports the pinned 1.7.10 `NoiseGeneratorImproved`, `NoiseGeneratorOctaves`, `NoiseGeneratorSimplex` and `NoiseGeneratorPerlin`. `src/terrain-generator.js` exposes `ChunkProviderGenerate(seed, type, biomeState?)`: `generateTerrain`, `density`, `replaceBlocksForBiome` and `provideChunk`. World types are `default`, `amplified` and `largeBiomes`; amplified changes positive biome height/variation during density blending, while largeBiomes changes only the GEN-01 layers.

`provideChunk(x, z)` returns `{x, z, blocks, metadata, biomes}` **before `MapGenCaves`**. Blocks are original numeric IDs in a `Uint16Array(65536)` (air 0), metadata is `Uint8Array(65536)`, and biome IDs are `Uint8Array(256)`. Block index is `(localX * 16 + localZ) * 256 + y`; biome index is `localX + localZ * 16`. Water occupies density-empty cells below y=63. This module is not called by `World` or `main.js`; runtime version and existing worlds are unchanged. Caves/ravines, structures, population, lighting and chunk construction are outside this slice.

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

GEN-03 is next: caves and ravines applied to these arrays. GEN-04/05 add population and structures; GEN-06 integrates the result with a streamed 256-high world. No full-generation or full-game parity is claimed.
