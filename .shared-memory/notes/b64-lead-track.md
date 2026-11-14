# Batch 64 lead (claude-b64-lead), release 0.93.0

Ten Sonnet tracks in `../wt64-<name>` on `batch64-<name>`, cut from 0.92.0 (f76b1db60), merged --no-ff on `batch64-lead`. Rules: `../artifacts/b64-lead/track-rules.md`. No browser checks (user request).

Merged (track note `<name>-b64-track.md` each): mpclientanim ec367abf8, atlas3 129e0b96d, entityprobes ce11d5f5c, trackertransient 3d8bdcccd, mpdragon 42e7a55c0, mpscoreboard bb45889b2, babyrender efd0ea810, mpend2 4bd61e948, mpwither2 8f2fe4664, mpstats2 1967e8645.

Conflicts (all kept both sides):
- `main.js`: the dragon credits hook (mpdragon) and the scoreboard reset (mpscoreboard) on connect; the remote fishing line (mpstats2) next to `RemotePlayers` with the scoreboard `board`.
- `server-end.js`: mpdragon's `setupEnd` stays; mpend2's `adopt` replaces the two `defineProperty` getters (its `dimState` covers the End).
- `server-dispense.js` `extrasOut`: mpwither2's skulls next to the fireballs, read through mpend2's `dimState`, so End skulls are saved too.

Lead fix:
- **Dragon kills.** The dragon adapter skips the base attackEntityFrom, so its killing blow never ran onDeath: no mobKills, killEnemy or totalKillCount. `installServerDragon` now calls the server's onDeath chain when a blow takes the last health (EntityDragon.func_82195_e is super.attackEntityFrom, recalled). The dragon has no egg, so no killEntity stat; its loot and orbs are unchanged. `src/b64-lead.test.js` fails without the fix.

Test fixes after the full run (test files only):
- `mpend2-b64.test.js`: the End spawn check now leaves out the dragon and crystals mpdragon places by population.
- `mpwither-b64.test.js` head-target test: the sweep half failed about 1 run in 8 on the track branch too. Three causes: the wither effect from earlier skull hits kept ticking damage on player a, blasts dug craters under the players, and the launch drew a random aim spread. The sweep now removes the wither, clears both players' effects, refills the floor, resets positions, waits out the hurt window and launches with `exact` aim. It passed 30 of 30 runs.

Not taken: the eye of ender `use` stat on the server (whether 1.7.10's ItemEnderEye adds it is not checked).

Verification on the merged tree: `npm test` 7600/7602 (`../artifacts/b64-lead/npm-test.log`); the two failures were the tests above, fixed afterwards. `mpend2-b64`, `mpdragon-b64`, `b64-lead` and `mpwither-b63/b64` passed on rerun, and the head-target test passed 30 of 30. No second full run (one full run per change by request). `npm run build` ok, bridge unittest OK.

Open: see "Still open from batch 64" in `public/research/remaining-gaps.md`.
