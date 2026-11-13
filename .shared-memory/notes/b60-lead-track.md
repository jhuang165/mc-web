# Batch 60 lead (2026-11-13)

Ten Sonnet tracks were cut from 94684b989 (release 0.88.0) in `../wt60-<name>` on `batch60-<name>` and merged --no-ff on `batch60-lead`. Every track followed `../artifacts/b60-lead/track-rules.md` (no browser checks of any kind, targeted tests only). mphealth ran in a harness worktree and committed on `worktree-agent-ab2fb7a15a815d946` (8833abbe1), merged from there. Release 0.89.0.

## Merges
- awaytracker (b7d1901c9), mpcommands2 (38b12054a), smallchecks2 (0c42c7bd5), mobsounds (0d98775e2): clean.
- mpinventory (4240d7501): `simulation.js` conflict with mpcommands2 (`dropHeld` beside `invClick`/`invAck`/`invClose`); kept both.
- mpmobs2 (4a2b3297e): `main.js` (`onSound` mob filter with `onInv`) and `server-mobs.js` (`watchMobs` with `mobStatus`); kept both.
- mphealth (8833abbe1): `client.js` constructor and `buffer`; kept `onInv`/`INV` beside `onHealthFx` and the health messages.
- savedorder8 (05ba6453a): `entities.js` imports; kept both.
- mpstations (3457e37c3): `main.js` import, `client.js` sends, `server-containers.js` furnace line; kept both.
- mpcontainers2 (7e3bee838, 04ab59d01, f027cdf14): `main.js` import and `onAux` (anvil 1020/1021 and dispenser aux both handled), `client-containers.js` (station builders and `litFurnaceData`/`dispenserAux`), `server-containers.js` (imports, constructor, furnace line); kept both.

## Lead fixes
- e82cc21e3: awaytracker declared `let awayIdle` inside `launch` but read it in `tickSurvival`, a ReferenceError on every single-player tick once `mobs` existed. Now module scope.
- In the merge commits: the window 0 craft result (`server-inventory.js` `container.onCraft`), the workbench (`ServerStations.onCrafted` default) and furnace takes (`ServerContainers.onFurnaceTake` default -> mpcontainers2's `smelted`, which also spawns the XP) award through `sim.achievements`. 590142848 adds `src/b60-lead.test.js` for the first two.
- Not wired: brewing-stand takes (`onPotionTaken`): `BrewingContainer` has no take hook, single player included.

## Verification
- Full `npm test` once on the merged branch: 7207 tests, 7207 pass (`../artifacts/b60-lead/npm-test.log`). `npm run build` ok. Bridge unittest OK.
- Pushed with `git push github main` rather than `npm run push:github`, which would have rerun the same full suite on the same code.
- No browser checks of any kind. Never seen running: the hurt tilt, heart blink and corpse poof; window 0, the three station screens and the anvil field; furnace glow, chest lids, dispenser smoke; mob sounds, poofs and knockback over a connection; objects after a Nether round trip.

## Follow-ups
See "Still open from batch 60" in `public/research/remaining-gaps.md`.
