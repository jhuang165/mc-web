# tiles87 (batch 87): tile entities after awaystore86

## Summary

- Beacons tick on total world time. TileEntityBeacon.updateEntity reads `getTotalWorldTime() % 80`, not the world time, so `/time set` no longer moves the pyramid check.
  - Single player (`src/main.js`) passes `(mobs?.worldTicks ?? -1) + 2`. That is the total time the native beacon sees, because `mobs.worldTicks` is advanced in tickLivingSimulation, after tickSurvival.
  - The server (`src/multiplayer/simulation.js`) passes `sim.ticks`. The Nether (`server-nether.js`) also passes `sim.ticks`, because DerivedWorldInfo reads the Overworld's total time.
  - Old test updated: `src/dedicated-beacon.test.js` set `sim.time` and now sets `sim.ticks`. It encoded the gap.
- A standing-to-wall sign swap (63 to 68, or back) now starts a fresh TileEntitySign. Chunk.func_150807_a runs breakBlock on any id change.
  - Single player: main.js onChange calls `isSign(old) && old !== now` and then `signs.remove`. The new id's tile is created lazily, as before.
  - Server: the put wrappers in `multiplayer/simulation.js`, `server-dimensions.js` and `server-end.js` remove the sign tile on an id change.
  - The away run was already native (awaystore86 hook).
  - A same-id metadata write still keeps the live and server tile. Only the away run clears it.
- `/setblock` over a chest, furnace, dispenser, hopper or brewing stand now spills the contents, as BlockContainer breakBlock does. Before this, `src/command-host.js` deleted the store record and the items were lost. The server lost them too, because its end-of-tick reap found no record.
  - The command host calls `env.spillTile(stacks, x, y, z, key)`.
  - Single player: `items.spill` (ItemEntities.spill).
  - Server (`server-worldcmds.js`): `sim.items.spill`, then `sim.containers.closeAt(key)`.
  - Away run (`away-world.js`): `ents.items.spill` when the entity run is on. Otherwise it writes drop records with the native offsets and 10 to 30 pieces, drawn with Math.random.
  - The lead's premise that CommandSetBlock clears the old tile is a 1.8 behaviour. In 1.7.10, bm only calls World.setBlock.
- Daylight sensors in the away run now track the world. Before this, the away run never refreshed them: LiveRedstone's sensor pass lives in endTick, which the away run does not call. So a sensor kept the value it had when the player left, not a noon value.
  - Now, every 20 total ticks while the 1200-tick gate is open, each watched sensor in a ticking column is refreshed (`away-world.js` sensorTick).
  - The refresh reads the run's sky light (`light.skyAt`), skylightSubtracted from the world time, rain and thunder, and the celestial angle.
  - The world time follows the away clock and holds still under doDaylightCycle false.
- Spawners removed during the away run now leave the saved list.
  - `away-plan.js` carries `root.spawners`, only when the world saved one.
  - `away-world.js` builds a MobSpawners store and watches it with `watchSpawnerBlocks`, so a removed spawner leaves the list. A `/setblock mob_spawner` adds a record through `env.spawners`.
  - The run returns `spawners`, and `dimension-live.js` writes it back whole. An empty list stays empty; it is not deleted, because a missing list reads as a fresh world in structure-simulation.js.
- New test file: `src/tiles87-b87.test.js` (8 tests).

## Evidence

