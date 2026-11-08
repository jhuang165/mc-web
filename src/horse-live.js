// EntityHorse (wi) inside EntityWorld (entities.js): the live record, interaction, taming by riding, ridden movement,
// foals, drops and the vehicle seat system. Pure rules live in horse.js (replayed against
// public/research/horse-reference.json); this file only wires them to the engine's mob record and event queue.
// A horse record keeps `horse` (type, variant, temper, tame, saddled, chested, armor, owner, speed, jump, maxHealth),
// with age in `growingAge`, health in `health` and love in `love` like every animal.
import { JavaRandom } from "./java-random.js";
import { originalOfLive } from "./item-names.js";
import { burst } from "./fx.js";
import * as H from "./horse.js";
import { cleanItems, ensureItems, syncGear } from "./horse-gear.js";
import { entityRandom, aiMoveSpeed } from "./entities.js";
import { PIG_MOUNTED_OFFSET } from "./pig-saddle.js";
import { mountedYOffset, maxHealthOf } from "./mob-riding.js";

const f = Math.fround;
export const HORSE_ENTITY = {
  health: H.HORSE_BASE_HEALTH, width: H.HORSE_WIDTH, height: H.HORSE_HEIGHT, movement: H.HORSE_BASE_SPEED,
  ai: { wander: 0.7, panic: 1.2, mate: 1, follow: 1 }, damage: 0, drop: 0,
};
const KEEP = ["items", "type", "variant", "temper", "tame", "saddled", "chested", "armor", "owner", "bred", "reproduced", "speed", "jump", "maxHealth"];
const seedFrom = (random) => new JavaRandom(Math.floor(random() * 2 ** 31));

// The view horse.js works on: record fields merged with the shared record's age, health and love.
// `maxHealth` stays the base (createChild averages bases); `liveMaxHealth` is getMaxHealth with saved modifiers (feeding, breeding readiness).
export const view = (e) => ({ ...H.blankHorse(), ...e.horse, age: e.growingAge ?? 0, health: e.health, inLove: (e.love ?? 0) > 0, liveMaxHealth: maxHealthOf(e, e.horse?.maxHealth) });
function apply(e, h) {
  for (const k of KEEP) e.horse[k] = h[k];
  if (Array.isArray(e.horse.items)) ensureItems(e.horse); // a chest just attached grows the stack list
  e.growingAge = h.age;
  e.health = h.health;
  if (h.inLove && !(e.love > 0)) e.love = 600;
}

// EntityHorse.onSpawnWithEgg with no group data (wi.a(sy)); `group` is an {type, variant} from a herd.
export function horseFields(random, group = null) {
  const { horse } = H.spawnHorse(seedFrom(random), group);
  const { age, health, ...rest } = horse;
  return { horse: pick(rest), health, growingAge: age, speedAttr: horse.speed };
}
// EntityHorse.onSpawnWithEgg on the entity's own Random (wi.a(sy)): `group` is the {type, variant} a herd passes on (EntityHorse.GroupData).
export function horseSpawn(rand, group = null) {
  const { horse, group: next, followBonus } = H.spawnHorse(rand, group);
  const { age, health, ...rest } = horse;
  return { fields: { horse: pick(rest), health, growingAge: age, speedAttr: horse.speed }, group: next, followBonus };
}
const pick = (h) => Object.fromEntries(KEEP.map((k) => [k, h[k]]));

// restore(): a saved record keeps its horse state after a sanity pass.
export function horseFieldsFrom(e, fresh) {
  const s = e.horse && typeof e.horse === "object" ? e.horse : {};
  const type = Number.isInteger(s.type) && s.type >= 0 && s.type <= 4 ? s.type : fresh.horse.type;
  const num = (v, d, lo, hi) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  const horse = {
    ...fresh.horse, type,
    variant: Number.isInteger(s.variant) ? s.variant & 0xffff : fresh.horse.variant,
    temper: Math.trunc(num(s.temper, 0, 0, H.MAX_TEMPER)),
    tame: s.tame === true, saddled: s.saddled === true, chested: s.chested === true && H.canCarryChest(type),
    armor: H.canWearArmor(type) && [0, 1, 2, 3].includes(s.armor) ? s.armor : 0,
    owner: typeof s.owner === "string" ? s.owner : "", bred: s.bred === true, reproduced: s.reproduced === true,
    speed: num(s.speed, fresh.horse.speed, 0, 1), jump: num(s.jump, fresh.horse.jump, 0, 2), maxHealth: num(s.maxHealth, fresh.horse.maxHealth, 1, 1024),
  };
  const items = cleanItems(s.items);
  if (items) { horse.items = items; ensureItems(horse); syncGear(horse); } // horse-gear.js: the stacks are the truth, the flags follow
  return { horse, speedAttr: horse.speed };
}

