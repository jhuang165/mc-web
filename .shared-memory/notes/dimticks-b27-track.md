# dimticks b27 track (Nether/End random ticks, ring mood draws)

## Summary
- Nether and End now run the WorldServer chunk loop (3 random ticks per section, mood, lightning/ice draws) plus fire and fluid scheduled ticks, in the resident window and the headless ring, via `Weather.tickDimension` (no weather timers, no bolts).
- Bytecode-read: `mt.g` reads no provider field; `aqo.f` is isHellWorld (Hell only), `aqo.g` is hasNoSky (Hell and End); `dimensions.js` labels were swapped (comment fixed, data unchanged).
- Fixed: Nether lava rate 10 / step 1 (was 30 / 2, `main.js` passed no option); `Fluids` `skyless` option (rate 10 in End too); ice melts and breaks to air in the Nether; fire eternal over End bedrock; no portal lit by fire in the End.
- Ring mood: native mood step is server-side and draws for every active chunk while the countdown is 0; only a player within 8 blocks hears it. Ring chunks now draw (RingLight cells) and never play; the old skip desynced the RNG stream.
- New: `tools/verify-dimension-ticks.mjs` -> `public/research/dimension-ticks-reference.json`; `src/dimension-ticks.test.js` (7 tests). Docs: natural-spawning.md Round 9, dimensions.md, music.md.

## Verification
- Ring-vs-all-resident replay, 400 ticks, Nether and End: identical logs, edits, blocks. Mutations (restore ring mood skip; drop End bedrock fire) fail the tests.
- Cost (node CPU, 441 active chunks): median 0.32 ms, p95 0.49 ms flat; dense fire/wart 0.67 / 1.3 ms (max 4.9); window only 0.02 ms; warm-up about 150 ms over the first 100 ticks.
- Muted headless Chrome (`--mute-audio`, `?silent`) Nether visit, 45 s on a built platform: ring 441 columns resident, 3 of 70 warts grew, fire alive, 0 bolts, rain 0, no page errors (one 404 resource), one 57 ms long task. Ice did not melt in 45 s (needs light; only a few ticks).

## Follow-ups
- Proposed gap lines: End has no sky light and `getActualHeight` is 128 natively (port: 256, `hasNoSky:false`); owner lighting4/dimensions.
- Mushroom spread, sapling and leaf ticks in the Nether not replayed.
- Nether population approximate; Nether shares Weather rand/lcg with the Overworld (native: one per WorldServer, unseeded).
- Stale shared rain state is harmless (biomes disable rain).
- Ring warm-up about 150-220 ms across the first 100 ticks (refcount build, from b26).
- Browser smoke was short (about 45 s).
