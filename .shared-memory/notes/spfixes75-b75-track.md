# Batch 75 spfixes75: bonus torch drops, per-hit death throw angle, table name lifetime

## Summary
- Bonus chest torch (closed): `src/bonus-world.js` no longer just skips a torch that cannot stay. It records `{x, y, z, id: TORCH}` in a new `drops` list of the result; `src/main.js` (`pendingBonusDrops`) spawns each through `items.dropBlock` in `launch`, after `items.load` (which replaces the item list).
- Death throw angle (closed, single player): `src/death-throw.js` `attackedAtOf(fresh, from, random, pose)` now takes the player's pose at the hit and stores the relative angle `{ rel }` (float atan2 degrees minus the yaw at the hit). `deathThrow` adds the yaw at death, as `onDeath` does. `hitPoseSource.get` (set once in `main.js` before `die()`, null in multiplayer) feeds `Survival.damage`. With no pose the b74 behaviour (angle at death) stays, so older callers and tests are unchanged.
- Enchanting table names: `forgetTableName` / `pruneTableNames` in `src/tile-names.js`. Hooks: `world.onChange` in `main.js` (any set that removes a table), a sweep in `tickChests` (loaded cells only, catches anything that bypassed onChange), `explosion-simulation.js`, `multiplayer/server-containers.js` `reap` (runs for every server block change), and `command-host.js` `/setblock` (also clears `tableNames`, and a table with a `CustomName` tag now takes the name).
- Chunk-resident saves: `src/chunk-runtime.js` has a `STORES` list that now includes `tableNames`. Names are split per column with the chunk, stored in the containers store, joined back, and validated (string value, key inside its column). Old saves hold `player.tableNames` in metadata; `splitRuntime` moves them into columns on the next save, so they migrate without a version bump.
- Tests: `src/spfixes75-b75.test.js` (6).

## Evidence
- Bytecode-read (b74, re-used): `BlockTorch.onBlockAdded` runs for `setBlock(torch, 0, 2)`, then `func_150109_e` (dropTorchIfCantStay) calls `dropBlockAsItem` and `setBlockToAir`; `Block.dropBlockAsItem` spawns an EntityItem with the 0.7 spread (`ItemEntities.dropBlock`, already ported). The port's rule for when it cannot stay is `torchCanPlace` (unchanged).
- Bytecode-read (b74, re-used): `EntityLivingBase.attackEntityFrom` sets attackedAtYaw at each hit; `EntityPlayer.onDeath` reads the stored value plus the current rotationYaw.
- Executed (port data from the probe-derived tables): `redstone.js` piston table row `116.0.0.1.0` (table: hardness ok, mobility 0, tile provider 1) means a piston cannot push a table; `enderman.test.js` checks `CARRIABLE` against the probe (no table). So pistons and Endermen never move or carry a table; nothing to remove there.
- Port rule (probe-derived, `enchanting-table-reference.json`): the table's blast resistance is 2000, so no blast the game produces breaks it. The listed "exploded tables keep their name" gap is therefore not reachable in practice; the explosion hook is kept for safety only. Test 4 shows a size-8 blast leaves the table and its name.
- Port-read audit of other per-position records (read, not executed): signs, skulls, beacons and the enchanting book are removed in `world.onChange` (`main.js`) and in `simulation.js` `reap` on the server; flower pots in `World.set` (`world.js`); command blocks, note blocks, jukeboxes in their `breakBlock` behaviours (run by the live-redstone `world.set` funnel and `external` for fluid writes); mob spawners by `watchSpawnerBlocks` (`spawner-block.js`) and the load-time prune; comparator signals live on the redstone `tiles` map, deleted with container ids (`redstone-live.js`). Chests, furnaces, dispensers, hoppers and brewing stands are dropped by break, explosion, `/setblock` and the tick sweeps. No further leak was found; the only leak was the table name.
- Recalled: native `/fill` and `/clone` do not exist in 1.7.10, so `/setblock` is the only command that replaces blocks.

## Verification
- `node --test src/spfixes75-b75.test.js`: 6 pass.
- 139 related tests (chunk-runtime, world-storage, tilenames, spfixes70/74/75, bonus, command-block, explosion-simulation, death*, survival, enchanting*, player-throw-replay, living-simulation-replay): pass. 135 more (command*, region import/export, nbtexport, mpbooks, mpcontainers, mpnether-b61): pass.
- `node --check` on every touched file; `npm run build` ok. Full npm test not run (batch rule). No browser check.

## Follow-ups
- Only a browser shows the dropped bonus torch landing next to the chest at world creation, and the thrown body after a turn between hit and death.
- Multiplayer still does not send the server's death motion to the client (unchanged).
- A server `/setblock` with a `CustomName` tag for a table is not wired (server world commands do not read tile tags for tables).
- The tickChests sweep and onChange hook both run on the single-player side only; away runs never edit tables.
