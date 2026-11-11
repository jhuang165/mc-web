// Minecraft Java 1.7.10 fishing: EntityFishHook (xe), ItemFishingRod (acv), ItemFishFood (act/acu)
// and WeightedRandomFishable (xf). Evidence: public/research/fishing-reference.json (written by
// tools/verify-fishing.mjs, which runs the unchanged classes against seeded Random doubles) and
// public/research/fishing.md. This module is pure: the caller supplies the world and the player.
//
// Native item ids are used for the loot tables; fishing-content.js maps them to this build's ids.
import { JavaRandom } from './java-random.js';
import { GaussianRandom, heading, intercept, rayTraceBlocks } from './projectiles.js';
import { moveEntity } from './entities.js';
import { mhSin, mhCos } from './lighting.js';
import { itemInfo, addRandomEnchantment } from './enchantments.js';

const f = Math.fround;
const PI_F = f(Math.PI), PI_D = 3.1415927410125732, RAD = f(0.017453292);
const WATER = 10; // internal water block (fluids.js)

export const WIDTH = f(0.25), ROD_DURABILITY = 64;
export const LOST_DISTANCE_SQ = 1024;

// WeightedRandomFishable lists (xe.d junk, xe.e treasure, xe.f fish): [weight, native id, count,
// damage, damagedFraction, enchanted]. A damaged fraction picks a random wear (xf.a).
export const JUNK = [
  [10, 301, 1, 0, 0.9, false], [10, 334, 1, 0, 0, false], [10, 352, 1, 0, 0, false], [10, 373, 1, 0, 0, false],
  [5, 287, 1, 0, 0, false], [2, 346, 1, 0, 0.9, false], [10, 281, 1, 0, 0, false], [5, 280, 1, 0, 0, false],
  [1, 351, 10, 0, 0, false], [10, 131, 1, 0, 0, false], [10, 367, 1, 0, 0, false],
];
export const TREASURE = [
  [1, 111, 1, 0, 0, false], [1, 421, 1, 0, 0, false], [1, 329, 1, 0, 0, false],
  [1, 261, 1, 0, 0.25, true], [1, 346, 1, 0, 0.25, true], [1, 340, 1, 0, 0, true],
];
export const FISH = [[60, 349, 1, 0, 0, false], [25, 349, 1, 1, 0, false], [2, 349, 1, 2, 0, false], [13, 349, 1, 3, 0, false]];
export const STAT = { junk: 'stat.junkFished', treasure: 'stat.treasureFished', fish: 'stat.fishCaught' };

// ItemFishFood.FishType (acu): raw and cooked heal and saturation; only cod and salmon cook.
export const FISH_TYPES = [
  { meta: 0, name: 'cod', raw: [2, f(0.1)], cooked: [5, f(0.6)] },
  { meta: 1, name: 'salmon', raw: [2, f(0.1)], cooked: [6, f(0.8)] },
  { meta: 2, name: 'clownfish', raw: [1, f(0.1)], cooked: null },
  { meta: 3, name: 'pufferfish', raw: [1, f(0.1)], cooked: null },
];
// ItemFishFood.onFoodEaten for a pufferfish: [potion id, duration ticks, amplifier] (Poison, Hunger, Nausea).
export const PUFFERFISH_EFFECTS = [[19, 1200, 3], [17, 300, 2], [9, 300, 1]];

