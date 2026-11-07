# World spawn point and player spawn placement (1.7.10)

Target: Minecraft Java 1.7.10 (client SHA-1 `e80d9b3b...`). Parity with 1.7.10 is not claimed. Code: `src/world-spawn.js`
(`createSpawnPosition`, `playerSpawnPoint`, `topSolidOrLiquidBlock`), `nativeWorldSpawn` in `src/java-world.js`, `nativePlayerSpawn`
in `src/world.js`. Test: `src/world-spawn.test.js`. Reference: `public/research/spawn-reference.json`, written by
`tools/verify-spawn.mjs` from `tools/probes/SpawnProbe.java` (needs a JDK and the pinned jar; `MC_RESEARCH` points at `tools/research`).

## Probed (executed natively against the unchanged jar)
- `WorldServer.createSpawnPosition` (`mt.b(WorldSettings)`) itself, on a WorldServer allocated without constructors: its real
  `findBiomePosition(0, 0, 256, ...)` with `new Random(seed)`, the walk, `WorldProvider.canCoordinateBeSpawn` (`aqo.a(II)`),
  `World.getTopBlock` (`ahb.b(II)`) and `WorldInfo.setSpawnPosition` (captured). Chunks come from the unchanged
  `ChunkProviderGenerate` (`aqz`, with caves and ravines; structure generation off, which writes no blocks) or `ChunkProviderFlat`
  (`aqu`). 84 records: 36 default seeds, 8 Large Biomes, 8 Amplified (1.7.10 has `WorldType.AMPLIFIED`), the 8 Superflat presets x 4
  seeds. The replay matches spawn x, y, z and the findBiomePosition result for all 84.
- `World.getTopSolidOrLiquidBlock` (`ahb.i(II)`) on the same chunks at 25 columns around every spawn (2100 values), replayed.
  Finding: despite its name it tests `Material.blocksMovement` (`awt.c()`) and not leaves, so water and lava are skipped.

## Bytecode-read only (not executed)
- The `EntityPlayerMP` constructor placement (`mw.<init>`): start at the world spawn; when the provider has sky (`aqo.g` false) and the
  game type is not Adventure, `k = max(5, spawnProtectionSize - 6)` (the size is 16 on the integrated server, `MinecraftServer.ao()`),
  `x += rand.nextInt(2k) - k`, `z += rand.nextInt(2k) - k` (x first), `y = getTopSolidOrLiquidBlock(x, z)`; then `setPosition(x + 0.5, y, z + 0.5)`
  and `y += 1` while `getCollidingBoundingBoxes` is non-empty. The Random is the entity's own unseeded `Random`, so only the structure is
  tested (a seeded `JavaRandom` is injected). Respawn without a usable bed runs the same constructor.
- `createSpawnPosition` call order: `provider.canRespawnHere()` false sets (0, averageGroundLevel, 0); otherwise the steps above, then
  `setSpawnPosition(x, getAverageGroundLevel(), z)` (64; 4 for WorldType.FLAT), then the bonus chest (`WorldServer.k`) when enabled.
  The browser's bonus chest is still placed on first open (`bonus-chest.js`), at the stored spawn.

## What the port does
- The spawn walk: Random seeded with the world seed, first `findBiomePosition`, fallback (0, 0) when none (the native "Unable to find spawn
  biome" warning), then at most 1000 steps of `x += nextInt(64) - nextInt(64)`, `z` likewise, stopping at the first grass top. Superflat
  top blocks are rarely grass at y 63, so most flat worlds walk all 1000 steps and end far from the origin (the replay shows it); the
  Overworld preset and Tunnelers' Dream (grass at the top) stop at once.
- Terrain at the walked columns is generated on demand by the port's own providers (terrain, caves, ravines; no population). Natively the
  walk also loads isolated chunks without population, since ChunkProviderServer populates only when three neighbours exist. Caves and
  ravines only remove blocks and grass only tops uncarved columns, so the carving step is skipped for columns whose uncarved top is not
  grass (exact, only an optimisation). Cost: about 35 ms to 5 s per new world (the worst probed seeds walk 190 to 450 chunks).
- New worlds record `world.nativeSpawn = [x, 64, z]` (native coordinates) and `record.worldSpawn` is that minus the origin, so the
  compass, `/setworldspawn` readers and the bonus chest use it. `World.spawn()` (new world and every respawn without a bed) applies the
  EntityPlayerMP fuzz with the live world: the collision test is the existing `collides()`, the material test `solid()` (a stand-in for
  `blocksMovement`) and not leaves. Entity boxes are not considered. The adventure flag is accepted but nothing passes it yet.

## Generation gate (decision)
The finite 128x128 window is placed from the spawn chunk (`originX = (spawnChunk - 4) * 16`), and all content depends on the origin, so
a changed spawn would move every block of an existing save. Therefore it is a new streamed generation: 18 is 16 plus the native spawn, and 19
is 17 (MapFeatures off) plus it. Worlds saved at 12, 13, 15, 16 and 17 keep the earlier findBiomePosition-only origin and their stored
`worldSpawn`; level.dat imports (`levelGenerator`) and `region-import.js` stay at 16/17 since those saves carry their own spawn. New
streamed worlds created by the menu use 18. `mapFeaturesOn(v)` replaces `v < 17` (it is false for 17 and 19), and structure data export
includes 18.

## Gaps
- Population is not modelled in the walk (matches the native isolated-chunk load, but a native populated neighbour from an earlier load,
  such as a saved world's chunks, is not considered); the probe runs on a world double, not a full integrated server.
- Player placement was not executed natively (bytecode-read); `solid()` approximates `Material.blocksMovement` for live block ids.
- The bonus chest still has standing torches (no `onBlockAdded` orientation) and is placed on first open.