// wi.a(rx) createChild: attributes and variant come from the parents; the foal starts at -24000.
export function horseChildFields(a, b, rand) {
  const c = H.childOf(view(a), view(b), rand);
  const { age, health, ...rest } = c;
  return { horse: pick({ ...rest, tame: false }), health, growingAge: -24000, speedAttr: c.speed };
}

// ---- vehicle seat system (vehicle-simulation.js picks it for a rider whose vehicle has `horse: true`) ----
export function horseSeats(mobs) {
  const seats = {
    carts: [],
    mobs,
    mount(e, rider) {
      if (!e || e.rider || rider.vehicle || e.health <= 0 || (e.growingAge ?? 0) < 0) return false;
      const vehicle = { horse: true, entity: e, get dead() { return e.health <= 0 || !mobs.entities.includes(e); } };
      Object.defineProperty(e, "rider", { value: rider, writable: true, configurable: true, enumerable: false });
      rider.vehicle = vehicle;
      rider.jumpCounter = 0;
      rider.jumpPower = 0;
      seats.updateRiderPosition(vehicle);
      return true;
    },
    dismount(world, rider) {
      const v = rider.vehicle;
      if (!v) return false;
      if (v.entity) v.entity.rider = null;
      Object.assign(rider, { vehicle: null, fallDistance: 0, jumpCounter: 0, jumpPower: 0 });
      return true;
    },
    // Entity.updateRiderPosition: feet = posY + mountedOffset (height * 0.75 * scale) - 0.5 (probe: rider eye at y + 1.2 + 1.12).
    updateRiderPosition(v) {
      const e = v.entity, rider = e?.rider;
      if (!rider) return;
      const lift = e.rearAmount ? f(0.15 * e.rearAmount) : 0;
      // EntityPig keeps Entity.getMountedYOffset (height * 0.75, pig-saddle.js).
      // Any other mob a save seats the player on (level.dat Player.Riding) keeps Entity.getMountedYOffset: height * 0.75 (mob-riding.js).
      const offset = e.type === "pig" ? PIG_MOUNTED_OFFSET : e.type === "horse" ? H.mountedOffset(view(e)) : mountedYOffset(mobs.size(e)[1]);
      Object.assign(rider, { x: e.x, y: e.y + offset - 0.5 + lift, z: e.z });
    },
    // EntityPlayerSP's jump key counter: charged while Space is held, sent as (int)(power * 100) on release.
    charge(rider, controls) {
      const v = rider.vehicle;
      if (!v?.horse || v.entity?.type !== "horse") return;
      const jump = !!controls.jump;
      if (jump) {
        if (rider.jumpCounter < 0) {
          if (++rider.jumpCounter === 0) rider.jumpPower = 0;
        } else {
          rider.jumpCounter++;
          rider.jumpPower = H.heldJumpPower(rider.jumpCounter);
        }
      } else if (rider.wasJump) {
        rider.jumpCounter = -10;
        if (rider.jumpPower > 0) mobs.horseJump(v.entity, Math.trunc(rider.jumpPower * 100));
        rider.jumpPower = 0;
      }
      rider.wasJump = jump;
    },
  };
  return seats;
}

