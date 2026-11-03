# Structure population orchestration (GEN-05f)

Status: standalone provider-order orchestration. This package is not wired into any live generation version and does not change saved worlds.

## Package

- `src/structure-population.js` creates the existing `MapGenMineshaft`, `MapGenVillage`, `MapGenStronghold`, and `MapGenScatteredFeature` ports and drives their native `ChunkProviderGenerate` order.
- Search runs after terrain, surface, caves and ravines: mineshaft, village, stronghold, scattered feature. Each `MapGenStructure.generate` retains its native range-8 search and per-generator random stream.
- Population calls the same four maps in that order with the same provider `Random`. The village structure result is returned to `populateBeforeDecoration`, where it suppresses water and lava lakes.
- Village and scattered-feature candidate checks also reseed the shared `World.rand` using the floor-divided spacing-cell coordinates (including negative chunks), then consume both native offset draws. The structure candidate predicate keeps its independent generator Random as in the original classes.

## Native evidence and replay

`tools/probes/StructurePopulationProbe.java` instruments only the four generator entry points, then calls the unchanged 1.7.10 `ChunkProviderGenerate.provideChunk` against real native terrain, caves and ravines. `tools/verify-structure-population.mjs` compiles/runs it with the pinned client JAR and writes `structure-population-reference.json`. The five fixtures record the observed provider search order, native `StructureMap` value order, and `World.rand` after search:

| Seed / search chunk | Native starts |
| --- | --- |
| 0 / (0, 0) | none |
| 0 / (-19, 18) | one mineshaft |
| 17 / (-25, 5) | one village |
| 17 / (-4, -55) | one stronghold |
| 17 / (10, -53) | one scattered feature |

`src/structure-population.test.js` replays every native start map and `World.rand` value. It also checks population callback order and the single shared Random. The village gate regression uses the native `population-stage-reference.json` seed 0, chunk (0,-1): without a village both water and lava lake attempts occur, and with the village result both are omitted. The first nine provider Random draws through the two lake inputs match the unchanged native pre-decoration probe.

The provider search order is instrumented through real native calls. The population callback order and lake gate are checked by the port regression together with the existing native pre-decoration stage replay; a complete native four-structure population write replay is still open. The separately ported structure modules retain their own native piece/populate replays; this orchestration evidence does not claim integrated structure-write equivalence.

## Limits

- No live generation, streaming generation, or saved-world version is changed.
- `MapGenStructureData`/NBT start persistence and reload are not implemented here.
- Block callbacks, lighting, update physics, structure entities and combined structure write conflicts are outside this orchestration package.
- The native `HashMap` value order reflects the recorded JDK 19 runtime; Java 6/7 HashMap iteration may differ.
