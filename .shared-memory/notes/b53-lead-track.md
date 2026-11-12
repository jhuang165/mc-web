# Batch 53 lead (2026-11-12)

## Summary
Eight Sonnet tracks were cut from 5ea7bb4d1 in `../wt53-<name>` and merged --no-ff on `batch53-lead` in this order: ridemounts, cmdtell, leafcolor, displayquads, digfinish, trackerjoint2, firetimes, savedorder2. The only conflict was in `src/entities.js`, at the start of `tickMobs`: savedorder2 added `trackSections(this, order, true)` beside the `playerStamp ??=` line, and trackerjoint2 had moved that line into `playerJoined`. The merge keeps `trackSections` and drops the old line. Release 0.82.0. Details for each track are in `<name>-b53-track.md`.

Lead fixes:
- e2a8ef43c, server dig (bytecode-read `ItemInWorldManager.onBlockClicked` and `blockRemoving`):
  - An instant break sets `initialDamage` but leaves `partiallyDestroyedBlockX/Y/Z` where an earlier dig put them, so `serverDig.start(pos, rate)` only moves the cell when the rate is below 1 (or for air).
  - The finish check compares with the float `0.7F` (`f(0.7)`), not the double 0.7. A rate of exactly 0.7 had been refused.
  - A guard test is at the end of `dig-finish-b53.test.js`.
- c7377297b: a burning arrow's `setFire(5)` skips an enderman (`zc.h` offset 906, `instanceof ya`, bytecode-read; `ya` is EntityEnderman by its sound strings). Firetimes had raised this as an open question.
- A trailing space in `DigFinishProbe.java`, found by `git diff --check`.

## Verification
- Full `npm test` once on the merged branch: 6551/6551 pass. `npm run build` ok. Bridge unittest OK.
- `git diff --check 5ea7bb4d1` found one trailing space, now fixed, then clean. The whitespace fix came after the full run.
- Muted headless smoke (`artifacts/b53-lead/smoke.mjs`, plus `diag.mjs` and `diag2.mjs`; vite 5590, killed afterwards):
  - Held digs: a held click broke port id 1 (grass) through the server timer in 24 ticks and continued into the next block. Port id 3 is stone (7.5 s by hand), so a 2 s hold leaving it is expected.
  - A right click mounted a saddled pig. The player stood at the pig copy's x, 0.175 above its y, and health stayed 20.
  - The display carts drew mature wheat, young wheat, carrots (141:7), oak leaves and the grass block, the grass block with a tinted top and plain sides (`carts.png`).
  - The inventory screen shows grass with plain sides and leaves in the basic foliage tone (`inv.png`).
  - The hotbar does not redraw after a `survival.add` from the console (it redraws on game events), so `hotbar.png` is blank. That is the test setup, not a regression.
  - `/me waves  at everyone` printed "* Player waves  at everyone", the empty word kept. `/tell Steve hi` and `/tell Nobody hi there` printed the red "That player cannot be found" error.
  - Ticks: 160 per 8 s in the Overworld and the Nether, with no long tasks while turning. The only error was the known 404.
  - The player has entity id 24 and a tracker key.
  - Not seen: the whisper lines themselves (there is no second player), the boat copy's water push, fire on mobs, and the saved-order refiling.

## Follow-ups
See "Still open from batch 53" in `public/research/remaining-gaps.md`.
