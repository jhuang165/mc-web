# Batch 17 track: temples round 2 (branch b17-temples2)

## Changed
- Tripwire probe (`tools/probes/RedstoneProbe.java`, new `TripwireHolder.java`, `tools/verify-tripwire.mjs`): 17 new native scenarios (33 total, 1330 ticks): shears/stick/empty-hand `onBlockHarvested`, random ticks of strings and hooks, entity classes (arrow, snowball, egg, ender pearl, thrown potion, bat), projectiles keeping a powered line active. Reference also records `tripwireEntities` (`getTickRandomly`, `doesEntityNotTriggerPressurePlate` per class) and a javap `collisionCallers` check of who reaches `Entity.func_145775_I`. verify-tripwire now needs the authlib jar (TripwireHolder's super constructor type); RedstoneProbe itself does not, so other verifiers are unaffected.
- `src/redstone.js`: `tripwire.onBlockHarvested`, `RedstoneWorld.randomTick`, sensing mode `tripwire` (bats ignored), replay ops entity2/unentity2/harvest/randomtick.
- Live: `redstone-runtime.js` entity modes `tripwire`/`collider` and `randomTick`; `redstone-live.js` idle scan uses `collider` (no stuck arrows, no thrown balls); `world.js` `ticksRandomly` +113/114; `main.js` two one-line hooks (`weather.blockTick` chain, `thrown: () => projectiles.balls`).
- Jungle temple populate: new `src/structure-redstone.js` (RedstoneWorld over the area store); `structure-population-area.js` routes redstone puzzle blocks (29, 55, 69, 93, 131, 132) to it unless `relaxRedstone`. New `src/temple-jungle-nbt.test.js` replays both native jungle populated Temple.dat states (byte-equal).

## Tests
`npm test` and `npm run build` pass (3821 tests, 0 fail). `node tools/verify-tripwire.mjs` PASS 33 scenarios against the native jar.

## Remaining gaps
- Boats and falling blocks should trip strings (native `moveEntity`), not in live `entitiesIn`; thrown potions/bottles are not in the live sense list.
- Setting bounds quirk of the shared BlockTripWire (client selection) and running arrow/throwable `onUpdate` themselves remain bytecode-read.
- Jungle populate replay covers unpowered generation only (powered providers still throw); the write/call streams of the jungle area are not claimed.

## Proposed remaining-gaps temples line
- Desert/jungle temples and witch huts: tripwire traps, lever puzzle and plate-and-TNT trap run live; tripwire hook/string probe-replayed (33 native scenarios incl. shears disarm, random ticks, entity classes and `func_145775_I` callers via javap); witch hut and jungle pyramid created/populated `Temple.dat` replayed (`temple-nbt`, `temple-jungle-nbt`). Open: boats/falling blocks do not trip strings live, thrown potions are not in the string sense list, jungle populate replays unpowered generation only.
