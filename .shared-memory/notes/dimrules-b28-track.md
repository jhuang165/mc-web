# dimrules (batch 28)

## Summary
- Provider facts: native `aqo.f` = isHellWorld (Nether only), `aqo.g` = hasNoSky (Nether and End); `getActualHeight` = hasNoSky ? 128 : 256. `PROVIDERS` in dimensions.js now uses those names (`lightNoSky` and the table `actualHeight` removed); End is 128 and no-sky. Readers matched: streaming-light (End stays sky-lit under `?nativeLight=0`), buckets (isHell), maps-clock-live, redstone-runtime (daylight), DimensionWorld.
- Own Random per dimension: weather.js `simulationKey(dim)`; main.js save/launch use it; Overworld `worldRandom` unchanged; Nether/End `simulation` stream.
- Tiny hunks outside my files: dimension-live.js (dimperf owns it): imports `actualHeight`, uses it at two sites, `waterEvaporates: p.isHellWorld`, "simulation" appended to DIM_KEYS. main.js: import and two lines.
- Mushroom random ticks probed in Nether/End with unchanged classes; port already matched, no change needed.
- New: tools/verify-dimension-rules.mjs, verify-dimension-random-ticks.mjs, tools/probes/DimRandomTickProbe.java (LightEngine3Probe `endLine` refactor, output unchanged), two reference JSONs, dimension-rules.test.js (6), dimension-random-ticks.test.js (2).

## Verification
npm test: 4693 tests, 4693 pass; npm run build ok. "a natural spawn tick stays cheap on a streamed world" failed once in the full run (timing) and passes in isolation.

## Follow-ups
- Saplings and leaves not probed in the Nether/End (no provider reads; only block light).
- Streams start fresh on first visit; Overworld timers freeze while away.
- Spawner and Teleporter `ahb.S` readers unreachable in the port.
- world-import's key list does not carry `simulation`.
- Proposed remaining-gaps lines: "Nether/End sapling and leaf ticks are unprobed"; "world-import drops the Nether/End `simulation` stream".
