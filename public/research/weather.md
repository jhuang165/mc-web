# Overworld weather (Minecraft Java 1.7.10)

Target: 1.7.10 only. This is not full parity; see "Not ported" below.

## Method

Class names are the obfuscated ones in the 1.7.10 client JAR (SHA-1 `e80d9b3b...`), found with `javap -c -p` and cross-checked against MCP names. `tools/probes/WeatherProbe.java` runs the original, unmodified `ahb`, `ays`, `xh`, `ahu`, `awt` and `aji` classes (a `World` subclass allocated without its constructor, with fixture overrides for biome, celestial angle, precipitation height and sky access) and `tools/verify-weather.mjs` writes the output to `weather-reference.json`, with class digests. `src/weather.test.js` replays it.

| 1.7.10 class | MCP name |
|---|---|
| `ahb` | World (`o` updateWeather, `j`/`h` rain and thunder strength, `y` canLightningStrikeAt, `a()` calculateInitialWeather) |
| `ays` | WorldInfo (RainTime, raining, ThunderTime, thundering) |
| `aqo`, `aqq` | WorldProvider, WorldProviderSurface |
| `mt` | WorldServer (per-chunk lightning roll) |
| `xh`, `xg` | EntityLightningBolt, EntityWeatherEffect |
| `blt` | EntityRenderer (`e` renderRainSnow, `l` addRainParticles, `j` updateFogColor, `i` updateLightmap) |
| `bma` | RenderGlobal (`renderSky`: sun, moon and star alpha) |
| `blf`, `bkm` | EntityRainFX, EntityFX |
| `bog` | RenderLightningBolt |
| `sa` | Entity (`isWet`, `onStruckByLightning`) |
| `ahu`, `awt` | BiomeGenBase, Material |

## Ported, and how it is checked

Evidence key: **probe** = replayed against the original classes in `weather-reference.json`; **bytecode** = transcribed from `javap` output only, covered by behavioural tests but not by a probe replay (they need LWJGL or a render context).

