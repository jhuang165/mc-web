# Batch 54 lead (2026-11-12)

## Summary
Eight Sonnet tracks were cut from 20bbab13b (release 0.82.0) in `../wt54-<name>` and merged --no-ff on `batch54-lead` in this order: respawntracker, chatnames, digabort, tintsflow, horsecopy, displaycubes, savedorder3, effects2. All merges were clean: `src/main.js`, `src/entities.js` and `src/entity-tracker.js` auto-merged. Release 0.83.0. Details for each track are in `<name>-b54-track.md`.

Several tracks claimed their files late or never got an MCP claim. respawntracker could not claim `src/entity-tracker.js` because horsecopy held it. Their notes are the handoff.

Lead fixes:
- 68d8ef721, saved order (bytecode-read `World.updateEntities`): a rider skipped at its own place in the pass (its mount is alive and carries it) gets no section check there. `prevEntity` is now set after that `continue`. The check runs after its update, which follows the mount's.
- 183d890a7, `flyturn-b51.test.js`: the hidden silverfish (b51sf) now keeps health 7 as `removedHealth` through savedorder3's despawn audit, so the health matches the native record. The test now checks that only the floor cell differs. This was the one failure in the full run.
- 7388f542f, mob pass: the smoke found `flushLoot` throwing "reading 'drop'" every tick.
  - Cause: loot queued outside the tick (a saddled horse killed from the console drops its saddle at `onDeath`) sat below a far mob's `farMark`. The far mob's `flushLoot` then shrank `events` below the mark, and `dropFarEvents` set `events.length = from`, leaving holes.
  - Fix: `tickMobs` flushes pending loot before taking the mark, and `dropFarEvents` clamps to the list length.
  - Not batch-54 specific: the batch 53 smoke killed pigs, which drop nothing at once.

## Verification
- Full `npm test` once on the merged branch (before the last two lead commits): 6610/6611. The one failure was `flyturn-b51` b51sf, fixed in 183d890a7 (14/14). `npm run build` ok. The bridge unittest ran 5 tests, OK. `git diff --check 20bbab13b` was clean.
- After 7388f542f: 78 test files that touch ring ticks, the loot flush and the away run, 1461/1461 pass.
- Targeted tests after each merge: respawntracker + chatnames 42, digabort 44, tintsflow 34, horsecopy 269, displaycubes 22, savedorder3 87, effects2 69. All passed.
- Muted headless smoke (`artifacts/b54-lead/smoke.mjs`, with `diag.mjs` and `diag2.mjs` for the loot bug; vite 5590, killed afterwards):
  - Dig: a 250 ms click on dirt (port id 2) was released and the dirt stayed (the abort path). A 2 s hold then broke it, dropping one item.
  - Horse: a right click mounted a tame saddled horse. The player stood 0.7 above the copy's y at the copy's x. The copy was `steered`, and its yaw followed the look: 180, 151.35, 122.7, 94.06 for look yaws 0 to 1.5 rad. The sneak dismount put the player at (51.02, 150, 79.5), beside the horse at (49.18, 150, 79.5), not on the seat. On one of three runs the horse wandered out of the aim and the click missed.
  - Display carts (`carts.png`) drew the hopper bowl, mature wheat, a torch, the grass block and tall grass. The flat shapes are darker than in batch 53, from the item normal (0, -1, 0) with the standard item lighting (0.4).
  - Opening the inventory printed "Player has just earned the achievement [Taking Inventory]" (`inv.png`). The component's `/msg` click was not inspected in the browser; the executed rows cover it.
  - Sugar cane: not checked. The smoke gave it by vanilla id 338, and port item ids are not vanilla.
  - Ticks: 160 per 8 s in the Overworld and the Nether, with no long tasks while turning. After the fix, the only error was the known 404.

## Follow-ups
See "Still open from batch 54" in `public/research/remaining-gaps.md`.
