# horse93 (batch 93): the rear seat reads bM everywhere, a mob rider's input is decayed once

Branch `batch93-horse93`. New: `tools/probes/Horse93Probe.java`, `tools/verify-horse93.mjs`, `public/research/horse93-reference.json` (5 scenarios, 9 KB), `src/horse93-b93.test.js`. Changed: `src/horse-live.js`, `src/horse-copy.js`, `src/mob-riding.js`; two old tests adjusted (below).

## Summary
1. **Mob rider input was decayed twice.** `steeringRider` (horse-live.js) multiplied the rider's moveForward / moveStrafing by 0.98 "because the port's rider walk does not run". It does run (`entities.js` walk of a ridden mob, which already decays in place), so the horse steered with 0.9604 * AI value. Natively `sv.e` (onLivingUpdate) does `bd *= 0.98; be *= 0.98` in place and `wi.e(FF)` reads `sv.bd * 0.5` and `sv.be` raw at its next update. The extra decay is removed.
2. **Player seat reads bM.** `wi.ac` reads `bM`, the PREVIOUS rear amount (`prevRearAmount`; `bL` is the new one, `wi.h` copies bL into bM before changing it). The player's seat on the live horse (`horseSeats.updateRiderPosition`) and on the client copy (`copySeat`, also used for a remote rider's copy in `client-ride-seat.js`) used `rearAmount`, one tick early. Both now use `prevRearAmount`. Interpolation does not apply: `ac` reads the raw field; only the renderer's pose uses partial ticks.
3. **Client copy of a mob rider.** `seatPosition` (mob-riding.js) only looked at `mount.horseAnim` (live horses); the tracker's `ClientEntity` keeps the counters in `horse`, so `stepRider` seated a mob rider with no rear shift. It now takes `mount.horseAnim ?? mount.horse`.

## Evidence
- **Executed**: `horse93-reference.json` from `Horse93Probe`: a real `sv` subclass rider (old-AI hook `bq` sets raw `be` / `bd`) whose own `sv.e` runs, on the unchanged `wi` (forward, forward + strafe, half speed, backward, idle). Rows: the fields the horse reads (0.98 * raw, never 0.9604) and the horse's position per tick. `horse92-reference.json` mobRider rows (rider position and body yaw while bM > 0) replay through the client-copy seat; `horse-copy-reference.json` `rear` rows set `bM` directly, which is what `ac` reads.
- **Bytecode-read**: `sv.e` 513-543 (in-place `*0.98`), `wi.e(FF)` 98-122 (reads `sv.bd`, `sv.be` raw), `wi.ac` reads bM.
- **Port-read**: player seat is taken after the horse / copy step in the same tick (`entities.js` seat(), `main.js` seatOnCartCopy after the tracker); a player rider's own input path (C0C, `e.rider`) was not changed.

## Verification
- `node --test --test-concurrency=2 src/horse93-b93.test.js`: 9/9. With the three src files restored from git it fails 6 (3 AI-rider scenarios, client-copy seat, player copy seat, live seat).
- Neighbours: `grep -rlE "horse-copy|horse-live|mob-riding|steeringRider|horseSeats|copySeat|rearAmount|seatPosition|client-ride-seat|riddenBy|horse9" src --include='*.test.js' | xargs node --test --test-concurrency=2`: 539 tests, first run 535 pass / 4 fail (all four encoded the old behaviour, fixed below), then `horse-copy-b54` + `horse92-b92` rerun 30/30. Full `npm test` and `npm run build` not run (no new imports in shipped code).

## Found wrong in the batch 92 list / old tests
- `horse92-b92.test.js` fed the rider `forward / 0.98` to cancel the port's second decay; now feeds the value as the rider's field (native). `horse-copy-b54.test.js` set only `rearAmount` and expected a seat shift; native shifts by bM, so it now sets `prevRearAmount` too.
- Batch 92 follow-up "the player seat uses rearAmount where native reads bM": confirmed (one tick early). "Rider input values are only port-read": confirmed wrong (double decay).

## Follow-ups
- A player rider's own input (C0C values) was not re-probed against `wi.e(FF)`; only the mob rider path.
- A dismount from a mob mount other than the sneak path is still not probed.
- Browser-only (not checked): how the rider looks on the first rearing ticks, now one tick later.
