# Batch 76 mpcauldron76: the server cauldron, and a sweep of server paintings, frames and knots

## Summary
- `src/multiplayer/server-cauldron.js` (new): `cauldronActivate` runs BlockCauldron.onBlockActivated on the server. Empty hand consumes the click. A water bucket below level 3 replaces the held stack with an empty bucket (Survival) and sets level 3; at level 3 it only consumes the click. A glass bottle at level > 0 gives a water bottle (inventory add first, else an item at x+0.5, y+1.5, z+0.5 with no pickup delay, else nothing in Creative), shrinks the bottle stack, and lowers the level (Creative too). Leather armour at level > 0 loses its colour and lowers the level (Creative too). Every other item falls through. `clientSwallows`: a cauldron click (not sneak with an item) sends no item-use packet from the client, so the item's own right-click (lava bucket, snowball, rod, map, armour, bottle fill) does not run on the server; block placing still does.
- `simulation.js` (minimal): import, one `cauldronActivate` line before the container dispatch, and `!noRightClick` on bucket, air use, rod, throw and map use.
- Rain: the server already ran `Weather` (same code as single player: 1 in 16 column pick, `nextInt(20) == 1`, level < 3, draws only when a cauldron is there). Checked against bytecode; no change.
- `server-hanging.js`: reach is now `useEntityInReach` from the entity's posY (native distance < 36, < 9 without line of sight), not the nearest box point from the eye (it accepted clicks about 2 blocks too far below). A hit no longer costs 0.3 exhaustion: EntityHanging.hitByEntity ends attackTargetEntityWithCurrentItem. Frame, painting and knot.
- `potion-use.js`: single player `bottleFromCauldron` was wrong in Creative (gave a bottle and used one up) and in a full inventory (threw it from the player); fixed, `player-edit-simulation.js` passes the cell.
- `src/mpcauldron76-b76.test.js` (13 tests).

## Evidence
- Bytecode-read (`ajw`): onBlockActivated order (isRemote true, empty hand true, bucket, bottle, cloth armour, else false), the bottle branch falls out to `return false`, `a(level)` clamps 0..3 with flag 2 then comparator update, fillWithRain, onEntityCollidedWithBlock (level > 0, minY <= y + (6 + 3 level) / 16, not remote), comparator = raw level. `mt` (WorldServer) calls fillWithRain on the block under the precipitation height when raining and `ahu.e` (biome can rain).
- Bytecode-read (`bje`, PlayerControllerMP.onPlayerRightClick): the client runs block.onBlockActivated, always sends the C08 packet, returns true when the block returned true. Recalled (not re-read): Minecraft.func_147121_ag skips sendUseItem when that returned true.
- Bytecode-read: `acz.a` (ItemHangingEntity.onItemUse: sides 0 and 1 false; entity built before canPlayerEdit; returns true when the surface is blocked, no stack use); `yz.a(IIIIadd)` canPlayerEdit = allowEdit || `add.z()` = `adb.v()` which is true, so an item in hand passes in Adventure too; `ss.j` hitByEntity and `yz.r` (attackTargetEntityWithCurrentItem returns right after it). EntityLeashKnot is `su extends ss` and does not override it.
- Executed (existing probes, replayed on the server glue): `cauldron-wash-reference.json` (136 rows) through a real server click; `hanging-reference.json` `place` (30 records, through the server's own ray) and `frame` (10 scenarios, insert/rotate/hit/force/move, drops) through `ServerHanging.act`. No new Java probe: the classes were already executed; the differences found are in the glue.
- Port-read: the water bucket, bottle and rain rules had no executed record of their own (only the wash did); they follow the bytecode above.

## Verification
- `node --test src/mpcauldron76-b76.test.js`: 13 pass; against the unpatched glue 8 of the first 12 fail.
- Targeted: mpbuckets-b75, mppaintings-b68, hanging, mpusesweep-b75, mpclicks-b70, mpriding2-b62, mpdispense-b61, weather, weather-simulation, redstone-live, potion-use, stone-utility, player-edit-simulation all pass. Full npm test not run (batch rule). No browser check.

## Follow-ups
- A real ray cannot hit the north face of a block whose north cell is solid, so the "blocked, side 2" place record is replayed by calling `useHeld` with the synthetic target.
- Single player still lets a lava bucket, food or a rod act through a cauldron click (native: the client swallows it). Drinking and eating on the server (not through `edit`) were not checked for the same swallow.
- Server level changes go through `world.set` (flag 1 neighbour notify); native uses flag 2 plus a comparator update. Comparator update is the same; extra neighbour wakeups are harmless.
- Leash knot placement and mob tie/untie were not re-swept (leash-reference.json already executed them); only knot reach and attack exhaustion changed. The `bucketUse` Adventure refusal in server-bucket.js looks wrong for the same canPlayerEdit reason (an item in hand passes); not changed here.
- Entity reach for other targets (carts, mobs) already used `useEntityInReach`.
