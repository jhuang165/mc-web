// Batch 61 (mpdispense): the client copy of what the server's dispensers fired (server-dispense.js).
// `dispEnts` is the whole list of dispensed entities near this player for one tick: { k, i, x, y, z, ...}. k 'a' arrow, 'b' thrown ball or fireball (kind), 't' primed TNT (fuse),
// 'r' firework rocket. RemoteDispense keeps one stable row per id (the renderers key their meshes by the object), moves px/py/pz to the old position each tick, and drops the rows
// the list no longer names; a snowball or egg that vanished plays its poof (Projectiles.clientImpact, EntityThrowable.onUpdate runs onImpact on the client too).
// `dispFx` is the one-shot effects: explode, splash (potion or bottle glass), firework (burst), spark (rocket trail), sound. The hooks do the drawing and playing (main.js).
import { GaussianRandom } from '../projectiles.js';
const ARROW_FIELDS = ['yaw', 'pitch'];

export class RemoteDispense {
  // hooks: sound(name, x, y, z, volume, pitch), explode(x, y, z, size), splash(x, y, z, damage), firework(x, y, z, vx, vy, vz, fireworks), spark(x, y, z, vx, vy, vz), poof(row), eyeTrail(row, vx, vy, vz)
  constructor(hooks = {}) { this.hooks = hooks; this.rows = new Map(); this.arrows = []; this.balls = []; this.primed = []; }
  clear() { this.rows.clear(); this.arrows = []; this.balls = []; this.primed = []; }
  apply(message) {
    if (message.type === 'dispEnts') this.ents(message.ents ?? []);
    else if (message.type === 'dispFx') this.events(message.events ?? []);
    else if (message.type === 'projCollect') for (const t of message.taken ?? []) this.hooks.collect?.(t.i, t.by, Number.isFinite(t.x) && Number.isFinite(t.y) && Number.isFinite(t.z) ? { x: t.x, y: t.y, z: t.z } : null); // b63: the arrow's last place, for the fly-in (its row is already gone from dispEnts) // S0D for an arrow: the pop sound arrives as a dispFx sound
  }
  ents(list) {
    const seen = new Set(), next = { a: [], b: [], t: [] };
    for (const d of list) {
      if (!d || ![d.x, d.y, d.z].every(Number.isFinite)) continue;
      const key = d.k + d.i;
      seen.add(key);
      let row = this.rows.get(key);
      if (!row) { this.rows.set(key, row = { px: d.x, py: d.y, pz: d.z, prevYaw: d.yaw ?? 0, prevPitch: d.pitch ?? 0, shake: 0, dead: false }); }
      else { row.px = row.x; row.py = row.y; row.pz = row.z; row.prevYaw = row.yaw ?? 0; row.prevPitch = row.pitch ?? 0; }
      row.x = d.x; row.y = d.y; row.z = d.z; row.id = d.i;
      if (d.k === 'a') { for (const f of ARROW_FIELDS) row[f] = d[f] ?? 0; row.inGround = !!d.g; row.crit = !!d.c; row.shake = d.s ?? 0; next.a.push(row); }
      else if (d.k === 't') { row.fuse = d.fuse; next.t.push(row); }
      else {
        row.kind = d.k === 'r' ? 'firework' : d.kind; row.damage = d.damage ?? 0;
        if (d.scale !== undefined) { row.scale = d.scale; row.fullbright = true; } // a fire charge: RenderFireball scale, full brightness
        if (d.kind === 'witherSkull') { row.blue = !!d.blue; row.vx = d.vx ?? 0; row.vy = d.vy ?? 0; row.vz = d.vz ?? 0; } // b63: RenderWitherSkull turns the cube to the flight and picks the charged skin
        if (d.kind === 'eyeOfEnder') this.hooks.eyeTrail?.(row, row.x - row.px, row.y - row.py, row.z - row.pz); // b65 mpdragon2: the copy draws the flying eye's portal trail itself (EntityEnderEye.onUpdate)
        next.b.push(row);
      }
    }
    for (const [key, row] of this.rows) if (!seen.has(key)) {
      this.rows.delete(key);
      if (key[0] === 'b' && (row.kind === 'snowball' || row.kind === 'egg' || row.kind === 'enderPearl')) { row.rand ??= new GaussianRandom(Math.floor(Math.random() * 2 ** 48)); this.hooks.poof?.(row); }
    }
    this.arrows = next.a; this.balls = next.b; this.primed = next.t;
  }
  events(list) {
    const h = this.hooks;
    for (const e of list) {
      if (!e || ![e.x, e.y, e.z].every(Number.isFinite)) continue;
      if (e.k === 'explode') h.explode?.(e.x, e.y, e.z, e.size);
      else if (e.k === 'splash') { h.splash?.(e.x, e.y, e.z, e.damage | 0); h.sound?.('game.potion.smash', e.x + .5, e.y + .5, e.z + .5, e.volume ?? 1, e.pitch ?? 1); }
      else if (e.k === 'firework') h.firework?.(e.x, e.y, e.z, e.vx, e.vy, e.vz, e.fireworks ?? null);
      else if (e.k === 'spark') h.spark?.(e.x, e.y, e.z, e.vx, e.vy, e.vz);
      else if (e.k === 'eyeShatter') h.shatter?.(e.x, e.y, e.z); // b64 mpend2: an eye of ender broke (WorldServer.playAuxSFX 2003)
      else if (e.k === 'sound' && SOUNDS.has(e.name)) h.sound?.(e.name, e.x, e.y, e.z, e.volume ?? 1, e.pitch ?? 1);
    }
  }
}
// The sounds a server may ask for here (an arbitrary name from the wire is not played).
const SOUNDS = new Set(['game.tnt.primed', 'fireworks.launch', 'fireworks.blast', 'fireworks.largeBlast', 'fireworks.twinkle', 'random.bowhit', 'random.bow', 'game.neutral.swim.splash', 'random.explode', 'random.click', 'damage.thorns', 'random.pop']);
