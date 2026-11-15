# Batch 74 mppickup74: server pickup in one list-order pass

## Summary
- New `src/multiplayer/server-pickup-order.js` (`pickupPass`, `playerBox`, `ridingBoxOf`): reuses `collectPickups` from `src/pickup-order.js` (new optional `keepItem` filter there) for the dedicated server.
- `server-dispense.js` `collectArrows`: calls `pickupPass`. With dropped items in reach (server-owned inventory) it takes items and stuck arrows in one pass in list order; with none it is the old `Arrows.collect` path. Per-dimension: it runs inside the lane's swap, so `sim.items`, `taken` and the arrows are that dimension's.
- `server-items.js`: `pickup` body split into `takeItem(p, e, stack, fit, auth)`; the client's `pickup` message takes the stuck arrows in reach in the same pass (only the named items). Arrow `projCollect` rows are pushed from both paths.
- Partial takes (server inventory): natively `addItemStackToInventory` answers false for a partial fit, so no pop, no S0D, no pickup event. The stack just shrinks. Old b60 tests that expected `partial` S0D were changed (`mpitems-b59`, `mpinventory-b60`).
- Orbs are left alone: they compete only with orbs (xpCooldown, executed in b73) and `tickOrbs` already orders them (experience.js). Only the order of the orb sound against the pops is not ported.

## Evidence
- Executed: `public/research/pickup-order-reference.json` (700 scenes, b73) replayed through the server: `src/mppickup74-b74.test.js` runs the tick pass on every scene with an arrow and the `pickup` message on every scene with an item in reach; pickup order, final inventory and arrow rows match.
- Executed (same file): `taken` there is onItemPickup; scene 12 shows a partial item take (47 + 17 stone) changing the inventory without appearing in it.
- Recalled / not re-read: the sound order between the two kinds on the wire (items use `soundsOut`, arrows `fx`), unchanged.

## Verification
- `node --test src/mppickup74-b74.test.js`: 4 pass. Related mp/projectile/b62/b63 files (16 files): 124 tests, after the two test edits all pass. `node --check` on touched files. Full npm test not run (batch rule).

## Follow-ups
- A client's item pickup message still arrives separately from the tick; with no stuck arrows nothing changed. Items are only taken by the server tick pass when a stuck arrow is in reach.
- Orb versus pop sound order within one tick.
- Only a browser could show which of two drops fills the last slot.
