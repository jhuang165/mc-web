# Batch 27 lighting4 track

## Summary
- `tools/probes/LightEngine3Probe.java` + `tools/verify-light-engine3.mjs` -> `public/research/light-engine3-reference.json` (9 scenarios, unchanged classes, chunks -3..3, real `aqq`/`aqp`/`aqr` providers). Replayed by `src/native-light-ring.test.js`.
- Evidence corrections: `aqo.g` = hasNoSky (Nether and End), `aqo.f` = isHellWorld; no-sky worlds read sky 15 above the heightMap of missing sections (my earlier "0 before the chunk" claim was wrong); `lightBrightnessTable(0.1)` was 1 ulp off at entries 5 and 6 (fixed in `dimensions.js`).
- Nether and End run on `NativeLight` (`world.lightNoSky`, real heights, block light), same `?nativeLight=0` fallback.
- Ring edits: refused updates and non-resident setBlocks are recorded, translated with the window and replayed when resident (`replaySkipped`, `replayDeferred`, `spreadBlock`). Port model, not native.
- `world.blockTap` (one null check in `World.put`) makes `world.set` without `updateBlock` light and keeps the id shadow current.
- 64 distinct changed cells in a chunk per tick run `resetRelightChecks` (resend model, `mr` bytecode-read).
- Small hunks outside my files: `dimension-world.js` (one line: `lightNoSky`), `dimensions.js` (flag note, `lightNoSky`, float ambient), `world.js` (`blockTap`). The lead says dimticks also edited the `dimensions.js` comment and `main.js` `sceneLight`; expect a trivial merge in the comment, keep their `ringSink.light` branch.

## Verification
- `npm test`: 4637 pass, 0 fail; `npm run build` ok.
- New tests: `native-light-ring.test.js` (16: 9 native replays, 5 residency, 1 approximate, 1 provider facts), `streaming-light-ring.test.js` (7).
- Perf (node): torch place+remove 0.93 -> 1.08 ms, shift 164 -> 164 ms, 2000 sets 0.13 -> 0.11 ms.
- Muted headless Chrome on :5273 (`artifacts/b27-lighting4/check.mjs`, screenshots there): edge torch 0 then 14/13 after the window moves; tapped set 14; Nether and End torch 14/13, sky 0 in the built section.

## Follow-ups
- Place-and-remove pairs while a ring is not resident leave different sky intermediate states (about 5.5k cells in the probe scenario); needs the edit history, not the final state.
- Nether/End sky nibble of sections no write created stays 15 where native may have zeroed it (invisible above ceilings).
- Proposed `remaining-gaps.md` lines: (1) End `hasNoSky` is true natively but `PROVIDERS[END].hasNoSky` stays false and `actualHeight` 256 (native 128) for other code (mob spawning, portal clamp); (2) the single light volume serves both the server light and the client relight checks, natively separate; (3) ring-edit light replay is a port model; (4) End/Nether ring columns beyond the window have no light at all until resident.
