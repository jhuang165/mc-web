# tiles89 (batch 89): tile entities after tiles88

Branch `batch89-tiles89`, worktree `wt89-tiles`. Target is 1.7.10. This does not claim full parity.

## Summary

- **One tile-swap rule for every host.**
  - `swapTiles` moved from `multiplayer/server-tile-swaps.js` into `container-tiles.js`. The server module now re-exports it, so the server's put wrappers in simulation.js, server-dimensions.js and server-end.js are unchanged.
  - New `installTileSwaps(world, ctx)` wraps `world.put`, the layer below every `world.set`, LiveRedstone's funnel included. It reads the old cell only when a sign or chest is being written.
  - Single player: `main.js` `watchFlowers` installs it. It is guarded by `own: () => !active?.remote`, so a multiplayer replica keeps taking the server's tiles.
  - The away run: `away-world.js` installs it.
  - Effect: in single player and the away run, any world edit (not only `/setblock`) does the following.
    - A chest swapped for a trapped chest, or back, spills its slots. The new block gets a fresh, empty record whose facing is settled by `BlockChest.onBlockAdded`.
    - An open screen closes, through the b88 `tilesReplaced` identity test.
    - A sign rewritten with only another metadata starts a fresh, empty tile.
  - `swapChestRecord` is the record side for hosts that keep their chests in one plain store.
- **`/setblock` compares facing and lit state** (`command-host.js`).
  - For original ids 54, 146, 61 and 62, the "no change" test now compares the id and meta that `blockAt` reports.
  - Results:
    - `/setblock chest` over a chest with record facing 2 spills; it used to report no change.
    - `/setblock chest 2` over the same chest is no change.
    - `lit_furnace` over an unlit furnace spills.
    - `lit_furnace` over a burning furnace with the same facing is no change.
  - The furnace written by `/setblock` gets its facing from `furnaceAddedFacing`, which is `BlockFurnace.onBlockAdded` / func_149930_e. It faces away from an opaque side, with 3 as the default, whatever meta the command gave.
  - `blockAt` now reports a furnace's facing from its cell meta. Before, it used the chest store, so it always reported 3.
- **Server darkness order** (`multiplayer/simulation.js`).
  - The `darkness` getter now uses the world time before this tick's clock step. `tick()` records `clockStep`, which is 0 when doDaylightCycle is false and before the first tick.
  - This matches WorldServer.tick, which calls calculateSkylightSubtracted before `ays.b` / `ays.c`.
  - Farming light, plants, mobs, spawners, sleep and `tickWorldSystems` all read it.
- **Furnace lit/unlit flip** (task 4, tests only). The port never changes the block id when a furnace lights or goes out. Single player, the away run and the server's tick all keep the same record object, so the tile and an open screen survive. This matches native keepInventory plus `setTileEntity` of the old tile. No code change was needed.
- **Moving chest and furnace facing into block metadata: too big for one track. Not done.**
  - The furnace already keeps its facing in the cell meta. Only its lit state is outside, as `burn > 0`.
  - Moving the chest facing would touch:
    - `chest.js` (settleFacing, placeChest, placementFacing);
    - the chest renderer, which reads the record facing;
    - tile-sync `contChest` facing;
    - the saves: the record-facing format, with a migration of old worlds;
    - region import/export (the `block-registry.js` `facing(state)` mappings);
    - hopper-replay, `server-containers.js`, the away world, bonus chests and falling tiles;
    - every test that builds chest records with `facing`.
  - Instead, `/setblock` compares the facing, as described above.
  - Ordinary world edits do not compare it. The port's facing writes correspond to setBlockMetadataWithNotify (Chunk.setBlockMetadata), which natively runs no breakBlock.

## Evidence

