# Batch 27 interchange4 (claude, 2026-11-08)

Branch `batch27-interchange4` from 8ab44f2.

## Summary
- Imported chunks saved with TerrainPopulated=false are populated at import (`src/imported-population.js`, post-pass of `importWholeSave`):
  - Native rule and order (`populationPlan`); Default, LargeBiomes, Amplified, Superflat; MapFeatures on/off; flag written true; populated chunks untouched except for neighbour spill.
  - Same code in the browser (`readBases`) and the Node CLI (`whole-save-cli.js` Map store).
  - Chests, dispensers, spawners, dungeon carts and liquid ticks are merged; animals, pots, villagers and other ticks are counted as dropped.
- Native probe: `tools/probes/InterchangePopulateProbe.java` + `tools/verify-interchange-populate.mjs` -> `public/research/interchange-populate-reference.json` (6 scenarios, 144 native populate calls; call order, flags, per-chunk hashes, chest/spawner counts match). Only divergence: stored cells cannot keep level-0 flowing fluid (cave lava reads still); isolated by `exactInput`.
- `src/stored-peek.js`: stored-column index for the Teleporter peek (`TerrainPeek.stored`, portal columns) and `/spreadplayers` `topY` (via `DimensionLive.warmStored`, `storedTop`; tiny wiring in `main.js`, `command-host.js`).
- `world-import.js`: list caps (4096/1024) replaced by `LIST_CAP = 1 << 20`.
- CLI `--whole-save` includes playerdata/players/stats/data and accepts `--player-file`/`--stats`.
- `tools/make-synthetic-save.mjs` + `tools/roundtrip-synthetic-save.mjs`; docs in `region-import.md`, `level-dat.md`, `streaming.md`.

## Verification
- Round trip of the generated save (artifacts/b27-interchange4/roundtrip.json): no chunk missing, all tile entity and entity ids kept in 3 dimensions; 25 unpopulated chunks populated.
- Tests: see the final run in the commit message / lead report (`npm test`, `npm run build`).
- Not done: muted headless Chrome check of the browser import; the synthetic save is not written by the Java classes (generation/population evidence is the probe's).

## Follow-ups
- Proposed gap lines for `remaining-gaps.md`:
  - Done (batch 27): imported TerrainPopulated=false Overworld chunks are populated at import with the native rule (probe-verified); Nether/End unpopulated chunks are not populated.
  - Remaining: stored cells cannot keep level-0 flowing fluid or chest facing, so some populate results differ from native; populate-time animals/pots/villagers/non-liquid ticks are dropped.
  - Done: portal search and `/spreadplayers` read the stored-column index; `topY` falls back to generated terrain while the index builds, and ignores post-import edits to evicted columns.
  - Done: merged runtime list caps raised to 1<<20; live-window caps (items 512, mobs 256, drops 512, projectiles) in other modules remain.
  - Done: CLI `--whole-save` is whole-save with player/stats/data; stale "CLI still area-only" lines are wrong.
- Browser check of a big import with the populate phase status text; Nether/End population on import.
