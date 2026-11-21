# tiles90 (batch 90): furnace/dispenser/dropper facing, lit_furnace, spawner darkness order

Branch `batch90-tiles90`, worktree `wt90-tiles`. Target is 1.7.10. This does not claim full parity.

## Summary

- **Furnace facing is cell metadata in both directions** (`block-registry.js`). `toOriginal` uses the cell meta when it is 2-5 (then `state.facing`, then 3). `fromOriginal(61|62, meta)` now returns that meta as the cell meta, as well as the `state.facing`. Effect: the region export writes the furnace's real facing (it wrote 3 whenever the chest store had no record), `blockAt` and hopper-replay agree, and an imported furnace keeps its facing in the world (the import dropped it into `state`, which nobody applied).
- **Dispenser and dropper on `/setblock`** (`command-host.js`). Natively the command's metadata is not kept: `BlockDispenser.onBlockAdded` (`akm.b` -> private `akm.m`) rewrites the metadata from the opaque neighbours (n&&!s 3, s&&!n 2, w&&!e 5, e&&!w 4, default 3, flags 2, server only). That drops the trigger bit and up/down too. The port used the command's meta as given. Both blocks now go through `furnaceAddedFacing` (the same rule; `placedFacing` in dispense.js is the same table). The dropper inherits it (`akq extends akm`).
- **`/setblock lit_furnace`** stays lit. The record gets `lit: true` (the flag imported furnaces already use). `survival.tickFurnaces` drops the flag only when `burn > 0` flips, which is native: `TileEntityFurnace.updateEntity` flips the block only when `burnTime > 0` changes. So the b89 follow-up ("the port cannot represent a lit furnace with burn 0") was wrong; the flag existed. `blockAt` now reads `lit ?? burn > 0`, so `/setblock lit_furnace` twice is "no change" and export agrees (region-export already read `lit ??`).
- **SpawnerAnimals reads the previous tick's skylightSubtracted.** New EntityWorld hooks `spawnLightAt` and `spawnSubtracted` (`entities.js` spawnerState: the spawner's light and the ring wrap use them first).
  - Server: `simulation.js` stores `spawnDarkness = darkness` at the end of each tick (after the weather update); `server-mobs.js` wires the hooks to it. The other readers (entities, farming, sleep) keep the live value.
  - Single player: `main.js` captures `spawnSubtracted = sensorSky(survival.time, cycling, rain, thunder).subtracted` just before `tickSurvival` (the pre-step value of the previous tick, with the weather as the previous tick left it). Before, the spawner read `scene.subtracted`, which `tickSurvival` had set from the post-step clock of the same tick: two ticks ahead of native in the sampled convention, one tick ahead of the server's b89 value.
- **Chest facing in block metadata: not done** (see Follow-ups for the plan).

## Evidence

- **Bytecode-read** (`javap -c -p`, `minecraft-1.7.10.jar`): `akm` (BlockDispenser) `b(ahb,III)V` calls `ajc.b` then `m`; `m` returns on `ahb.E` (isRemote), reads z-1, z+1, x-1, x+1 with `aji.j()` and writes `ahb.a(IIIII)` with flags 2. TileEntity registry `aor`: `apb` Trap, `apc` Dropper. WorldServer.tick order and BlockFurnace as in tiles89.
- **Executed:** none new (no probe needed; the rules are bytecode).
- **Port-read:** the SP tick order: `tickSurvival` (clock step, weather tick, `scene.setTime`) runs before `tickLivingSimulation`, which contains the spawner; the server's `mobs.tick()` runs before `weather.tick`.

## Verification

- `node --test --test-concurrency=2 src/tiles90-b90.test.js`: 4/4 pass. With the old `block-registry.js` and `command-host.js` stashed, the two tile tests fail (2/2). The spawner tests were written against the new code only; the server one checks the live value against the hook across an executed-formula edge tick; the single-player one is a source check.
- One targeted run over 34 files: 307/309, then the 2 failures fixed (below) and re-run: block-registry, region-import, tiles90 17/17.
- Old tests updated because they encoded the old representation: `block-registry.test.js` `fromOriginal(62, 2)` now has meta 2 (it was 0, which lost an imported furnace's facing) and the round-trip test allows a furnace's stray cell meta to come back as the exported facing; `region-import.test.js` approximations row for the furnace `to: [14, 2]`.
- `node --check src/main.js` ok. `npm run build` not run (no import changes); no browser checks, by the track rules.

## Found wrong in the batch 89 list

- "`/setblock lit_furnace` shows unlit... the port cannot represent a lit furnace with burn 0": it can (`record.lit`, as imports).
- "dispenser facing on `/setblock`": natively the command's metadata is not used at all (onBlockAdded rewrites it); the gap was keeping it.

## Follow-ups

- **Chest facing in block metadata** (not done; too many hosts for one safe track). Plan: (1) read path first: `chestFacing(world, stores, x, y, z)` = cell meta when 2-5 else the record's `facing` else 3, used by `chest.js`, `chest-renderer.js`, tile-sync `contChest`, `hopper-replay.js`, `server-containers.js`, `away-world.js`; (2) writes: `settleFacing` / `placeChest` write the cell meta (flags 2) and keep the record `facing` only as a save fallback; (3) save migration: on load, a chest cell with meta not in 2-5 takes the record's facing into the cell, and `serialize` keeps writing `facing` for one release; (4) block-registry `chest()` `to`/`from` use the meta like the furnace now; region-import's `facings` map and `isChestBlock` carry-through then go; (5) retarget tests that build records with `facing`.
- Mob entity updates in single player still read `scene.subtracted` (computed from the post-step clock at the end of `tickSurvival`), so they are one tick ahead of native `j` at step ticks; same for `mobs.isDaytime`. Not checked or changed here.
- Weather order, sleep skip order, other dimensions' swaps: as in b89.
- Browser-only: furnace face and lit texture after `/setblock lit_furnace`; dispenser/dropper facing after `/setblock`; spawn timing at dusk and dawn.
