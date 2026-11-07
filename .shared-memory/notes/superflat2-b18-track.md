# Superflat and generator leftovers (batch 18, branch b18-superflat2)

## Summary
- Native probe of the unchanged `ChunkProviderFlat` (aqu) populate: `tools/probes/FlatPopulateProbe.java`, `tools/verify-flat-populate.mjs`,
  `tools/probes/flat-populate-areas.json` -> `public/research/flat-populate-reference.json` (44 areas, 949 chunks) -> `src/flat-populate.test.js`.
  No divergence found in the JS call order, writes or Random state; the replay already matched. Each area runs in its own JVM (native jungle temple
  static state leaks into later areas in one JVM).
- `mapFeatures` parameter added to `FlatStructureCache`/`FlatStructurePopulation` (flat-structures.js), `PopulationArea` (population-world.js) and
  `StreamingPopulation` (streaming-population.js).
- MapFeatures off is streamed generation 17 (`NO_MAP_FEATURES_GENERATION` in java-world.js); `levelGenerator` returns 17 and no `approximate` entry.
- Bonus chest: native `World.rand` is unseeded, so the game uses `unseededBonusRandom(JavaRandom)`; tests inject a fixed Random.

## Tests
- `src/flat-populate.test.js` (45), `src/map-features-off.test.js` (gen 17 gates; 13/15/16 untouched), `src/bonus-chest.test.js`, `src/biome-generation-gate.test.js` (17 for MapFeatures off).

## Generation change
Version 17 only. Existing seeds at 13, 15 and 16 produce the same output; new level.dat imports with MapFeatures off use 17 (no mineshafts, villages,
strongholds or temples). World accepts 12, 13, 15, 16, 17; region-import `options.generationVersion` accepts 13, 15, 16, 17.

## Remaining gaps
- Live `PopulationArea` has no native `neighborChanged` chain: village/stronghold/desert temple read-call streams are not compared (writes are);
  jungle temples miss 8-10 updater writes, their World.rand draws and pending ticks.
- Native-only call order was not compared in a full WorldServer (no light engine or entity ticking in the probe).
- Superflat spawn point still uses `World.spawn`, not `canCoordinateBeSpawn`; biome hole ids throw natively, the port uses plains.
- Bonus chest torches are placed standing (meta 5) without `onBlockAdded`; Material checks use the live `World.solid`.

## Proposed one-line replacements for remaining-gaps.md (lead merges)
- Item 11: `11. Superflat world type and its customization screens. Partial: generator, presets, Customize/Presets screens, level.dat export and import, and ChunkProviderFlat.populate (44 native areas, structures, lakes, dungeons, decoration, mapFeatures on/off) are in ([superflat.md](superflat.md)); Add/Edit Layer are hidden as in 1.7.10; live-world door/redstone/tripwire neighbour reads and jungle-temple updater writes are not replayed.`
- Item 12: `12. Bonus chest (WorldGeneratorBonusChest). Partial: contents and placement replayed against the jar ([superflat.md](superflat.md)); the game uses an unseeded Random like World.rand (native contents differ per creation); torches are placed standing without onBlockAdded.`
- level.dat line: `MapFeatures off: Done (batch 18, generation 17, level-dat.md): streamed generation without any structure generator and with the native mutated-biome rule, for default and Superflat worlds.`