// wi.e(F,F) with a rider (cu() and a living rider): the rider's yaw and half pitch are copied, strafe is halved, backwards is
// quartered, a standing rearing horse is held still, and a stored jump power launches it (probe: ride rows).
export function horseRideThink(mobs, e) {
  const rider = e.rider, h = e.horse;
  e.rotationYaw = rider.yaw;
  e.yaw = f(-rider.yaw * Math.PI / 180);
  let strafe = f(rider.moveStrafing * f(0.5)), forward = rider.moveForward;
  if (forward <= 0) forward = f(forward * f(0.25));
  if (e.onGround && !(e.jumpPower > 0) && e.rearing && !e.jumpHeld) strafe = forward = 0;
  if (e.jumpPower > 0 && !e.jumpingHorse && e.onGround) {
    e.vy = h.jump * e.jumpPower;
    e.jumpingHorse = true;
    if (forward > 0) {
      const sin = Math.sin(e.rotationYaw * Math.PI / 180), cos = Math.cos(e.rotationYaw * Math.PI / 180);
      e.vx += -0.4 * sin * e.jumpPower;
      e.vz += 0.4 * cos * e.jumpPower;
      mobs.events.push({ sound: "mob.horse.jump", volume: 0.4, pitch: 1, position: { x: e.x, y: e.y, z: e.z } });
    }
    e.jumpPower = 0;
  }
  // jumpMovementFactor is getAIMoveSpeed() * 0.1 (the prior bp) before setAIMoveSpeed((float) movementSpeed.getAttributeValue()): the attribute
  // with its saved modifiers (probed attributes2 `horseRide`: +50% gives bp 0.38358983 and aQ 0.038358983; a prior bp of 0.9 gives aQ 0.09 once).
  const speed = aiMoveSpeed(e, 1);
  e.stepHeight = 1;
  e.jumpFactor = f((Number.isFinite(e.aiMoveSpeed) ? e.aiMoveSpeed : speed) * f(0.1));
  e.aiMoveSpeed = speed;
  e.moveStrafing = strafe;
  e.moveForward = forward;
  e.jumping = false;
}

// main.js hands the live player rider over each time it builds the vehicle state, so interaction can mount it.
export function horseSeatsFor(mobs, rider) {
  const seats = mobs?.horseSeats;
  if (seats) seats.player = rider;
  return seats;
}

