# mpplace84 (batch 84) track

Branch `batch84-mpplace84`, cut from release 0.112.0 (5cb5c6458).

## Summary

1. **Every ItemBlock canPlace refusal is withheld from the block C08.**
   - `right-click-swing.js` `withheldReason`: `entity-collision`, `player-collision`, `occupied` and every `*-support` reason, except `door-side` / `door-support` (ItemDoor is no ItemBlock) and `cocoa-support` (ItemDye). `clientWithholdsPlace` uses it; ItemReed placers, slab merges, beds and signs still answer through `clientUseResult` first.
   - The client then sends the `air` edit (C08 255) as before.
   - **Server S23 resend: nothing to remove.** `nh.a(jo)` sets its `flag` (offset 233) after every non-255 placement packet whose reach, height and `canMineBlock` tests passed or failed alike, and sends S23 for the clicked cell and the cell on the clicked face. The extra resend the batch 83 note worried about only existed because the client sent the block C08; with the C08 withheld there is no resend, and the server's own refusal of a block C08 keeps sending it as native does. The 255 path already resends nothing.
2. **Lily pads.**
   - New `lily-use.js`: `useLilyPad` (ItemLilyPad.onItemRightClick, `aej.a(add, ahb, yz)`) and `lilyCanStay` (BlockLilyPad.canPlaceBlockAt). Found gap: the port placed a pad into the water cell itself (placeHeldBlock had no support rule) and had no ray-trace use at all.
   - `placeHeldBlock` now refuses with `lily-support` unless the cell below is source water. A lake-bed click is thus withheld (C08 255).
   - Server: `server-air.js` `airUse` runs the trace for the 255 / no-target case (spawn protection via `blockProtected`). Single player: `player-edit-simulation.js` runs it after the dry placement refuses; `captureBucketTarget` captures the ray for item 59.
3. **Dimension filter.** `multiplayer/simulation.js` placement `collides` and the sleeper box skip players in another dimension.

## Evidence

- Bytecode-read (`javap -c -p`, 1.7.10 jar): `bje.a(yz, ahb, add, IIII, azw)` (abh instance, `abh.a(ahb, IIIIyz, add)`, `ireturn` before the `jo` C08); `abh.a` -> `ahb.a(aji, IIIZ, I, sa, add)` (entity box, then `Material.isReplaceable`, then `aji.a(ahb, IIII, add)`); `nh.a(jo)` (255 branch 60-92 returns before any S23; flag at 233 / 298; S23 pair 301-404); `aej` (ItemLilyPad: trace flag true, `ahb.a(yz, III)`, `yz.a(IIIILadd)`, material water, metadata 0, air above, `setBlock`, decrement unless `yw.d`).
- Executed: none. Port-read: the dimension rule (`World.checkNoEntityCollision` sees only the world's entities).

## Verification

- `node --test src/mpplace84-b84.test.js`: 5/5 pass.
- Neighbours (concurrency 1): 188/188 pass (attack83, block-placement-replace / -simulation, buckets / buckets-simulation, client-predict-b56/b57, clientfire-b58, collide81, lily-pad, mpblocks73, mpplace82, multiplayer-refusal, multiplayer, player-edit-simulation, potion-use, prediction4/5, spswing78/79/80, mpplace84).
- `npm run build`: OK. No full `npm test`, no browser checks.

## Follow-ups

- Not done (item 4): the single-player copy still moves from the new packet position (beginTick order).
- The multiplayer client does not predict the lily pad placed by the 255 use (the pad appears with the server's block update).
- Browser-only: the swing and ghost block when placing on a lake bed or into an occupied cell in multiplayer; lily pad feel.
