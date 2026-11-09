// Browser save representation of pending block updates. Delays are relative to
// the scheduler clock (like TileTicks), and array order preserves equal-time ties.
export function saveTicks(entries, time, block) {
  return {
    version: 1,
    time,
    // NextTickListEntry.compareTo: time, priority, creation. `p` (always 0 for fluid, fire and falling ticks a vanilla world schedules, but a
    // save may carry another value) is written only when it is not 0, so a record without priorities is unchanged.
    entries: [...entries].sort((a, b) => a.time - b.time || (a.p | 0) - (b.p | 0) || a.id - b.id)
      .map((e) => ({ x: e.x, y: e.y, z: e.z, block: e.block ?? block, delay: e.time - time, ...(e.p ? { p: e.p } : {}) })),
  };
}

// Missing/unsupported envelopes use the legacy wake migration. Individual bad
// entries are ignored without discarding the rest of an otherwise valid queue.
export function readTicks(data, world, accepts) {
  if (!data || data.version !== 1 || !Number.isSafeInteger(data.time) || data.time < 0 || !Array.isArray(data.entries)) return null;
  return {
    time: data.time,
    entries: data.entries.filter((e) => e && [e.x, e.y, e.z, e.delay].every(Number.isSafeInteger)
      && world.inside(e.x, e.y, e.z) && accepts(e.block) && Number.isSafeInteger(data.time + e.delay))
      .map((e) => (Number.isSafeInteger(e.p) && e.p ? e : { ...e, p: 0 })),
  };
}
