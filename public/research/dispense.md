# Dispenser and dropper (0.40.0)

Source: unchanged Minecraft Java 1.7.10 `BlockDispenser` (23), `BlockDropper` (158), `TileEntityDispenser`, `BehaviorDefaultDispenseItem` and the Bootstrap dispense registry, run over a constructor-less World double (`tools/probes/DispenseProbe.java`, `tools/verify-dispense.mjs`) into `public/research/dispense-reference.json` (513 rows: 216 dispense, 60 projectile heading, 36 dropper-into-inventory, 128 neighbour-change, 32 onBlockAdded, 30 slot-choice, 10 addItemStack, 1 tick rate). `src/dispense.test.js` replays every row against `src/dispense.js`.

Internal ids: dropper block 132, item 1132 (recipe: 7 cobblestone and redstone). The dispenser stays 115 / item 1115. Dropper screen: the dispenser container titled "Dropper". Dropper contents live in the same position-keyed `survival.dispensers` store (saved, spilled on break or explosion like a dispenser); Java export writes the tile as `Dropper`, import reads `Dropper` for block 132.

## Native-verified (replayed row by row)
- Redstone trigger: onNeighborBlockChange schedules a 4-tick update and sets bit 8 (flag 4) on the rising edge, clears it on the falling edge; power is read at the block and the cell above. onBlockAdded facing from opaque neighbours.
- Slot choice (nextInt(j++) over non-empty slots, own Random), addItemStack (first empty slot).
- Default throw: world Random draws nextDouble then three Gaussians, speed 6, spawn at centre + 0.7 facing, y - 0.3; sounds 1000/1001, smoke 2000 with data fx+1+(fz+1)*3; empty dispenser: 1001 only.
- Arrows, eggs, snowballs (velocity 1.1F, inaccuracy 6F, y component + 0.1F in float; arrow heading draws a sign boolean, throwables do not) and splash potions (x1.25 velocity, x0.5 inaccuracy; the damage bit 16384 selects it), bow aux 1002. Headings are replayed with a seeded entity Random; the per-entity Random of a live shot is unseeded in the original too.
- Minecarts (rail ahead, rail below an empty front cell, ascending offsets, fallback to default throw with both sound pairs), TNT, buckets (fill/empty, whole stack becomes one empty bucket when placing, fallback throw), flint and steel (fire, TNT ignition, durability), bone meal on wheat/carrots/potatoes, and the sticky success flags of flint and steel / bone meal (a first failure turns the click into the failed click 1001 for the rest of the session, as in the original).
- Dropper: inserts one item into the facing inventory through the shared `inventory-transfer.js` helper (chests blocked by a normal cube above, furnace sides, dispensers, hoppers), otherwise the default throw; no sound when an insert succeeds or fails.

## Approximated or absent
- Batch 69 (docs sweep): `dispense.js` emits the level events (1000 click, 1001, 1002, 2000 smoke, 2005 bone meal) through `host.aux`, and the client draws them (`onAux` in `main.js`; `mpdispense-b61.test.js`). Not re-checked: the particle sprites themselves.
- Batch 69 (docs sweep): the header of `dispense.js` lists boats, fire charges, spawn eggs, TNT, fireworks and worn armour as dispenser behaviours (host callbacks `boat`, `spawnEgg`), tested in `dispense.test.js` and `spawn-egg-rolls-b52.test.js`. Older text: boats, fire charges and spawn eggs do not exist in this build; potions that are not splash potions are thrown as items.
- Batch 69 (docs sweep): dispenser bone meal runs the IGrowable path (`bone-meal.js`, `dispense.js` batch 67 note) for every growable block.
- The per-item Random of live projectiles and the item yaw are unseeded as in the original and not compared; dispensed entities use the browser entity systems' own flight and impact code.
- One slot-choice Random stream is shared by all dispensers (the original has one per tile).
- Parity with the whole 1.7.10 dispenser registry is not claimed.
