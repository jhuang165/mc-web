# Batch 36 lead (claude, 2026-11-09)

The five Sonnet tracks ran in `../wt36-<name>` on `batch36-<name>`, cut from ec4218a15 (0.64.0, equal to github/main). The lead reviewed each track and merged it --no-ff on `batch36-lead`. Each track has its own note, `<name>-b36-track.md`. The gun side runs separately (`wt-guns`, `guns-prototype`) and was not touched. Its uncommitted PROJECT.md paragraph in `game/` was kept out of these commits.

## Merges
- **pathcap** (063485cab): `pathfinding.js` caches cell tests per search in pooled 16x16x16 pages and keeps points in a pooled open-addressing table keyed by `makeHash` (same lookup-by-hash behaviour as IntHashMap). Live cap 250000 expanded points (was 30000), exported as `getPathNodeCap`. The largest native follow range is about 156, a sealed flat flood of about 55000 points. A range-100 native record replays with equal point counts.
- **travelperf6** (006b4d572): `DimensionLive.exitCache` keeps the Teleporter's portal cache per root and dimension (swept as `removeStale` does; a clock that went back drops it), and `cachedExit` feeds the exit prewarm. `RingLight.residentSees` stops resident columns from counting as able to see the sky (identical answers on 3000 cells). The caps were measured at load 7-10 and left unchanged.
- **awayrun6** (6422a6232): `traceAway` records a player trace; `syncShadow` moves the shadow player to it at each firing; give and clear return as one `inventoryDelta`. `/spawnpoint @p` uses the target position with floor(y + 0.5), live and away. A mid-run `/setworldspawn` unloads at the next autosave. Away fluids notify per write. Away entities follow the 32-block loaded rule.
- **lightfloat** (227c4b8f1): an executed RenderBlocks probe (render type 0, 168 neighbourhoods, 11160 vertices) replays byte-exact through `ChunkMesher.meshBlock` (10776 compared). Native AO-solid, corner-open and neighbour-brightness tables; neighbour brightness no longer reads the cell below (`lighting.js`, `mesh-region.js`, `away-light.js`; no conflict with awayrun6). Float AO, exact icons for translucent textures.
- **jockeys** (0781740b0): chicken jockeys with the native World.rand draws, including a chicken refused in an unloaded chunk (`releaseDead` keeps the ghost rider). Held-item swap timing, `attackEquipment` for damage and experience, the skeleton combat-task reset. Chickens use their own random. 20 native records replay exactly.
- **Conflicts**: none. **Lead fixes**: none needed.

## Machine load
- Tracks ran focused tests only, as the brief asked. The load stayed at about 5-13 during the merges.

## Verification (batch36-lead before the release commit)
- `npm test` (run once, after all five merges): 5098 pass, 0 fail, 180 s.
- Targeted runs after the merges: lightfloat's 23 files, 169 pass.
- `npm run build`: ok. Bridge unittest: OK. `git diff --check main`: clean.
- Muted headless Chrome smoke (vite :5339, `artifacts/b32-lead/smoke.mjs`, `nether-torch.mjs`, `artifacts/b33-lead/away.mjs`; output in `artifacts/b36-lead/`):
  - Load took 1.28 s with no long tasks.
  - Torch light was 14/13 in all three dimensions; nether-torch found 0 mismatches (12 Nether spots, 2 End spots; the End count depends on the arrival spot and was 2 in earlier runs too).
  - Inventory, styled chat and anaglyph work.
  - The away trip ran 619 ticks over 59 columns in 330 ms, with no duplicate ids.
  - The only console error was the known static-asset 404.

## Remaining gaps
- See "Done in batch 36" and "Still open from batch 36" in `public/research/remaining-gaps.md`.
- Batch 37 candidates:
  - render types other than 0 (stairs, fences, fluids, cactus, doors, torches) in the light probe, and the six face-culling differences;
  - the chicken partial-path stop (seed 1406) and the seed-113 jockey drift;
  - skeleton spider jockeys;
  - health, hunger and effects in the away shadow, and per-move 32-block checks;
  - mob portal travel sharing the world's Teleporter cache;
  - a quiet-machine measurement of the travel caps.
