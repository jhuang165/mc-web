# Batch 37 lead (claude, 2026-11-10)

The five Sonnet tracks ran in `../wt37-<name>` on `batch37-<name>`, cut from 95d7265bb (0.65.0, equal to github/main). The lead reviewed each track and merged it --no-ff on `batch37-lead`. Each track has its own note, `<name>-b37-track.md`. The gun side runs separately (`wt-guns`, `guns-prototype`) and was not touched. Its uncommitted PROJECT.md paragraph and notes in `game/` were kept out of these commits.

## Merges
- **ringpistons**: the ring-rim piston fault (a line reaching an unheld chunk read it as air and could drop a pushed block). `LiveRedstone.eventActive` keeps the block event queued until the column takes writes and the chunks within 14 blocks are held; `tileActive` (one-line hook in `redstone.js` `updateTileEntities`) gates moving pistons. `hopperActive` lets hopper blocks tick in ring columns (one line in `main.js`); `hopperSuck` waits for an unhydrated ring column. The `World.chunkAt` miss cache already existed (batch 26). Evidence is bytecode-read (`ring-pistons-reference.json`).
- **awayshadow**: trace samples carry health, food, saturation, exhaustion and effects; `playerDelta` returns the net change (`applyPlayerDelta`); `effect` entries no longer replay. Redstone ticks in unloaded away columns are held. `park` in `away-entities.js` applies the 32-block rule each tick to moving entities.
- **wander**: `ridden()` runs the AI only and `walk()` moves and pushes a rider before the seat takes it (fixes the batch 36 seed 113 drift; motion is still zeroed first in `mob-riding.js`). Spider jockey records (7) and underground wanders; seed 1406 was a replay-world error (grass below y 0).
- **rendertypes**: executed `RenderTypesProbe` over 16 render types (354 fixtures, 28656 vertices, 2.3 MB reference). Doors, logs, fluids, fences, stairs, pumpkin and workbench fixes; the six culling cases. `materialSolid` is used only by the fluid mesher's corner heights (checked: `liquidHeight` has no physics caller). Panes, vines, beds, lily pads and fence ends are pinned as known gaps.
- **mobportals**: `shareTeleporter` gives mob, item, orb, cart and boat travel the player's per-world cache; `host.totalTime` (`mobs.saveTotalTime()`) is the sweep clock. Carts and boats travel through portals (executed `xl.h`/`xi.h`, 8 scenarios). One cache record (seed 3000) is replayed only for its first two steps.
- **Conflicts**: none (awayshadow and mobportals both edited `dimension-live.js` in separate parts). **Lead fixes**: none needed.

## Verification (batch37-lead before the release commit)
- Targeted runs after the merges: 224, 80, 208, 169 and 159 pass.
- `npm test` (run once, after all five merges): 5141 pass, 0 fail, 179 s.
- `npm run build`: ok. Bridge unittest: OK. `git diff --check main`: clean.
- Muted headless Chrome smoke (vite :5339, `artifacts/b32-lead/smoke.mjs`, `nether-torch.mjs`, `artifacts/b33-lead/away.mjs`; output in `artifacts/b37-lead/`):
  - Load took 1.04 s with one 55 ms long task.
  - Torch light 14 in all three dimensions. The Overworld spot's east neighbour was dirt (0, correct); its other four neighbours were 13. The Nether spot was one block from lava, so its neighbours read 13-14. nether-torch found 0 mismatches over 12 Nether and 2 End spots.
  - Inventory, styled chat and anaglyph work.
  - The away trip ran 620 ticks over 53 columns in 266 ms, with no duplicate ids.
  - The only console error was the known static-asset 404.

## Remaining gaps
- See "Done in batch 37" and "Still open from batch 37" in `public/research/remaining-gaps.md`.
- Batch 38 candidates: `renderBlockPane`; vines, beds, lily pads; the unprobed render types (wire, repeaters, comparators, levers, pistons, gates, walls, cauldrons, brewing stands, anvils, hoppers); the spider's `updateEntityActionState`; the seed 3000 Teleporter site and a persistent Teleporter Random; a player-ridden cart through a portal; `/xp` as a net away delta.
