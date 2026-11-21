// Batch 61 (mpdispense): the client copy of what the server's dispensers fired (server-dispense.js).
// `dispEnts` is the whole list of dispensed entities near this player for one tick: { k, i, x, y, z, ...}. k 'a' arrow, 'b' thrown ball or fireball (kind), 't' primed TNT (fuse),
// 'r' firework rocket. RemoteDispense keeps one stable row per id (the renderers key their meshes by the object), moves px/py/pz to the old position each tick, and drops the rows
// the list no longer names; a snowball or egg that vanished plays its poof (Projectiles.clientImpact, EntityThrowable.onUpdate runs onImpact on the client too).
// `dispFx` is the one-shot effects: explode, splash (potion or bottle glass), firework (burst), spark (rocket trail), sound. The hooks do the drawing and playing (main.js).
import { GaussianRandom } from '../projectiles.js';
import { s27Decode } from "./server-explosion-packet.js"; // b79 explfx79
import { ThrownCopies } from './thrown-copy.js'; // b84 mpthrown84
import { ballCopyLook } from "./skull-look.js"; // b81 mpcopies81: the skull copy's angles (spawn bytes, own turn, look packets); b82 mpball82: the fireballs' too
const LOOK_BALLS = new Set(['fireball', 'smallFireball', 'witherSkull']);
const ARROW_FIELDS = ['yaw', 'pitch'];

