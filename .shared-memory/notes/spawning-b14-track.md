# Batch 14 spawning track (branch b14-spawning)

Owner: claude-b14-spawning. Base main f832094.

## Done
- Cap: `ELIGIBLE_CHUNKS = 289` (spawner-animals.js); `ctx.capChunks` is always 289. `countEntities` counts every non-persistent mob in `EntityWorld.entities`, active or frozen. Points are still drawn only in simulated chunks.
- Cadence: `EntityWorld.loadTotalTime/saveTotalTime`; main.js loads `record.totalTime ?? record.player.time` and saves `active.totalTime`. Bytecode (`mt.b`): the spawner reads total time before it adds 1.
- Spawn point: bytecode shows `mm` (WorldServerMulti) uses DerivedWorldInfo over the Overworld's, so the Nether and End use the Overworld spawn point, not their own. `spawnPointOf(record)` in dimension-spawning.js; main.js no longer limits `mobs.spawnPoint` to the Overworld. (The task text guessed a per-dimension spawn point; the jar says otherwise.)
- Witch hut: `atx.a(III)` never checks the biome; the lookup no longer requires slots 6/134.
- Portal pigmen: `NetherLive.randomTick` + `EntityWorld.spawnPortalPigman`, gated by surface world and doMobSpawning without drawing.
- Probe: SpawnListProbe has a fourth replay "wet-caves" (biomes 134/21/23, caves at y 30..35): bats and cave spawns. verify-spawn-lists.mjs regenerated the reference (older records unchanged).

## Not done
- No seeded replay for slimes (size on the unseeded entity Random made the probe non-repeatable), ocelots (none spawned) or horses (foals on unseeded Random), nor for the Nether/End flow.
- Spawn points are not drawn in non-simulated chunks of the 17x17 window.
- Total world time advances only while that world is played.
- Not checked in a browser.
