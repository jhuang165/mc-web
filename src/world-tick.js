// The block-system segment of the live tick. The caller owns time, daylight and
// player position; each observer runs before the next system, as in main.js.
// This is not yet the complete authoritative world tick.
export function tickBlockSystems({ farming, fluids, fire }, { time, daylight, x, z }, observers) {
  observers.farming(farming.tick(time, daylight));
  if (fluids) observers.fluids(fluids.tick());
  if (fire) observers.fire(fire.tick(x, z));
}
