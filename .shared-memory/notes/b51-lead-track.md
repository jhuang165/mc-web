# Batch 51 lead (2026-11-12)

## Summary
Eight Sonnet tracks cut from 119a6db93 in `../wt51-<name>`, merged --no-ff on `batch51-lead` in this order: ridecopy, blockclicks, cmdtexts, dragonfx, awaydispense2, mobvictims, trackerqueue, flyturn. No merge conflicts (`src/main.js`, `src/entities.js` and `src/object-tracker.js` auto-merged). Release 0.80.0. Each track's details are in `<name>-b51-track.md`.

Lead fix (a76cface9): the gamerule list (`/gamerule` with no argument) joins the sorted rule names with `CommandBase.joinNiceString` ("a, b and c"), as `CommandGameRule` does over `GameRules.getRules` (a TreeMap key set). It used to join with ", ". A guard test is at the end of `cmd-texts-b51.test.js`.

## Verification
- Full `npm test` once on the merged branch: 6424/6424 pass. `npm run build` ok. Bridge unittest OK. `git diff --check` clean.
- After the lead fix, only the gamerule test files were re-run (49/49, then `cmd-texts-b51` 7/7). The fix went in before the full run.
- Muted headless smoke (`artifacts/b51-lead/smoke.mjs`, vite 5590, killed afterwards):
  - Real right click with a held block places it through the pending-edit queue (0 to 1 block in the test area).
  - Real left click on a cow lands after the walk (10 to 9 by hand).
  - Display carts with tall grass meta 0, 1 and 2: the dead shrub stays brown, grass and fern are tinted green (`carts.png`).
  - Dropped items carry entity ids from their creation and have client copies.
  - Ticks: 160 per 8 s in the Overworld and the Nether, no long tasks while turning. The only errors are the known 404 and localStorage messages.
  - Not seen: a held-mouse dig did not break a dirt block in headless Chrome. It also fails the same way on main (0.79.0, port 5591), so it is a harness limit, not a batch 51 change. The queued dig is covered by `block-clicks-b51.test.js` and the player-mining tests only.
  - Not seen: the ridden boat splash, the dragon beam and the joint tracker walk (`mobs.jointRan` resets each tick, so a read between ticks says nothing).

## Follow-ups
See "Still open from batch 51" in `public/research/remaining-gaps.md`.
