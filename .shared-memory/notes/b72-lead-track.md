# Batch 72 lead: merges, joins and release 0.101.0

## Merged (git log --first-parent on batch72-lead)
- cakefog72 74dfb0ca1
- spcapes72 11183ed61
- mpsettings72 c85cd174d: conflict in `tools/build-settings-catalogue.mjs` (SHOW_CAPE keeps spcapes72's offline cape text plus "(settingsClient, C15 showCape)"); catalogue regenerated.
- spawncaps72 f6f045f2e: conflict in `stems-cake.md`, both lines kept.
- smallfixes72 495d6a9a0
- flowerpots72 c683e9571
- mpcadence72 1b476526a: conflict in `src/main.js` at both joins: `client.clientSettings(options)` (mpsettings72) kept with `itrackClient.clear()` (mpcadence72).
- riders72 022567fa6: conflict in `player-step.md`, both lines kept.
- projectiles6 ad0249218
- mpstream72 c84a926e2: conflict in `src/multiplayer/simulation.js`: the ObjectTracker takes mpstream72's `chunkViews.sees` gate and mpcadence72's cadence flag.

## Lead fixes
- 27913f43b: `mpstream72-b72.test.js` tracker test read `messageFor(...).items`, which cadence mode removes (it sends `itrack`); it now reads the tracker's tracked set.
- 7f4c596aa: the seven failures of the full run, each traced to one track by running the file in the track worktrees:
  - `chicken.test.js`: the hatch no longer has a 40-mob cap (spawncaps72; native EntityEgg has none). Test and the `hatch` comment updated.
  - `village-fight-b38/b39` spider jockey replays (3): projectiles6's chunk candidate order applied to replays of `VillageFightProbe`, whose `VillagerProbe` world double keeps one flat entity list; `replayFight` now sets `candidateOrder.flat` (as `projectiles5-b70` does).
  - `mpsurvival-b58` WebSocket dig: the dropped item arrives as an `itrack` spawn row (mpcadence72), not in `tick.items`.
  - `mpreach71-b71` cart cadence: `server-vehicles.js` skipped every vehicle when the host had no `chunkViews` (mpstream72); now a missing `chunkViews` means no column gate (the Simulation always has one).
  - `mpnether3-b63` out-of-range spawner (flaky, 2 of 5 runs on the merged lead): a natural fortress blaze in the 80-mob Nether; the test sets `doMobSpawning` false (spawners ignore it natively).

## Verification
Targeted tests after each merge (riders 234 pass, projectiles 64 pass, multiplayer 77 pass plus the fixed test). One full `npm test` on 27913f43b: 8334 tests, 8327 pass, 7 fail (all fixed in 7f4c596aa, see above); `npm run build` ok; bridge tests ok. After the fixes, targeted reruns: the seven files plus village-fight*, projectiles5/6, spawncaps72, mpstream72: 267 pass, 0 fail; `mpnether3-b63` whole file 9 pass. The full suite was not rerun (one full run per change). No browser checks (by request).

## Open
See "Still open from batch 72" in `public/research/remaining-gaps.md` and the ten track notes (`*-b72-track.md`).
