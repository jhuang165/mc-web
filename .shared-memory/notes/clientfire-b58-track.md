# Batch 58 clientfire: when the crystal copy's client fire ends, and client fire spread

## Summary
- `src/crystal-fire-layer.js`: each overlay entry remembers the real block and meta at the time it was made. `reconcile` drops the entry (and rebuilds the cell from the real world) when the real cell differs from that base (the server's block change for the cell, any block), when the real cell equals the entry, or when the chunk is no longer loaded (no mesh call then). There is no timeout, because native has none. An unsupported fire is shown as air (see Evidence).
- `set` now runs BlockFire.onBlockAdded's support test (`fire.js canPlace`) on the client view: with no solid top below and no flammable neighbour the client cell ends as air.
- `src/crystal-fire-b57.test.js`: fixture gets a bedrock floor (the crystal stands on one; without it the new rule removes the fire). `src/clientfire-b58.test.js`: 6 tests.
- `client-prediction.js` untouched.

## Evidence
- Bytecode-read (`javap -c -p` on the unchanged jar): `bjf` (WorldClient) `a(IIIIII)` (invalidateBlockReceiveRegion) is a single `return`; `bjf.b()` (tick) calls `ahb.b`, time, entity re-adds, `bjb.a` (network), chunk cache `bjd.d`, `g()`: nothing resets a predicted block. So there is no "blocksToReceive" timeout in 1.7.10; a client-set block stays until S23 / S22 / chunk data replaces it. `bjf.c(IIIaji I)` (setBlockAndMetadataWithNotify path used by packets) calls the empty invalidate and then `ahb.d(..., flags 3)`.
- Bytecode-read: `bjf.g()` (tickBlocksAndAmbiance) calls `ahb.g()` (`C()`: builds the active chunk set from players) then, for up to 10 chunks, `ahb.a(II apx)` (ambient light/sound only). Block.updateTick (`aji.a(ahb,III,Random)`) is invoked only from `mt` (WorldServer, 3 call sites); 0 call sites in `ahb`, `bjf`, `apx`, `bao`, `bjb`. `ahb.a(IIIaji I)` (scheduleBlockUpdate) is an empty method in the base World. Result: the client world does no fire spread or burn-out. The gap "client fire spread not read" is wrong as a spread gap; only fire's `onBlockAdded` and `onNeighborBlockChange` run client side.
- Bytecode-read: `alb.b(ahb,III)` (onBlockAdded): skips the portal test when dimension id > 0 (End), then `!doesBlockHaveSolidTopSurface(below) && !canNeighborBurn` -> `setBlockToAir`, else `scheduleBlockUpdate` (no-op on the client). `alb.a(ahb,III,aji)` (neighbour change) does the same removal.
- Recalled: S23 only arrives when the server's cell changed; the port approximates that by comparing the real cell to its value when the entry was made (a change and change-back between two copy ticks is missed). Not executed; no probe built.

## Verification
- `node --test src/clientfire-b58.test.js src/crystal-fire-b57.test.js src/end.test.js src/client-predict-b56.test.js src/entity-tracker*.test.js`: 54/54. `npm run build` ok. Full npm test not run (batch rule). No browser check.

## Follow-ups
- Real-world fire (not overlay) that loses support through a predicted client break is not removed on the client view: `client-prediction.js clientNeighbourChange` has no fire case (left alone for the `prediction4` neighbour). One line: `FIRE && !canPlace(w,...) -> w.set(x,y,z,0)`.
- Only the crystal copy's cell is modelled; other client-set fire (flint and steel use, client onItemUse) is not.