- **Bytecode-read** (`javap -c -p` on `tools/research/minecraft-1.7.10.jar`):
  - Chunk.func_150807_a `apx.a(IIILaji;I)Z`:
    - It returns early only when both the block and the meta are unchanged.
    - On the server it calls the old block's breakBlock `aji.a(Lahb;IIILaji;I)V` with no id test, and the new block's onBlockAdded `aji.b(Lahb;III)V`, also with no id test.
    - It then calls `akw.a` to make a fresh tile.
    - The client branch removes the tile only on an id change.
  - BlockChest.onBlockAdded `ajx.b`: calls super, then `e` (func_149954_e) on the cell and on each side neighbour that is the same block.
  - BlockFurnace `ale`:
    - `b` (onBlockAdded) calls private `e`. It reads z-1, z+1, x-1, x+1 with `aji.j()` and defaults to 3. The rules are n&&!s→3, s&&!n→2, w&&!e→5, e&&!w→4. It writes setBlockMetadataWithNotify(meta, 2), server side only.
    - Static `a(ZLahb;III)V` (updateFurnaceBlockState) reads the meta and the tile, sets `M = true`, calls setBlock with `am`/`al`, sets `M = false`, restores the meta with flags 2, then calls `aor.t` (validate) and setTileEntity with the old tile.
    - `a(Lahb;IIILaji;I)V` (breakBlock) skips the spill while `M` is set.
  - WorldServer.tick `mt.b`, in this order:
    - super.tick (weather);
    - the sleep skip;
    - the mob spawner (`aho.a`);
    - the chunk source;
    - `a(F)`, stored to `j` (skylightSubtracted);
    - `ays.b` (total time +1);
    - `ays.c` (world time +1 when doDaylightCycle is on);
    - tickPending, tickBlocks and the rest.
- **Executed:** Tiles88Probe, from `public/research/tiles88-reference.json`.
  - The test checks the server's `darkness` after a tick from t against the probe's calculateSkylightSubtracted at t, for every clear-weather record below world time 100000 (181 records).
  - Those records are 250 ticks apart, where t and t+1 agree. So the ticks where the value steps use the port formula, which matches every probe record (tiles88-b88.test.js).
- **Port-read:**
  - The facing representation: the chest facing is in the record with the cell meta at 0; the furnace facing is in the cell meta, and lit means `burn > 0`.
  - `survival.tickFurnaces` keeps records in place.
  - The command host's spill loop finds the fresh, empty record the hook just made, so the spill happens once.

## Verification

- `node --test --test-timeout=600000 src/tiles89-b89.test.js`: 9/9 pass.
  - With the old `simulation.js` and `command-host.js` put back temporarily, 3 of the tests fail: chest facing, furnace and darkness.
  - The single-player hook tests use the hook directly, and the source checks cover main.js.
- One targeted run over 26 files, 209/209 pass: tiles89, tiles88, tiles87, command-tags, mpworldcmds-b68, block-sweep, chest, chests, bonus-chest, signs, away-world, away-commands, awaystore86-b86, cmdfix84, container-screens, tile-sync, tile-edits, ring-chests, mpcontainers-b59, mpcontainers2-b60, mpend-b63, mpnether-b61, mpmobs-b59, mpmobs2-b60, mpsleep-b66, mpsleep2-b67.
- One targeted run over 10 darkness-sensitive server files, 68/68 pass: bonemeal2-b66, mpspawn73-b73, mpspawners2-b65, sieges-b67, mpmobtypes-b61, chunkscan2-b68, fixes68-b68, multiplayer, mpnether2-b62, mpend3-b66.
- No existing test encoded the fixed gaps. tiles88's server-wrapper source regexes still match, because the wrappers are unchanged. No test asserted the old `/setblock chest` no-change result or the post-step darkness.
- `npm run build`: passes (one run; only the usual chunk-size warning).
- No browser checks, by the track rules.

## Follow-ups

- **Chest facing in block metadata:** the full migration listed under Summary.
- **`/setblock lit_furnace` over an unlit furnace** gives a fresh record with burn 0, so the port shows it unlit. Natively it stays a lit_furnace block with an empty tile until the next update. The port cannot represent a lit furnace with burn 0.
- **Dispenser and dropper:** their onBlockAdded facing settle (BlockDispenser.func_149938_m) is not ported on `/setblock`.
- **Region export and the registry:** the furnace's original meta comes from `state.facing`, which defaults to 3, not from the cell meta. Only `blockAt` was fixed.
- **Mob spawning order:** native spawning (`aho.a`) runs before calculateSkylightSubtracted, so it reads the previous tick's value. The port's mobs read this tick's pre-step value. Fixing this needs `server-mobs.js` / `server-spawners.js` changes.
- **Weather order:** the port's `weather.tick` runs after the mobs, so they see the previous tick's rain strength. Native updates the weather first.
- **Sleep skip order:** the port does the sleep skip after the clock step. Natively it comes before calculateSkylightSubtracted. Between ticks, `/time set` shifts the getter by `clockStep`, whereas natively the stored field stays put until the next tick.
- **Other dimensions:** Nether and End puts made outside their own swap still skip `swapTiles`, as in b88.
- **Browser-only confirmation:**
  - the spilled items appearing in single player after a non-command chest-kind swap;
  - the chest renderer and lid after a swap;
  - the furnace's facing rendered after `/setblock`;
  - the screen closing in a running game;
  - farm growth and mob spawning timing at dusk and dawn on a live server.