// MathHelper.getRandomIntegerInRange (qh.a(Random, I, I)) and randomFloatClamp (qh.a(Random, F, F)).
const intRange = (r, lo, hi) => (lo >= hi ? lo : r.nextInt(hi - lo + 1) + lo);
const floatClamp = (r, lo, hi) => (lo >= hi ? lo : f(f(r.nextFloat() * f(hi - lo)) + lo));
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// WeightedRandom.getRandomItem (qv.a): one nextInt over the total weight.
export function weightedPick(rand, table) {
  let n = rand.nextInt(table.reduce((s, e) => s + e[0], 0));
  for (const e of table) if ((n -= e[0]) < 0) return e;
  return null;
}
// WeightedRandomFishable.func_150708_a (xf.a): the stack, with random wear and enchantments.
export function makeFishable(rand, [, id, count, damage, damaged, enchanted]) {
  const stack = { id, count, damage };
  if (damaged > 0) {
    const i = Math.trunc(f(f(damaged) * itemInfo(id).maxDamage));
    let j = itemInfo(id).maxDamage - rand.nextInt(rand.nextInt(i) + 1);
    if (j > i) j = i;
    if (j < 1) j = 1;
    stack.damage = j;
  }
  if (enchanted) addRandomEnchantment(rand, stack, 30);
  return stack;
}
// EntityFishHook.func_146033_f (xe.f): junk with chance 0.1 - 0.025 luck - 0.01 lure, then treasure with
// 0.05 + 0.01 luck - 0.01 lure of the rest (both clamped), otherwise a fish. The first roll is World.rand;
// the weighted picks and wear/enchantments use the hook's own Entity.rand. Returns { stack, kind }.
export function rollFishable(worldRand, rand, luck, lure) {
  let r = worldRand.nextFloat();
  const junk = clamp(f(f(f(0.1) - f(luck * f(0.025))) - f(lure * f(0.01))), 0, 1),
    treasure = clamp(f(f(f(0.05) + f(luck * f(0.01))) - f(lure * f(0.01))), 0, 1);
  if (r < junk) return { kind: 'junk', stack: makeFishable(rand, weightedPick(rand, JUNK)) };
  r = f(r - junk);
  if (r < treasure) return { kind: 'treasure', stack: makeFishable(rand, weightedPick(rand, TREASURE)) };
  return { kind: 'fish', stack: makeFishable(rand, weightedPick(rand, FISH)) };
}

// Minecraft degrees from this build's yaw/pitch radians (see projectiles.js launch()).
export const mcAngles = (yaw, pitch) => ({ yaw: f(180 - (yaw * 180) / Math.PI), pitch: f((-pitch * 180) / Math.PI) });

// World.isAABBInMaterial(box, water) (ahb.b(azt, awt)): any water cell in the box's cell range whose
// surface (y + 1 - meta/8 for meta < 8) reaches the box's bottom.
function boxInWater(world, [x0, y0, z0, x1, y1, z1]) {
  const ax = Math.floor(x0), bx = Math.floor(x1 + 1), ay = Math.floor(y0), by = Math.floor(y1 + 1), az = Math.floor(z0), bz = Math.floor(z1 + 1);
  for (let x = ax; x < bx; x++)
    for (let y = ay; y < by; y++)
      for (let z = az; z < bz; z++) {
        if (world.get(x, y, z) !== WATER) continue;
        const meta = world.getMeta(x, y, z);
        let top = y + 1;
        if (meta < 8) top = y + 1 - meta / 8;
        if (top >= y0) return true;
      }
  return false;
}
export const setBox = (e) => {
  const h = f(WIDTH / 2);
  e.bb = [e.x - h, e.y, e.z - h, e.x + h, e.y + WIDTH, e.z + h];
};

