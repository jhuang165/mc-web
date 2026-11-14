# Live redstone (0.39.0)

Target: Minecraft Java 1.7.10. Not full parity.

## What runs

`src/redstone-live.js` (LiveRedstone) is the native-verified `RedstoneWorld` of `src/redstone.js` storing through the running `World`
(internal ids and 4-bit metadata converted by `block-registry.js`). `src/redstone-runtime.js` builds it for each world that loads
(finite and streamed) and wires the hooks; `src/main.js` only calls it.

Native evidence:
- `public/research/redstone-reference.json` (59 scenarios: dust, torches, repeaters, comparators, plates, lamps, sensor, pistons),
  `redstone-blocks-2-reference.json`, `piston-live-reference.json`: the engine itself.
- `public/research/redstone-live-reference.json` (9 scenarios, `tools/probes/RedstoneLiveProbe.java`, `tools/verify-redstone-live.mjs`):
  unchanged BlockDoor (wooden and iron) and BlockTNT in the original World/Chunk fixture. `src/redstone-live.test.js` replays them through
  LiveRedstone over a real `World` at an offset origin and compares block changes, pending ticks, the world Random, primed TNT and drops.
  The call log is compared too, except for scenarios with dust: dust iterates a HashSet of positions, so its order depends on absolute coordinates.
- Differential tests (same events through `RedstoneWorld` and LiveRedstone): lever-dust-lamp, repeater delays and click cycle, torch inversion
  and burnout ring, plates with entities, comparator over a chest, daylight sensor, save/restore in mid pulse. These check the live storage layer
  against the native-verified engine, not against the JAR directly.

## Tick order

`redstoneRuntime.tick()` runs once per 20 TPS game tick in `main.js` right after `tickBlockSystems` (fluid, fire and farming scheduled ticks) and
before chests, mobs and spawners. Inside: `LiveRedstone.tick()` = pending block updates (tickUpdates), queued block events, the tile-entity loop
(piston progress), plate polling and the daylight sensor refresh (every 20 ticks); then `pistons.tick()`; then the changed cells are handed to
`scene.updateBlocks` (relight for lamps/torches, mesh rebuild). Reason: WorldServer.tick runs scheduled updates, then block events, then entity
updates; entities that already moved this tick (items, arrows in `tickSurvival`) are polled by plates next tick. Mobs move after, as in 1.7.10.
Pistons draw through `pistons.frame(partial)` each rendered frame.

## Interaction and funnel

- Right click on lever, stone/wooden button, repeater (delay cycle), comparator (mode toggle) goes to `LiveRedstone.use`. Daylight sensor has no use in 1.7.10.
  Wooden/iron doors keep `doors-panes.js` use; power opens them through the native BlockDoor behaviour.
- `World.set` is wrapped (`installFunnel`): breaks, explosions, falling blocks, fire and placement via `set` run the native setBlock tail. The two-step
  `placeHeldBlock` (untracked then tracked set) skips the funnel, so the runtime calls `placed()` plus `onBlockPlacedBy` (diode, piston) after it,
  once, only for cells the funnel did not already notify (`redstone.touched`).
- Fluids write with `world.put`; their tick changes go through `redstone.external()`.
- The older inert `RedstoneBlocks` watcher is bypassed for every block the engine ports, tripwire hook and string included.
- Drops go to the item entities, sounds to the positional sound system, TNT to `lightTnt`.

## Save / load

`record.redstone = redstone.save()` (pending ticks, deferred ticks, block events, torch toggles, lit repeaters, comparator signals, pistons, world Random,
clocks) and `record.pistons = pistons.save()` (chunk-runtime splits that list per column). Load restores `record.redstone`; a Java import (only
`record.pistons`) restores the piston tiles. Pending ticks are not exported to Java `TileTicks`.

## Known limits (open)

- Batch 69 (docs sweep): dispenser and dropper exist (`src/dispense.js`, `src/dispenser-container.js`); the hopper is live (hopper.md). Trapped chests are block 146 (`src/block-registry.js`); whether they emit signals was not checked.
- Comparator reads chest, furnace, dispenser and hopper contents from the browser stores and re-reads them whenever a container changes: a slot click in an open screen, a hopper transfer, a furnace fuel/smelt result and a screen close call `containerChanged` (the `World.func_147453_f` path; see [hopper.md](hopper.md)). Dispenser/dropper firing is the dispenser track's to report.
  Furnace progress and chest-lid changes do not notify comparators.
- Batch 69 (docs sweep): minecarts trigger plates (`src/redstone-runtime.js` `cartsIn` mode "all" includes every cart). Thrown projectiles and tripwire do not trigger plates; arrows, items, orbs, primed TNT, mobs and the player do (strict AABB).
- Sensor sky light uses the scene light volume; the daylight cycle follows `scene.angle`.
- Tripwire hook (131) and string (132) are live (tripwire-reference.json, 16 native scenarios; see scattered-features.md, Live traps). Not probed: shears disarm, the selection bounds, random ticks; thrown projectiles, boats and falling blocks do not trip strings.
- Batch 69 (docs sweep): pending ticks are exported in Java `TileTicks` (`src/region-export.js`, `src/tile-ticks.js`); whether redstone's own ticks are among them was not checked.
