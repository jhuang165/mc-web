// EntityLargeFireball (zg), EntitySmallFireball (zi) and EntityFireball (ze) inside EntityWorld: the flight, the block and entity sweep, the
// impact and the player's deflecting punch. The rules are in blaze-ghast.js (replayed against blaze-ghast-reference.json); this file wires
// them to the engine's mobs, player and event queue. EntityWorld.tick calls `_fireballs.tick()`; main.js draws `balls` with the other
// projectiles (projectile-renderer.js draws kind "fireball" / "smallFireball" as the fire charge item at scale 2 and 0.5, fullbright).
import { JavaRandom } from "./java-random.js";
import { intercept, rayTraceBlocks } from "./projectiles.js";
import { pushBox } from "./entities.js";
import { FIREBALL, fireballAcceleration, fireballStep, deflect, faceCell } from "./blaze-ghast.js";
import { gameRule } from "./game-rules.js";

const f = Math.fround;
// Entity.isImmuneToFire of the mobs that exist or will exist in this build.
export const FIRE_IMMUNE = new Set(["blaze", "ghast", "magma_cube", "zombie_pigman", "wither_skeleton", "wither"]);
// ze.h: the sweep grows each candidate box by this (getCollisionBorderSize 0.3 for the mob; the player's pick uses 1.0 for the fireball).
const SWEEP = 0.3, PICK_BORDER = 1;
const seedOf = (mobs) => Math.floor(mobs.random() * 2 ** 48);

