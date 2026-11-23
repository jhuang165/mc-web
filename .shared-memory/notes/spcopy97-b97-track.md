# spcopy97 (batch 97): early arrival for the End portal, nearest-first exit prewarm, finite Overworld hint

## Summary
The Teleporter result for a trip is now known inside the portal tick for the End portal and for a finite Overworld root, and a Nether-to-Overworld wait that ends early is more likely to hold the arrival's cells. Does not claim full parity.

- `src/dimension-live.js`:
  - `tick`: when not remote, not in the End and not busy, the destination's edits are armed (`armArrival(root, END)`) while standing in an End portal block, and every 10 ticks when `nearEndPortal` (7 x 7 x 5 box scan) finds one. The End portal itself has no wait, so arming happens as the player approaches; the trip's `announceNow` then runs before its first await (the portal tick). Without earlier arming it still falls back to the post-settle path.
  - `armArrival` for a finite Overworld root (`!root.chunked`): builds the finite `World` (generate + `restore(root.edits)`) after one microtask (so not inside the tick that arms it) into `pre.finite`; `announceNow` uses `FinitePeek(pre.finite)`.
  - `arrive`: a finite destination now uses `FinitePeek` instead of `LivePeek` (the Teleporter reads what it just wrote, as `peekFor` already did). Needed so the hint and the real arrival agree (before, the hint differed: 75,36.5,72 vs 68,64,68 in a test).
- `src/travel-loading.js` `window()`: the chunk list is sorted nearest-the-target first, so the unit holding the arrival leads each lane (a worker builds its queue in order and each cell is adopted as it arrives). A wait that ends early more often holds the arrival's cell; no extra round, no page-thread generation.
- `src/spcopy97-b97.test.js` (6 tests). Probe: `tools/research/spcopy97-probe/` (git-ignored; SpCopy97Probe, case `overToEnd` added).

## Evidence
- Executed (SpCopy97Probe, real ahb/oi/mt classes), `overToEnd`: the End portal transfer removes the player, runs the Teleporter (arrival 100,49,0), tracks in the End and the old world lists no player, all inside the one portal tick; the old world's next tick has no player entry.
- Port-read: lane order in `StreamPrefetch.whenHas` (messages posted in list order, worker serial), cells adopted on receive.
- Port-read: finite `arrive` used `LivePeek` (writes invisible to its own Teleporter); `peekFor` used `FinitePeek`.

## Verification
- `node --test --test-concurrency=2 src/spcopy97-b97.test.js`: 6 pass.
- Related list (55 files: spcopy*, dimension*, away*, portal*, prewarm, travel-loading, every test importing dimension-live/travel-loading/exit-prewarm): 387 tests, 387 pass, 0 fail. (I briefly swapped the two source files aside for the fails-without-fix check while this run was going; it still passed.)
- With dimension-live.js and travel-loading.js reverted: spcopy97 test file 4 fail, 2 pass.
- No build (no new imports), no full `npm test`, no browser. (One accidental whole-suite start from an empty file list after a failed BSD `sed` chain was stopped with TaskStop at once; no result used.)

## Found wrong in the batch 96 list
- "Finite Overworld roots: no shell, no hint": the finite world is cheap to build on the page; done. Also found finite `arrive` used a peek that hid its own writes (see above).
- Item 2: I could not make a guaranteed arrival hint for a wait that ends before ANY cell is built: only the order changed. Native has no such delay; the page thread does not generate Overworld cells (a cell costs 1 to 2 s).

## Follow-ups
- A Nether-to-Overworld wait shorter than one cell build (about 1.2 s) still gets no hint; scripted trips similar.
- The Teleporter may need a neighbouring cell when the arrival is within about 17 blocks of a cell border; then nearest-first gives it second, not guaranteed within the wait.
- The finite peek ignores the inbox's pending arrival writes, as `arrive` does (unchanged).
- Browser-only: the finite `World` build (about the size of `peekFor`'s) happens one microtask after the arming tick; any hitch is not measured.
