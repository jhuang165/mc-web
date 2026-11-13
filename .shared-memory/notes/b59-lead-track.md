# Batch 59 lead (2026-11-13)

Ten Sonnet tracks were cut from dcde17ef4 (release 0.87.0) in `../wt59-<name>` on `batch59-<name>` and merged --no-ff on `batch59-lead`. Every track followed `../artifacts/b59-lead/track-rules.md`, which forbids browser checks of any kind (the user blamed the batch 58 headless check for their mouse skipping). Release 0.88.0.

## Merges
- smallchecks (7c4a4819f), deathfx (20fc6ff57), trackeridle (20ef2fec8), savedorder7 (de05d49ea), prediction5 (2f0ff81cc), servercommands (e3947280f): clean.
- mpstate (7eaa689ba): conflicts with servercommands in `simulation.js` (`savePlayer`, the void branch of `tick`) and `server-broadcast.js` (`drain`); kept both.
- mpitems (754e402aa): conflicts in `server.js`, `main.js`, `client.js`, `simulation.js`; kept both. The pickup moved to `ServerItems.pickup`, which now pushes the servercommands `pickup` event.
- mpcontainers (803517d9a): conflicts in `main.js`, `client.js`, `simulation.js`; kept both. Its hotbar guard became `if (!p.window && !serverItems.adopt(...))`.
- mpmobs (f2e4430fe): conflicts in `server.js`, `entities.js` (the savedorder7 seat release and the `beforeMob` hook), `main.js`, `client.js`, `simulation.js`; kept both. The chat line is now "Dimension travel is not connected yet."
- The mpcontainers agent stopped once when the computer slept and was resumed.

## Lead fixes (in the merge commits)
- 8e513ef3b: the constructor's `--difficulty` and the saved difficulty collided (servercommands set 1 after mpstate set the option); a saved value now wins over the option. The Survival respawn uses the `/spawnpoint`.
- 1e278a770: mpstate's `health` message carried `ate` so the client took the eaten food, but with mpitems the server's own `Survival.eat` spends the stack and sends a slot correction, so the client took two. `ate` is gone; tests updated.
- 5c2879e72: `damagePlayer` was a no-op on both sides (mpmobs left it for mpstate, which never defined it), so mobs could not hurt players. It now calls the player's real `Survival.scaledDamage` / `damage` with the mob's arguments (difficulty scaling, armour, CombatTracker); `mpmobs-b59.test.js` checks a zombie hit and a slain-by death. A merge slip that commented out `newPlayerMode` was fixed in the same commit.
- Not wired: `comparator-toggle.js` (smallchecks). The client world has no redstone state for the input powers, so the powered-input case stays open.

## Verification
- Full `npm test` once on the merged branch with the fixes: 7022 tests, 7022 pass (`../artifacts/b59-lead/npm-test.log`). `npm run build` ok. Bridge unittest OK.
- No browser checks of any kind, as asked. Never seen running: the multiplayer HUD, death screen and respawn; container windows, lids and furnace bars; mob copies, aim and attack; break effects, fly-in, orbs; the prediction5 cases; the copy death poof; the F3+H titles.

## Follow-ups
See "Still open from batch 59" in `public/research/remaining-gaps.md`.
