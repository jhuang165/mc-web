# World spawn point and player placement (batch 19, spawnpoint track)

## Summary
- `src/world-spawn.js`: port of `WorldServer.createSpawnPosition` (findBiomePosition, "Unable to find spawn biome" fallback, up to 1000 steps of
  `x += nextInt(64) - nextInt(64)` until `canCoordinateBeSpawn`, `setSpawnPosition(x, averageGroundLevel, z)`), `getTopSolidOrLiquidBlock` and the
  EntityPlayerMP spawn fuzz (radius max(5, protection - 6), then move up while colliding).
- `nativeWorldSpawn` (java-world.js) generates columns on demand with the port's providers; new worlds store `world.nativeSpawn`; `World.spawn()` applies the fuzz
  (new world and respawn without bed). main.js hooks: `record.worldSpawn` from `nativeSpawn`; new streamed worlds at generation 18.
- Generation gate: 18 = 16 + native spawn, 19 = 17 + native spawn; 12-17 keep the earlier origin (origin decides block positions). `mapFeaturesOn(v)` replaces `v < 17`.
  `World` accepts 18, 19; `STRUCTURE_DATA_VERSIONS` adds 18. level.dat and region imports stay at 16/17.

## Native evidence
- Probed (executed): unchanged `mt.b` (createSpawnPosition) with real findBiomePosition/walk/canCoordinateBeSpawn/getTopBlock on `ChunkProviderGenerate`/`ChunkProviderFlat`
  chunks, 84 records (36 default, 8 Large Biomes, 8 Amplified, 8 Superflat presets x 4); unchanged `ahb.i` (getTopSolidOrLiquidBlock) at 25 columns per record.
  `tools/probes/SpawnProbe.java`, `tools/verify-spawn.mjs`, `public/research/spawn-reference.json`.
- Bytecode-read: EntityPlayerMP constructor placement, `mt.b` call order incl. bonus chest `k()`, `aqo.i()` (64 / 4 flat), `MinecraftServer.ao()` = 16.
- Finding: `getTopSolidOrLiquidBlock` uses `Material.blocksMovement` only (water/lava skipped).

## Tests
- `src/world-spawn.test.js` (6): replay of all 84 records, walk edge cases, player fuzz, generation gate, a generation 18 world. Full `npm test` and `npm run build` pass.

## Remaining gaps
- No population in the walk (as the native isolated-chunk load); probe uses a world double, not a full server. Player placement not executed natively;
  entity boxes ignored; `solid()` stands in for blocksMovement. Adventure flag not wired. Bonus chest torches still standing (no onBlockAdded), chest placed on first open.
- Worst-case world creation walks 190-450 chunks (about 2-5 s).

## Proposed remaining-gaps lines
- Superflat spawn: `Done (batch 19, world-spawn.md): native createSpawnPosition walk and EntityPlayerMP spawn fuzz for new worlds (generation 18/19, 84 native records); older saves keep their origin.`
- Bonus chest: `torches are placed standing without onBlockAdded; chest placed on first open.` (unchanged)
