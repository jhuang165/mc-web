# Dimensions track handoff (batch 7)

Branch `batch7-dimensions`. Details in `public/research/dimensions.md`.

## Changed

- New: `src/dimensions.js` (pure rules: providers, PortalState, transferTarget, Teleporter), `src/dimension-world.js` (`DimensionWorld`, `TerrainPeek`), `src/dimension-live.js` (records, travel, arrival, portal tick, overlay, bed explosion), `src/dimension-render.js` (brightness table, sky mode, fog); tests `dimensions.test.js` (8), `dimension-live.test.js` (13); probe `tools/probes/DimensionProbe.java`, `tools/verify-dimensions.mjs`, `public/research/dimensions-reference.json` (103 records).
- Items 2100-2109 are unused; no BLOCKS slot was added.

## Shared files touched (small hooks)

- `src/main.js`: import and `dims` instance (near `portalTimer`); `save()` shelves `storedRecord` for views; `deleteWorld` removes `~-1`/`~1` columns; `openWorld` (view record, `dims.createWorld`, `dims.arrive`, `dims.applyWrites`); `startPrefetch` skips `world.noPrefetch`; `ContainerResidency` skipped for `world.isDimension`; launch toast suppressed while `dims.quiet`; respawn button leaves a dimension first; `tickSurvival` calls `dims.tick`/`portalFrame`; `tickWeather` returns in dimensions; `useBed` bed explosion; `world.evaporated`; `window.__mc.travel`.
- `src/scene.js` (setWorld, setTime, render: dimension, fixed angle, fog provider, weather off), `src/sky.js` (`setDimension`, End sky cube), `src/lighting.js` (`hasNoSky`, `fogColor` provider param), `src/streaming-light.js` (`hasNoSky`), `src/buckets.js` (Nether water), `src/entities.js` (no Overworld natural spawns in dimensions), `src/maps-clock-live.js` (clock spin).
- Merge hint: `main.js` hooks are all marked with dimension comments; `scene.js` and `entities.js` hunks are one to four lines each.

## Remaining

See the Gaps section of `dimensions.md` (spawn lists, region `DIM-1`/`DIM1`, End lightmap, credits, followers, unverified bed explosion).

Tests: `npm test` 2947 tests (this track 21); one unrelated village-live golem test failed once under full-suite load and passes alone (6 of 6), `npm run build` ok. Nothing was run in a browser. No credentials stored.
