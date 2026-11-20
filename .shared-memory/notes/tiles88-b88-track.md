# tiles88 (batch 88): tile entities after tiles87

## Summary

- A chest swapped for a trapped chest (54 to 146, or back) on the server now spills its slots and starts an empty tile, as natively.
  - `/setblock` was already native in both hosts (b87 `command-host.js` spill loop plus a fresh record). World edits were not: the server's end-of-tick reap kept the record, because `isChestBlock` is true for both kinds.
  - New `src/multiplayer/server-tile-swaps.js` `swapTiles`, called from the put wrappers in `multiplayer/simulation.js`, `server-dimensions.js` and `server-end.js`. It calls the new `ServerContainers.swapChest` (`server-containers.js`), which deletes the record, spills through `sim.items.spill` and runs `closeAt(key)`. The reap's `ensureChest` then makes the new block's empty record.
  - No double spill with `/setblock`: the wrapper runs inside `w.set`, so the command host's loop finds no record.
  - Same-id chest metadata writes (the facing, setBlockMetadataWithNotify) keep the tile.
- A sign rewritten with only another metadata (a standing sign's rotation, a wall sign's facing) now starts a fresh, empty, editable TileEntitySign on the server.
  - `/setblock` was already native (b84 cmdfix84 `env.signs().create`, or the tag reader).
  - Server world edits now go through `swapTiles` (remove, then create). The Nether and End wrappers act only while their dimension is swapped in (`own()`).
  - Old test updated: `src/tiles87-b87.test.js` "server: a standing <-> wall sign swap..." asserted that a same-id `put(SIGN_POST, 4)` kept the text "old". It encoded the gap; it now expects "". Its source regexes (main.js and the b87 wrapper lines) still match unchanged.
- The live daylight sensor now gates on total time and reads native clock inputs (new `src/daylight-sensor-time.js`).
  - `redstone-live.js`: the 20-tick gate reads the new `hooks.totalTime()` and falls back to LiveRedstone's own count. Before, it used `this.time`, LiveRedstone's own tick counter, which is neither the world time nor the total time.
  - Single player (`main.js`): `totalTime` is `(mobs.worldTicks ?? -1) + 2`, the beacon's clock. The sensor pass (tickWorldSystems, then redstone endTick) runs before tickLivingSimulation moves worldTicks, as tickBeacons does.
  - Single player now takes the angle and skylightSubtracted from `survival.time`, using `sensorSky`. Before, it read the scene's values, which were a tick old at partial 0.
  - Server (`simulation.js`): `totalTime` is `sim.ticks`. skylightSubtracted now comes from the world time before this tick's increment (WorldServer.tick order); a held clock (doDaylightCycle false) uses the current time.
  - `redstone-runtime.js` and `simulation.js` both compute the angle in radians with the native float products, `celestialRadians` (`f(f(a) * f(PI)) * 2`). Before: `Math.fround(a * Math.PI * 2)` (single player) and an unrounded double (server).
  - `away-world.js` sensorTick now calls the shared `sensorSky`. Its behaviour is unchanged; it already gated on totalAt.
- Single player: a `/setblock` over a block whose screen is open now closes the screen. This covers a chest or either half of a large chest, an ender chest, a furnace, a dispenser or dropper, a hopper and a brewing stand.
  - New `src/container-tiles.js`. `heldTiles` records the store records the screen opened on, keyed by store and key. `tilesReplaced` is the identity test (`getTileEntity != this`).
  - `main.js` openContainer stores `containerView.tiles` (single player only; multiplayer windows are closed by the server). tickChests calls `resume()` once a record is no longer the same object.
  - `command-host.js`: `/setblock ender_chest` over an ender chest now makes a new TileEntityEnderChest and calls `env.closeTile(key)`. Before, `??=` kept the old one.
  - `server-worldcmds.js`: the new hook `closeTile` maps to `sim.containers.closeAt`.
- New: `src/tiles88-b88.test.js` (9 tests), `tools/probes/Tiles88Probe.java`, `tools/verify-tiles88.mjs`, `public/research/tiles88-reference.json` (728 records).

## Evidence

