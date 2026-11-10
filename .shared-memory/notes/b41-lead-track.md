# Batch 41 lead (claude, 2026-11-10)

The five Sonnet tracks ran in `../wt41-<name>` on `batch41-<name>`, cut from 84a45d685 (0.69.0, equal to github/main). The lead reviewed each track and merged it --no-ff on `batch41-lead`. Each track has its own note, `<name>-b41-track.md`. The gun side runs separately and was not touched. Its uncommitted PROJECT.md paragraph in `game/` was kept out of these commits.

## Merges
- **awaytrip** (d4504951d):
  - Cause of the duplicate Nether mob id: `EntityWorld`'s constructor counted `nextId` up from 1 while restoring, so a portal arrival (no id; `dimension-live.js` `deliver` deletes it) took a saved id. `nextId` now starts above every saved `mob-N`, and a repeated id is renumbered.
  - `away-trip.test.js`: the real `runAway` with a pig, item and orb in a portal, `finishAway`, `deliverArrivals`, and the Nether lists loaded as `main.js` does. Each arrives once, near the Teleporter's portal. Unit chain, not a browser trip.
- **gateitem** (a8e568b73):
  - Fence gate item boxes (`GATE_ITEM_BOXES`, bytecode-read) in the icon, first-person hand, third-person hand and drops. Before, every block in the third-person hand was a cube.
  - `RenderTypesPosProbe.java`, `render-types-pos-reference.json` (704 fixtures at 24 positions plus plant, lily pad and vine sweeps), `render-types-pos.test.js`: exact.
  - Fixes it found in `chunk-mesher.js`: float hash offsets and `(p+0.5)±0.45` edges for crossed plants, bitten cake side strips, the vine top quad under any `renderAsNormalBlock` block (`render-normal.js`).
- **ringpiston** (813d07e1c):
  - `RimPistonProbe.java`, `rim-piston-reference.json`: a piston reading into an unloaded chunk makes the server load or generate it, so `canExtend` sees real blocks. The port's air reading can only queue an event, which already waits for held chunks (batch 37); end states match (`ring-rim-piston.test.js`). No code change.
  - `ring-chests.js` `seedRingChest`: a hopper, dropper or hopper cart reaching a chest in a never-resident chunk fills it from the unclaimed population record first, so it no longer makes an empty chest that blocks the loot. `StreamingPopulation.unclaimedRecord`, `inventory-transfer.js` `host.seedChest`, one `main.js` line.
- **trackerpos** (4d71c7d1f):
  - `entity-tracker.js`: S12 velocity packets (spawn motion, the 0.02 change, `velocityChanged` on knockback); `ClientEntity` runs `onLivingUpdate` (3-step interpolation, drag, `moveEntityWithHeading(0,0)` through `EntityWorld.moveClient`), hovering in an unloaded chunk. Six executed client scenarios in `tracker-reference.json` (packet handlers bytecode-read).
  - `mob-renderer.js`, the shadow list, leash and nameplate views draw a tracked mob at its client position with the partial tick. Mounted and ridden mobs stay live.
- **lead fix** (1898ba9bb): `EntityWorld.pick` aims at the client entity's box, as `EntityRenderer.getMouseOver` reads the client world (the crosshair hit air in front of a drawn mob otherwise). Test in `entity-tracker.test.js`.
- **playermp** (3bebad402):
  - `ServerPlayerProbe.java`: a real `EntityPlayerMP`. `village-fight-b41-reference.json` (22 records): zombie, skeleton, spider and cave spider against survival, creative, adventure, invisible and sneaking players, at range, and spiders on pillars. The port already matched.
  - `fireballs-b41-reference.json` (10 records): the `inGround` path (fields set by the probe; nothing in 1.7.10 sets it) and blaze volleys at a mob attacker. `fireballs.js` stick rule and per-ball Random; float `getDistanceToEntity` for the blaze; balls tick after the mobs in `tickMobs`.
- **Conflicts**: none.

## Verification (batch41-lead before the release commit)
- `npm test` (run once, after all five merges and the lead fix): 5353 of 5353 pass (load 4.5 at the start).
- `npm run build`: ok (6.1 s). Bridge unittest: OK. `git diff --check main`: clean.
- Focused runs after each merge pass (away-trip, dimension-live, entity-tracker 24 with the pick test, and the tracks' own lists).
- Muted headless Chrome smoke (vite :5339; output in `artifacts/b41-lead/`):
  - Load took 1.26 s, with one 53 ms long task after load.
  - Torch light was 14 in every dimension, and nether-torch found 0 mismatches over 12 Nether and 10 End spots.
  - Inventory, styled chat and anaglyph work. The only console error was the known static-asset 404.
  - Tick rate (`tps.mjs`, 8 s each, load about 9): 160 ticks in the Overworld and in the Nether on both batch 41 and 0.69.0.
  - Away trip: the first run covered only 127 of the usual ~620 ticks (127 ran, no duplicate ids); three re-runs covered 596, 654 and 657 ticks, so the short one was not reproduced and its cause is unknown. Run times were 1.0 to 1.6 s while a local llama-server held the load at 9 to 14; side by side at that load 0.69.0 took 593 ms and batch 41 707 ms. No duplicate ids in any run.

## Remaining gaps
- Mob ids are per `EntityWorld`, not one global `Entity.nextEntityID`; the away delivery check is a unit chain.
- Gate item boxes are bytecode-read; the render-types-2 blocks are exact only at their batch 38-40 positions; `render-normal.js` duplicates flags packed in `redstone.js`.
- Chunk resend carries no tile entity data; a visited and evicted chest can still be made empty by a ring hopper; `unclaimedRecord` can rebuild a population cell (about a second) on the main thread.
- Client entities: flying, swimming and boss mobs are interpolation only; water flags come from the live mob; mounts, riders and leash holders stay live; items, orbs, arrows and particles use live positions.
- Enderman and wolf targeting are not recorded; an idle wandering zombie (seed 4109) turns differently from tick 19; fireballs tick after all mobs rather than in list order; ghast fireballs at mobs are not recorded; the blaze crackle +0.5 offset is bytecode-read and not applied.

## Batch 42 candidates
- Items, orbs and arrows through the tracker; mounts on the client.
- The idle zombie turn difference (seed 4109); enderman and wolf target records.
- Chunk resend tile entity data; evicted chest seeding.
- One global entity id counter across worlds.
