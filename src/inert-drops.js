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
/** Entity.writeToNBT of the inert item: id "Item", Pos, Item {id 0, Count, Damage 0}, Age, PickupDelay. */
export function inertDropNbt(d, ox = 0, oz = 0) {
  return new Map([['id', t(NBT.STRING, 'Item')], ['Pos', list([d.x + ox, d.y, d.z + oz])],
    ['Item', t(NBT.COMPOUND, new Map([['id', t(NBT.SHORT, 0)], ['Count', t(NBT.BYTE, d.count | 0)], ['Damage', t(NBT.SHORT, 0)]]))],
    ['Age', t(NBT.SHORT, d.age)], ['PickupDelay', t(NBT.SHORT, d.pickupDelay)]]);
}
