// Batch 64 (trackertransient): entities that spawn and die inside one tick. Natively World.spawnEntityInWorld -> EntityTracker.trackEntity adds the entity's EntityTrackerEntry to the
// HashSet at once and the death (World.updateEntities -> onEntityDestroy -> untrackEntity) removes it, so an arrow that hits at once, an item picked up the same tick or a potion that
// splashes on its first move was in the set for a moment: the 13th entry doubles the table (16 to 32, never shrunk) and permanently changes the order of the ids above 15
// (executed: tracker-dead-reference.json, case transient12 and the transient* cases). The port lists entities to the tracker once per tick and never sees them.
// EntityWorld.joined (the spawn hook of items, orbs, arrows, thrown entities, rockets, falling blocks, carts, boats, hangings) reports every spawn to the world's tracker (`born`);
// at the next tracker pass the ones that are dead and were never listed are replayed as an add and a remove in the id's place among the tick's new entries.
const idNumber = (e) => { const id = e?.entityId ?? e?.id; const n = typeof id === "string" ? Number((/(\d+)$/.exec(id) ?? [])[1]) : id; return Number.isInteger(n) ? n : null; };
/** `born`: the entities spawned since the last pass. `trackers`: the trackers whose entries exist; `lists`: the entities listed to them this tick. Returns the ids to add and remove. */
export function transientIds(born, trackers, lists) {
  if (!born.length) return [];
  const listed = new Set(lists.flat());
  const out = [];
  for (const e of born) {
    if (!e || e.dead !== true || listed.has(e) || trackers.some((t) => t.entries.has(e))) continue;
    const id = idNumber(e);
    if (id !== null) out.push(id);
  }
  return out;
}
