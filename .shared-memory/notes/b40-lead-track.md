# Batch 40 lead (claude, 2026-11-10)

The five Sonnet tracks ran in `../wt40-<name>` on `batch40-<name>`, cut from e95ec9d43 (0.68.0, equal to github/main). The lead reviewed each track and merged it --no-ff on `batch40-lead`. Each track has its own note, `<name>-b40-track.md`. The gun side runs separately and was not touched. Its uncommitted PROJECT.md paragraph in `game/` was kept out of these commits.

## Merges
- **slablight** (0de1c31e3):
  - `lighting.js` `cellPacked` and `isSlabBlock`: a BlockSlab cell whose brightness is 0 answers the cell below (`aji.c`), in `LightVolume.packed` and the worker's `RegionLight.packed`.
  - `SlabLightProbe.java`, `slab-light-reference.json` (408 fixtures, 30924 vertices), `slab-light.test.js`: exact.
  - Sandstone and wood single slabs now use the single-slab side culling.
- **potplant** (d7bd6c8ba):
  - The probe registers items (`Item.registerItems`), so pot tile entities resolve; all 14 pot contents exact.
  - 111 new fixtures: iron bars (all masks and neighbours), bent stems, position-hashed plants, lily pads and fire at several positions (one stand-in chunk per chunk coordinate).
  - Iron bars had x and z swapped on z-axis planes; the leaf rule for the top and bottom strips was fixed.
  - `render-types-2.test.js` KNOWN is empty; the reference is 8.0 MB. The gate item boxes are recorded (`GATE_ITEM_BOXES`) but not wired into icons.
- **tracker** (9a127eb93):
  - `entity-tracker.js` `MobTracker`: native `EntityTrackerEntry` encoded positions, update delays, the 4-block / 400-tick resend and the `viewDistance*16-16` clamp; `TrackerProbe.java`, `tracker-reference.json`, 15 tests.
  - `drainClientSounds` plays a mob's client sounds at the tracker's client position, only while the client entity exists; dragon wings are client-only and tracked. `main.js` passes `options.distance` as `mobs.viewChunks`.
  - Renderer and particles still use live positions (about two ticks of motion ahead of native).
- **fireballs** (bda517953):
  - `FireballProbe.java`, `fireballs-reference.json` (27 records), `fireballs-replay.js`, `fireballs-native.test.js`: flight, drag, intercepts, the punch, explosion power and fire, water, exact.
  - `fireballs.js` fixes (aim normalisation, first-update box, water before the sweep, collidable large balls, punch rules, damage source); `projectiles.js` cake ray box.
  - Blaze, silverfish and giant take any living attacker as target (`TARGETS_ATTACKER`); the blaze crackle is client-only; silverfish and giant keep `isJumping`.
- **netherload** (0bff8f657):
  - Root cause of the "Downloading terrain" hang: `renderer.compileAsync` threw in its timer when a mob or item material was disposed during the trip, so the warm-up promise never settled. `shader-warm.js` `compileReady` replaces it.
  - Scripted trips with a pig, item and orb in the portal: 7 of 8 stalled before, 5 of 5 loaded after.
  - Its runs showed one duplicate id in the Nether mob list after the return trip; not investigated.
- **Conflicts**: none.

## Verification (batch40-lead before the release commit)
- `npm test` (run once, after all five merges): 5299 of 5299 pass (3:07).
- `npm run build`: ok. Bridge unittest: OK. `git diff --check main`: clean.
- Focused runs after each merge all pass (slab-light, render-types, render-types-2, mesh-worker, doors-panes, stems-cake, entity-tracker, ring-events, dragon, entities, away-entities, fireballs-native, legacy-ai, blaze-ghast, silverfish, giant, projectiles, village-fight b38/b39, shader-warm).
- Muted headless Chrome smoke (vite :5339; output in `artifacts/b40-lead/`):
  - Load took 1.26 s, with one 61 ms long task after load.
  - Torch light was 14 in every dimension, and nether-torch found 0 mismatches over 12 Nether and 12 End spots.
  - Inventory, styled chat and anaglyph work.
  - The away trip ran 624 of 624 ticks over 58 columns in 402 ms with no duplicate ids; two re-runs (load 5.4) took 319 and 292 ms, inside the earlier range.
  - The only console error was the known static-asset 404.

## Cursor jumps (user report, still unresolved)
- The user says CPU is about 15% and nothing is running in Codex. ChatGPT's idle computer-use helpers (`cua_node` servers started 13:52 and 13:53, 0% CPU) were the only input-capable processes found. The unified log showed no readable TCC entries. Suggested test: switch off Accessibility entries one at a time.

## Remaining gaps
- See "Done in batch 40" and "Still open from batch 40" in `public/research/remaining-gaps.md`.
- Batch 41 candidates: the duplicate Nether mob id after a return trip; a full-trip check of away portal delivery; the gate item model; renderer positions from the tracker with velocity packets; an `EntityPlayerMP` probe player for creative targeting.
