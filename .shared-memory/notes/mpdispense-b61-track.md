# Batch 61 mpdispense: dispensers fire their 1.7.10 behaviours on the multiplayer server

## Summary
- `src/dispense.js`: new BOAT and ARMOR behaviours (BehaviorDispenseBoat, ItemArmor's dispense). BOAT only runs when the host has `boat`; ARMOR when the host has `armorType`. Hosts without them (single player armour, older tests) behave as before.
- `src/multiplayer/server-dispense.js` (new): `ServerDispense`. Builds the dispense host for the server: arrows, eggs, snowballs, splash potions, XP bottles (reusing `WitchPotions`), fire charges (the mob fireball launcher), fireworks (`FireworkRockets`), primed TNT (also redstone-powered TNT through `redstone.hooks.primeTnt`), spawn eggs (`mobs.hatch`), buckets, flint and steel, bone meal, armour onto a player in front (`p.survival.inventory.armor`), default item drop. Keeps the in-flight entities and sends them.
- `src/multiplayer/client-dispense.js` (new): `RemoteDispense`, the client copy of the in-flight rows and the one-shot effects.
- `src/multiplayer/server-container-ticks.js`: the dispenser host now spreads `sim.dispense.host(stop)`.
- `src/multiplayer/simulation.js`: builds `ServerDispense`, `mobs.mobs.ignite = fire.ignite`, `dispense.tick()` before and `dispense.flush()` after `mobs.tick()`.
- `server/server.js`: sends `player.dispOut`. `src/multiplayer/client.js`: `onDisp` option. `src/main.js`: `remoteDispense` (draws arrows and balls through `scene.setArrows` / `setProjectiles`, TNT through `tntRows()`, explosion, splash, firework, spark, sound hooks) and the single-player `boat` host hook.
- Vehicles: carts and boats go through `sim.dispense.vehicles = { dispenseBoat(x,y,z), dispenseCart(type,x,y,z,stack) }` (to be set by mpvehicles). Without it the dispense is undone and the stack is kept.
- Tests: `src/mpdispense-b61.test.js` (new, 14). `src/mpcontainers2-b60.test.js`: the dropper test now dispenses a boat into water, because an arrow now flies.

## Wire messages (new, server to client)
- `dispEnts { ents }`: every dispensed entity near the player this tick; one empty list clears. Rows: `k:'a'` arrow (`i,x,y,z,yaw,pitch,g,s,c`), `k:'b'` ball (`i,kind,x,y,z`, plus `damage` for potions or `scale` for fire charges), `k:'t'` TNT (`i,x,y,z,fuse`), `k:'r'` rocket (`i,x,y,z`). Range 64 blocks, 160 for TNT.
- `dispFx { events }`: `explode`, `splash`, `firework`, `spark`, `sound` (name checked against a whitelist on the client).
- The armour change reaches the client through the existing `invSet` diff (needs the inventory window state, which a client has).

## Evidence
- Executed: the 14 new tests run a real `Simulation` and tick the dispensers (arrow, egg, snowball, potion hurting a player, XP bottle, fire charge, firework, TNT, flint and steel, bucket, bone meal, spawn egg, armour, far player gets nothing, client routing).
- Bytecode-read (earlier, javap): boat dispense (`la`), armour dispense (`abc`/`abb`), behaviour selector, flint and steel damages the item only in the air branch.
- Recalled: the other behaviours follow `dispense.js`, which has its own native evidence from earlier batches. No new Java probe was written for this track.

## Gaps
- Closed: server dispensers did nothing visible for these items before. Now they fire and clients see them.
- Not closed: arrows and thrown balls hit mobs, not players. Dispenser arrow pickup is not implemented. TNT primed by a chain explosion is not primed. Nothing in flight is saved. Snowball knockback is approximate. Spawn eggs for mob types outside `SUPPORTED`, or in a full world, keep the egg. Single-player armour equip is not added. Hopper minecarts not done.

## Verification
- `node --test src/mpdispense-b61.test.js` -> 14 pass.
- `node --test src/dispense.test.js src/mpcontainers2-b60.test.js src/mpcontainers-b59.test.js src/away-dispense-b51.test.js src/multiplayer.test.js src/mpmobs-b59.test.js src/mpmobs2-b60.test.js src/mpitems-b59.test.js src/mpinventory-b60.test.js` -> 70 pass.
- `node --test src/dispenser-container.test.js src/dispenser-piston.test.js src/dispenser-piston-world.test.js src/multiplayer-refusal.test.js` -> 18 pass.
- `node --check` on every touched source file: ok. Every new `main.js` identifier is declared or imported in scope.
- `npm run build` ok (only the usual chunk size warning). Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Only a browser can show: arrow, ball, TNT and rocket drawing, explosion bursts, splash particles and the sounds on the client.
- mpvehicles should set `sim.dispense.vehicles`.
- Hit players with dispensed arrows and balls; pick arrows up from the ground; prime TNT in chain explosions; save in-flight entities.
