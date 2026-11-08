# lighting3 (batch 26): native light wired into the streamed Overworld

## Summary
- `src/streaming-light.js`: `StreamingLight` takes `{ native }`. With it on (and no `hasNoSky`) it builds the eager fixed-point arrays, then creates a `NativeLight` that shares them. Per chunk it sets the section mask, `hmMin`, populated flags and the 4096 counter, rewrites missing sections to their light rule, and keeps an id shadow for old opacity. The outermost chunk ring is unloaded.
  - `update(x, y, z, oldId)` runs `World.setBlock`'s light half; `tick()` runs `Chunk.func_150804_b` for chunks with pending gaps; `shift()` translates the per-chunk arrays, the id shadow and rebinds the replaced light arrays.
  - `NATIVE_LIGHT_DEFAULT = true`; `?nativeLight=0|1` or localStorage `blockworld.nativeLight` overrides it.
- `src/scene.js`: `resetLight` passes `native` for streamed non-dimension worlds; `updateBlocks` passes the old block id to native edits; `setTime` calls `tickLight()`, which remeshes the changed box.
- New `src/streaming-light-native.test.js` (8 tests). `public/research/light-engine.md` has a batch-26 section.
- Native is the default because it met the budgets. The measured difference from the old path is within noise.

## Verification
- `npm test`: 4593 tests, 4593 pass, 0 fail (with native on by default).
- `npm run build`: ok.
- Muted headless Chrome on vite :5262 (`artifacts/b26-lighting3/measure.mjs`, `visual.mjs`), alternating old/new, 3 runs each, machine shared with other tracks:
  - new world playable: old 1.02-1.53 s, native 0.92-1.33 s
  - longest long task after load: old 0-136 ms, native 0-99 ms (90 ms load long task in both)
  - one-chunk shifts: old 63-94 ms, native 58-124 ms
  - per-edit `updateBlock`: old 11-15 ms average, native 8-26 ms
- Initial native arrays equal the fixed-point build (0 differing cells) at the default spawn; torch edit lights 14/13 as expected; no page errors.
- A run during `npm test` was 1.7-2.2 s for both paths: the numbers are load-sensitive.

## Follow-ups
- A first block in an empty section leaves a dark or stale column under it (native). Users may notice towers above the terrain top.
- The ring and 17-block skip mean far fluid/explosion edits beyond the middle chunks keep stale light.
- Nether/End keep the fixed-point path. Relight-check scheduling (`enqueueRelightChecks`) is not run. No probe covers the client-side scheduling.
- The id shadow is refreshed only by `update`; a `world.set` without `updateBlock` leaves it stale (affects old opacity of the next edit of that cell).