// EntityFishHook. `rand` is its Entity.rand (nextFloat/nextInt/nextGaussian); world.rand is passed to
// retrieve(). The hook never counts as in water (handleWaterMovement shrinks its 0.25 box by 0.8), keeps
// the xTile/yTile/zTile = 0 and inTile = null of a fresh entity (so a landed hook is released and
// re-lands each tick), and despawns only when the player stops holding the rod or is over 32 blocks away.
export class FishHook {
  constructor(rand = new GaussianRandom(Math.floor(Math.random() * 2 ** 48))) {
    this.rand = rand;
    Object.assign(this, {
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, px: 0, py: 0, pz: 0, yaw: 0, pitch: 0, prevYaw: 0, prevPitch: 0,
      onGround: false, collidedH: false, fallDistance: 0, shake: 0, inGround: false, ticksInGround: 0, ticksInAir: 0,
      ticksCatchable: 0, ticksCaughtDelay: 0, ticksCatchableDelay: 0, fishApproachAngle: 0, hooked: null, dead: false,
    });
  }
  // EntityFishHook(World, EntityPlayer) (xe.<init>): `player` is { x, y, z (feet), yaw, pitch } in Minecraft
  // degrees, `yOffset` the player's Entity.yOffset (0 on the integrated server's EntityPlayerMP).
  static cast(rand, player, yOffset = 0) {
    const h = new FishHook(rand);
    h.x = player.x;
    h.y = player.y + 1.62 - yOffset;
    h.z = player.z;
    h.yaw = h.prevYaw = player.yaw;
    h.pitch = h.prevPitch = player.pitch;
    const k = f(f(h.yaw / 180) * PI_F), p = f(f(h.pitch / 180) * PI_F);
    h.x -= f(mhCos(k) * f(0.16));
    h.y -= 0.10000000149011612;
    h.z -= f(mhSin(k) * f(0.16));
    const power = f(0.4);
    const d = heading(rand, f(f(-mhSin(k) * mhCos(p)) * power), f(-mhSin(p) * power), f(f(mhCos(k) * mhCos(p)) * power), 1.5, 1);
    h.vx = d.mx; h.vy = d.my; h.vz = d.mz;
    h.yaw = h.prevYaw = d.yaw;
    h.pitch = h.prevPitch = d.pitch;
    h.ticksInGround = 0;
    h.px = h.x; h.py = h.y; h.pz = h.z;
    setBox(h);
    return h;
  }
  // EntityFishHook.onUpdate (xe.h). `env`:
  //   world { get, getMeta, solid }, player { x, y, z, valid (alive and holding the rod), luck, lure },
  //   canLightningStrike(x, y, z), canSeeSky(x, y, z), sound(name, volume, pitch),
  //   particle(name, x, y, z, count, dx, dy, dz, speed), worldRand,
  //   entities(box) -> [{ ref, box, angler }] of collidable entities near the box,
  //   hitEntity(ref) -> boolean (attackEntityFrom with 0 thrown damage), entityState(ref) -> { x, z, minY, height } | null.
  // Returns true while the hook lives.
  tick(env) {
    if (this.dead) return false;
    const { world } = env, rand = this.rand, p = env.player;
    // Entity.onEntityUpdate
    this.px = this.x; this.py = this.y; this.pz = this.z;
    this.prevPitch = this.pitch;
    this.prevYaw = this.yaw;
    if (this.y < -64) { this.dead = true; return false; }
    const dx = this.x - p.x, dy = this.y - p.y, dz = this.z - p.z;
    // the angler check, the hooked entity, the entity search and the fish timers are all under !isRemote (env.remote: a client's copy)
    if (!env.remote && (!p.valid || dx * dx + dy * dy + dz * dz > LOST_DISTANCE_SQ)) { this.dead = true; return false; }
    if (this.hooked !== null && !env.remote) {
      const s = env.entityState?.(this.hooked);
      if (s) {
        this.x = s.x;
        this.y = s.minY + f(s.height) * 0.8;
        this.z = s.z;
        return true;
      }
      this.hooked = null;
    }
    if (this.shake > 0) this.shake--;
    // inTile is null, so the block at (0, 0, 0) never equals it: a landed hook is released at once.
    if (this.inGround) {
      this.inGround = false;
      this.vx *= rand.nextFloat() * f(0.2);
      this.vy *= rand.nextFloat() * f(0.2);
      this.vz *= rand.nextFloat() * f(0.2);
      this.ticksInGround = 0;
      this.ticksInAir = 0;
    } else this.ticksInAir++;

    let start = [this.x, this.y, this.z], end = [this.x + this.vx, this.y + this.vy, this.z + this.vz];
    const block = rayTraceBlocks(world, start, end);
    start = [this.x, this.y, this.z];
    end = block ? [...block.vec] : [this.x + this.vx, this.y + this.vy, this.z + this.vz];
    const bb = this.bb;
    const area = [
      bb[0] + Math.min(0, this.vx) - 1, bb[1] + Math.min(0, this.vy) - 1, bb[2] + Math.min(0, this.vz) - 1,
      bb[3] + Math.max(0, this.vx) + 1, bb[4] + Math.max(0, this.vy) + 1, bb[5] + Math.max(0, this.vz) + 1,
    ];
    let target = null, d0 = 0;
    const grow = f(0.3);
    for (const e of (env.remote ? [] : env.entities?.(area) ?? [])) {
      if (e.angler && this.ticksInAir < 5) continue;
      const b = e.box, r = intercept([b[0] - grow, b[1] - grow, b[2] - grow, b[3] + grow, b[4] + grow, b[5] + grow], start, end);
      if (!r) continue;
      const d = Math.sqrt((r.vec[0] - start[0]) ** 2 + (r.vec[1] - start[1]) ** 2 + (r.vec[2] - start[2]) ** 2);
      if (d < d0 || d0 === 0) { target = e; d0 = d; }
    }
    if (target) {
      if (env.hitEntity?.(target.ref) ?? true) this.hooked = target.ref;
    } else if (block) this.inGround = true;

    if (!this.inGround) this.fly(env);
    return !this.dead;
  }
  // The airborne half of xe.h: moveEntity, rotation smoothing, water slices, the catch timer and drag.
  fly(env) {
    const { world } = env, rand = this.rand, p = env.player;
    moveEntity(world, this, WIDTH, WIDTH, this.vx, this.vy, this.vz, 0);
    const flat = f(Math.sqrt(this.vx * this.vx + this.vz * this.vz));
    this.yaw = f((Math.atan2(this.vx, this.vz) * 180) / PI_D);
    this.pitch = f((Math.atan2(this.vy, flat) * 180) / PI_D);
    while (f(this.pitch - this.prevPitch) < -180) this.prevPitch = f(this.prevPitch - 360);
    while (f(this.pitch - this.prevPitch) >= 180) this.prevPitch = f(this.prevPitch + 360);
    while (f(this.yaw - this.prevYaw) < -180) this.prevYaw = f(this.prevYaw - 360);
    while (f(this.yaw - this.prevYaw) >= 180) this.prevYaw = f(this.prevYaw + 360);
    this.pitch = f(this.prevPitch + f(f(this.pitch - this.prevPitch) * f(0.2)));
    this.yaw = f(this.prevYaw + f(f(this.yaw - this.prevYaw) * f(0.2)));
    let drag = f(0.92);
    if (this.onGround || this.collidedH) drag = f(0.5);
    const bb = this.bb;
    let wet = 0;
    for (let k = 0; k < 5; k++) {
      const lo = bb[1] + ((bb[4] - bb[1]) * k) / 5 - 0.125 + 0.125, hi = bb[1] + ((bb[4] - bb[1]) * (k + 1)) / 5 - 0.125 + 0.125;
      if (boxInWater(world, [bb[0], lo, bb[2], bb[3], hi, bb[5]])) wet += 1 / 5;
    }
    if (wet > 0 && !env.remote) {
      const cx = Math.floor(this.x), cy = Math.floor(this.y), cz = Math.floor(this.z);
      let l = 1;
      if (rand.nextFloat() < f(0.25) && env.canLightningStrike(cx, cy + 1, cz)) l = 2;
      if (rand.nextFloat() < f(0.5) && !env.canSeeSky(cx, cy + 1, cz)) l--;
      const surface = f(f(Math.floor(this.bb[1])) + 1);
      if (this.ticksCatchable > 0) {
        this.ticksCatchable--;
        if (this.ticksCatchable <= 0) { this.ticksCaughtDelay = 0; this.ticksCatchableDelay = 0; }
      } else if (this.ticksCatchableDelay > 0) {
        this.ticksCatchableDelay -= l;
        if (this.ticksCatchableDelay <= 0) {
          this.vy -= 0.20000000298023224;
          env.sound('random.splash', f(0.25), f(1 + f(f(rand.nextFloat() - rand.nextFloat()) * f(0.4))));
          const n = Math.trunc(f(1 + f(WIDTH * 20)));
          env.particle('bubble', this.x, surface, this.z, n, WIDTH, 0, WIDTH, 0.20000000298023224);
          env.particle('wake', this.x, surface, this.z, n, WIDTH, 0, WIDTH, 0.20000000298023224);
          this.ticksCatchable = intRange(rand, 10, 30);
        } else {
          this.fishApproachAngle = f(this.fishApproachAngle + rand.nextGaussian() * 4);
          const a = f(this.fishApproachAngle * RAD), s = mhSin(a), c = mhCos(a),
            px = this.x + f(f(s * f(this.ticksCatchableDelay)) * f(0.1)), py = surface,
            pz = this.z + f(f(c * f(this.ticksCatchableDelay)) * f(0.1));
          if (rand.nextFloat() < f(0.15)) env.particle('bubble', px, py - 0.10000000149011612, pz, 1, s, 0.1, c, 0);
          const s4 = f(s * f(0.04)), c4 = f(c * f(0.04));
          env.particle('wake', px, py, pz, 0, c4, 0.01, -s4, 1);
          env.particle('wake', px, py, pz, 0, -c4, 0.01, s4, 1);
        }
      } else if (this.ticksCaughtDelay > 0) {
        this.ticksCaughtDelay -= l;
        let chance = f(0.15);
        if (this.ticksCaughtDelay < 20) chance = f(chance + 0.05 * (20 - this.ticksCaughtDelay));
        else if (this.ticksCaughtDelay < 40) chance = f(chance + 0.02 * (40 - this.ticksCaughtDelay));
        else if (this.ticksCaughtDelay < 60) chance = f(chance + 0.01 * (60 - this.ticksCaughtDelay));
        if (rand.nextFloat() < chance) {
          const a = f(floatClamp(rand, 0, 360) * RAD), dist = floatClamp(rand, 25, 60);
          const px = this.x + f(f(mhSin(a) * dist) * f(0.1)), pz = this.z + f(f(mhCos(a) * dist) * f(0.1));
          env.particle('splash', px, surface, pz, 2 + rand.nextInt(2), 0.10000000149011612, 0, 0.10000000149011612, 0);
        }
        if (this.ticksCaughtDelay <= 0) {
          this.fishApproachAngle = floatClamp(rand, 0, 360);
          this.ticksCatchableDelay = intRange(rand, 20, 80);
        }
      } else {
        this.ticksCaughtDelay = intRange(rand, 100, 900) - p.lure * 20 * 5;
      }
      if (this.ticksCatchable > 0) this.vy -= f(f(f(rand.nextFloat() * rand.nextFloat()) * rand.nextFloat())) * 0.2;
    }
    this.vy += 0.03999999910593033 * (wet * 2 - 1);
    if (wet > 0) {
      drag = f(f(drag) * 0.9);
      this.vy *= 0.8;
    }
    this.vx *= drag; this.vy *= drag; this.vz *= drag;
    setBox(this);
  }
  // EntityFishHook.func_146034_e (xe.e), ItemFishingRod's reel-in: pulls a hooked entity to the player (3),
  // or lands the bite (1) as an item thrown toward the player plus a 1-6 experience orb at the player's
  // feet + 0.5, and adds 2 when the hook sits in the ground. The hook is then removed. `env.worldRand` is
  // World.rand; `env.player` { x, y, z, luck, lure }. Returns { cost, pull, drop, orb, stat, kind }.
  retrieve(env) {
    const p = env.player, rand = this.rand, out = { cost: 0, pull: null, drop: null, orb: 0, stat: null, kind: null };
    const toward = () => {
      const dx = p.x - this.x, dy = p.y - this.y, dz = p.z - this.z, d = f(Math.sqrt(dx * dx + dy * dy + dz * dz));
      return [dx * 0.1, dy * 0.1 + f(Math.sqrt(d)) * 0.08, dz * 0.1];
    };
    if (this.hooked !== null) {
      out.pull = { ref: this.hooked, add: toward() };
      out.cost = 3;
    } else if (this.ticksCatchable > 0) {
      const r = rollFishable(env.worldRand, rand, p.luck, p.lure), v = toward();
      out.drop = { stack: r.stack, x: this.x, y: this.y, z: this.z, vx: v[0], vy: v[1], vz: v[2] };
      out.orb = rand.nextInt(6) + 1;
      out.stat = STAT[r.kind];
      out.kind = r.kind;
      out.cost = 1;
    }
    if (this.inGround) out.cost += 2;
    this.dead = true;
    return out;
  }
  // Save/load of the runtime state (the hooked entity is not kept: the reference is to a live mob).
  serialize() {
    const { x, y, z, vx, vy, vz, yaw, pitch, prevYaw, prevPitch, shake, inGround, ticksInGround, ticksInAir, ticksCatchable, ticksCaughtDelay, ticksCatchableDelay, fishApproachAngle, onGround, collidedH } = this;
    return { x, y, z, vx, vy, vz, yaw, pitch, prevYaw, prevPitch, shake, inGround, ticksInGround, ticksInAir, ticksCatchable, ticksCaughtDelay, ticksCatchableDelay, fishApproachAngle, onGround, collidedH, rand: this.rand.save?.() };
  }
  static load(data, rand) {
    if (!data || ![data.x, data.y, data.z, data.vx, data.vy, data.vz].every(Number.isFinite)) return null;
    const h = new FishHook(rand);
    const num = (k, d = 0) => (Number.isFinite(data[k]) ? data[k] : d), int = (k) => Math.trunc(num(k));
    Object.assign(h, {
      x: data.x, y: data.y, z: data.z, vx: data.vx, vy: data.vy, vz: data.vz, yaw: f(num('yaw')), pitch: f(num('pitch')),
      prevYaw: f(num('prevYaw')), prevPitch: f(num('prevPitch')), shake: int('shake'), inGround: !!data.inGround, ticksInGround: int('ticksInGround'),
      ticksInAir: int('ticksInAir'), ticksCatchable: int('ticksCatchable'), ticksCaughtDelay: int('ticksCaughtDelay'),
      ticksCatchableDelay: int('ticksCatchableDelay'), fishApproachAngle: f(num('fishApproachAngle')), onGround: !!data.onGround, collidedH: !!data.collidedH,
    });
    h.px = h.x; h.py = h.y; h.pz = h.z;
    if (data.rand && rand?.restore) rand.restore(data.rand);
    setBox(h);
    return h;
  }
}
export { JavaRandom };
