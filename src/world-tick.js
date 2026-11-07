// The block-system segment of the live tick. The caller owns time, daylight and
// player position; each observer runs before the next system, as in main.js.
// This is not yet the complete authoritative world tick.
export function tickBlockSystems({ farming, fluids, fire }, { time, daylight, x, z }, observers) {
  observers.farming(farming.tick(time, daylight));
  if (fluids) observers.fluids(fluids.tick());
  if (fire) observers.fire(fire.tick(x, z));
}

// Shared server-side block/tile ordering. Browser presentation is supplied as
// observers; Node can run the same segment without a scene or a document.
export function tickWorldSystems(systems, clock, observers) {
  tickBlockSystems(systems, clock, observers);
  systems.hoppers?.tick();
  systems.brewing?.();
  systems.redstone?.tick();
}
