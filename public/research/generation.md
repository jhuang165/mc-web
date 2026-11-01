# Java world generation (WORLD-02c)

The live game still generates its own finite 128 × 128 × 64 terrain (generation versions 1–8). WORLD-02c ports the 1.7.10 Overworld generator piece by piece as tested modules, then switches a new generation version to it once the chunk provider streams a 256-high world. Each piece is replayed against the unchanged client classes before anything uses it.

| Slice | Scope | Status |
| --- | --- | --- |
| GEN-01 | Biome layers (`GenLayer.initializeAllBiomeGenerators`), the `BiomeGenBase` registry, `WorldChunkManager` | Done, not wired in |
| GEN-02 | Noise octaves and `ChunkProviderGenerate` terrain density, biome surface blocks, sea level 63 | Open |
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

- Nothing calls these modules yet: no terrain, no wiring into `World`, `main.js` or saves.
- `BiomeCache` never expires blocks (the client drops ones unused for 30 s); this does not change any value.
- No seed entry: `GuiCreateWorld`'s `Long.parseLong`, `hashCode` and random fallback come with GEN-06.