- Executed:
  - `tools/probes/Tiles88Probe.java` runs on the unchanged 1.7.10 classes, unzipped (the signed jar refuses a probe class in its packages). It uses a real World allocated without its constructor, plus the real WorldInfo `ays`, WorldProvider `aqo`, MathHelper and BlockDaylightDetector `akg`. Only getSavedLightValue and the meta cell are stubbed.
  - Per world time t and weather case, it runs `calculateSkylightSubtracted(1.0F)` at t, then sets the world time to t + 1 and calls `akg.e` at sky 15, 12, 7 and 4.
  - `MC_RESEARCH=... node tools/verify-tiles88.mjs` gave "728 records agree" with `replaySensorRecord` (sensorSky + celestialRadians + redstone.js refreshDaylightSensor).
  - The old formulas disagreed with the native values in 236 of 728 records for the angle float bits and in 2 of 728 for skylightSubtracted at the moved clock. No signal differed in this sweep, so the change is exactness at edges, not a visible jump.
- Bytecode-read (`javap -c -p`):
  - Chunk.func_150807_a `apx.a(IIILaji;I)Z` returns false only when the block and the meta are both unchanged. Otherwise, server side, it calls the old block's breakBlock `aji.a(Lahb;IIILaji;I)V` with no id test. The client branch removes the tile only on an id change. Afterwards it makes a new tile (`akw.a`) if the new block is a container without one.
  - BlockChest.breakBlock `ajx.a` spills every slot (nextFloat offsets, nextInt(21)+10 pieces, gaussian motion), then calls func_147453_f and `ajc.a`, which removes the tile. BlockSign has no breakBlock of its own, so `ajc`'s removes the tile.
  - TileEntityDaylightDetector `apa.h`: `!isRemote && ahb.I() % 20 == 0` calls `akg.e`.
  - `akg.e` reads `getSavedLightValue(SKY) - ahb.j`, then `ahb.d(1.0F)`, which is `c(F) * 3.1415927F * 2.0F` in float. It applies the 3.1415927 / 6.2831855 lerp ×0.2, then `Math.round(sky * qh.b(angle))` clamped to 0–15, and writes the meta with flags 3 when it changes.
  - The isUseableByPlayer of every container tile (`aow` / `apg` / `apb` / `api` / `aov` / `ape .a(yz)Z`) begins `getTileEntity(x, y, z) != this -> false`.
  - EntityPlayer.onUpdate `yz.h`: `!isRemote && openContainer != null && !openContainer.a(this)` calls `k()` (closeScreen) and sets the open container back to the inventory container.
- Port-read:
  - `command-host.js` `/setblock` already spilled and made fresh container records (b87), and made fresh sign tiles on a meta-only change (b84).
  - In single player, the sensor pass is before tickLivingSimulation, which moves `mobs.worldTicks`, so `+ 2` matches the beacon.
  - In the port, chest and furnace facings live in the record, not the cell meta. So `/setblock chest 3` over a chest is reported as noChange.

## Verification

- `node --test --test-timeout=600000 src/tiles88-b88.test.js`: 9/9 pass, run six times; one early draft was order-sensitive to item merging and was fixed.
- One targeted run over 34 files, 365/365 pass:
  - New and updated: tiles88, tiles87.
  - Away run: away-commands, away-tick-tree, away-world, awaystore86.
  - Tiles, signs and commands: block-sweep3, chests, cmdfix84, container-screens, dedicated-beacon, plants83, signs, skins73, tile-sync, tile-edits, ring-chests.
  - Dimensions: dimension-live.
  - Multiplayer: mpcontainers-b59 and b60, mpend b63/b64/b66, mpendwindow-b65, mpnether b61/b62/b63, mpworldcmds-b68, mpblocks73.
  - Redstone and ticks: redstone-blocks-2, redstone-live, redstone, tick-tree-runtime, world-tick.
- `npm run build`: passes (one run; only the usual chunk-size warning).
- No browser checks, by the track rules.

## Follow-ups

- Single-player world edits: main.js onChange still clears a sign only on an id change, and a non-command chest <-> trapped chest edit relies on the command host. Natively only `/setblock` and a few world rules reach these cases in single player.
- The port keeps chest and furnace facings in the record. `/setblock chest <other facing>` over a chest is noChange here, but natively it would run breakBlock and spill.
- The server's `darkness` getter, used by farming and mobs, still uses the post-increment world time. Only the sensor's input was moved.
- Single player: the weather update and the clock may run in a different order from WorldServer.tick (rain timing), not checked.
- Nether and End puts made outside their own swap skip `swapTiles`.
- Browser-only confirmation:
  - the screen closing on `/setblock` in single player;
  - the spilled chest items on screen;
  - the trapped chest's lid and new tile sync on clients;
  - sensor values in a running world.
