# Batch 39 lead (claude, 2026-11-10)

The five Sonnet tracks ran in `../wt39-<name>` on `batch39-<name>`, cut from 12940159e (0.67.0, equal to github/main). The lead reviewed each track and merged it --no-ff on `batch39-lead`. Each track has its own note, `<name>-b39-track.md`. The gun side runs separately and was not touched. Its uncommitted PROJECT.md paragraph in `game/` was kept out of these commits.

## Merges
- **gates** (caac8e328):
  - `render-shapes.js`: `gateRenderPlan` (taken from a symbolic run of `renderBlockFenceGate`; gates between walls sit 3/16 lower), the anvil uv table (fitted to the record), and the End portal frame eye box (0.25 to 0.75).
  - `ChunkMesher.box()`: a block with `lightEmission > 0` takes `flatFace`; `renderAllFaces` may be a face-skip function; an optional `uvFn`.
  - The batch 38 button rows were stale (already exact). All rows for these types are deleted.
- **vessels** (bd215a90e):
  - `render-vessels.js`: cauldron, hopper, cocoa, stems, brewing stand and fire are exact. The flower pot's plant is drawn from the bytecode; the record has no plant quads (row `[5508, 0, 2376]`).
  - `fire.js` `FIRE_INFO` gains wood stairs, fences and wood slabs at 5/20.
  - The branch cherry-picked the gates commit; the merge took it once. Conflicts in `render-types-2.test.js` (the KNOWN rows) and `post-shaders.md` (both sections kept).
- **spiderwall** (dae91435b):
  - `village-fight-b39-reference.json`: 13 climbing, 7 kill and 2 night-jockey records, all exact. `SeedMath.java` logs `Math.random` for `Entity.knockBack`, replayed through `EntityWorld.mathRandom`.
  - `legacy-creature.js` no longer clears `isJumping` each tick; damage with no attacker draws one `Math.random`; `deathUpdate` calls `freeRider`.
  - Creative target clearing was not recorded (the probe has no `EntityPlayerMP`).
- **legacyai** (01e047cb4):
  - `LegacyAiProbe.java`, `legacy-ai-reference.json` (3.9 MB), `legacy-ai-replay.js`, `legacy-ai.test.js`: 33 slime, magma cube, ghast and blaze records, exact.
  - `blazeThink` on `creatureActionState`; slime squish on dying mobs; level event 2006 for falls over 3 blocks (`main.js`); splash volume from `moveMotion`.
  - In its browser check a size 2 slime's health fell from 16 to 3 near a ghast and a blaze; the track did not find why (probably their fireballs). Not investigated further.
- **awayportals** (b130faa2a):
  - `entityDeparture` (replacing `vehicleDeparture`) builds the record for carts, boats, mobs, items and orbs; the away run steps all of them through portals and returns the run tick; `finishAway` delivers at that tick's total time.
  - `EntityPortalProbe` mount mode (101 records); `advanceWorldClock` in `dimension-live.js` with a unit test.
  - The track left two waiting loops that matched their own command line and never ended; the lead killed them.
  - Its scripted Nether trips sometimes stayed on the terrain screen, also on the batch 38 code; the cause was not found.

## Verification (batch39-lead before the release commit)
- `npm test` (run once, after all five merges): 5246 of 5246 pass (2:59, load about 4.5 at the start).
- `npm run build`: ok. Bridge unittest: OK. `git diff --check main`: clean.
- Focused runs after each merge: render-types-2, render-types, shaped-blocks, fire, stone-utility (all pass); village-fight b37/b38/b39, legacy-ai, silverfish, giant, slime, blaze-ghast, entities, mob-riding (all pass together); away-entities, entity-portal, dimension-live, dimension-away, away-world (all pass).
- Muted headless Chrome smoke (vite :5339, `artifacts/b32-lead/smoke.mjs`, `nether-torch.mjs`, `artifacts/b33-lead/away.mjs`; output in `artifacts/b39-lead/`):
  - Load took 1.27 s, with one 53 ms long task after load.
  - Torch light was 14 in every dimension (neighbour 13 in the Overworld and the End, 14 beside lava in the Nether), and nether-torch found 0 mismatches over 12 Nether and 12 End spots.
  - Inventory, styled chat and anaglyph work.
  - The away trip ran 623 of 623 ticks over 50 columns in 266 ms, with no duplicate ids.
  - The only console error was the known static-asset 404.

## Remaining gaps
- See "Done in batch 39" and "Still open from batch 39" in `public/research/remaining-gaps.md`.
- Batch 40 candidates:
  - the Nether trip that stays on the terrain screen;
  - a probe pot tile entity, so the flower pot's plant can be checked;
  - an `EntityPlayerMP` probe player for creative targeting;
  - fireball flight in the AI records, and blaze revenge targets;
  - tracker encoded positions and update delays.
