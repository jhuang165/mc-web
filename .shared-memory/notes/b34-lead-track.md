# Batch 34 lead (claude, 2026-11-09)

Five Sonnet tracks ran in `../wt34-<name>` on `batch34-<name>`, cut from 087c0b4ea (0.62.0 plus the vanilla use fixes, equal to github/main). The lead reviewed each one and merged it --no-ff on `batch34-lead`. Per-track notes are `<name>-b34-track.md`. The gun side runs separately (`wt-guns`, `guns-prototype`) and was not touched; its uncommitted PROJECT.md paragraph in `game/` was kept out of these commits.

## Lead fixes
- **0.62.0 regression** (00d5b8e41): with the shared tick tree, `tickWorldSystems` never called redstone `tickEnd`, so block events, the redstone tile-entity loop and piston pushes did not run in play. `world-tick.js` now calls `tickEnd` after hoppers and brewing (where `redstone.tick()` ran it); `world-tick.test.js` pins both paths. awayspawn found it; the away run had its own loop and was not affected.
- **Protocol** (12aeb027b): serverchecks3 raised PROTOCOL to 3, which collides with the gun branch's own 3. Kept 2; chunk packets go only to a client that joins with `chunks: true`, and the server expands them to cells (`expandChunks`) for older clients. A test checks both clients get the same cells.
- Path cap comment cost figure corrected (d34281ca7); serverchecks3 note brought in line with protocol 2 (4de3daa9a).

## Merges
- **serverchecks3**: dedicated refusal chat then `blocks` to the clicker only (live WebSocket test), `splitChanges`/`chunkPacketCells`, real-constructor `EyeHeightProbe` (95/95), weather mood player at the feet.
- **ticktree2**: redstone `n` as an 8th save item, `observers.step(name, changes)` in `TickTree.tick` (fluid changes reach redstone per run), two backlog scenarios (2600, 3300 entries), no primed TNT in 14 seeds; low-border import ticks documented as not kept.
- **awayspawn**: player commands queued while away and replayed on return through the live command host (`/give` to the inventory, `/tp` success text without the move, `/kill` fails as from a block); away spawning settled as none; away run on `attachTickTree`; lit furnaces emit; `selectsNobody` makes a no-match selector silent in play.
- **villagefight6**: the `ChunkCache` is read only by the swimming start loop, so no region bound; live cap 6000 -> 30000; a reinforcement site in an unloaded chunk is lost but draws the world Random through a ghost zombie; reinforcement yaw from `Math.random`; 23 records replay exactly.
- **travelperf4**: `savedPortals`/`savedPortalFor` aim the exit prewarm at the saved portal the Teleporter picks; Nether `specMax` 40; ring-light `info` keeps the emitter y-range. `exit-prewarm.test.js` passes `timeoutMs: 120000` to `adopt` (the flaky test).
- **Conflicts**: none (auto-merges in `main.js` and `dimension-live.js`).

## Verification (batch34-lead before the release commit)
- `npm test`: 5020 pass, 0 fail (run once). `npm run build`: ok. Bridge unittest: OK. `git diff --check main`: clean.
- Muted headless Chrome (vite :5339, `artifacts/b32-lead/smoke.mjs`, `nether-torch.mjs`, `artifacts/b33-lead/away.mjs`): load 1.82 s with one 107 ms task (the gun session's two GPU Chromes were running; batch 33 measured 1.01 s on a quieter machine). Torch light 14/13 in all dimensions; nether-torch 0 mismatches over 12 Nether and 2 End spots; inventory, styled chat and anaglyph work. Away trip 630 ticks over 57 columns in 454 ms, no duplicate ids. Only console error: the known static-asset 404.
- No live piston browser check; the regression is pinned by the unit test only.

## Cursor jumps (user report, not a game issue)
- The user's mouse jumped while agents worked. Codex/ChatGPT computer-use processes were gone; Universal Control was disabled (preference set; the System Settings toggle is authoritative). A headless Playwright page asking for pointer lock did not move the cursor.
- A 150 s cursor recording caught one instant 467 px teleport to (640, 313) while the gun-server session (`f004ff64`, headless Chromes on CDP 9433/9434, `--window-size=1280,800`) had just started a renderer and two node drivers. That session is the main suspect; not confirmed.

## Remaining gaps
- In "Done in batch 34" and "Still open from batch 34" of `public/research/remaining-gaps.md`.
- Batch 35 candidates: away commands whose effects a later command in the same run can see; spawnpoint/difficulty from away commands; per-`setBlock` fluid notifications to redstone; saved-portal pick with height; ring-light cells beside the resident window; a live piston browser check.
