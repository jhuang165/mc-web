GEN-04h (Claude): biome decorate overrides, replayed natively.

- `src/biome-decorator.js`: `BiomeDecoration(trees)` holds one world's `BiomeDecorators`, the shared `BiomeTrees` and the class-static `WorldGenDoublePlant`. `decorate(world, random, slot, blockX, blockZ)` is BiomeGenBase.decorate with every override, keyed by `BIOME_DECORATE` (slot → [class, parameter]):
  - plains counts, double grass and sunflowers;
  - desert wells (1/1000), hills emeralds and monster-egg veins;
  - forest double plants and the roofed grid;
  - taiga boulders and ferns, ice spikes and paths;
  - jungle melons and vines (draws only), savanna grass;
  - mutated biomes on the base decorator object; `aih` runs slot 29's whole decorate; `ait` uses its own decorator.
  - Plains count changes persist on the decorator object, as natively.
- `src/biome-features.js`: DoublePlant, DesertWells, Melon, Vines, IceSpike, IcePath and BlockBlob, plus the BlockDoublePlant place/stay rules.
- `src/gen-world.js`: BlockDoublePlant neighbour break (the bottom drops and clears the top with flag 2) and its drop rule.

Probe: BiomeOverrideProbe/verify-biome-overrides.mjs write `biome-overrides-reference.json`:
- ten natural-biome regions of native terrain, caves and ravines;
- 130 feature records, including `dpbreak`, which notifies soil, top and bottom removals and gets 202 drops;
- 80 decorate records with 208 decorations over all 59 slots.

`src/biome-overrides.test.js` replays calls, writes, pending ticks, drops, sounds, storage and RNG exactly. Mutation checks each fail the replay: roofed offset, plains grass, sunflower count, emerald height, mutated delegation, vine count, spike edge, blob passes/flags, double-plant top clearing and drops. The decorate-level 1/1000 well roll never hits; the well generator is replayed directly. Regeneration is byte-identical. npm test 742/742, build OK, bridge 5/5. Runtime stays 0.23.4 / generation 9; no Site publish.

Next:
- worldgen animals and snow/ice;
- the whole populate chain on one GenWorld (population-stage.js, then BiomeDecoration);
- versioned runtime integration.
