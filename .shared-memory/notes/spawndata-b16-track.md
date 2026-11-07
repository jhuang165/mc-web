# Batch 16: spawner data and riders (branch b16-spawndata, from 60d9af0 / 0.45.0)

## Changed
- SpawnData / SpawnPotentials `Riding` chains: `src/spawner-riding.js` (chain walker with the native null-mount NPE reported as `out.crashed`), `mob-spawner.js` runs it after each spawn, `entities.js spawnerMount` (mob mounts, spawn cap 40), `structure-simulation.js spawnerVehicle` (cart/boat mounts). `applyProperties` now keeps the rolled yaw/pitch on SpawnData spawns (previously lost). `/setblock mob_spawner {..}` creates a live spawner (`command-host.js`, `main.js` env `spawners`).
- Probe: `tools/probes/SpawnDataProbe.java` + `tools/verify-spawn-data.mjs` -> `public/research/spawn-data-reference.json` (14 scenarios, 139 ticks); replay `src/spawn-data.test.js` (18 tests, includes /setblock, JSON and Java region round trip of a Riding chain).
- Chicken jockey for pigmen: the probe's second entity on a portal pigman spawn was a baby pigman's chicken jockey. `EntityPigZombie.onSpawnWithEgg` = EntityZombie's rolls then `setVillager(false)`. `entities.js onSpawnWithEgg` now sets the child flag and runs `chickenJockeyRolls` for pigmen. `tools/probes/PigmanJockeyProbe.java` + `verify-pigman-jockey.mjs` -> `pigman-jockey-reference.json` (4 x 20000 spawns); `src/pigman-jockey.test.js`.
- Player's own boat/minecart: Java export writes it as level.dat `Player.Riding` (not a chunk entity) via `report.playerMount` in `region-export.js`; import (`level-dat.js` `riding`, `region-import.js levelRecord`) makes a `rider: true` boat or rideable cart. Test `src/player-mount.test.js`. Bytecode-read only (sa.e, sa.d, oi): no probe run for this part.
- Docs: spawner-cart.md, boats.md, minecarts.md, natural-spawning.md, remaining-gaps.md.

## Tests
`npm test` 3718 pass, 0 fail; `npm run build` ok. Probes run with `MC_RESEARCH=<repo>/tools/research`.

## Remaining
- Zombie `onSpawnWithEgg` path inside SpawnPotentials: probed only with Delay -1 (double lacks chunk, native NPE); bytecode-read.
- Pigman nearby-chicken branch is not exercised by the probe world (no chickens stand there).
- Player mount: only boats and rideable carts can seat the browser player; other cart types in `Riding` are listed as lost. No native replay of the load order, dismount position after reload is the existing browser path (not probed).
- Port `/summon` of a cart or boat does not add the native yOffset in setLocationAndAngles (not mine, noted).
