# lightengine batch 20 track

## Summary
Audited the port's light propagation (`LightVolume`, `StreamingLight`, `scene.js` applyChanges) against the unchanged 1.7.10 `World.updateLightByType`/`computeLightValue` and Chunk light code. The port's fixed-point solve equals native light after every edit (once the per-tick chunk work has run) in 12 scenarios and 660 random stress edits; no port bug found, `lighting.js` unchanged. Differences are documented in `public/research/light-engine.md` and pinned by tests.

## Native evidence
Probed (executed natively): `tools/probes/LightEngineProbe.java` runs the real `World` over real `Chunk`/`ExtendedBlockStorage` objects (setBlock -> relightBlock/propagateSkylightOcclusion -> updateAllLightTypes; generateSkylightMap; func_150804_b ticks). 18 scenarios in `public/research/light-engine-reference.json` (driver `tools/verify-light-engine.mjs`). Bytecode-read: func_150804_b/func_150809_p/func_150811_f structure, recheckGaps isRemote early return, updateLightByType queue rules.

## Tests
`src/light-engine.test.js`: 17 tests (12 exact scenarios, flat generateSkylightMap, Nether, 4 pinned differences).

## Remaining gaps
- Port lights fresh chunks eagerly; native leaves lateral sky/emitters unlit until populate/tick.
- Native stale light under a floating opaque block set into a null section; native skips updates beside unloaded chunks; native incremental queue limits (32768, 17 blocks) not ported.
- Nether/End real terrain, `func_150809_p` neighbour ordering, queue overflow not covered.

## Proposed remaining-gaps lines
- Light engine: `LightVolume` replays unchanged `updateLightByType` over 18 native scenarios (660 stress edits exact). Not replicated: native stale light (null-section `generateSkylightMap`, pre-tick gaps), lazy lateral light at generation, skipped updates beside unloaded chunks, queue limits.
