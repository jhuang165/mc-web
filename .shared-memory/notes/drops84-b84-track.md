# Batch 84 drops84: skull breakBlock on every setBlock, server support-loss drops, Creative-world drops

## Summary
- Skull: `World.set` now calls `world.skullBreak(x, y, z, oldMeta)` when a skull (internal 172) is replaced by another block. `skull.js` `installSkullBreak(world, skulls, drop)` is the native `BlockSkull.breakBlock`: it drops the tile's item (SkullOwner kept) unless metadata bit 8 is set, and the tile goes with the block. Installed for single player (`main.js` watchFlowers), the server Overworld (`simulation.js`) and the Nether/End (`server-nether.js`), via `installServerSkullBreak` (`server-redstone-drops.js`, honours doTileDrops). So explosions, /setblock, /fill, the dragon and fire drop the skull on both runtimes.
  - The player break path and the piston path consume the tile first, so nothing drops twice. `breakPlayerBlock` takes a `skulls` option; the server passes its own store (before it read the single-player global store and always dropped type 0).
  - The Wither build removes the tiles before `world.set` (the native build sets metadata 8 first), so it drops no skulls.
- Server support loss (new `multiplayer/server-support-loss.js`, `watchSupportLoss`): the server had none of single player's `watchFlowers` rules. Added for the Overworld, Nether and End: carpet, sign (signShouldPop), stem and cake (popDrops), flower (flowerCanStay), crop and farmland (farmNeighbourChange), ladder, snow layer (no drop).
- Creative worlds: `ServerItems.stacksDrop`, `fallingDrop` and `serverRedstoneDrop` no longer gate on a Survival world. Natively only a Creative player's own harvest skips drops (ItemInWorldManager.tryHarvestBlock).
- Away world: the redstone engine's drop path exists (`rt` game.drop -> spill). It added +0.5 to the engine's position, which already holds the native offset; fixed (`away-world.js`).

## Evidence
- Bytecode-read (earlier batch, mppiston83 note): BlockSkull `anl.a(ahb,III,aji,I)` breakBlock drops on metadata bit 8 clear; chunk setBlock calls breakBlock on any block change. Port-read: all other rules ported from existing single-player code.
- Executed: `src/drops84-b84.test.js` (hook, bit 8, tile consumption, Wither build, server carpet in both modes, source checks).

## Verification
- `drops84-b84`: 5/5. Neighbour set (skull, block-break, mppiston83, pots82, wither, mpwither, mpexplosion78, mpnether, mpdragon, mp-dig, away tests and more): 233/233, 898 of 899 over 96 DedicatedSimulation files, the one failure (`mpitems-b59` torch in Creative) encoded the old convention and was updated (10/10). All `away*.test.js`: 103/103. `npm run build` ok. No full `npm test`, no browser checks.

## Follow-ups
- Creative players cannot pick up items on the server (`ServerItems.pickup` returns for creative); natively they can, so Creative-world drops now lie until they despawn.
- The away world has no skull tile store: a skull replaced there drops nothing, and a piston-crushed skull drops type 0.
- The dedicated server's dimension skull store in the player-break path is the Overworld's even for a Nether player (the same `this.tileEntities` the swap provides while within a dimension; not re-checked).
- Browser/client only: whether the server-popped blocks and Creative-world drops show correctly on a client.
