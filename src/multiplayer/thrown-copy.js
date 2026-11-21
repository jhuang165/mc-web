// Batch 84 mpthrown84: the dedicated client's own copies of the server's arrows, thrown balls, rockets and eyes of ender (server half: thrown-tracks.js).
// Each copy is object-tracker.js's ObjectClient (executed against the unchanged 1.7.10 classes). Native tick order (bytecode-read, Minecraft.runTick bao): WorldClient.updateEntities
// (bjf.h) runs before NetworkManager.processReceivedPackets (ej.a), so a copy that exists updates first and then takes this message's packets; a spawned copy is only placed.
// Rows keep one stable object per id (the renderers key meshes by it) in the shapes RemoteDispense already draws: arrows { x, y, z, px.., yaw, pitch, prevYaw, prevPitch, inGround, crit,
// shake, burning }, balls { kind, x, y, z, px.., damage, burning }.
// b85 mphook85: fishing hooks (S0E type 90, data = the angler's id) and hit targets. NetHandlerPlayClient.handleSpawnObject (bjb.a(fw)) looks the angler up by id and builds the hook only if
// it is found (`hooks.hasAngler(id)`; a hook without its angler never exists on this client). EntityThrowable.onUpdate searches for entities only under !isRemote (bytecode-read, zk.h:
// `ahb.E` ifne skips the search), so snowballs, eggs, pearls, potions and bottles still fly with no targets; EntityArrow and EntityFishHook search the client world's entities, so their copies
// get `hooks.targets()` (mob copies and other players' copies; EntityOtherPlayerMP.attackEntityFrom (bll.a(ro, float)) returns true, so an arrow that hits one ends with the hit sound).
// A row's `sh` names the shooter or angler ({ p: playerId } | { m: mobWireId }, `hooks.refOf(sh)` -> the target ref), skipped for the arrow's first 5 ticks and never hooked by its own hook.
import { ObjectTracker, ObjectClient, OBJECT_KINDS } from '../object-tracker.js';

export class ThrownCopies {
  // hooks: { particle(name, x, y, z, vx, vy, vz), firework(x, y, z, vx, vy, vz, fireworks), effects(sims.balls), targets() -> [{ ref, box, ... }], refOf(sh) -> ref, hasAngler(id) -> bool }
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.tracker = new ObjectTracker(10, Math.random, null);
    if (hooks.particle) this.tracker.hooks.particle = hooks.particle;
    hooks.balls?.(this.tracker.sims.balls);
    if (hooks.targets) this.tracker.hooks.clientTargets = () => hooks.targets() ?? [];
    this.tracker.hooks.clientOf = (sh) => (sh ? hooks.refOf?.(sh) ?? null : null);
    this.copies = new Map(); this.rowOf = new Map();
  }
  get size() { return this.copies.size; }
  clear() { this.copies.clear(); this.rowOf.clear(); }
  // One message: the copies update, then the rows' packets apply. Returns { arrows, balls, hooks, falling }.
  tick(rows, world, player) {
    this.tracker.ctx.world = world; this.tracker.ctx.player = player;
    for (const c of this.copies.values()) { c.world = world; this.tracker.hookAngler = c.spec.hook && c.shooterLive ? this.hooks.refOf?.(c.shooterLive) ?? {} : null; c.step(this.tracker.ctx); }
    this.tracker.hookAngler = null;
    this.hooks.stepped?.(this.copies); // (test seam: the copies after their update, before the message's packets)
    for (const r of rows ?? []) {
      if (!OBJECT_KINDS[r.k] || !Array.isArray(r.p)) continue;
      const key = `${r.k}:${r.i}`;
      let c = this.copies.get(key);
      for (const p of r.p) {
        if (p.type === 'spawn') {
          if (r.k === 'fishHook' && !(this.hooks.hasAngler?.(p.data) ?? true)) break; // handleSpawnObject: no angler found, no entity
          if (!c) this.copies.set(key, c = new ObjectClient(r.k, this.tracker));
          c.world = world; c.apply(p); c.damage = p.data | 0;
          c.angler = p.data; // (this wire's player ids may be strings: the hook's data is the raw id)
          c.shooterLive = r.sh ?? (r.k === 'fishHook' ? { p: p.data } : null); // the arrow's shooter for its 5 tick skip (clientHitContext), the hook's angler (hookEnv)
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
    const arrows = [], balls = [], hooks = [], falling = []; // b89 mpobjects89: + falling
    for (const [key, c] of this.copies) {
      let row = this.rowOf.get(key);
      const fresh = !row;
      if (fresh) this.rowOf.set(key, row = { id: Number(key.slice(key.indexOf(':') + 1)), dead: false });
      const spec = c.spec;
      Object.assign(row, { x: c.x, y: c.y, z: c.z, px: c.px, py: c.py, pz: c.pz, yaw: c.yaw, pitch: c.pitch, prevYaw: c.sim?.prevYaw ?? c.yaw, prevPitch: c.sim?.prevPitch ?? c.pitch });
      row.burning = ((c.meta.get(0) ?? 0) & 1) === 1 || (c.sim?.fire > 0);
      if (spec.hook) {
        row.angler = c.angler; row.hook = true;
        hooks.push(row);
      } else if (spec.arrow) {
        row.crit = ((c.meta.get(16) ?? 0) & 1) === 1; row.inGround = !!c.sim?.inGround; row.shake = c.sim?.shake ?? 0;
        arrows.push(row);
      } else if (c.kind === 'falling') { // b89 mpobjects89: falling-block copies (S0E type 70), rows as scene.setFalling draws them: y the box bottom (posY - 0.49), the block of the S0E data
        const yo = spec.yOff; row.y = c.y - yo; row.py = c.py - yo; row.block = c.sim?.block ?? 1; row.meta = c.sim?.meta ?? 0; row.kind = 'falling';
        falling.push(row);
      } else {
        row.kind = c.kind; row.damage = c.damage | 0;
        if (c.kind === 'eyeOfEnder' && !fresh) this.hooks.eyeTrail?.(row, row.x - row.px, row.y - row.py, row.z - row.pz);
        balls.push(row);
      }
    }
    return { arrows, balls, hooks, falling };
  }
}
