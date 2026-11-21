// b94 tiles94: the clock correction an away run returns (away-commands.js `timeShift`: /time moves plus `gained`, the ticks the clock moved beyond or short of what the trip
// assumed). The run already counted doDaylightCycle per tick, so the live rule state at the return must not gate it: a run that turned the rule ON from off returns a positive
// shift, and a live clock that is frozen again by then still owes it (the world's total clock kept the same ticks natively). main.js awayResult adds this to survival.time.
export function awayTimeShift(result) {
  const shift = result?.timeShift;
  return Number.isFinite(shift) ? shift : 0;
}
