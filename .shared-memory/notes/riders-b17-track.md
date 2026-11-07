# Batch 17 riders and interchange track (branch b17-riders)

## Summary
- Player mounted on boat/cart/pig/horse: probed natively (`PlayerRidingProbe`, `player-riding-reference.json`); export as Player.Riding, import and remount (`playerRides` flag, `restorePlayerVehicle`). Fixed an exporter bug (horse `att` returned a tag, export threw).
- Summoned carts/boats: yOffset per `Entity.setLocationAndAngles` (`SummonProbe`, `summon-reference.json`, 31 records). Boat summon was 0.3 low.
- Spawner `onSpawnWithEgg` path: four `egg-*` scenarios added to `spawn-data-reference.json`; port already matched.
- /summon hanging: any byte Direction accepted; Dir only written for 0..3; summoned knots clickable.

## Tests
`node --test src/`: 3810 pass, 0 fail. `npm run build` OK. New: src/player-riding.test.js (7), src/summon-reference.test.js (2); updated summon-coverage.test.js; spawn-data.test.js replays 4 new scenarios.

## Probed vs bytecode-read
Probed: player writeToNBT/Riding, rewrite after load, CommandSummon on all cases, onSpawnWithEgg draw counts. Bytecode-read only: ServerConfigurationManager load of Riding, native RenderItemFrame with a bad Direction (may crash the client).

## Remaining gaps
- Mount keys UUIDMost/UUIDLeast and optional mob keys differ in export.
- Summoned knots keep tile (0,0,0); multiple share a tile.
- Nested player mount chains are not linked (matches native), mount types beyond boat/cart/pig/horse are lost.

## Proposed remaining-gaps replacements
- Riders: the player's own boat, cart, pig or horse is probed (`player-riding-reference.json`), exported as `Player.Riding` and remounted on import (batch 17); open: mount UUID keys are not written, other mount types are dropped.
- Spawner minecart: implemented, see `spawner-cart.md`; summoned carts carry the native yOffset (batch 17) and the `onSpawnWithEgg` SpawnData-absent path is probe-replayed.
- /summon covers 55 of 57 EntityList registrations; hanging Directions outside 0..3 are accepted as native and summoned knots are clickable (batch 17); open: summoned knots share tile (0,0,0), native item frame rendering with a bad Direction is not probed.
