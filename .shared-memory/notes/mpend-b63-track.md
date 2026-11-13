# Batch 63 mpend: the End on the dedicated server

## Summary
- `src/multiplayer/server-end.js` (new): `ServerEnd`. The End is built on first use (about 0.6 s): a finite 128 x 128 world filled from the single-player End generator (`DimensionWorld.endChunk`), the Nether's systems reused through `n.dim = 1` (fluids, fire, falling, random ticks, redstone, containers, light, projectiles, a second `ServerMobs`; natural spawns come from EntityWorld's End list, enderman only). Eye of ender on an end portal frame (`useEyeOnFrame`, ring check lights the portal). End portal block sends a player that rides nothing to the End, and back from the exit portal. The Teleporter builds the 5 x 5 obsidian platform at the entrance. `theEnd` on entering, `theEnd2` when the exit portal takes the player out. Saved with the world (`dimensions.end`), a player saved in the End rejoins it.
- Window: the light volume is a fixed 128 x 128 grid, so the End replica holds x -25..102, z -96..31 of the End, stored shifted by `END_OFFSET` (+25, +96). The platform (100, 49, 0) is local (125, 49, 96). Coordinates a player sees in the End are the shifted ones. The island's -x part is cut off.
- Exit portal: natively only after the dragon dies. No dragon yet, so the structure (`exit-portal.js`) is built when the End is made, at the origin (local 25, 64, 96). `DRAGON_ON_SERVER` marks where to turn that off.
- `server-dimensions.js`: small hooks: `state/worldOf/mobsOf`, `within`, `useItem` (eye), `adopt`, `removePlayer`, `saveField`, `snapshotFor`, `afterTick` (alt message for dimension 1), `checkPortal`, `teleporterFor`, `arrive` (`exit` option, End placement, awards), `netherMessage(base, n, dim)`.
- `server-nether.js`: `n.dim ?? NETHER` in six places, fortress list only with `source.provider`.
- `client-dimensions.js`: `FiniteDimensionWorld` handles dimension 1 (isEnd, no hell flag, Sky biome, platform spawn). `main.js`: join chat text only.
- No new wire messages; `dimRespawn` and the welcome snapshot carry `dimension: 1`.
- Test: `src/mpend-b63.test.js` (5).

## Evidence
- executed: JS tests above (ring of 12 eyes lights the portal only on the last, platform blocks, awards, only End players in the End message, save and rejoin).
- reused executed evidence: `useEyeOnFrame`, `createExitPortal`, End generator, Teleporter End branch (earlier batches' reference files).
- bytecode-read earlier: travelToDimension awards pc.C/pc.D only for End trips. Recalled: BlockEndPortal travels at once, no timer.

## Verification
- `node --test src/mpend-b63.test.js`: 5 pass. `mpnether-b61` + `mpnether2-b62`: 14 pass. `b62-lead` + `b61-lead` + `mpend-b63`: 8 pass. `dimension-live` + `mpmobtypes-b61`: 33 pass. `npm run build` ok. `node --check` ok on every touched file. Full npm test not run (batch rule).

## Follow-ups
- Dragon, ender crystals, credits screen: not done. Flying eye of ender (stronghold search) not on the server. End projectiles are not saved. XP orbs inert.
- Real 1.7.10 has a larger End; this window is a compromise. Only a browser could show the swap, End sky/fog, portal rendering.