export function installHorse(EntityWorld) {
  const proto = EntityWorld.prototype;
  Object.defineProperty(proto, "horseSeats", { get() { return (this._horseSeats ??= horseSeats(this)); }, configurable: true });
  // wi.w(int): the jump power the client sends.
  proto.horseJump = function (e, p) {
    const j = H.jumpPower(!!e.horse.saddled, p);
    e.jumpPower = j.power;
    e.jumpHeld = j.held;
    if (j.rearing) this.horseRear(e);
  };
  proto.horseRear = function (e, sound = false) {
    e.rearing = true;
    e.rearTicks = 0;
    if (sound) this.horseAngry(e);
  };
  proto.horseAngry = function (e) {
    const sound = H.angrySound(e.horse.type);
    if (sound) this.events.push({ sound, volume: H.SOUND_VOLUME, pitch: f(1 + f(f(this.random() - this.random()) * f(0.2))), position: { x: e.x, y: e.y, z: e.z } });
  };
  // Per tick (EntityHorse.onUpdate / onLivingUpdate): the rearing timer, regeneration, taming while ridden and the land sound.
  proto.horseTick = function (e) {
    const rand = entityRandom(e);
    if (!e.rider) { e.stepHeight = e.jumpFactor = undefined; e.moveStrafing = 0; } // wi.e(): no rider restores 0.5 and 0.02
    if (e.rearing && ++e.rearTicks > 20) { e.rearing = false; e.rearTicks = 0; } // wi.bP counter, recalled (not probed)
    e.rearAmount = e.rearing ? Math.min(1, (e.rearAmount ?? 0) + 0.1) : Math.max(0, (e.rearAmount ?? 0) - 0.1);
    if (e.onGround) { e.jumpingHorse = false; if (!e.rider) e.jumpPower = 0; }
    const max = maxHealthOf(e, e.horse.maxHealth);
    if (e.health < max && rand.nextInt(900) === 0) e.health = Math.min(max, e.health + 1); // wi.e(): heal(1)
    const rider = e.rider;
    if (rider && !e.horse.tame && rider.player) {
      const out = H.tameTick(view(e), rand, "player");
      if (out.status !== null) {
        apply(e, out.horse);
        e.horse.owner = out.horse.owner;
        if (out.status === 7) burst(this.fx, "heart", 7, e, rand, 0.5);
        else {
          this.horseSeats.dismount(this.world, rider);
          e.rider = null;
          this.horseRear(e, true);
          burst(this.fx, "smoke", 7, e, rand, 0.5);
        }
      }
    }
  };
  // wi.b(F) fall damage and the land sound (probe: fall rows): over 1 block plays mob.horse.land at 0.4, over 6 hurts.
  // EntityLiving.onEntityUpdate's roll at the horse's 400 interval, then wi.t(): idle sound at 0.8 volume, nextInt(10) == 0 rears.
  proto.horseTalk = function (e, livingSoundRoll) {
    const rand = entityRandom(e);
    if (!livingSoundRoll(e, rand, H.TALK_INTERVAL)) return;
    const out = H.livingSound(e.horse.type, rand);
    const pitch = f(f(f(rand.nextFloat() - rand.nextFloat()) * f(0.2)) + (e.growingAge < 0 ? f(1.5) : 1));
    this.events.push({ sound: out.sound, volume: H.SOUND_VOLUME, pitch, position: { x: e.x, y: e.y, z: e.z } });
    if (out.rearing) this.horseRear(e);
  };
  proto.horseLand = function (e, distance) {
    if (distance <= 1) return 0;
    this.events.push({ sound: "mob.horse.land", volume: 0.4, pitch: 1, position: { x: e.x, y: e.y, z: e.z } });
    return H.fallDamage(distance);
  };
  // EntityHorse.interact (wi.a(yz)). `ctx` carries what the edit dispatcher knows: `sneak`, `rider` and `horses`.
  proto.horseInteract = function (e, survival, ctx = {}) {
    if (e.type !== "horse" || e.health <= 0 || !this.entities.includes(e)) return false;
    const stack = survival.held, creative = !!survival.creative;
    const id = stack ? originalOfLive(stack.id)?.id ?? null : null;
    const h = view(e), rand = entityRandom(e), box = { x: e.x, y: e.y, z: e.z, width: H.HORSE_WIDTH, height: H.HORSE_HEIGHT };
    const take = (n = 1) => { if (!creative && n > 0) survival.inventory.decr(survival.inventory.current, n); };
    const eatSound = () => this.events.push({ sound: "random.eat", volume: 1, pitch: f(1 + f(f(rand.nextFloat() - rand.nextFloat()) * f(0.2))), position: { x: e.x, y: e.y, z: e.z } });
    const fed = id != null ? H.feedHorse(h, id, { creative }) : null;
    if (fed?.used) {
      apply(e, fed.horse);
      take(1);
      eatSound();
      return true;
    }
    const out = H.interactHorse(h, id, { sneak: !!ctx.sneak });
    if (!out.result) return false;
    apply(e, out.horse);
    if (out.action === "rear") { this.horseRear(e, true); }
    else if (out.action === "chest") {
      take(1);
      this.events.push({ sound: "mob.chickenplop", volume: 1, pitch: f(1 + f(f(rand.nextFloat() - rand.nextFloat()) * f(0.2))), position: { x: e.x, y: e.y, z: e.z } });
    } else if (out.action === "gui") {
      // The inventory screen opens (horse-gear-live.js); without a screen host the saddle or armour is equipped from the held stack.
      if (ctx.open) ctx.open(e);
      else if (id === H.SADDLE_ID && !e.horse.saddled) { e.horse.saddled = true; take(1); }
      else if (H.HORSE_ARMOR_IDS[id] && H.canWearArmor(e.horse.type) && !e.horse.armor) { e.horse.armor = H.HORSE_ARMOR_IDS[id]; take(1); }
    } else if (out.action === "mount") {
      if (this.nameTagUse?.(e, survival)) return true; // wi.a: a name tag is tried before mounting
      if (ctx.horses?.player) ctx.horses.mount(e, ctx.horses.player);
    }
    void box;
    return true;
  };
}
