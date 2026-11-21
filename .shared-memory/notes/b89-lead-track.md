# Batch 89 lead track

## Merged
On `batch89-lead`, cut from 6cd02f772 (0.117.0), in this order: entnbt89, tiles89, horse89, spcopy89, mobrec89, mpobjects89, credit89, console89, mobpackets89, mpperf89. Track agents ran on Opus, by request. No merge conflicts.

## Lead fixes
- The away-run catch-up (b59/b60) read the deleted `record.transit` in `launch` and never ran in the game; it reads `tripArrival` now (8d61ba6d9, `lead89-b89.test.js`).
- The dedicated server never cleared a refused edit's resend list (the statement sat inside a comment since b61), so the cells went out every tick and the list grew; found by mpperf89, fixed with a test that fails without it (f9777cf5d).

## Cross-track tests
115 files (every test changed since 6cd02f772 plus tracker, mpperf8x, spcopy, horse, mobrec, console, entnbt, tiles, credit, combat, dispense, projectile, falling, boat, crystal, portal, dimension, summon, offline87, mpnether, serverprops, trackeridle, vehicle, replay, scheduled-ticks and survival neighbours), MC_MPPERF83..89=verify: 2047/2047.

## Verification
- One full `npm test` on f9777cf5d: 10077/10077.
- `npm run build` ok (existing chunk-size warning); bridge unittest ok.
- No browser checks, by request.

## Found wrong in the batch 88 list
- The server's mob eye height was NaN (not 1.7) for every mob, crystals included.
- 1.7.10 sends no S1D/S1E for a mob's effect changes.
- Eggs and fishing bobbers are never saved natively.
- Batch 88's portal carry-over and batch 59/60's away-run catch-up never ran in the game (deleted `record.transit`).

## Open
"Still open from batch 89" in `public/research/remaining-gaps.md`.
