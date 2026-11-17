# Batch 79 mplanes79: server mob pickup collect, command block store, eye aux dimension, piston-moving click

## Summary
- Mob pickup S0D: `pickUpLoot` (mob-equipment-live.js) takes an `onTake` callback; `EntityWorld.lootPickupOne` calls `this.itemPickedUp?.(mob, item)`. `ServerMobs` sets it to push `{ i: item.eid, by: null, mob: <wire id>, at: {x,y,z} }` on `host.serverItems.taken`, the same list player pickups use (so the object tracker filters it with the tracked item and the tick message carries it). `main.js` flies the item to `t.at` when present. No pop sound (native plays it from EntityItem.onCollideWithPlayer only).
- Nether and End: both build their mobs through `buildNetherInside`, whose host already had `items`; the Nether/End host's `serverItems` now has its own `taken` getter (`n.taken`) so the row lands in that lane's list even outside a swap. Tests show a zombie picking up in dimension -1 and 1.
- Command blocks: new `server-command-blocks.js` (`CommandBlockTiles`: data-only tile map, `tile`, `get`, `toJSON(world)`, `fromJSON`). Lives at `tileEntities.commandBlocks` for the Overworld and each of the Nether and the End, saved and restored with `tileEntities`; `serverFallingTile` passes it, so a landed falling command block gets its TileEntityData. The server still does not run command blocks from it.
- Eye aux: `server-eyes.js use` now takes the dimension from the thrower for the sound, the aux recipients and the shatter row (was constant 0). The stronghold gate stays Overworld-only, so a Nether or End throw still does nothing.
- Piston-moving click: `pistonMovingClick` (server-use.js), called from `DedicatedSimulation.edit` on a place click: a PISTON_MOVING cell with no tile in the player's dimension's redstone engine is set to air and the click is used up; not when sneaking with an item.

## Evidence
- Bytecode-read (b78 notes, not re-read): `sw.e` pickup loop, `apr` onBlockActivated, `bje` right click flow.
- Port-read: `EntityLiving.onItemPickup` sending S0D is from the brief; the S0D collector position for a mob is its current position (approximated by the mob's x,y,z at pickup).
- Recalled only (header of server-eyes.js, NOT re-read): ChunkProviderHell and ChunkProviderEnd return null from findClosestStructure, so an eye thrown in the Nether or End finds nothing and plays no aux. I tried to re-read it and did not finish; left open.
- Not executed: no probe.

## Verification
`node --test src/mplanes79-b79.test.js`: 7 pass. 143 pass across 17 related files (loot78, falling78, fallingblock77, mpend2-b64, mpend-b63, mppickup74, mptrackers71, mppistons-b66, spswing78, eye-of-ender, mob-equipment, mob-griefing, mpdispense-b61, mpitems-b59, mpstats-b63, pistons5-b68). The eye test is a source check, since a Nether throw has no behaviour to see. No full npm test, no browser.

## Follow-ups
- The eye claim above (no stronghold in Nether and End) should be bytecode-read; if a provider does answer, the `dim === 0` gate in `ServerEyes.use` is the single line to change.
- Command block tiles are stored, not executed or sent to clients (no S35 description for them; the dirty cell is harmless).
- Mob collector position is the mob's position at pickup; the client's fly-in ends at the mob's feet, not eye height.
- Piston-moving click: the client prediction swing for a held ItemBlock is still the spswing78 approximation.
