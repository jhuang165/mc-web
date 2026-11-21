// The block-system segment of the live tick. The caller owns time, daylight and
// player position; each observer runs before the next system, as in main.js.
// This is not yet the complete authoritative world tick.
export function tickBlockSystems({ farming, fluids, fire, tickTree }, { time, daylight, x, z }, observers) {
  observers.farming(farming.tick(time, daylight));
  // One shared tree (tile-ticks.js TickTree): fluid, fire, falling, redstone and foreign entries are taken together under one cap, so the redstone
  // update and the falling/foreign systems run inside it; hoppers and brewing stay after it.
  if (tickTree) { tickTree.tick({ x, z }, observers.tree ?? observers); return; }
  if (fluids) observers.fluids(fluids.tick());
  if (fire) observers.fire(fire.tick(x, z));
}

// Shared server-side block/tile ordering. Browser presentation is supplied as
// observers; Node can run the same segment without a scene or a document.
export function tickWorldSystems(systems, clock, observers) {
  tickBlockSystems(systems, clock, observers);
  systems.hoppers?.tick();
  systems.brewing?.();
  // With the shared tree the scheduled redstone entries already ran inside it; block events, the tile-entity loop and the piston pushes
  // (redstone-runtime.js tickEnd) still run here, where redstone.tick() ran them before the tree (batch 33 dropped this call by mistake).
  if (systems.tickTree) systems.redstone?.tickEnd?.(!!systems.deferTiles); // deferTiles: the caller runs redstone.tickTiles() after the entity walk
  else systems.redstone?.tick();
}

// b92 mpobjects92 (bytecode-read mt.b / ahb.h): the dedicated server's world pass in two pieces. WorldServer.tick runs the scheduled tickUpdates (fluids, fire, falling, redstone)
// and the queued block events BEFORE the random block ticks and World.updateEntities; the tile entities (hoppers, brewing stands, the pistons' TileEntityPiston) update at the END of
// updateEntities. `tickScheduledSystems` is the first piece, `tickTileSystems` the second (the live redstone engine's tile loop only: `redstone.endTick(true)` defers it).
export function tickScheduledSystems(systems, clock, observers) {
  systems.falling?.tick({ entities: false }); // BlockFalling.updateTick's scheduled entry; the falling entities walk later with the others (FallingBlocks.tickEntities)
  tickBlockSystems(systems, clock, observers);
  const r = systems.redstone;
  if (!r) return;
  r.beginTick();
  r.tickUpdates();
  r.endTick(true); // sendQueuedBlockEvents and the sensor scans now; the tile-entity loop waits for tickTileSystems
}
export function tickTileSystems(systems) {
  systems.hoppers?.tick();
  systems.brewing?.();
  systems.redstone?.updateTileEntities();
}
