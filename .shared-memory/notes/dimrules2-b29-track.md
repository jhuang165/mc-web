# dimrules2 (batch 29)

## Summary
- Bytecode-read what natively runs in a dimension the player is not in: `MinecraftServer` ticks every WorldServer each tick (`mt.b()`, `mt.h()`); `ahb.o` weather and the world/total time advance (Overworld only, DerivedWorldInfo ignores writes in the Nether/End); the active chunk set comes from the world's own players, so no random ticks or spawning in an empty world; scheduled ticks and entity updates continue in loaded chunks; `ms.b` keeps the Overworld spawn area (within 128 blocks, `aqo.e` canRespawnHere) and unloads all Nether/End chunks.
- Ported: Overworld weather timers, flags, strengths and `worldRandom` keep running while the player is in the Nether/End (`Weather.awayOverworld`, `saveWeather`, `saveOverworldSimulation`; main.js: 3 lines in save, 1 in launch). World time already continued (player `time` in the shared root); the browser run shows 20 ticks/s and no double advance over two trips. Away saves also keep live rain/thunder strengths (browser extension, optional fields).
- Not ported: Overworld spawn-area scheduled ticks and entity updates while away (frozen, resume on return). Travel loading screens pause the tick about 4 s per trip.
- Saplings and leaves in the Nether/End: no mismatch. New `DimTreeProbe.java` / `verify-dimension-trees.mjs` -> `dimension-tree-reference.json`; `dimension-trees.test.js` (2 tests) replays unchanged `BlockSapling.updateTick`/`BlockLeaves.updateTick` on real Nether/End chunks (light 0/8/9/10/14, marks, normal and big growth, failed growth, leaf cube) against `Trees` with NativeLight. Mutation (light - 1) fails both.
- World import: `world-import.js` lists and validates `simulation` (and `worldRandom`); `importedDimensionState` sanitises each `dimensions[d]` record (one-line hunk in main.js import). Region and whole-save importers already used `DIM_KEYS` (includes `simulation`).
- Docs: dimensions.md (Batch 29 section), weather.md. remaining-gaps.md not edited.

## Verification
- `npm test`: 4746 tests, 4746 pass. `npm run build` ok.
- Muted headless Chrome on vite :5294 (`artifacts/b29-dimrules2/smoke.mjs`, `smoke-out.json`): rain with a 200-tick timer, Nether for 30 s, back: time 21 -> 621 in the Nether (20 tps), 621 on return, 681 three seconds later; rainTime 200 -> expired during the visit, new timer 68923, raining false on return (without the change it would still be raining with ~200 ticks left). Only console error: a 404 resource.

## Follow-ups
- Proposed gap lines: "Overworld spawn-area scheduled ticks and entity updates freeze while the player is in the Nether/End (native: they keep running; no random ticks natively either)"; "dimension trips pause the game tick for the loading screen (native server keeps ticking)"; "decaying leaves (drops) not probed in the Nether/End (harness lacks GameRules/world Random)".
- Closing the Overworld spawn-area gap needs a resident Overworld world (or a headless ring) plus fluid/fire/redstone tick queues running with the player away.
- The Nether's own `weather.rain` field is stale while away (harmless, biomes there do not rain).
- Hunks outside owned files: main.js (save: `saveWeather`, away worldRandom; launch: `awayOverworld`; import: `importedDimensionState`).
