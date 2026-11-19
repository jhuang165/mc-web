# Batch 85 pickup85: Creative pickups, skulls in the away world, farmland self-check

## Summary
- Creative pickup: `ServerItems.pickup` no longer returns for a Creative player, and `main.js` (multiplayer client) no longer skips the pickup request in Creative. `pickupFit` counts a Creative inventory (the whole stack is consumed, as `InventoryPlayer.addItemStackToInventory` does for Creative even with no room). Single player already took items, XP orbs (`ExperienceOrbs`, no mode gate in the server `tickOrbs` either) and arrows natively: `Arrows.takeOne` is `pickup == 1 || (pickup == 2 && creative)`, then `take(1)` only for pickup 1, which is `EntityArrow.onCollideWithPlayer`; the inventory's Creative `add` answers true and consumes. Nothing to change there.
- Away world skulls: `awayPlan` carries `root.skulls`; `runAway` builds a `Skulls` store, installs `installSkullBreak` on the shell world (drop at the native 0.7 spread through the run's item random, SkullOwner tags kept), hands the store to the redstone engine (`game.skulls` -> `LiveRedstone` hooks.skulls, so a piston crush drops the tile's own type, not 0), and returns `skulls`; `dimension-live.js` writes it back into the root (dropped when empty). `redstone-runtime.js` gained the `skulls` hook passthrough (undefined keeps the global store).
- Nether skull store in the player-break path: already correct, no change. `handleDig` / `edit` run inside `dimensions.within`, whose swap replaces `sim.tileEntities` (NETHER_CONTEXT) so `this.tileEntities.skulls` is the Nether's. Now covered by an executed test.
- Farmland self-check: removed `[0,0,0]` from `farmNeighbourChange` (single player, client prediction and server support loss all use it). Applies to crops too.

## Evidence
- Bytecode-read: `aky` (BlockFarmland) overrides only the neighbour change (`a(ahb,III,aji)`: solid above -> `setBlock(dirt)`), the random tick, `onFallenUpon`; no `onBlockAdded` (`b(ahb,III)`). `ahb.d(III,aji,I,I)` (World.setBlock) ends with `c(III,aji)` notify of the six neighbours (not the cell) and `Chunk.func_150807_a` runs only the new block's onBlockAdded. `akf` (BlockCrops) / `ajr` (BlockBush) also have no onBlockAdded (BlockBush's check runs from the neighbour change and the random tick). So farmland set under a solid block (/setblock, /fill) stays until a neighbour changes or its random tick reverts it (the random tick only reverts on dryness, not on a solid above); tilling needs air above anyway.
- Executed: `src/pickup85-b85.test.js` (6 tests): Creative server pickup including the no-room consume, away `/setblock` over a skull (type kept, tile left the store), Nether player's `breakDug` reading the Nether store, farmland self-check.

## Verification
- `node --test` targeted: pickup85-b85 6/6; block-sweep, block-sweep3, chunkscan2-b68, farming, spfarming-b69, client-predict/prediction tests 76/76 after the update below; drops84-b84, mpitems-b59, away-world, away-commands, crops, redstone-blocks in the same run passed (100 tests, 1 failure fixed below). `npm run build` not run by this track (see report).
- Updated test: `block-sweep3.test.js` `farmStays` used `farmNeighbourChange` on the crop's own cell as a canBlockStay probe; it now probes through a neighbour cell (a neighbour update of the crop), the native route.

## Follow-ups
- The away world still has no `doTileDrops` gate for the skull drop (like the existing `dropStacks`); signs/beacons have no away tile store either (they drop nothing there).
- Creative inventories on the server: the C10 `invCreative` mirror could overwrite a slot the pickup filled in the same tick; not checked.
- Browser only: the pickup animation and slot refresh of a Creative player on a client.
