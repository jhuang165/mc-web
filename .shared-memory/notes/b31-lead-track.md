# Batch 31 lead (claude, 2026-11-08)

Seven Sonnet tracks ran in `../wt31-<name>` on `batch31-<name>`, cut from 2d4287be (0.59.0, equal to github/main). The lead reviewed each one and merged it --no-ff on `batch31-lead`. Per-track notes are `<name>-b31-track.md`. The gun side runs separately (`wt-guns`, `guns-prototype`) and was not touched; its uncommitted PROJECT.md paragraph in `game/` was kept out of these commits.

## Merges
- **serverdist**: `serverClick`/`faceOf` in `server-handlers.js`; `serverAcceptsClick` at the top of `edit()` and on the finished-dig hook in `tickMining` (C08 placement < 8 blocks from the feet, C07 dig <= 6 from the eye, C02 use-entity < 6 feet to feet, build-height message). A refused click resends both cells. Creative survival-tab drops go through the limiter; the dedicated server gates chat with `chatPacket` (code only, nothing started or deployed).
- **awayents**: `away-entities.js` runs items, xp orbs, primed TNT, minecarts and boats headlessly for the first 1200 away ticks (the gate re-read from `mt.h`, bytecode-read); dispensers and droppers fire through those systems; `Weather.advance(n)` and the clock run for every trip's loading ticks.
- **interchange8**: `foreignTicks` keeps TileTicks the port cannot run (air, unknown ids, y out of range, blocks without a handler, the low border outside an area) raw and ages them on export; ThisTick tails replayed; float `getInteger` wraps like `floor_double`.
- **villagefight3**: 19 new native records (`village-fight-b31-reference.json`), all 26 replay exactly. Fixes: `WatchClosest` always looks up the closest player, skeletons keep one bow and one melee task for life, loot pickup runs per mob after its own update, a converted villager leaves the list at once.
- **rimlight3**: `RimLightProbe` (5 records, `rim-light-reference.json`); the outermost held ring holds vertical-only sky and no block light (`isRim`, `verticalLight`); invalidation 5 x 5; 64-change resend case added to the client-light probe (not ported).
- **neighbors3**: powered door chain, door fall and every power provider in `native-neighbor-world.js` (pinned by 80 native door records); generation 22/23 for level.dat imports (16/17 plus callbacks, import origin); the jungle decoration limit was the pre-16 biome map and is removed.
- **walkperf**: biome halo of 12 chunks plus `warmBiomes` ahead of ice rolls, inlined relight spread, exit-window-first Teleporter prefetch when a saved portal exists, `?meshWorkers=N`.
- **Conflicts**: none. `main.js` auto-merged (serverdist, awayents, walkperf), as did `dimension-live.js` (awayents, interchange8, walkperf), `world.js` and `java-world.js` (neighbors3, walkperf).
- **Lead fix (91c48461)**: `STRUCTURE_DATA_VERSIONS` lacked 20, so Java export of new worlds since batch 30 wrote no `data/*.dat`; 22 (new imports) would have lost it too. Both added, with a test that 20/22 bytes equal 18/16.

## Verification (batch31-lead plus the release commit)
- `npm test`: 4871 pass, 0 fail (load average about 10-14). The silverfish chase test failed once inside the awayents track's full run under load and passes alone and in the lead run. `npm run build`: ok. Bridge unittest: 5 OK. `git diff --check main`: clean.
- Muted headless Chrome (`artifacts/b31-lead/smoke.mjs`, `nether-torch.mjs`; vite :5339; load average 17-19):
  - A new world loads in 1.28-1.30 s, with 0 long tasks in the 20 s after load.
  - Torch light 14 at the torch and 13 beside it (air neighbour) in all three dimensions. nether-torch: 0 mismatches over 12 Nether and 2 End spots.
  - Inventory, styled chat and anaglyph flags work. One 54-71 ms task after arriving in the End.
  - The only console error is a 404 for a static asset (seen in batch 30 too).

## Remaining gaps
- In "Done in batch 31" and "Still open from batch 31" of `public/research/remaining-gaps.md`.
- Batch 32 candidates:
  - mobs, arrows and projectiles while away; command blocks and projectile dispenses away;
  - running `foreignTicks` in the live world for handlers the port gains;
  - ring-light `search` spikes while walking and the no-saved-portal second fetch;
  - the second rim ring (load-order dependent native light) and the 64-change resend on the client;
  - village fights on terrain, water and closed doors; Hard reinforcements in a dark world;
  - hanging entities, carts and boats through the server use-entity gate.
