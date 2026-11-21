# spcopy92 (batch 92): the single player's server copy across a portal trip

## Summary
- `src/ai.js`: `PlayerView.left` is now an accessor: `_left || absent`. The away stand-in (`absent`) reads as `left` for every reader batch 91 gated; `update()` still runs for the stand-in (`if (this._left) return`). New `departing` field. `alive` getter unchanged. `sneakOff`/`answerFrom` untouched.
- `src/entities.js`: new `copyDeparts()`; `tickMobs` calls it at the player's turn in the list walk (or after the walk if the player was last). It flips `left` there and skips the one entity that shifts into the player's index, except for End exits and deaths.
- `src/main.js`: instead of `left = !!dims.busy` each frame, hands `copy.departing = { skip: dims.listSkip }` to the walk; a failed trip (`!dims.busy`) clears `left`/`departing`. `feet`/`tickBeacons` keep `dims.busy` (tile pass runs after the removal).
- `src/dimension-live.js`: `listSkip = !exit && !death` set in `travel()`.
- `src/player-edit-simulation.js`: `applyEditInner` returns `{ handled: false, branch: 'player-left' }` while `left`. Gates hits, entity clicks, callReinforcement, leashFence and block clicks during the async trip window.
- `public/research/spcopy92-reference.jsonl` (5.7 KB): probe output. Probe in git-ignored `tools/research/spcopy92-probe/`.
- `src/spcopy92-b92.test.js` (7 tests). `src/spcopy89-b89.test.js`: one source-shape regex updated (it matched the old `left = !!dims.busy` line, not behaviour; the behaviour assertions in that test are unchanged and pass).

## Evidence
- Executed (real ahb/oi/mt, Unsafe-allocated WorldServer doubles, `public/research/spcopy92-reference.jsonl`): in the portal tick the old world drops the player from `playerEntities` and `loadedEntityList` (ahb.f), `isDead` is reset, tracker untracks in the old dim then tracks in the new dim in the same tick; the entity after the player is not updated that tick (list `i++` skip) and updates the next; last/only player: no skip; End exit (ahb.e): no skip, untrack twice; the new world's first tick updates old entities then the player.
- Bytecode-read: oi.a(mw,int), oi.a(sa,int,mt,mt), ahb.h/f/e/d/a, mp/mn track/untrack, vu.b.
- Port-read: the away-run readers; tracker spawn timing at arrival; the walk gates (tests drive them).

## Verification
- `node --test --test-concurrency=2 src/spcopy92-b92.test.js`: 7 pass. With ai.js, entities.js, player-edit-simulation.js reverted (copy-aside): 5 fail, 2 pass (reference file, source regex).
- 66 test files naming PlayerView/siegePlayers/dims.busy/applyPlayerEdit/DimensionManager/away-entities/`.left` (via xargs, concurrency 2): 636 tests, 635 pass, 1 fail (the spcopy89 regex above), then fixed: spcopy89 + spcopy92 19/19.
- No full `npm test`, no build (no imports touched), no browser.

## Found wrong in the batch 91 list
- The away `absent` stand-in did not behave like `left`: the gates read `left` only. Before the fix the away run despawned spider, pigman, silverfish, blaze, enderman on tick 1 and `siegePlayers` was non-empty; after it 10 survive and siege count is 0.
- `left` flipped at frame level (`dims.busy`), not at the player's turn: entities before the player in the portal tick saw him gone, and no entity was skipped.
- Player-event readers were reachable: clicks during the async trip window (busy until the new world opens).

## Follow-ups
- Open: continueExecuting held-target difference when arrival is within follow range (needs arrival coordinates, unknown at the portal tick); tracker spawn timing at arrival is port-read; the old-chunk membership quirk after ahb.f is not modelled.
- The skip applies to the entity at the player's list slot in the port's order; the real list order for entities spawned this tick is port-read.
- Browser-only: none verified; the feel of the one-tick skip is unobservable.
