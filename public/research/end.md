# The End: generator, crystals, dragon egg (batch 6, end-gen track)

Target is 1.7.10. Not full parity; the Ender Dragon, its healing beam and End travel are not built here.

## Evidence
`tools/probes/EndProbe.java` runs the original classes and writes `end-reference.json` (106 records: 60 terrain, 4 population, 4 spikes, plus egg, crystal and exit portal cases). `tools/verify-end.mjs` and `src/end.test.js` compare the port against it.

## What is done
- `src/end-generator.js`: ChunkProviderEnd terrain (density grid and blocks), BiomeEndDecorator, WorldGenSpikes. Bit-exact for the probed seeds and chunks.
- `src/exit-portal.js`: EntityDragon.createEnderPortal as a pure function (setBlock call list).
- `src/dragon-egg.js`, `dragon-egg-live.js`: block 122 maps to internal slot 171. Falls after a 5 tick delay, click and punch teleport (1000 tries in a 16/8/16 box, 128 portal particles), 8 box render shape, texture, region round trip. Native 1.7.10 has no Creative entry, so none is listed.
- `src/ender-crystal.js`, `ender-crystal-mobs.js`: fires in the End when `world.isEnd === true`; any damage explodes it once at power 6, flaming, through the explosion pipeline. `/summon EnderCrystal`; region export name `EnderCrystal`.
- `src/ender-crystal-renderer.js`: RenderEnderCrystal rig (two glass cubes, inner cube, base, spin 3 deg per tick, bob). Derived from bytecode, not run.

## Gaps
- Batch 69 (docs sweep): this line is from the first crystal slice. The dragon (`dragon-mobs.js`, `dragon.md`), the End dimension and travel (`dimension-live.js`, `end-generator.js`, `exit-portal.js`) and the dedicated server End now exist; the crystal healing beam was not re-checked here.
- Nothing browser-verified (no render check of the crystal).
- Crystal `innerRotation` is not seeded; only its range is checked.
- Vanilla world import does not list EnderCrystal (the importer defaults health to 20); saved game worlds round trip.
- Egg teleport: client particle destination mismatch kept as in the original. The unloaded-chunk instant-fall branch is not modelled.
- Exit portal torch metadata is left to the lead's callbacks.
- `ignite` depends on `fire.js`.
