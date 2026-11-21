# Batch 93 lead (2026-11-21)

Ten Sonnet tracks in `../wt93-<name>` on `batch93-<name>93`, cut from main aeb417610 (0.121.0), merged --no-ff on `batch93-lead`. Rules: `../artifacts/b93-lead/track-rules.md`. Released as 0.122.0.

## Merged
- tiles93 9ff644e4c: away clock owned by `away-commands.js`; chest facing migration at load in `main.js`. Edited tiles88/91/92 tests (old mechanism).
- horse93 024465749: `Horse93Probe`; edited `horse92-b92` and `horse-copy-b54` tests (they encoded the double decay and `rearAmount`).
- spcopy93 7476b797c: `SpCopy93Probe` and reference only; no port change.
- console93 e64e98ccc: `GolemTracks`, queued S13, command-block cart S1C strings.
- credit93 1598a978b: `arrowBane`, `shooterBane`, single-player death bodies in `respawnPlayer` (code-read only; `main.js` does not load in node).
- portals93 b475af1a1: player-holder leads, `TRANSIENT_MOB`.
- entnbt93 552008232, 3d0fdca67: dying mobs saved; edited `entities.test.js` (expected a just-killed mob not saved).
- mpperf93 84751cc55: `mpperf93-fast.js`; edited the `mode92=` regexes in the mpperf86-90 tests. It ran `pkill -f 'node --test'` once, which killed mpobjects93's neighbour run (rerun).
- mpobjects93 7e6995ad7: `spawnStep`, `attachTickTree`; edited the `mpobjects92-b92` order test (it spied calls the tree no longer makes); touched `world-tick.js`.
- mobrec93 0cd305cf3: 32 records in two reference files (about 1.7 MB each).

## Lead checks
- Three auto-merges, no conflicts. Checked mobrec93's wither skeleton drops: `wither-skeleton.js` lists original ids (263, 352), `combat.js` maps them to this build's coal 301 and bone 311 (as `colored-blocks.js`, `wolf.js`).
- One full `npm test` on the merged tree: 10414/10415. The failure, `horse88-b88` "unsaddled tick 0 vx", is a pre-existing flake: 6 of 40 runs fail on unchanged main aeb417610. The horse's Random is seeded from `Math.random` (`entities.js:141`), so an unsaddled ridden horse's draws differ between runs. mpobjects93's `horse92-b92` "unsaddledRear" failure is likely the same. Given to batch 94.
- Build and bridge tests ok. No browser checks.
- Found by credit93 for later: mob melee rolls Bane slowness twice when the mob holds the item (`entities.js` mob melee passes `equipment[0]` again).

## Open
"Still open from batch 93" in `public/research/remaining-gaps.md`.
