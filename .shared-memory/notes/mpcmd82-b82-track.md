# Batch 82 mpcmd82: command block leftovers (spawnpoint target, counts above 15, server residency)

## Summary
- **Bug fixed (b63/b81): `/spawnpoint <other>` from a server block.** It set the other player's spawn at the base (nearest) player's block.
  - Cause: `commandBlockSender.playerPosition` was `() => host.position()` (the base host). The server redirect (commands.js `dispatch`) builds the target host with `Object.create(sender)` and copies the target's `position` onto it, so `playerPosition` was inherited unchanged.
  - Fix: it is now a getter in command-block.js. On the redirected host it returns `() => this.position()` (the target), otherwise it returns the base host's position, as before.
  - The fix is in command-block.js only; commands.js is not touched. `/spawnpoint` with no argument from a block still throws playerNotFound (count 0).
  - The test fails with the old line: bobx got `[64, 10, 64]`, and gets `[90, 10, 80]` with the fix.
- **Counts above 15: the port already matched native; nothing changed in the engine.**
  - These do not clamp:
    - `akc.h` (comparator input) returns `aji.g` (getComparatorInputOverride; for a command block, `agp.g()`).
    - `akj.h` (diode input) returns an input of 15 or more as is.
    - `ahb.u` (getBlockPowerInput) and `ahb.g` (getIndirectPowerLevelTo).
    - `aoz` keeps the int signal.
  - `akc.j` (subtract mode) is `max(rear - side, 0)` on those unclamped values.
  - Only `ahb.w` (getStrongestIndirectPower), which the wire reads, returns 15 for 15 or more.
  - Repeaters output 15. Lamps, pistons and doors test `> 0`.
  - The port's redstone.js has the same shape: `getBlockPowerInput`, `getIndirectPowerLevelTo`, `diodeInput`, `comparatorInput` and `comparatorTarget` are unclamped, and `getStrongestIndirectPower` returns 15. Single player and the server share this engine (LiveRedstone).
  - New tests run a command block with a count of 20 through:
    - comparator to comparator (20, 20) to wire (15)
    - subtract mode with a full side wire (5; a clamped 15 would give 0)
    - comparator to stone to comparator (20)
    - a repeater (15)
    - the same comparator to comparator to wire line on the server simulation
- **Residency: with the default spawn there is no gap, and an optional model covers a moved spawn.**
  - With the spawn anywhere in the 128 × 128 window, every chunk centre (8..120) is within 128 of it, so `unloadChunksIfNotNearSpawn` never queues any window chunk. Native keeps the whole window loaded and ticking with nobody online, as the port does.
  - The b81 follow-up ("a far block keeps running where native would unload") only applies once `/setworldspawn` moves the spawn at least 9 blocks outside the window. Example: spawn x = -9 puts chunk 7's centre (120) 129 away.
  - New `DedicatedSimulation` option `residency: true` (off by default; multiplayer/server-residency.js) installs `World.tickResident(x, z)` on the Overworld.
  - A column is resident if either holds:
    - its centre is within ±128 of the WorldInfo spawn on both axes: `/setworldspawn`, else `nativeSpawn`, else `world.spawn()` floored, cached
    - it lies in an Overworld player's square of radius `rules.chunkRadius` around the managed chunk (`ChunkWatch.mx/mz`, the 8-block rule)
  - The set is rebuilt once per `sim.ticks`.
  - Read by:
    - `LiveRedstone.tickable` (redstone-live.js): due entries wait in `deferred`
    - `pauseUnloadedTicks` (streaming-ticks.js, used by fluids and fire): the time is bumped, so the delay is kept, as native TileTicks keep it
    - `ringTickActive` (falling blocks, the same time bump)
  - Without `tickResident` every path is unchanged; streaming single player is unaffected.

## Evidence
- **Bytecode-read** (`javap -c -p`, 1.7.10 jar):
  - `bp.b`: 0 args `b(ac)` (getCommandSenderAsPlayer), else `d(ac, String)`; 4 args parse x/y/z; otherwise more than 1 arg is usage, and the spawn is `mw.f_()` of the target, then `mw.a(r, true)`.
  - `akc.h` / `akc.j` / `akc.a(ahb,IIII)`, `akc.f` (`aoz.a()`), `akj.h` (the `>= 15` early return).
  - `ahb.u`, `ahb.g`, `ahb.v` and `ahb.w` (the `bipush 15; ireturn` clamp is only in `w`).
- **Executed (earlier batches, reused):** `chunk-provider-reference.json` replay of `unloadChunksIfNotNearSpawn` (centre ±128, inclusive), `unloadQueuedChunks` (100 per tick, at the start of WorldServer.tick), `saveAllChunks` queueing unwatched chunks, and PlayerManager watcher squares (`chunk-view-reference.json`).
- **Port-read:** the server Overworld is `SIZE` 128 (world.js). simulation.js order: `ticks++`, then `chunkViews.tick()`, then `tickWorldSystems`. The redirect in commands.js `dispatch`.

## Verification
- `node --test --test-concurrency=1`, batch 1 (22 files): block-audit-columns, chat-component-b52, cmd-output-b50, cmd-texts-b51, command-block, furnace-cart-b49, headless-columns, falling79-b79, mpcmd82-b82 (new, 6 tests), mpcmd81-b81, mpcmd80-b80, particles73-b73, order74-b74, redstone-live, ring-events, ring-rim-piston, ring-ticks, prediction5-b59, ring-random-ticks, ring-pistons, spsounds-b75 and tile-ticks. 190 pass, 0 fail.
- Batch 2 (19 files): away-commands, command-selector, commands, falling, fire, fluids, mpchunks71-b71, mpcommands2-b60, mpsleep-b66, mpsleep2-b67, mpspawn73-b73, mpstream72-b72, mpvehicles3-b63, mpworldcmds-b68, redstone, serverchunks-b67, servercommands-b59, streamfix73-b73 and streaming-world. 286 pass, 0 fail.
- No old test needed changing. The full `npm test` was not run. No browser checks were made.
- Browser-only: a comparator lamp line lit behind an `@a` block on a live server; the new spawn after a respawn following `/spawnpoint other` from a block.

## Follow-ups
- **Residency model limits (flag on only):**
  - Chunks loaded on demand are not modelled. `World.getBlock`/`setBlock` through `provideChunk` load an unloaded chunk natively: redstone, block events and pistons reaching in. Block events, pistons, plates and writes ignore residency here.
  - The startup load of the 25 × 25 spawn area beyond 128, and the autosave (900 ticks) that queues unwatched chunks, are not modelled. Natively such chunks linger until the next autosave.
  - A due redstone entry runs on the first resident tick. Natively its saved delay (TileTicks `t`) restarts on reload.
  - Tile entities (hoppers, furnaces, beacons), entities and the `updateEntityTick` 1200-tick idle rule are not gated.
  - Nether and End lanes are not given a residency predicate. They tick only with a player there, and with view distance 7 or more a player watches the whole window.
  - The flag has no server.properties / CLI switch.
- The client's comparator click prediction (client-comparator.js) reads 0 for a command block. Native's client tile has SuccessCount from S35. This was not changed.
- `pauseUnloadedTicks` re-sorts by (time, id) and ignores priority. That is old streaming behaviour, and it could break the heap order for equal-time entries of different priority. It was not changed.