export class Fireballs {
  constructor(mobs) {
    this.mobs = mobs;
    this.list = [];
    this.next = 1;
  }
  // Draw rows for the projectile renderer: the live balls.
  get balls() { return this.list; }
  find(id) { return this.list.find((b) => b.id === id && !b.dead) ?? null; }
  // EntityFireball(world, shooter, dx, dy, dz) at (x, y, z): the aim gets 0.4 * gaussian per axis (x, y, z) on the ball's own Random, then
  // acceleration = aim / |aim| * 0.1. `exact` is the (world, x, y, z, ax, ay, az) form of the dispenser: the acceleration as given.
  launch({ large, owner = null, x, y, z, dx = 0, dy = 0, dz = 0, power = FIREBALL.defaultPower, exact = null }) {
    const rand = new JavaRandom(seedOf(this.mobs));
    const [ax, ay, az] = exact ?? fireballAcceleration(dx, dy, dz, rand);
    const ball = {
      id: "fb-" + this.next++, type: "fireball", kind: large ? "fireball" : "smallFireball", large: !!large, owner, health: 1,
      x, y, z, px: x, py: y, pz: z, vx: 0, vy: 0, vz: 0, ax, ay, az, power, ticks: 0, dead: false,
      scale: large ? 2 : 0.5, fullbright: true, width: large ? FIREBALL.largeSize : FIREBALL.smallSize,
    };
    this.list.push(ball);
    return ball;
  }
  // The shooter is "dead" (setDead) when it is gone from the world: ze.h removes the ball then.
  ownerGone(b) {
    const o = b.owner;
    return !!o && o !== "player" && (!this.mobs.entities.includes(o) || (o.health <= 0 && (o.death ?? 0) >= 20));
  }
  tick() {
    const mobs = this.mobs;
    for (const b of this.list) {
      if (b.dead) continue;
      b.px = b.x; b.py = b.y; b.pz = b.z;
      if (this.ownerGone(b)) { b.dead = true; continue; }
      b.ticks++;
      mobs.fx?.spawn("smoke", b.x, b.y + 0.5, b.z, 0, 0, 0);
      const start = [b.x, b.y, b.z], end = [b.x + b.vx, b.y + b.vy, b.z + b.vz];
      let hit = rayTraceBlocks(mobs.world, start, end), stop = hit ? hit.vec : end;
      const entity = this.sweep(b, start, stop);
      if (entity) hit = { entity: entity.target };
      if (hit) { this.impact(b, hit); continue; }
      const water = mobs.world.get(Math.floor(b.x), Math.floor(b.y), Math.floor(b.z));
      fireballStep(b, water >= 8 && water <= 9);
    }
    this.list = this.list.filter((b) => !b.dead);
  }
  // ze.h's entity pass: every collidable entity box grown by 0.3 against the swept segment, the shooter skipped for 25 ticks; nearest wins.
  sweep(b, a, z) {
    const mobs = this.mobs, boxes = [];
    for (const e of mobs.entities) if (e.health > 0 && !(e === b.owner && b.ticks < FIREBALL.ownerGrace)) boxes.push({ target: e, box: pushBox(e, ...mobs.size(e)) });
    const p = mobs.ai?.player;
    if (p?.alive && !(b.owner === "player" && b.ticks < FIREBALL.ownerGrace)) boxes.push({ target: { player: true }, box: pushBox(p, p.width, p.height) });
    let best = null, bd = Infinity;
    for (const c of boxes) {
      const g = SWEEP, box = [c.box[0] - g, c.box[1] - g, c.box[2] - g, c.box[3] + g, c.box[4] + g, c.box[5] + g], r = intercept(box, a, z);
      if (!r) continue;
      const d = (r.vec[0] - a[0]) ** 2 + (r.vec[1] - a[1]) ** 2 + (r.vec[2] - a[2]) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  // zg.a(azu) / zi.a(azu), then setDead.
  impact(b, hit) {
    const mobs = this.mobs, owner = b.owner, byPlayer = owner === "player", from = byPlayer ? mobs.ai?.player : owner;
    const damage = (n) => {
      const t = hit.entity;
      if (t?.player) {
        const s = mobs.ai?.survival;
        return !!s && s.damage(n, "fireball", true, "fireball");
      }
      return mobs.damage(t, n, from?.x ?? b.x, from?.z ?? b.z, byPlayer, null, { name: "fireball", fireball: true, player: byPlayer });
    };
    if (b.large) {
      if (hit.entity) damage(FIREBALL.largeDamage);
      // The explosion is the world's (no exploder): the fireball's own position, `flaming`, and `smoking` while mobGriefing is on.
      mobs.events.push({ explode: { x: b.x, y: b.y, z: b.z, size: b.power, source: null, smoking: gameRule("mobGriefing"), flaming: true }, position: { x: b.x, y: b.y, z: b.z } });
    } else if (hit.entity) {
      const t = hit.entity;
      if (t.player) {
        if (damage(FIREBALL.smallDamage)) mobs.ai?.survival?.setFire(FIREBALL.smallFireSeconds);
      } else if (!FIRE_IMMUNE.has(t.type) && damage(FIREBALL.smallDamage)) t.fire = Math.max(t.fire || 0, FIREBALL.smallFireSeconds * 20);
    } else {
      const [x, y, z] = faceCell(...hit.block, hit.side);
      if (mobs.world.get(x, y, z) === 0) mobs.ignite?.(x, y, z);
    }
    b.dead = true;
  }
  // The first ball a player's ray meets, grown by the collision border 1.0 (ze.ao), nearer than `wallDistance`.
  pick(origin, dir, reach, wallDistance = reach) {
    let best = null;
    const o = [origin.x ?? origin[0], origin.y ?? origin[1], origin.z ?? origin[2]], d = [dir.x ?? dir[0], dir.y ?? dir[1], dir.z ?? dir[2]], limit = Math.min(reach, wallDistance);
    for (const b of this.list) {
      if (b.dead || !b.large) continue;
      const h = b.width / 2 + PICK_BORDER, box = [b.x - h, b.y - PICK_BORDER, b.z - h, b.x + h, b.y + b.width + PICK_BORDER, b.z + h];
      const r = intercept(box, o, [o[0] + d[0] * limit, o[1] + d[1] * limit, o[2] + d[2] * limit]);
      if (!r) continue;
      const dist = Math.hypot(r.vec[0] - o[0], r.vec[1] - o[1], r.vec[2] - o[2]);
      if (!best || dist < best.distance) best = { entity: b, distance: dist };
    }
    return best;
  }
  // ze.a(ro, F): a player's hit takes the ball: its motion becomes the look vector, the acceleration look * 0.1 and the player the shooter.
  punch(b, look) {
    if (b.dead) return false;
    deflect(b, look);
    b.owner = "player";
    b.ticks = 0;
    return true;
  }
  serialize() { return []; }
}
