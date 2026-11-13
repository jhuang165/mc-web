# Batch 58 lead (2026-11-13)

Ten Sonnet tracks were cut from a584b2389 (release 0.86.0) in `../wt58-<name>` on `batch58-<name>` and merged --no-ff on `batch58-lead`. Every track followed `../artifacts/b58-lead/track-rules.md`. Release 0.87.0.

## Merges
- clientfire (6ded58862), rendering (0b16bbadc), savedorder6 (c06ee3b9d), vehicles4 (d271ad1aa), trackerphase (fe0e5da91), mpsurvival (389323612), serverbroadcast (a6b03c51e), mpeating (ac446f943), itemtags2 (0997dcf8e), prediction4 (0b121dd10).
- Conflicts, all kept both sides: `src/entities.js` imports (savedorder6 `trackChunkLoads`, vehicles4 `horseCopyStatus`); `server/server.js` options (`gameMode` and `ops`) and the per-tick sends (`collect` and `sound`); `src/multiplayer/client.js` hooks (`onCollect`, `onPlayerOp`, `onSound`); `src/multiplayer/simulation.js` player record (`achievementsSaved` and `rand`).
- Found wrong by the tracks: client fire spread, the horse flag metadata delay, the burp being local-only, a showDeathMessages gamerule, `/kill <name>` targeting the named player, the native double button click (the port's own extra click was the bug).
- The savedorder6 note's "cow lost after a reload" is the test harness: the cow is at x -14 and the bounded test world rejects it in `EntityWorld.restore`; not a bug.

## Lead fix
- 545be5b5c: `movementTick` returns early over a connection, before `tickMining`, so a Survival dig sent status 0 and never progressed or sent status 2. The branch now ticks the dig when not Creative; `mpsurvival-b58.test.js` pins it.

## Verification
- Full `npm test` once on the merged branch before the lead fix: 6929 tests, 6929 pass. `npm run build` ok. Bridge unittest OK.
- After the fix, targeted: dig and prediction files (52 pass).
- Muted headless multiplayer check (`../artifacts/b58-lead/mp.mjs`: a local Survival server on 127.0.0.1:5475 in-process, vite 5590, Alice in headless Chrome as an operator, Bob a plain ws client; ledoge0 not contacted): Bob eating an apple played random.eat x7 and random.burp at Alice; `/give Bob diamond 2` sent Bob a `playerOp` give of id 303 x2; `/achievement give achievement.openInventory Bob` reached Bob as a `chat.type.achievement` component; `/kill` put `death.attack.outOfWorld` on Bob's chat with the component JSON and killed Alice. No page errors. The dig did not break the dirt; that led to the lead fix.
- The user said the mouse skipped during that check and blamed the browsers; the rerun was stopped and no further browser checks were run (the dig fix is test-checked only). Single-player smoke (prediction4 hotbar count, hopper sprite, skull profile) was not run.

## Follow-ups
See "Still open from batch 58" in `public/research/remaining-gaps.md`.
