// Live wiring of the mooshroom and the snow golem (see public/research/mooshroom-golem.md): installs methods on EntityWorld,
// the snow golem's snowballs in flight and its AI task list. Rules are in mooshroom.js and snow-golem.js.
import { Projectiles, heading, mobTargets, thrownHit } from "./projectiles.js";
import { entityRandom, ENTITY_TYPES } from "./entities.js";
import { throwSpawn } from "./witch.js";
import { makeStack } from "./inventory.js";
import { SNOW_LAYER, PUMPKIN, BLOCKS } from "./world.js";
import { snowCanStay } from "./snow.js";
import { biomeTemperatureAt } from "./biomes.js";
import { ironGolemShape } from "./iron-golem.js";
import { mooshroomUse, useBowl, RED_MUSHROOM, SHEAR_MUSHROOMS, SHEARS } from "./mooshroom.js";
import { SNOW_GOLEM, SNOW_BLOCK, IRON_BLOCK, SNOW_GOLEM_TARGETS, snowGolemShape, updateSnowGolem, aimFor } from "./snow-golem.js";
const f = Math.fround, JACK_O_LANTERN = 148;

// The snow golem's EntitySnowballs: a Projectiles of their own, ticked by EntityWorld.tick and drawn with the others.
export class GolemBalls {
  constructor(mobs, random = Math.random) {
    this.mobs = mobs;
    this.projectiles = new Projectiles(random);
  }
  get balls() { return this.projectiles.balls; }
  // EntitySnowman.attackEntityWithRangedAttack (wr.a(sv, F)); `target` is the AI's view of the victim.
  shoot(e, target) {
    const rand = entityRandom(e), at = throwSpawn(e, f((-e.yaw * 180) / Math.PI), SNOW_GOLEM.eyeHeight), rng = this.projectiles.rng(),
      a = aimFor(e, target, at.y), h = heading(rng, a.dx, a.dy, a.dz, SNOW_GOLEM.ballVelocity, SNOW_GOLEM.ballInaccuracy);
    const ball = { ...h, ...at, kind: "snowball", owner: e, px: at.x, py: at.y, pz: at.z, prevYaw: h.yaw, prevPitch: h.pitch, ticks: 0, rand: rng, random: rng, dead: false };
    this.projectiles.balls.push(ball);
    this.mobs.joined?.(ball, "golemBall"); // entity-simulation.js (entityWalkers): the ball's place in World.loadedEntityList
    this.mobs.events.push({ sound: SNOW_GOLEM.shootSound, volume: 1, pitch: f(1 / f(f(rand.nextFloat() * f(0.4)) + f(0.8))), position: { x: e.x, y: e.y, z: e.z } });
  }
  tick() {
    const p = this.projectiles;
    if (!p.balls.length) return;
    for (const b of [...p.balls]) this.tickOne(b);
    this.reap();
  }
  // One snowball's update, where the loaded-entity walk reaches it (entity-simulation.js entityWalkers).
  tickOne(ball, extra = [], vehicleHit = () => {}) {
    const mobs = this.mobs, p = this.projectiles;
    if (ball.dead) return;
    const targets = mobTargets(mobs.entities.filter((e) => e.health > 0), null);
    for (const t of targets) if (t.ref.type === "snow_golem") t.thrower = true;
    targets.push(...extra); // the carts and boats (entity-simulation.js vehicleTargets)
    p.tickOne(mobs.world, ball, targets, (ref, b) => { if (typeof ref?.type === "string") thrownHit(mobs, ref, b.owner ?? ref, b); else if (ref) vehicleHit(ref); });
    p.drain();
  }
  reap() { this.projectiles.reap(); }
  serialize() { return []; }
}

// ai.js builds the snow golem's lists with its own task classes: arrow attack 1 (1.25, 20, 20, range 10), wander 2, watch the
// player 3 (6), look idle 4; target 1 is the nearest visible IMob within the follow range (EntityAINearestAttackableTarget).
export function buildSnowGolemTasks(m, K) {
  const { Wander, WatchClosest, LookIdle, ArrowAttack, TargetBase } = K, T = SNOW_GOLEM.tasks.arrowAttack;
  class NearestMonster extends TargetBase {
    constructor(brain) { super(brain, true); this.target = null; }
    shouldExecute() {
      const d = this.range();
      let best = null, bd = Infinity;
      for (const o of m.nearby(d, 4, d, (b) => SNOW_GOLEM_TARGETS.has(b.e.type) && b.alive)) {
        const s = m.distSq(o);
        if (s < bd && this.isSuitableTarget(o) && s <= d * d) { best = o; bd = s; }
      }
      this.target = best;
      return !!best;
    }
    startExecuting() { m.attackTarget = this.target; super.startExecuting(); }
  }
  m.tasks.add(1, new ArrowAttack(m, T.speed, T.min, T.max, T.range));
  m.tasks.add(2, new Wander(m, 1));
  m.tasks.add(3, new WatchClosest(m, 6));
  m.tasks.add(4, new LookIdle(m));
  m.targets.add(1, new NearestMonster(m));
}

