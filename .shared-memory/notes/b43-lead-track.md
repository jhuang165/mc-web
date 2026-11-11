# Batch 43 lead (claude, 2026-11-10)

Eight Sonnet tracks ran in `../wt43-<name>` on `batch43-<name>`, all cut from e644dabc2 (0.71.0, equal to github/main). The lead reviewed each one and merged it `--no-ff` on `batch43-lead`. Each track has its own note, `<name>-b43-track.md`. The gun side runs separately and was not touched. Its uncommitted PROJECT.md paragraph in `game/` was kept out of these commits.

## Merges (in merge order)
- **tileedits** (c6a6f853b):
  - `describeCell` sends the description of each changed cell outside a resent chunk, and of each edited tile, with the native S35 action ids.
  - New `sign`, `beacon` and `signEditor` messages. `updateSign` follows `processUpdateSign`. Placing a sign or skull makes its tile, and tiles go with their block.
  - `containerPending`: a hopper or hopper cart beside a loading column skips its whole update.
  - The flower pot scan in `describeTiles` is one `indexOf` pass. The lead checked it against the world's `(lx*16+lz)*height+y` layout.
  - Not native: a spawn egg has no spawner branch in 1.7.10, so only the server setter exists. The beacon payment uses the held item because the dedicated server has no windows.
- **awayride** (69df3f473):
  - Mounted units and player leads run while away. Hanging entities use `x`/`z` for the 32-block rule.
  - `away-death.js` puts a shadow kill's drops and orbs in that dimension's arrivals. The live player then dies through `survival.damage` on return.
  - The wall step is measured.
- **thinicons** (12f952f9f, plus a lead fix):
  - Non-cube icons draw their executed boxes through `icon-quads.js`. Block item ids fold to the block in `item-boxes.js`.
  - `ChestItemProbe` adds `chest-item-model.js`. Flat icons use GL edges.
  - **Lead fix:** the track extended the stub GL11 (display lists, scale, push/pop) but did not re-run `verify-item-render.mjs`. Re-run, it records 400 items with none failing, because the chest family now runs. With that reference `item-render.test.js` and `icon-quads.test.js` failed 3 tests. The box tests now skip render type 22, which is covered by `chest-item-reference.json`, and the old "chests fail" assertion is now "nothing fails, type 22 is the chest family". Those two files then passed 14/14.
- **legacywander** (2cdd3ebfe):
  - Silverfish keep the 0.98 forward carry and sync `entityAge` (+2 in light). The lead checked that silverfish skip `Brain.updateAITasks`, so the counter is not added twice.
  - Corpses zero `moveStrafing`, and a blaze corpse runs `blazeUpdate`.
  - The fireball replay keeps health on `setDead`.
  - `fireballs-b43-reference.json` has 27 records with each entity's draws.
- **trackerextras** (182edfdb5): eyes, rockets, hooks and witch potions on the object tracker. S1C metadata goes to the client copies, knocked objects set `velocityChanged`, falling blocks use step height 0 and the native falling block id.
- **wanderdraws** (13794059a):
  - `endermanThink` runs on `legacyThink` with a `findPlayerToAttack` hook.
  - Wolf and sheep tasks draw `Entity.rand`. `legacyThink` now sets `rotationYawHead = rotationYaw`.
  - The enderman carry lookup bug is fixed.
  - The strict replay passes 59/59 b42 and 17 b43 records.
  - Combined after the legacywander merge: legacy-ai, fireballs b42/b43, enderman-wolf b42/b43, silverfish and zombie-wander passed 257/257.
- **entitylist** (4f26939e7):
  - `entityWalkers` and `EntityWorld.joined` stamps; `tickOne`/`reap` per kind.
  - `finishEntitySimulation` runs after the walk. `EntityListProbe` gives 15 records, 13 of them replayed.
  - The merge was automatic. The lead checked that trackerextras' `velocityChanged` and step height 0 survived it.
- **trackermounts** (a8de5c648):
  - S1B attach on the tracker. Riders, mounts and leash holders use client positions.
  - `clientEnvironment` and client motion for ghast, squid, blaze, wither and bat.
  - **Conflict:** `EntityWorld.turnBody` in `entities.js`. wanderdraws had added the enderman's legacy body turn (`LEGACY_BODY`), while trackermounts had moved the body helper into the exported `bodyTurn`. The lead kept the enderman branch inline and delegated every other mob to `bodyTurn`.
  - After the fix, tracker-mounts, enderman-wolf b42/b43, entity-tracker, entities, squid-bat and entity-list passed 167/167.

## Verification (batch43-lead before the release commit)
- `npm test`, run once after all eight merges: 5611 of 5611 passed.
- `npm run build`: ok (11.0 s). Bridge unittest: OK. `git diff --check main`: clean.
- Muted headless Chrome smoke (vite :5443; output in `artifacts/b43-lead/`):
  - Load took 2.2 s, with no long tasks after load. 160 ticks per 8 s in the Overworld and the Nether.
  - Spawned drops fall and arrows fly.
  - The first look-down run (`smoke2.json`) had 22 items and `fell: false`. That came from that random world: a muted rerun (`smoke2b.json`) and `diag.mjs` showed 5 items, all falling and none duplicated.
  - Away trip (`away.mjs`): the first run delivered the pig and 2 orbs, with no item and the third orb missing, and showed three separate portal entry times. The rerun (`away2.json`) ran 356 of 356 ticks and delivered the pig, the item and 3 orbs once each, with no duplicate ids. The awayride track's own trip (355 ticks) also delivered everything. The first run's loss is not reproduced and is listed as open.
  - The only console errors were the known static 404 and the localStorage message from the final about:blank page.
- The lead closed the two headless Chromes left from an older multiplayer test (ports 9433 and 9434, about 28 h old) at the user's request.

## Remaining gaps
See "Still open from batch 43" in `public/research/remaining-gaps.md`, plus each track note.