| Part | File | Evidence |
|---|---|---|
| `updateWeather`: thunder first, then rain; each timer rolls `nextInt(12000)+3600` (thunder on), `nextInt(168000)+12000` (thunder off), `nextInt(12000)+12000` (rain on), `nextInt(168000)+12000` (rain off); flag toggles when the countdown hits 0; strengths ramp 0.01 per tick and clamp to 0..1 | `weather.js` | **probe**: 6 runs of 400000 ticks and 4 runs of 70000 ticks from ten starting states (all zero, and mixed counters and flags); every roll and toggle plus sampled `prevRain/rain/prevThunder/thunder` |
| `getRainStrength`, `getWeightedThunderStrength` (thunder multiplied by rain), `isRaining` (rain > 0.2), `isThundering` (weighted thunder > 0.9) | `weather.js` | **probe** (513 rows over 9 states x 3 partial ticks x 19 angles) |
| `calculateInitialWeather` on load: raining gives rain 1, and thundering as well gives thunder 1; previous values stay 0 | `weather.js` `restore` | **bytecode** |
| Saved state: `rainTime`, `thunderTime`, `raining`, `thundering` in the world record (`active.weather`), tolerant of junk | `main.js` `save`/`launch` | unit test |
| `calculateSkylightSubtracted` and `getSunBrightness` with rain and thunder (each removes up to 5/16; subtracted is 3 in rain and 5 in a storm at noon) | `lighting.js` | **probe** |
| `getSkyColor` rain grey (0.6, k = 1 - 0.75 rain), thunder grey (0.2), lightning blend `min(1, bolt - partial) * 0.45` toward (0.8, 0.8, 1) | `lighting.js` | **probe**, 3 biomes |
| `getCloudColour` rain grey (0.95) before the day factor, thunder grey (0.95) after it | `lighting.js` | **probe** |
| `getStarBrightness` has no weather term; `renderSky` fades sun, moon and stars by `1 - rain` | `sky.js` | star brightness **probe**; fade **bytecode** |
| `EntityRenderer.updateFogColor`: rain darkens red and green by `0.5 rain` and blue by `0.4 rain`, thunder all three by `0.5 thunder`, after the sky blend and before the water and lava colours; the sky colour fed to it includes rain, thunder and lightning | `lighting.js` `fogColor` | **bytecode** (needs LWJGL); the provider fog colour is **probe** |
| `updateLightmap` during a flash (`lastLightningBolt > 0`): the sky level is the bare brightness table, with no sun or rain factor | `lighting.js` `lightmap`, `light-material.js` | **bytecode** |
| `World.canLightningStrikeAt`: raining, sees sky, `precipitationHeight <= y`, biome does not snow, `canSpawnLightningBolt` | `weather.js` | **probe**: 168 cases (raining, sky access, precipitation height, y, biome); biome flags (snow, spawn-lightning, temperature) for ids 0 to 39 |
| `getPrecipitationHeight`: stops at `blocksMovement || isLiquid`; leaves, glass, water and lava stop rain, air, torches, crops, tall grass, flowers, fire and snow layers do not | `weather.js` | **probe** block table, mapped from this build's ids in the test |
| `WorldServer` lightning roll: per active chunk each tick `rand.nextInt(100000) == 0` while raining and thundering; column from `updateLCG = updateLCG * 3 + 1013904223`, `j = lcg >> 2`, `x = j & 15`, `z = (j >> 8) & 15` | `weather.js` `rollLightning` | **bytecode** (LCG and flow) |
| `EntityLightningBolt`: state 2, `boltLivingTime` 1 to 3, `nextLong` path seed, thunder (volume 10000, pitch 0.8 to 1.0) and `random.explode` (volume 2, pitch 0.5 to 0.7) on state 2, re-flash `state < -nextInt(10)` with a new seed, `lastLightningBolt = 2` while `state >= 0` | `weather.js` | **probe**: 36 runs (every seed and life count), per tick state, life, seed, flash, death and sounds |
| `Entity.onStruckByLightning`: 5 fire damage in a box 3 either side horizontally, 3 below and 9 above the strike, then `++fire` and `setFire(8)` when that reaches 0 | `weather.js`, `main.js` | **bytecode** |
| `Entity.isWet` (in water, or rain reaches the feet or the head): extinguishes burning entities; the player's `fire` is zeroed the same way | `weather.js`, `entities.js`, `main.js` | **bytecode**; unit test |
| Zombies do not burn in rain (vanilla sets them alight and `isWet` puts them out the same tick) | `entities.js` | unit test |
| Rain moistens farmland (`BlockFarmland.updateTick` uses `canLightningStrikeAt(x, y + 1, z)`) | `farming.js`, `main.js` | unit test |
| `renderRainSnow`: 21 x 21 columns, `rainXCoords/rainYCoords` billboard tables, per-column seed `x*x*3121 + x*45238971 ^ z*z*418711 + z*13761`, scroll `((count + ...) & 31 + partial) / 32 * (3 + nextFloat)`, V `y / 4 + scroll`, alpha `((1 - (d/10)^2) * 0.5 + 0.5) * rain`, lightmap at `(x, max(precipHeight, eye y), z)`, `rain.png` nearest and repeating | `weather-renderer.js` | **bytecode**; browser check |
| `addRainParticles`: seed `rendererUpdateCount * 312987231`, radius 10 candidates, `100 rain^2` tries, skips air and lava, keeps one random landing spot for the loop sound, `nextInt(3) < counter++` | `weather.js` `rainParticles` | **bytecode**; unit test |
| Rain loop sound `ambient.weather.rain`: volume 0.2, pitch 1.0 in the open, volume 0.1, pitch 0.5 under a roof (`y > eye + 1` and the viewer's column covered) | `weather.js`, `main.js` | **bytecode**; unit test |
| `EntityRainFX` splash: `EntityFX` constructor motion, then x and z scaled by 0.3 and vertical set to 0.1 to 0.3; gravity 0.06, drag 0.98, life `8 / (0.2..1.0)` ticks, 50% die on landing, 0.7 ground friction, particle sheet tile 19 to 22, scale `(0.5..1.0) * 2` | `weather.js` `RainDrop`, `weather-renderer.js` | **bytecode**; unit test |
| `RenderLightningBolt`: 4 layers, 3 passes per layer, triangle strips of 5 vertex pairs, widths and path offsets from `Random(boltVertex)` (`nextInt(11) - 5`, and `nextInt(31) - 15` for passes 2 and 3), additive blend, colour (0.45, 0.45, 0.5, 0.3), unlit | `weather-renderer.js` `boltGeometry` | **bytecode**; vertex count and determinism tested |
| Audio: `ambient.weather.rain` (rain1 to rain4) and `ambient.weather.thunder` (thunder1 to thunder3) imported from the 1.7.10 asset index with `tools/import-vanilla-media.mjs` | `public/audio/1.7.10` | SHA-1 verified like the other clips |

## Differences and gaps (not ported)

- **Snow only in the snowy preset.** Meadow, island and alpine (temperature 0.8, 0.8 and 0.2) still always rain and never snow. The "Snowy Tundra" preset (Ice Plains, temperature 0.0, `getEnableSnow`, no lightning) renders `environment/snow.png` columns instead of rain, freezes still water and settles snow layers through the `WorldServer.func_147456_g` tick, and melts them near light. Details, evidence and gaps are in [snow.md](snow.md). Temperature is not lowered above y 64 (the world is 64 high).
- **Thunder timers do not depend on rain.** The original `updateWeather` rolls thunder and rain independently; thunder only matters while the rain strength is high enough (`weightedThunder` is thunder times rain). A storm therefore needs both. This differs from the simpler "thunder only while it rains" model.
- **No `/weather` command.** `window.__mc.weather.set("rain" | "thunder" | "clear", seconds)` exists in dev builds only. It sets flags and timers; strengths still ramp at 0.01 per tick.
- **Fire from lightning is placed.** The `Blocks.fire` placement in the bolt constructor and its re-flash are ported in `fire.js` (`boltStart`, `boltRestrike`) and checked against the original classes (see [fire](fire.md)). Because this build's extinguish sets `fire` to 0 rather than `-fireResistance`, a struck entity burns for a single tick, as a first strike does in vanilla.
- **Damage ticks.** Damage and ignition are applied on each tick the bolt flashes (`Weather.struck`), through this build's existing `hazard`/`damage` paths and their invulnerability rules. The original code path was not probed.
- **Sounds.** Thunder plays once. Single-player 1.7.10 plays it twice (the server-side bolt and the client copy). `random.explode` is not in the audio manifest and is skipped. The `random.fizz` sound when rain puts out a burning entity is skipped. Thunder is played without a position at volume 1 (vanilla uses volume 10000, so it is audible at any distance).
- **Splash collision** is simplified to the precipitation surface of the column the particle is in, rather than `EntityFX.moveEntity` against block boxes; the lava smoke variant is not ported.
- **Fast graphics** variant (radius 5, half density) is not ported; fancy only.
- **Lightning bolt fog.** The bolt is drawn unfogged. In vanilla the fixed-function fog applies.
- **Active chunk radius.** `WorldServer` uses the server view distance (10 chunks by default); it is clipped to this 8 x 8 chunk world, so every chunk is eligible. Each chunk rolls once per tick as in the original.
- **Beds, spawning and mob behaviour** that depend on weather (sleeping through thunder, `isDaytime` for spawn rules) are not ported. Zombies use this build's existing night window plus the wetness check.
- **Weather is not saved per dimension** (there is one dimension) and an old save without `weather` starts like a new world: both timers 0, so the first tick rolls them.

## Regenerating the reference

```
node tools/verify-weather.mjs
```

Requires a JDK, the client JAR and the extracted classes under `tools/research/` (ignored by Git).