- Bytecode-read (`javap -c -p` on the 1.7.10 jar):
  - TileEntityBeacon `aoq.h` reads `ahb.I()` (getTotalWorldTime) `% 80`.
  - WorldServer.tick `mt.b` computes skylightSubtracted (`ahb.j = a(1.0F)`) before it increments the total and world time, then runs tickUpdates. MinecraftServer runs updateEntities after that.
  - CommandSetBlock `bm` calls only `ahb.d(IIILaji;II)Z` with flags 3. Destroy mode calls `ahb.a(IIIZ)`; keep mode calls `ahb.c`. It does not remove the tile entity itself.
  - BlockChest `ajx.a` (breakBlock) and BlockHopper `aln` loop the non-null slots. Each slot gets offsets of nextFloat*0.8+0.1 and is split into pieces of nextInt(21)+10, with gaussian motion ×0.05 (+0.2 upward). The NBT is copied. Each piece spawns through `ahb.d(Lsa;)`, so there is no doTileDrops check.
  - BlockFurnace has the keepInventory guard only during its own lit/unlit swap.
  - TileEntityDaylightDetector `apa.h`: when `ahb.I() % 20 == 0`, it calls `akg.e`.
  - `akg.e` returns early when the provider has no sky. It takes the saved sky light minus `ahb.j`, reads the angle `ahb.d(1.0F)`, adds the 3.1415927 and 0.2 lerp, applies Math.round, and writes the metadata with flags 3.
- Port-read:
  - Chunk.func_150807_a breakBlock on an id change, as awaystore86 already used.
  - `hasSavedStructures` treats a missing `spawners` list as a fresh world.
  - restoreStructureEntities drops spawner records only for loaded columns.
  - The server container reap spills only when the record is still present.
- Executed (node, this worktree): a scratch away-run probe with a sensor at meta 7 and a command block keeping the run alive. It read 15 at 6000, 4 at 12500, 2 at 13000, 0 at 18000, 4 at 23500 and 11 at 25500. With doDaylightCycle false at 18000 it read 0. Before the fix the sensor column never changed.

## Verification

- `node --test --test-timeout=600000 src/tiles87-b87.test.js`: 8/8 pass.
- Targeted neighbours, 35 files, 313/313 pass:
  - New and updated tests: tiles87, dedicated-beacon.
  - Command and setblock tests: cmdfix84, plants83, pots82, mpworldcmds-b68, mpcmd80/81/82, pickup85, drops84, command-tags, spfixes75.
  - Away-run tests: away-commands, awaystore86, away-world, away-spawn, away-trip, away-shadow, away-dispense-b51.
  - Beacon and sign tests: pyramid, signs.
  - Dimension tests: dimension-live, dimension-away.
  - Source scan: skins73.
  - Falling-block tests: falling78/79.
  - Spawner tests: mob-spawner-block, mpspawners2-b65, spawner-replay3.
  - Other: bed, block-sweep3, redstone-live, container-screens, block-actions-replay.
- Server neighbours, 10 files, 69/69 pass: lighting, mpcontainers-b59 and b60, mpend b63/b64/b66, mpendwindow-b65, mpnether b61/b62/b63.
- `npm run build` passes, with only the usual chunk-size warning.
- The full `npm test` was not run (track rule). No browser checks were run.

## Follow-ups

- On the server, a chest turned into a trapped chest (54 to 146, or back) still keeps its contents. The reap uses `isChestBlock`; natively the old chest's breakBlock spills them.
- A same-id metadata write over a sign (for example `/setblock` standing_sign with another rotation) keeps the old text in single player and on the server. The away run already clears it.
- Away sensors only advance in columns the run ticks, and only while the run has other work: an otherwise idle run stops early. Pressure plates and tripwire are still not sensed in the away run.
- The sensor angle×2π is computed in double precision; native uses float. This could differ by one at a rounding edge (not probed).
- LiveRedstone's own live sensor cadence is `this.time % 20` (world time). Natively it is total time. Not changed here.
- away-entities' mob clock treats plan.time as the start of the trip; away-commands treats it as the end. This mismatch predates this batch.
- In single player, `/setblock` does not close an open container screen.
- In destroy mode, the order is the block item first, then the contents. Native runs dropBlockAsItem and then setBlock, whose breakBlock spills the contents, so native has the same order. Not probed by execution.
- Browser-only: how the spilled items and swapped sign text look on screen.
