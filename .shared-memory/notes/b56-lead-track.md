# Batch 56 lead (2026-11-12)

Eight Sonnet tracks were cut from 626a467c3 (release 0.84.0) in `../wt56-<name>` on `batch56-<name>` and merged --no-ff on `batch56-lead`. Release 0.85.0.

## Merges
- dragondeath (f27aed089), trackermobs (44c4b0f52), savedorder4 (01fac48b1), boatcopy (7ba2b8aa2), horsepose (bcbfaeb04), prediction2 (7103554f3, fixes 2f7da0048), displaylight (c8348d5e8), chatnbt (4f517fad6).
- Conflicts: `remaining-gaps.md` (boatcopy) and `src/entities.js` (horsepose against trackermobs); both resolved by keeping both sides (`stepHorseCopy(c, c.horseFlags ?? 0)` in clientAfterMove).
- prediction2 went back once from the browser check: the relight was skipped on a streaming world (`!world.ringSink` guard), and the door item (470) was not predicted because it has no `.block`. Fixed in 701ade97a.
- Lead fix 1a064141d: the canvas pointerdown sent key.use to `edit(true)`, bypassing `clickEdit`, so mouse uses were never predicted.

## Verification
- Full `npm test` once on the merged branch before the last two fixes: 6715/6715. `npm run build` ok. Bridge unittest OK. `git diff --check 626a467c3` clean.
- After the fixes, targeted only: every test that references main.js (358) and the prediction and click tests passed.
- Muted headless smoke (`artifacts/b56-lead/smoke.mjs`, vite 5590, killed afterwards): torch break predicted (timing-dependent in headless; sometimes the real world lands in the same frame); door 470 placed with both halves predicted (38 ms against real 84 ms), toggle predicted (35 ms against 75 ms); `/give` with RepairCost hover; `/say` bare red usage; skeleton arrow death; boat ridden in a water pool with the copy matching live and a working dismount; horse copy flags delivered and the rear pose drawn; 160 ticks per 8 s in the Overworld and the Nether with no long tasks. Only the known 404.

## Follow-ups
See "Still open from batch 56" in `public/research/remaining-gaps.md`.
