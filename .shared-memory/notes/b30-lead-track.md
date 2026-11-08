# Batch 30 lead (claude, 2026-11-08)

Eight Sonnet tracks ran in `../wt30-<name>` on `batch30-<name>`, cut from 5f9862e (0.58.0, equal to github/main). The lead reviewed each one and merged it --no-ff on `batch30-lead`. Per-track notes are `<name>-b30-track.md`.

## Merges
- **villagefight2**: all seven village fight records replay exactly. Fixes: probe sight rays, death-tick `burst(null)` draws, per-entity kept bounding box in `moveEntity`, golem lift as a double, `Brain.syncCombatTask`, Peaceful removal at the end of the tick (`peacefulGone`), and `Brain.nearby(..., dying)`.
- **ringlight2**: chunks that are neither resident nor held act as barriers in `computeColumnLight` and the search (the `complete()` gate is gone). Adds `World.put` -> `ringSink.edited` -> `HeadlessColumns.edited`, and `LightClientServerProbe`.
- **anaglyph4**: `requestGuiAnaglyph`/`commitGuiAnaglyph` ahead-of-time conversion, Cache API `mcag-1` (SHA-1 keyed), a body hold of at most 1.5 s on load with the option on, item-atlas tint after conversion, pack icons and the profile skin, and a png-codec registry for the upload hook. Changes 2 lines in `scene.js`.
- **awayticks**: `away-plan.js`, `away-world.js`, `away-worker.js`; `DimensionLive.beginAway`/`finishAway`/`endAway`; `writeChunkColumns`; clock catch-up through `host.advanceTicks`. Changes about 5 lines in `main.js`.
- **serverhandlers**: `server-handlers.js` (`SpamCounter`, `creativeDrop`, `chatPacket`), `chatSpamGate` in `main.js`, creative reach 5 for blocks and 6 for entities (was swapped; checked against `getMouseOver`), and `ServerHandlersProbe` with a netty `AttributeKey` double.
- **meshworker**: `chunk-mesher.js`, `mesh-region.js` (snapshot of the column plus 2 cells on every side), `mesh-pool.js`, `mesh-worker.js`. Stale results are dropped by `keyEpoch`, dirty stamps and `meshGen`. `?meshWorkers=0` keeps meshing on the page. Also `warmShaders()` and an `endFrame` -> `endFrameBlock` rename (End portal frames were not meshed).
- **interchange7**: `TileTicksProbe` and `HorseItemsProbe`; the save box changes from +18 to +16; comparator `OutputSignal`; `cleanItems` keeps count <= 0 and sets negative damage to 0; `leash.raw` round trip.
- **superflat2**: generation 20/21 (`neighborsOn`, `mapFeaturesOn` odd versions from 17). `native-neighbor-world.js` adds neighbour callbacks in population, with a quiet retry when a chain is unported. The dispenser `setSlot` marks dirty. New worlds are created at 20.
- **Conflicts**: none. `main.js` auto-merged (awayticks, serverhandlers, meshworker, superflat2), as did `scene.js` (anaglyph4, meshworker) and `world.js` (ringlight2, superflat2).
- **Lead fix**: a trailing blank line in `src/away-plan.js` (diff-check).

## Verification (batch30-lead plus the release commit)
- `npm test`: 4833 pass, 0 fail. `npm run build`: ok, and the away and mesh workers are emitted. Bridge unittest: OK. `git diff --check 5f9862e`: clean.
- Muted headless Chrome (`artifacts/b30-lead/smoke.mjs`, `nether-torch.mjs`; vite :5319; load average 16-22):
  - A new world loads in 1.26 s, with 0 long tasks in the 20 s after load. Batch 29 had 4-28 under heavier load, so this is not a clean comparison.
  - Torch light is 14/13 in all three dimensions. nether-torch shows 0 mismatches over 12 Nether and 2 End spots.
  - Inventory, styled chat and anaglyph flags work. One 63 ms task after arriving in the End.
  - The only console error is the favicon 404.

## Remaining gaps
- They are in "Done in batch 30" and "Still open from batch 30" of `public/research/remaining-gaps.md`. The batch 29 open list is trimmed to two lines.
- Batch 31 candidates:
  - entity movement while away (mobs, items, carts, TNT) and dispensers;
  - native-exact rim light;
  - walking frame spikes and the Teleporter second fetch;
  - neighbour callbacks for imported saves and powered doors;
  - several-skeleton and Hard fights;
  - enforcing server distance checks in play.
