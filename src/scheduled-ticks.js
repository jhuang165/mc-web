// Browser save representation of pending block updates. Delays are relative to
// the scheduler clock (like TileTicks), and array order preserves equal-time ties.
export function saveTicks(entries, time, block) {
  return {
    version: 1,
    time,
    entries: [...entries].sort((a, b) => a.time - b.time || a.id - b.id)
      .map((e) => ({ x: e.x, y: e.y, z: e.z, block: e.block ?? block, delay: e.time - time })),
  };
}

// Missing/unsupported envelopes use the legacy wake migration. Individual bad
// entries are ignored without discarding the rest of an otherwise valid queue.
export function readTicks(data, world, accepts) {
  if (!data || data.version !== 1 || !Number.isSafeInteger(data.time) || data.time < 0 || !Array.isArray(data.entries)) return null;
  return {
    time: data.time,
    entries: data.entries.filter((e) => e && [e.x, e.y, e.z, e.delay].every(Number.isSafeInteger)
      && world.inside(e.x, e.y, e.z) && accepts(e.block) && Number.isSafeInteger(data.time + e.delay)),
  };
}
