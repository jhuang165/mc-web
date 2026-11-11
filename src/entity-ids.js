// Entity.nextEntityID (sa.b, one static int that `new Entity` post-increments into entityId): every entity of every world and class draws from the same counter
// (executed: tools/probes/EntityIdProbe.java, public/research/entity-ids-reference.json). Here one `EntityIds` is shared by the mob list (`EntityWorld`), the carts,
// boats, hanging entities and experience orbs of every dimension and of the away run; a unit that is built without one counts on its own, as before.
// Saved ids are stable (a mob keeps "mob-N", a cart or boat its number); the counter starts above every saved id of every kind, so an id is never given twice.
export class EntityIds {
  constructor(next = 1) { this.next = Math.max(1, next | 0); }
  take() { return this.next++; }
  // Keeps the counter above an id that exists already (a saved or delivered entity).
  reserve(id) { const n = typeof id === "string" ? (/^mob-(\d+)$/.test(id) ? Number(id.slice(4)) : NaN) : id; if (Number.isInteger(n) && n >= this.next) this.next = n + 1; }
  // The ids a saved world record holds: mobs, minecarts, boats and hanging entities (orbs are never saved with one).
  reserveRecord(record) {
    if (!record || typeof record !== "object") return this;
    for (const e of Array.isArray(record.entities) ? record.entities : []) this.reserve(e?.id);
    for (const list of [record.minecarts?.carts, record.boats, record.hanging]) for (const e of Array.isArray(list) ? list : []) this.reserve(e?.id);
    return this;
  }
}
// Makes `target.nextId` read and write the shared counter (the `nextId++` sites of the carts, boats and hanging list stay as they were).
export function bindIds(target, ids = new EntityIds()) {
  Object.defineProperty(target, "ids", { value: ids, writable: true, configurable: true, enumerable: false });
  Object.defineProperty(target, "nextId", { get() { return this.ids.next; }, set(v) { this.ids.next = v; }, configurable: true, enumerable: false });
  return target;
}
