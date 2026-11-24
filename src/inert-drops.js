// b98 tiles98: the EntityItem native leaves for a stack whose item is null (a jukebox holding a Record int that names no registered item, `ghost`).
// Bytecode-read / executed in batch 97 (tiles97-reference.json): BlockJukebox.dropRecord spawns it unconditionally for any non-null stack; EntityItem.onUpdate only
// ends the entity for a null stack or at age 6000; addItemStackToInventory refuses a null item and combineItems never merges it, so it is invisible, unpickable
// and inert; Entity.writeToNBT writes `Item {id 0, Count 1, Damage 0}`. The port keeps it as a record (no model, no pickup, no merge, no physics) so it
// can age out and be saved; the port's item entity cannot hold an id-0 stack.
import { NBT } from './nbt.js';
export const INERT_DESPAWN_AGE = 6000, INERT_PICKUP_DELAY = 10;
const t = (type, value) => ({ type, value });
export class InertDrops {
  constructor() { this.list = []; }
  spawn(x, y, z, count = 1) { this.list.push({ x, y, z, count, age: 0, pickupDelay: INERT_PICKUP_DELAY }); }
  // One game tick of EntityItem.onUpdate: the pickup delay counts down, the age up, and the entity ends at 6000.
  tick() {
    for (const d of this.list) { if (d.pickupDelay > 0) d.pickupDelay--; d.age++; }
    this.list = this.list.filter((d) => d.age < INERT_DESPAWN_AGE);
  }
  save() { return this.list.map((d) => ({ ...d })); }
  restore(records) {
    this.list = (Array.isArray(records) ? records : []).filter((r) => [r?.x, r?.y, r?.z].every(Number.isFinite) && Number.isInteger(r.age) && r.age < INERT_DESPAWN_AGE)
      .map((r) => ({ x: r.x, y: r.y, z: r.z, count: Number.isInteger(r.count) ? r.count : 1, age: r.age, pickupDelay: Number.isInteger(r.pickupDelay) ? r.pickupDelay : 0 }));
  }
}
const list = (items) => t(NBT.LIST, { elementType: NBT.DOUBLE, items });
/** The `Item` compound of the inert drop: {id 0, Count, Damage 0} (a Map, as region-export's stackNbt returns). */
export function inertItemNbt(d) { return new Map([['id', t(NBT.SHORT, 0)], ['Count', t(NBT.BYTE, d.count | 0)], ['Damage', t(NBT.SHORT, 0)]]); }
/** Entity.writeToNBT of the inert item: id "Item", Pos, Health, Age, Item {id 0, Count, Damage 0}. 1.7.10 (xk.b, bytecode-read) writes no PickupDelay. */
export function inertDropNbt(d, ox = 0, oz = 0) {
  return new Map([['id', t(NBT.STRING, 'Item')], ['Pos', list([d.x + ox, d.y, d.z + oz])], ['Health', t(NBT.SHORT, 5)],
    ['Item', t(NBT.COMPOUND, inertItemNbt(d))], ['Age', t(NBT.SHORT, d.age)]]);
}
/** A saved `Item` entity whose stack has id 0 (EntityItem.readEntityFromNBT keeps it; the pickup delay is not saved, so it restarts at 0): the port's inert record, or null. */
export function inertFromNbt(x, y, z, itemId, count, age) {
  if (itemId !== 0 || !Number.isFinite(x + y + z) || age >= INERT_DESPAWN_AGE) return null;
  return { kind: 'inert', x, y, z, count, age, pickupDelay: 0 };
}
/** The music-tile save list carries the inert drops as `{ kind: 'inert', ... }` records, so every store that keeps `musicTiles` keeps them. */
export const inertRecords = (inert) => inert.save().map((d) => ({ kind: 'inert', ...d }));
