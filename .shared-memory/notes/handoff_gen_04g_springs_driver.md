GEN-04g (Claude): springs and the BiomeDecorator driver, both replayed natively.

- `src/gen-world.js`: a generation World (`GenWorld`, `GenChunk`) over native-layout Chunk arrays. It has sections, the generateSkylightMap height map, func_150807_a setBlock order, neighbour notification, onBlockAdded/breakBlock, func_147480_a drops, and WorldServer scheduling. Immediate mode ticks every block but fire at once (Block.L() defaults to true), so sand/gravel fall instantly and liquids cascade. It also runs the full dynamic/static liquid tick. Callbacks it does not port throw, so a new block type fails loudly instead of being guessed.
- `src/springs.js`: WorldGenLiquids (asm).
- `src/biome-decorator.js`: decorateChunk/genDecorations (aia), with `pickFlower` (func_150572_a: base, aip plains noise for slots 1/129, aif type 1 for slot 132, aiv for slot 6; noise is the static Perlin(Random 2345)). `BiomeDecorator(slot)` and `BiomeDecorators` give one decorator per slot; pass one shared `BiomeTrees` per world.
- `src/gen-world-recording.js`: test-side call/write hashing, effects and the storage hash, shared by both replays.

Probes:
- SpringProbe/verify-springs.mjs: 140 records (748 placed, 73 rejected) on a synthetic cave fixture.
- BiomeDecoratorProbe/verify-biome-decorator.mjs: 70 records with 178 decorations on 4×4 regions of native terrain, caves and ravines (5 seeds), covering all 59 slots whose `ahu.ar` is the base aia. It calls `ahu.ar` directly, so biome decorate overrides are not exercised.

Both probes replay the ordered calls, writes, pending ticks, drops, sounds, aux, final chunk storage and RNG exactly. Regeneration is byte-identical, and a mutation check (flower forest remap) fails the replay. npm test 730/730, build OK, bridge 5/5. App 0.23.3, generation 9, no Site publish. PROJECT.md's earlier "728" count was 726 before GEN-04g.

Next:
- biome decorate overrides: emeralds and silverfish, double plants, desert wells, the roofed-forest grid, ice spikes, mutated delegation (the base decorator with the mutated biome), mesa/savanna/taiga extras;
- animals and snow/ice;
- the whole populate chain on one GenWorld (population-stage.js, then decorate), then versioned runtime integration.
