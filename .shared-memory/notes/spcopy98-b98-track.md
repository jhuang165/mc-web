# spcopy98 (batch 98): arrival hint for a short or missing portal wait

## Summary
A trip into the Overworld whose portal wait ended before the exit window was built (or that had no wait: scripted) now still gets the arrival hint, by waiting for the workers' window instead of giving up. Does not claim full parity.

- `src/dimension-live.js`:
  - `waitExitWindow(root, from, to, p, ms = 15000)` (new): starts the exit prewarm for the trip's target when the wait never did (saved portals read first, as `warmExit`), then awaits `exitWarm.need` (the 8 x 8 chunk window, i.e. every cell it touches), bounded like `ExitPrewarm.adopt`.
  - `announceArrival`: when `announceNow` finds columns missing and the target is the Overworld (prewarm enabled), it calls `waitExitWindow` and runs `announceNow` again. This path runs after `settle`, never in the portal tick, and generates nothing on the page thread (cells come from the workers). `arrive` adopts the same cells afterwards (its own wait on `need` is now already satisfied), so total trip time is not lengthened, only the old world's save follows the hint.
- `src/spcopy98-b98.test.js` (4 tests).

## Item 2 (cells beside the arrival)
The window requested is the 8 x 8 chunks round the Teleporter focus, so all cells it touches (up to 4) are `need`, not speculative; the neighbouring cell of a target near a border is requested together with the first and waiting for `need` covers it. Nearest-first order (b97) only matters for the in-tick early hint, which still needs all columns the Teleporter reads (Port-read); a partial shell gives no early hint and the post-settle path above then covers it. Edge case not covered: a Teleporter search or makePortal reading outside the 8 x 8 window (the exit focus is a saved portal up to 128 blocks away: `start` focuses the saved portal, which is what the Teleporter picks; Port-read).

## Evidence
- Port-read: `arrivalTerrain` throws on a column not in the shell; `announceArrival` previously ended there (no hint). `ExitPrewarm.start/need/adopt`.
- Not executed against native: native has no such delay (Bytecode-read, b95/b96: Teleporter runs in the portal tick).

## Verification
- `node --test --test-concurrency=2 src/spcopy98-b98.test.js src/spcopy96-b96.test.js src/spcopy97-b97.test.js src/spcopy95-b95.test.js`: 19 tests, 19 pass.
- With dimension-live.js reverted: spcopy98 file 3 fail, 1 pass.
- Related list (57 files: spcopy*, dimension*, away*, portal*, every test naming dimension-live/travel-loading/exit-prewarm): 394 tests, 394 pass, 0 fail.
- No build (no new imports), no full `npm test`, no browser.

## Follow-ups
- Still no in-portal-tick hint for a wait shorter than one cell build (impossible without page-thread generation); the hint arrives after the cell does, before the save.
- Browser-only: the old world's save (and so the loading transition) now follows the worker delivery by up to the cell build time on such trips; the loading screen covering it was not looked at.
