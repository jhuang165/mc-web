# Batch 62 mpnether2: a living dedicated-server Nether

## Summary
- `src/multiplayer/server-nether.js` (new): builds the Nether's own copy of the systems the Overworld runs: `Fluids` (`nether: true, skyless: true`), `Fire`, `FallingBlocks`, `Farming`, `Trees`, `Plants`, `LiveRedstone` (no sky), `LightVolume`, a `Weather` for random ticks (`tickDimension`), `Survival` tile stores (chests, furnaces, dispensers, brewing, hoppers), beacons, spawners, `ServerContainers` and `ContainerTicks`, `ServerDispense`, and a second `ServerMobs` (a facade host over `sim` with the Nether's world, light, items, weather). `tickNether` runs one tick in the Overworld's order. `saveNether` and the restore keep tiles, items, beacons, spawners, scheduled fluid/fire/falling ticks, crops, redstone and mobs. Fortress chest loot and blaze spawners come from `DimensionWorld.population.records` on a Nether with no saved tiles. The Nether world gets its own `fortressSpawns` reading its own blocks.
- `server-dimensions.js`: `context()` now also swaps `tiles, fluids, fire, falling, light, dispense, mobs`; `ensureNether` builds the systems (inside a swap for those that register on `sim.*`); `netherMessage` runs `tickNether` only when a Nether player exists and adds `redstone.lit` and the container actions; the join snapshot carries lit redstone and chest descriptions; `adopt`/`arrive` move the player's mob view between the two `ServerMobs`; new `removePlayer`; `saveField` saves the new state.
- `server-mobs.js`: `SUPPORTED` gains pigman, ghast, magma_cube, blaze, wither_skeleton; `fireballWatch` (a ball sweeps the nearest player; a punched ball credits its puncher); `punchBall(p)`.
- `server-containers.js`, `server-container-ticks.js`, `server-dispense.js`: a `dim` field (0 or -1) and per-player dimension filters (minimal edits for the dispense merge).
- `simulation.js` hooks: `dimensions.removePlayer`, delayed dig break inside `within`, `vehicles.useHeld` guarded for Nether players (two places), `punchBall` before attack/dig for Nether players.
- Tests: `src/mpnether2-b62.test.js` (7); `src/mpmobtypes-b61.test.js` now uses silverfish as its unsupported kind.
- No new wire messages. Fireball rows reach clients through the existing `dispEnts`.

## Evidence
- Executed in node tests: lava reaches 7 cells from a source in the Nether (Overworld 3), netherrack fire persists, gravel falls, Nether chest tile separate from the Overworld store and saved/restored, items and spawners saved, Nether mobs spawn and packets go only to Nether players, a punched ball kills a ghast and `award ghast` goes to the puncher.
- Bytecode-read/recalled (earlier tracks): Nether lava rules, tick rate 10, spawn lists, fortress list.
- Name check: the engine's mob type is `pigman`, not `pig_zombie`.

## Verification
- `node --test src/mpnether2-b62.test.js`: 7 pass.
- Targeted multiplayer suite (29 files, 295 tests): 294 pass, then the 1 failure (mpmobtypes ghast refusal) fixed; rerun of that file 10 pass.
- `node --check` on every `src/multiplayer/*.js`; `npm run build` ok. Full npm test not run (batch rule).

## Follow-ups
- Experience orbs in the Nether are inert (no orbs from kills or smelting there).
- No spawner ticking (also missing in the Overworld server), no vehicles or `animUse` in the Nether, the End is not connected.
- Mob difficulty is the Overworld's (`ServerMobs` ignores `sim.difficulty`).
- Only a browser would show client rendering of Nether mobs and fireballs, and lava/fire visuals.
- Merge risk: `server-dispense.js` (mpprojectiles rewrote it): re-apply the `dim` field and the player filters in equip/splash/flush.
