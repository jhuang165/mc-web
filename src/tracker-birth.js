// Batch 48: when an entity's tracker entry starts. Natively EntityTracker.trackEntity runs from World.spawnEntityInWorld, so the entry (and its spawn packets and first S12)
// carries the entity's state at creation, and anything that pushes the entity later in the same tick (a collision, an explosion, a hit) reaches the player as a second S12 from
// the entry's first update. The port lists entities to the tracker once per tick, so the spawn site that creates an entity gameplay then moves records its creation state here
// (`recordBirth`, a shallow copy), and ObjectTracker.create builds the entry from it (`takeBirth`) before it reads the live entity. A WeakMap keyed by the entity: an entity that is
// never listed, or dies first, leaves nothing behind. Entities rebuilt from saves, summon records and portals are not recorded: they join with the state they were loaded with.
const BIRTH = new WeakMap();
export const recordBirth = (e) => { BIRTH.set(e, { ...e }); return e; };
export function takeBirth(e) {
  const b = BIRTH.get(e);
  if (!b) return null;
  BIRTH.delete(e);
  return b;
}
