# Batch 63 mpnether3: the dedicated Nether gets orbs, spawners, vehicles, animal clicks and the server difficulty

## Summary
- `src/multiplayer/server-nether-vehicles.js` (new): the Nether's own `ServerVehicles` (carts, boats, pig seat, rail redstone) and `ServerLeads` (a `NetherLeads` subclass that accepts Nether holders), built over a view of `sim` with the Nether's world, items, mobs, containers, redstone and players. `pinOverworldVehicles` gives the Overworld instance a host whose `players` are Overworld players only, and routes `dismount` of a Nether rider to the Nether instance. `dimensionPlayers` is the Map-like per-dimension player view.
- `server-spawners.js` (new): `tickSpawners` runs `MobSpawners.tick` with `EntityWorld.spawnerHooks` and the feet of the living players of that dimension; kinds outside `SUPPORTED` are refused. Run for the Nether (in `tickNether`, after the mobs and vehicles) and for the Overworld (one line in `simulation.js` tick; the Overworld server had no spawner ticking either).
- `server-nether.js`: `NETHER_CONTEXT` gains `vehicles`, `leads`; `buildNetherInside` builds the vehicles; redstone `entitiesIn` answers the `minecart` / `inventory` modes from the Nether's carts; `tickNether` ticks the orbs (`tickOrbs(-1)`), rider input, vehicles and spawners; `saveNether` saves `xpOrbs` and `vehicles`. The copy of the Overworld mob difficulty is gone.
- `server-dimensions.js`: `n.xp` is a real `ExperienceOrbs` (restored from `xpOrbs`) with its own `n.taken`; `swap` swaps `serverItems.xp` and `serverItems.taken`; the Nether tick message carries `xp` and `taken`; `queueVehicle` is an entry point (runs in the player's dimension); `removePlayer` drops the Nether vehicle view.
- `server-items.js`: `tickOrbs(dim)` only targets and collects for that dimension's players and tags the orb sound with `dim`; `xpField()` keeps the "last sent" count on each orb set.
- `server-mobs.js`: `tick` reads `host.difficulty` (the server setting). This also fixes the Overworld mobs, which ignored `/difficulty` before.
- `server-vehicles.js`: one line in `track()`: a player the host does not own forgets what it saw.
- `simulation.js`: removed the Overworld-only guards for vehicles, fence knots and `animUse`; vehicle and animal actions run inside `dimensions.within(p, ...)`; spawner tick line.
- No new wire messages. Nether orbs ride the Nether `tick` message (`xp`, as in the Overworld) and carts the existing `vehicles` message.

## Evidence
- Bytecode-read (`javap -c -p` on `net.minecraft.server.MinecraftServer`, `loadAllWorlds` ends with `setDifficultyForAllWorlds(getDifficulty())` and the per-tick method `g()` writes the same value into every `WorldServer.difficultySetting`, hardcore forces Hard): the Nether follows the server setting, no per-dimension difficulty.
- Reused executed rules (earlier tracks): `updateSpawner` (mob-spawner.js, spawn-data replay), orbs (experience.js), carts and boats (their own probe tests).
- Recalled: spawner activation uses the closest player of the spawner's own world.
- Executed in node tests (`src/mpnether3-b63.test.js`): see Verification.

## Verification
- `node --test src/mpnether3-b63.test.js` (9 new tests) plus b62-lead, mpnether2-b62, mpnether-b61, b61-lead, mpdispense-b61, mpcontainers2-b60, mpriding2-b62, mpvehicles-b61 in one run: 75 pass, 0 fail.
- Earlier group run (mpitems-b59, mphealth-b60, mpmobs-b59, mpmobs2-b60, mpmobtypes-b61, mpsmall2-b62 and the ones above): 116 pass, 0 fail.
- `node --check` on every `src/multiplayer/*.js` and the new test: clean.
- `npm run build`: ok (built in 6.27s).
- Fixed on the way: a context filter left `sim.dispense` and `sim.mobs` pointing at the Nether after the build (b62-lead and mpnether2 failed); reverted.
- Full npm test not run (batch rule).

## Follow-ups
- The spawn smoke and flame (aux effect 2004) and the spawner's cage display are client-only and not sent from the server.
- A SpawnData Riding mount of a spawner is not checked against `SUPPORTED`.
- Only a browser would show Nether carts, orbs and spawned blazes rendering.
- The End is not connected (mpend).