export class RemoteDispense {
  // hooks: sound(name, x, y, z, volume, pitch), explode(x, y, z, size), splash(x, y, z, damage), firework(x, y, z, vx, vy, vz, fireworks), spark(x, y, z, vx, vy, vz), poof(row), eyeTrail(row, vx, vy, vz), ballFx(row),
  // ballWet(row) (b82: Entity.isInWater of a ball row at px/py/pz, for the angles of a row whose copy holds none)
  constructor(hooks = {}) { this.hooks = hooks; this.rows = new Map(); this.arrows = []; this.balls = []; this.primed = []; this.copies = null; this.falling = []; /* b89 mpobjects89: falling-block copies */ }
  clear() { this.rows.clear(); this.arrows = []; this.balls = []; this.primed = []; this.falling = []; this.copies?.clear(); }
  apply(message) {
    if (message.type === 'dispEnts') {
      this.ents(message.ents ?? []);
      this.falling = []; // b89 mpobjects89: the falling-block copies of this message (thrown-copy.js lists)
      // b84 mpthrown84: tracker rows (`trk`) for arrows, thrown balls, rockets and eyes; the copies update first, then take the packets (thrown-copy.js). Old rows (`ents`) still work.
      if (message.trk || this.copies?.size) {
        this.copies ??= new ThrownCopies({ particle: this.hooks.copyParticle, firework: this.hooks.firework, eyeTrail: this.hooks.eyeTrail, balls: this.hooks.copyBalls, targets: this.hooks.copyTargets, refOf: this.hooks.copyRefOf, hasAngler: this.hooks.copyHasAngler });
        const { arrows, balls, hooks, falling } = this.copies.tick(message.trk, this.hooks.copyWorld?.() ?? null, this.hooks.copyPlayer?.() ?? null);
        this.arrows = [...this.arrows, ...arrows]; this.balls = [...this.balls, ...balls];
        this.hooks.fishHooks?.(hooks); // b85 mphook85: the fishing hook copies (client-fishing.js `lane`)
        this.falling = falling ?? []; // b89 mpobjects89
      }
    }
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
      if (row?.lingered) { this.rows.delete(key); row = null; } // b81 blast81: S13 came and went; a ball seen again is a new spawn (a new copy, motion 0)
      const fresh = !row; // b81 mpcopies81 (after blast81's lingered reset, so a re-seen skull starts a new look)
      if (!row) { this.rows.set(key, row = { px: d.x, py: d.y, pz: d.z, prevYaw: d.yaw ?? 0, prevPitch: d.pitch ?? 0, shake: 0, dead: false }); }
      else { row.px = row.x; row.py = row.y; row.pz = row.z; row.prevYaw = row.yaw ?? 0; row.prevPitch = row.pitch ?? 0; }
      row.x = d.x; row.y = d.y; row.z = d.z; row.id = d.i; row.burning = d.f === 1; // b81 throwfire81: the server's fire flag (Entity.isBurning) for the flames
      if (d.k === 'a') { for (const f of ARROW_FIELDS) row[f] = d[f] ?? 0; row.inGround = !!d.g; row.crit = !!d.c; row.shake = d.s ?? 0; next.a.push(row); }
      else if (d.k === 't') { row.fuse = d.fuse; next.t.push(row); }
      else {
        row.kind = d.k === 'r' ? 'firework' : d.kind; row.damage = d.damage ?? 0;
        if (d.scale !== undefined) { row.scale = d.scale; row.fullbright = true; } // a fire charge: RenderFireball scale, full brightness
        if (d.kind === 'witherSkull') { row.blue = !!d.blue; row.vx = d.vx ?? 0; row.vy = d.vy ?? 0; row.vz = d.vz ?? 0; } // b63: RenderWitherSkull turns the cube to the flight and picks the charged skin
        if (d.kind === 'eyeOfEnder') this.hooks.eyeTrail?.(row, row.x - row.px, row.y - row.py, row.z - row.pz); // b65 mpdragon2: the copy draws the flying eye's portal trail itself (EntityEnderEye.onUpdate)
        if (d.k === 'b') row.track = d.t ?? null; // b81 blast81: a fireball's or skull's tracker packets (fireball-copy.js): the copy flies itself and the row takes its place
        if (d.k === 'b') this.hooks.ballFx?.(row); // b80 mpfx80: a fireball's or wither skull's client copy draws its own smoke and bubbles (ze.h, client-explosion.js clientBallFx)
        // b81 mpcopies81 / b82 mpball82: the angles of a ball row whose copy holds none (a batch 81 server's six-field `s`, or no ballFx hook): the row's own turn on the S0E
        // speed fields, with water's 0.8 (skull-look.js ballCopyLook). A copy built from an angle-bearing `s` turns itself (fireball-copy.js flyBallRow).
        if (d.k === 'b' && LOOK_BALLS.has(d.kind) && !row.copy?.angles) ballCopyLook(row, d, fresh, { wet: !fresh && !!this.hooks.ballWet?.(row) });
        next.b.push(row);
      }
    }
    for (const [key, row] of this.rows) if (!seen.has(key)) {
      // b81 blast81: the server's S13 for a dead ball goes out at the players' next onUpdate and the client updates its entities before a tick's packets, so the copy has two
      // more updates (smokes): one in the message where its row is gone (still drawn), one in the next (the S13 then ends it, not drawn) (fireball-copy.js)
      if (row.copy && !row.lingered) { row.lingered = true; row.track = { p: [] }; this.hooks.ballFx?.(row); next.b.push(row); continue; }
      if (row.copy && row.lingered === true) { row.track = { p: [] }; this.hooks.ballFx?.(row); }
      this.rows.delete(key);
      if (key[0] === 'b' && (row.kind === 'snowball' || row.kind === 'egg' || row.kind === 'enderPearl')) { row.rand ??= new GaussianRandom(Math.floor(Math.random() * 2 ** 48)); this.hooks.poof?.(row); }
    }
    this.arrows = next.a; this.balls = next.b; this.primed = next.t;
  }
  events(list) {
    const h = this.hooks;
    for (const e of list) {
      if (!e || ![e.x, e.y, e.z].every(Number.isFinite)) continue;
      if (e.k === 'explode') { h.explode?.(e.x, e.y, e.z, e.size, s27Decode(e.x, e.y, e.z, e.bl)); if ([e.mx, e.my, e.mz].every(Number.isFinite)) h.knock?.(Math.fround(e.mx), Math.fround(e.my), Math.fround(e.mz)); } // b78: S27 handleExplosion: effects, then motion += the floats
      else if (e.k === 'splash') { h.splash?.(e.x, e.y, e.z, e.damage | 0); h.sound?.('game.potion.smash', e.x + .5, e.y + .5, e.z + .5, e.volume ?? 1, e.pitch ?? 1); }
      else if (e.k === 'firework') h.firework?.(e.x, e.y, e.z, e.vx, e.vy, e.vz, e.fireworks ?? null);
      else if (e.k === 'spark') h.spark?.(e.x, e.y, e.z, e.vx, e.vy, e.vz);
      else if (e.k === 'eyeShatter') h.shatter?.(e.x, e.y, e.z); // b64 mpend2: an eye of ender broke (WorldServer.playAuxSFX 2003)
      else if (e.k === 'spawnerBurst') h.spawnerBurst?.(e.x, e.y, e.z); // b65 mpspawners2: WorldServer.playAuxSFX 2004 (a spawner spawned a mob)
      else if (e.k === 'spawnerDelay') h.spawnerDelay?.(e.x, e.y, e.z, typeof e.v === 'string' ? e.v : null); // b65: the spawner's block event 1 (a cart's entity status 1)
      else if (e.k === 'spawnerPuff') h.spawnerPuff?.(e.x, e.y, e.z, e.w, e.h); // b65: entity status 20 on the spawned mob
      else if (e.k === 'sound' && SOUNDS.has(e.name)) h.sound?.(e.name, e.x, e.y, e.z, e.volume ?? 1, e.pitch ?? 1);
    }
  }
}
// The sounds a server may ask for here (an arbitrary name from the wire is not played).
const SOUNDS = new Set(['game.tnt.primed', 'fireworks.launch', 'fireworks.blast', 'fireworks.largeBlast', 'fireworks.twinkle', 'random.bowhit', 'random.bow', 'game.neutral.swim.splash', 'random.explode', 'random.click', 'damage.thorns', 'random.pop']);
