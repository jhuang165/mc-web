# Batch 38 lead (claude, 2026-11-10)

The five Sonnet tracks ran in `../wt38-<name>` on `batch38-<name>`, cut from 6e4629595 (0.66.0, equal to github/main). The lead reviewed each track and merged it --no-ff on `batch38-lead`. Each track has its own note, `<name>-b38-track.md`. The gun side runs separately and was not touched. Its uncommitted PROJECT.md paragraph in `game/` was kept out of these commits.

## Merges
- **ringevents** (6fd686323):
  - `ring-events.js`: `tracksMob`, `trackedWithin` and `ROCKET_TRACKING`, from bytecode-read `EntityTracker` ranges (`ring-events-reference.json`).
  - Client hurt and death sounds play only inside the mob's tracking square (`entities.js` `watching`); explosion bursts need a player within 64 blocks; rockets tick only in loaded ring chunks.
  - The particle 16-block cull is native. Targeted: 78 pass.
- **teleporter** (66394e2ba):
  - `makePortal` abandons a cell's remaining rotations after one fails (native `continue label274`); all eight cache records replay.
  - One Teleporter Random per world in the shared cache.
  - `vehicleDeparture`: a vehicle already counting down when mounted travels and leaves the player.
  - Away carts and boats return `portalTravel`; `advanceTicks` advances `mobs.worldTicks`. Targeted: 85 pass.
- **panes** (a1a53e7ae):
  - `glassPane`, `vine`, `bed`, `lilyPad` and a rewritten `pane` in `chunk-mesher.js`; fences draw every box face.
  - `smoothFace` takes the neighbour's light in front of fancy leaves.
  - The batch 37 `render-types.test.js` known-gap table is empty. Targeted: 121 pass.
- **spiderai** (22958ee26):
  - `legacy-creature.js`: native `EntityCreature.updateEntityActionState` for spiders, cave spiders and pigmen; `spiderThink` and `pigmanThink` removed.
  - Look-timer and yaw-velocity fixes shared with silverfish; `freeRider` in `mob-riding.js`.
  - 27 records in `village-fight-b38-reference.json`, replayed by `village-fight-replay.js`. Targeted: 321 pass.
- **redstonerender** (71a7ef331):
  - `RenderTypes2Probe.java` (581 fixtures, 96960 vertices), `render-types-2-reference.json` (7.3 MB), `render-redstone.js`.
  - Exact: wire, lever, repeaters, comparators, pistons and heads, tripwire hook and tripwire, pressure plates, daylight sensor. The other types are pinned with matched counts in `render-types-2.test.js`.
  - Targeted: 178 pass.
- **Conflicts**: only `public/research/post-shaders.md` (redstonerender against panes); both sections were kept.

## Verification (batch38-lead before the release commit)
- `npm test` (run once, after all five merges): 5183 of 5184 pass. The one failure was `game-rules.test.js`'s creeper test, which put the player 70 blocks from the blast. Ringevents now drops the S27 burst beyond 64 blocks, as `WorldServer.newExplosion` does, so the lead moved the test's player to 28 blocks (544db670e). `game-rules` and `ring-events` then pass (13/13).
- `npm run build`: ok. Bridge unittest: OK. `git diff --check main`: clean.
- Muted headless Chrome smoke (vite :5339, `artifacts/b32-lead/smoke.mjs`, `nether-torch.mjs`, `artifacts/b33-lead/away.mjs`; output in `artifacts/b38-lead/`):
  - Load took 1.01 s, with one 51 ms long task after load.
  - Torch light was 14 in every dimension, and nether-torch found 0 mismatches over 12 Nether and 2 End spots. The Overworld neighbour read 0 because it was dirt.
  - Inventory, styled chat and anaglyph work.
  - The away trip ran 619 of 619 ticks over 56 columns in 309 ms, with no duplicate ids.
  - The only console error was the known static-asset 404.

## Remaining gaps
- See "Done in batch 38" and "Still open from batch 38" in `public/research/remaining-gaps.md`.
- Batch 39 candidates:
  - the pinned render types (fence gates, walls, anvils, hoppers, cauldrons, flower pots, cocoa, stems, brewing stands, buttons);
  - spider wall climbing;
  - slime, ghast and blaze AI;
  - away mobs, items and orbs through portals;
  - tracker encoded positions and update delays.
