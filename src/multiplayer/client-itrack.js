// b72 mpcadence72: the client half of the dedicated server's item and orb tracker packets (server-object-tracker.js cadence mode, wire name `itrack`).
// Each tracked item or orb is an ObjectClient (the single-player client entity, executed against the unchanged 1.7.10 classes in tracker-items-reference.json): the spawn, S1C meta,
// S12 velocity, S15/S17 move, S18 teleport and S13 destroy packets are applied as NetHandlerPlayClient does, and between packets every client tick runs EntityItem.onUpdate /
// EntityXPOrb.onUpdate on the copy (ObjectClient.step: gravity, drag, collision, the orb's pull towards the local player). `lists()` turns the copies back into the `items` / `xp`
// rows the dedicated client already draws (main.js syncMultiplayerItems / syncMultiplayerOrbs).
import { ObjectTracker, ObjectClient, OBJECT_KINDS } from '../object-tracker.js';

const fl = Math.fround;
export class ItemTrackClient {
  constructor(random = Math.random) { this.tracker = new ObjectTracker(10, random, null); this.random = random; this.copies = new Map(); }
  get size() { return this.copies.size; }
  clear() { this.copies.clear(); }
  /** One tick: the packet rows of the message (may be empty), then one client update of every copy. `player` is the local player's feet position. */
  tick(rows, world, player) {
    this.tracker.ctx.world = world; this.tracker.ctx.player = player;
    for (const r of rows ?? []) {
      const key = `${r.k}:${r.i}`;
      let c = this.copies.get(key);
      for (const p of r.p) {
        if (p.type === 'spawn') {
          if (!c) this.copies.set(key, c = new ObjectClient(r.k, this.tracker));
          c.world = world;
          c.apply(p);
          if (r.k === 'item') c.sim.hover = fl(this.random() * Math.PI * 2); // EntityItem's constructor: hoverStart = random * 2 pi
          else c.orbValue = p.value | 0 || 1;
        } else if (c) {
          if (p.type === 'destroy') { c.apply(p); this.copies.delete(key); c = null; } else c.apply(p);
        }
      }
    }
    for (const [key, c] of [...this.copies]) {
      if (!c.present) { this.copies.delete(key); continue; }
      c.step(this.tracker.ctx);
      if (!c.present) this.copies.delete(key);
    }
  }
  /** The copies as the tick message's own row shapes. */
  lists() {
    const items = [], xp = [];
    for (const [key, c] of this.copies) {
      const i = Number(key.slice(key.indexOf(':') + 1));
      const b = (c.meta.get(0) ?? 0) & 1; // b81 throwfire81: Entity.isBurning's watched flag 0 (the S1C), for the flames (fire-overlays.js)
      if (c.kind === 'item') items.push({ i, stack: c.meta.get(10) ?? c.sim.stack, x: c.x, y: c.y - OBJECT_KINDS.item.yOff, z: c.z, age: c.sim.age, hover: c.sim.hover, delay: 0, ...(b ? { b } : {}) });
      else xp.push({ i, x: c.x, y: c.y - OBJECT_KINDS.orb.yOff, z: c.z, v: c.orbValue ?? 1, c: c.sim.color | 0, ...(b ? { b } : {}) });
    }
    return { items, xp };
  }
}
