# spcopy96 (batch 96): Nether-to-Overworld arrival before the save, and the arrival in the portal tick

## Summary
The Teleporter result is now known before the old world's save point for a trip INTO the Overworld too, and (when the portal wait pre-read the destination's edits) it is computed inside the portal tick itself, so no tick sees the copy "dropped" first. Does not claim full parity.

- `src/dimension-live.js`:
  - `armArrival(root, target)`: reads the destination's saved edits (and the stored-column index) once, from `warmExit` during the portal wait; kept in `arrivalPre`, cleared in `arrive`.
  - `arrivalTerrain`: Nether/End `DimensionWorld` as before; Overworld: only the population cells the exit prewarm shell already holds (`exitWarm.shell`, the same cells `arrive` adopts). A column that is not built throws, so there is no hint and NO generation on the page thread (no stall).
  - `announceNow(rec, p, target)`: the synchronous Teleporter run on copies of the shared cache and random (batch 95 logic, now with `stored`). `announceArrival` = `armArrival` + `announceNow`.
  - `travel`: tries `announceNow` before its first `await` when no delivery is in flight (`flights === 0`; the shared cache must be final), else after `settle` as in batch 95.
  - Bug fixed: the batch 95 guards were `if (target && ...)`, and `target` is `0` for the Overworld, so even a supported Overworld trip never reached the hint. Now `!exit && !death`.
- `src/spcopy96-b96.test.js` (4 tests). Probe: `tools/research/spcopy96-probe/` (git-ignored) with two added cases.

## Evidence
- Executed (SpCopy96Probe, real ahb/oi/mt classes): `netherToOver`, `blockedNetherToOverWest/East`: the old world lists the copy at the SCALED chunk (e.g. scaled 8,2 / arrival 7,2 and the reverse), the same rule as Overworld to Nether. The portalTick record holds `afterRemove`, `track`, `trackerDone` inside the one tick and the old world's list after it has no player: no tick runs between the portal tick and the Teleporter result natively.
- Bytecode-read (batch 95): `oi.a(mw,int)` runs the Teleporter before the save.
- Port-read: the exit prewarm shell holds the Overworld cells the portal wait built (same cells adopted by `arrive`); `arrive` and `announceNow` use the same Teleporter inputs (test 1 compares them on a streaming Overworld reading the same cells).

## Verification
- `node --test --test-concurrency=2 src/spcopy96-b96.test.js`: 4 pass. With `dimension-live.js` reverted: 3 fail, 1 pass.
- Related list (spcopy*, dimension*, away*, portals*, *prewarm*, every test importing dimension-live; 51 files): 367 tests, 367 pass, 0 fail.
- No build (no new imports), no full `npm test`, no browser.

## Found wrong in the batch 95 list
- "Overworld destination: terrain not on this thread": the prewarm already holds it during a portal wait; fixed. Also the `target &&` guard bug above (Overworld is 0).

## Follow-ups
- Only a trip with a portal wait that finished building the window gets the Overworld hint: a scripted trip, the End exit (not a transfer anyway) or a wait shorter than the cell build (about 1.2 s per cell) still gets no hint; I did not add synchronous generation (a cell costs 1 to 2 s on the page thread).
- A trip without a wait (End portal, /tp-like scripted trips) still computes after the settle, so ticks between remain there (the Nether/End edits are not pre-read). Could arm `armArrival` for the End portal on standing in it.
- Finite (non-streaming) Overworld roots get no hint (no shell).
- Browser-only: nothing visible expected; the early compute is a synchronous Teleporter run in the portal tick (Nether destination generates Nether columns there, as in batch 95, now at the tick instead of after an await).
