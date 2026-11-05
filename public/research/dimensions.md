# Dimensions: Nether and End travel (batch 7)

Target: Minecraft Java 1.7.10. Not full parity. Evidence is the probe `tools/probes/DimensionProbe.java`, which drives the unchanged obfuscated classes (Teleporter `ahp`, providers `aqo`/`aqp`/`aqq`/`aqr`, `Direction p`, `Entity sa.ah`, `EntityPlayer yz.D`) and writes `public/research/dimensions-reference.json` (103 records: 1 direction, 49 movementDirection, 3 provider, 2 timing, 60 setInPortal, 36 teleport). `src/dimensions.test.js` replays them against `src/dimensions.js`. Run `MC_RESEARCH=<tools/research> node tools/verify-dimensions.mjs` to regenerate.

## What works

- **Save model.** The Overworld is the world record, unchanged: old saves load as before. In the Nether or End the active record is a view (`id = <world>~<dim>`); its block edits use the existing per-column storage under that id. `save()` shelves the root with `dimension` (where the player is) and `dimensions[d] = { state, tiles }`. `state` holds the coordinate-keyed runtime fields (entities, drops, fluid/fire ticks, redstone, spawners, signs, ...; `DIM_KEYS`), `tiles` the chests, furnaces, dispensers, brewing stands and hoppers. Global fields (inventory, health, XP, bed spawn, weather, game rules) are shared. Deleting a world also deletes its `~-1`/`~1` columns. Code: `src/dimension-live.js` (`viewRecord`, `storedRecord`).
- **Nether portal travel** (both ways). `BlockPortal` collision (cells overlapped by the player box shrunk by 0.001) calls `PortalState.setInPortal`; `tick` follows `Entity.onEntityUpdate`: `portalCounter` against `getMaxInPortalTime` (80, or 0 in Creative), `timeUntilPortal` cooldown 10 for the player (300 for other entities), and a decay of 4 per tick outside a portal. Arrival: `transferTarget` (x/z divided or multiplied by 8, clamped) and the ported `Teleporter` (`placeInExistingPortal`, a 128-block search with the per-column cache, then `makePortal`). The Teleporter runs on a read-only terrain peek plus the target dimension's saved edits; its writes are applied after the columns load. Replayed against 36 probe teleports (positions, motion, yaw, writes).
- **End portal travel.** The end portal block (internal 149) sends the player to the End at the entrance (100, 50, 0): `Teleporter.placeInPortal` for dimension 1 builds the 5 x 5 obsidian platform with 3 layers of air and places the player at (100, 49, 0). Entering again from a bed-less Overworld uses the same code. The exit portal (the same block inside the End) returns to the bed spawn, if still a bed, else to the world spawn; inventory is kept. The End is a real streamed world (`DimensionWorld`) with entities, tiles and edits saved. First entry calls `DimensionLive.onDragonSpawn({x:0,y:128,z:0})` once (`dragonSpawned` is saved); the dragon track assigns that hook (default: no-op).
- **Death in a dimension.** `canRespawnHere` is false in both: the respawn button first travels to the Overworld (state kept, no Teleporter) and then runs the existing respawn (bed or world spawn).
- **Rendering and rules.** Nether: no sky, sun, stars or clouds; fog (0.2, 0.03, 0.03); no sky light (`hasNoSky`: `LightVolume` heights = height, no inflow); light table with 0.1 ambient (rewrites the shared `BRIGHTNESS` array); celestial angle fixed 0.5; no weather. End: `environment/end_sky.png` on a six-face cube (radius 100, UV 0..16, colour 0x282828, `RenderGlobal.renderSky` rotations), no sun/moon/stars/clouds, fog from `endFogColor`, angle fixed 0, no weather. Water buckets in the Nether fizz (`random.fizz`, 8 `largesmoke`) and place nothing (`ItemBucket.a(ahb,III)Z` reads `ahb.t.f`, hasNoSky: Nether only). Beds explode in the Nether and End (power 5, flaming, smoking). The clock spins outside the Overworld. Portal overlay (`portal.png`, first frame) with the alpha of `renderPortalOverlay`, the existing nausea warp, `portal.trigger` on entering a portal and `portal.travel` on leaving.
- **Terrain.** Nether: `ChunkProviderHell` terrain (batch 6) plus population (see approximations). End: `EndTerrain` plus `populateEndChunk`. Both stream in the 8 x 8 window.
- **Test helper.** `window.__mc.travel(dim)` and `window.__mc.dims`. No commands were added.

## Bytecode notes

- `WorldProviderHell` (`aqp`): id -1, `hasNoSky` true (field `aqo.f`), `isHellWorld` true, `canRespawnHere` false, light table ambient 0.1, celestial angle constant 0.5, fog (0.2, 0.03, 0.03). `WorldProviderEnd` (`aqr`): id 1, `isHellWorld` true, `hasNoSky` false, `canRespawnHere` false, cloud height 8, entrance (100, 50, 0), fog from 0xA080A0 scaled by 0.15, angle 0. Its chunk provider is `ChunkProviderEnd`: `end-generator.js` (`EndTerrain`, documented in `end.md`); the dragon is spawned by `EnderDragon` logic on first load of the End (`decorateEnd` records an `ender_dragon` spec at (0,128,0) in this port).
- `EntityPlayer.getMaxInPortalTime` (`yz.D`) returns 0 in Creative and 80 otherwise; the task description said 1. The probe value (0) is implemented.
- `Direction.rotateLeft/rotateRight` and `getMovementDirection` are replayed from the probe; the first port had them reversed and the replay caught it.

## Approximations

- Nether and End population is per column and stateless: each column runs the populate step of its own chunk and of the -x/-z neighbours, each on a `Random` seeded from that chunk (the original uses one carried-over `Random` and populates once after the +x/+z neighbours exist). Terrain is exact; fortress, lava lakes, fire, glowstone and mushroom placement differ from the original. Fire's neighbour update is not ported in the generation world, so those populate steps are skipped (a warning is logged once).
- The Teleporter's search reads terrain only (no population, no structures) of the target dimension plus saved edits; features that population adds later can overlap a new portal.
- Overworld arrival uses the streamed generator's terrain without trees and structures.
- Yaw: the game's yaw is converted with `pi - mcYaw`.

## Gaps

- No natural mob spawn lists for the Nether (ghast, pigman, magma cube, blaze) or End (enderman); the Overworld spawners, ocelot, squid and bat passes are switched off in dimensions. Fortress and spawner mobs come from other tracks.
- Region import/export of `DIM-1`/`DIM1`: not mapped; only the Overworld exports.
- The End lightmap override of `EntityRenderer.updateLightmap` (dimension 1) is not applied (not verified against bytecode); the End uses the Overworld lightmap.
- Credits screen after the exit portal is not shown; the 20-block `EntityEnderPortal` mechanics are not ported.
- Followers (wolves, riders, leashed animals) do not follow through portals; non-player entities do not use portals.
- A saved portal counter and cooldown are not persisted; maps are one store (no per-dimension map data); the compass item is inert in this build.
- The bed explosion (power 5, flaming) is recalled from the 1.7.10 class and not probed; `portal.travel` timing and volume are approximations.
- Weather keeps its Overworld state while the player is away (no simulation in the other dimensions; the Overworld does not advance either).
- Finite (non-streamed) Overworld worlds: 8x coordinates outside the world fall back to the world spawn.
- Nothing was run in a browser; the pure parts (records, generation, teleport arrival, rules) are covered by `src/dimension-live.test.js`.