export function installMooshroomGolem(EntityWorld) {
  const P = EntityWorld.prototype;
  Object.defineProperty(P, "golemBalls", { get() { return (this._golemBalls ??= new GolemBalls(this)); }, configurable: true });
  // EntityMooshroom.interact (wm.a(yz)): a bowl gives stew, shears turn it into a cow with 5 red mushrooms. True when handled.
  P.mooshroomInteract = function (e, survival) {
    if (e.type !== "mooshroom" || !this.entities.includes(e) || e.health <= 0) return false;
    const held = survival.held, use = mooshroomUse(held?.id, e.growingAge);
    if (use === "bowl") return useBowl(survival, makeStack);
    if (use !== "shear") return false;
    const cow = this.create("cow", e.x, e.y, e.z);
    cow.yaw = e.yaw; cow.pitch = e.pitch; cow.bodyYaw = e.bodyYaw ?? e.yaw; cow.health = e.health;
    for (const k of ["yaw", "bodyYaw", "headYaw"]) if (e[k] !== undefined) cow[k] = e[k];
    e.removedHealth = e.health; e.health = 0; e.death = 20; // setDead keeps the mooshroom's health (b53so)
    this.entities.push(cow);
    const h = ENTITY_TYPES.mooshroom.height;
    if (this.fx) this.fx.spawn("largeexplode", e.x, e.y + h / 2, e.z, 0, 0, 0);
    for (let i = 0; i < SHEAR_MUSHROOMS; i++) this.events.push({ drop: RED_MUSHROOM, count: 1, offsetY: f(h), position: { x: e.x, y: e.y, z: e.z } });
    this.events.push({ sound: "mob.sheep.shear", volume: 1, pitch: 1, position: { x: e.x, y: e.y, z: e.z } });
    if (!survival.creative) survival.wear(SHEARS, 1);
    return true;
  };
  // BlockPumpkin.onBlockAdded (amw.b): snow golem first (two snow blocks), else the iron golem. Returns the cleared cells or null.
  P.tryBuildGolem = function (x, y, z) {
    const w = this.world, head = w.get(x, y, z);
    if (head !== PUMPKIN && head !== JACK_O_LANTERN) return null;
    const snow = snowGolemShape((a, b, c) => w.get(a, b, c) === SNOW_BLOCK, x, y, z);
    if (snow) {
      for (const [a, b, c] of snow.cells) w.set(a, b, c, 0, true, 0);
      const g = this.create("snow_golem", snow.at.x, snow.at.y, snow.at.z);
      this.entities.push(g);
      return snow.cells;
    }
    const shape = ironGolemShape((a, b, c) => w.get(a, b, c) === IRON_BLOCK, x, y, z);
    if (!shape) return null;
    for (const [a, b, c] of shape.cells) w.set(a, b, c, 0, true, 0);
    this.spawnIronGolem(shape.at.x, shape.at.y, shape.at.z, true);
    return shape.cells;
  };
  // EntitySnowman.onLivingUpdate after the base update: melting, drowning and the snow trail.
  P.snowGolemUpdate = function (e, wet) {
    const w = this.world;
    const placed = updateSnowGolem(e, {
      wet,
      temperature: (x, y, z) => w.temperatureAt?.(x, y, z) ?? biomeTemperatureAt(w.biome, x, y, z),
      hurt: (n, name) => this.hazard(e, n, name),
      isAir: (x, y, z) => w.get(x, y, z) === 0,
      canLayer: (x, y, z) => snowCanStay(w, x, y, z),
      setLayer: (x, y, z) => w.set(x, y, z, SNOW_LAYER, false, 0),
    });
    if (placed.length) this.events.push({ blockEdit: placed });
  };
}
