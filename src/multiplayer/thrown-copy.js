// Batch 84 mpthrown84: the dedicated client's own copies of the server's arrows, thrown balls, rockets and eyes of ender (server half: thrown-tracks.js).
// Each copy is object-tracker.js's ObjectClient (executed against the unchanged 1.7.10 classes). Native tick order (bytecode-read, Minecraft.runTick bao): WorldClient.updateEntities
// (bjf.h) runs before NetworkManager.processReceivedPackets (ej.a), so a copy that exists updates first and then takes this message's packets; a spawned copy is only placed.
// Rows keep one stable object per id (the renderers key meshes by it) in the shapes RemoteDispense already draws: arrows { x, y, z, px.., yaw, pitch, prevYaw, prevPitch, inGround, crit,
// shake, burning }, balls { kind, x, y, z, px.., damage, burning }.
import { ObjectTracker, ObjectClient, OBJECT_KINDS } from '../object-tracker.js';

export class ThrownCopies {
  // hooks: { particle(name, x, y, z, vx, vy, vz), firework(x, y, z, vx, vy, vz, fireworks), effects(sims.balls) }
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.tracker = new ObjectTracker(10, Math.random, null);
    if (hooks.particle) this.tracker.hooks.particle = hooks.particle;
    hooks.balls?.(this.tracker.sims.balls);
    this.copies = new Map(); this.rowOf = new Map();
  }
  get size() { return this.copies.size; }
  clear() { this.copies.clear(); this.rowOf.clear(); }
  // One message: the copies update, then the rows' packets apply. Returns { arrows, balls }.
  tick(rows, world, player) {
    this.tracker.ctx.world = world; this.tracker.ctx.player = player;
    for (const c of this.copies.values()) { c.world = world; c.step(this.tracker.ctx); }
    this.hooks.stepped?.(this.copies); // (test seam: the copies after their update, before the message's packets)
    for (const r of rows ?? []) {
      if (!OBJECT_KINDS[r.k] || !Array.isArray(r.p)) continue;
      const key = `${r.k}:${r.i}`;
      let c = this.copies.get(key);
      for (const p of r.p) {
        if (p.type === 'spawn') {
          if (!c) this.copies.set(key, c = new ObjectClient(r.k, this.tracker));
          c.world = world; c.apply(p); c.damage = p.data | 0;
        } else if (c) {
          if (p.type === 'destroy') { c.apply(p); this.copies.delete(key); this.rowOf.delete(key); c = null; } else c.apply(p);
        }
      }
    }
    for (const [key, c] of [...this.copies]) if (!c.present) { this.copies.delete(key); this.rowOf.delete(key); }
    for (const e of this.tracker.drainEvents()) if (e.firework) this.hooks.firework?.(e.firework.x, e.firework.y, e.firework.z, e.firework.vx, e.firework.vy, e.firework.vz, e.firework.fireworks);
    return this.lists();
  }
  lists() {
    const arrows = [], balls = [];
    for (const [key, c] of this.copies) {
      let row = this.rowOf.get(key);
      const fresh = !row;
      if (fresh) this.rowOf.set(key, row = { id: Number(key.slice(key.indexOf(':') + 1)), dead: false });
      const spec = c.spec;
      Object.assign(row, { x: c.x, y: c.y, z: c.z, px: c.px, py: c.py, pz: c.pz, yaw: c.yaw, pitch: c.pitch, prevYaw: c.sim?.prevYaw ?? c.yaw, prevPitch: c.sim?.prevPitch ?? c.pitch });
      row.burning = ((c.meta.get(0) ?? 0) & 1) === 1 || (c.sim?.fire > 0);
      if (spec.arrow) {
        row.crit = ((c.meta.get(16) ?? 0) & 1) === 1; row.inGround = !!c.sim?.inGround; row.shake = c.sim?.shake ?? 0;
        arrows.push(row);
      } else {
        row.kind = c.kind; row.damage = c.damage | 0;
        if (c.kind === 'eyeOfEnder' && !fresh) this.hooks.eyeTrail?.(row, row.x - row.px, row.y - row.py, row.z - row.pz);
        balls.push(row);
      }
    }
    return { arrows, balls };
  }
}
