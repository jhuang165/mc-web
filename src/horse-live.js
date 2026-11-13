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
import { entityRandom, aiMoveSpeed, resizeBox } from "./entities.js";
import { PIG_MOUNTED_OFFSET } from "./pig-saddle.js";
import { rearSeat, newHorseAnim, stepHorseAnim, horseFlagsOf } from "./horse-copy.js";
import { Minecarts, dismountSpot } from "./minecarts.js";
import { mountedYOffset, maxHealthOf, mountEntity } from "./mob-riding.js";

const f = Math.fround;
export const HORSE_ENTITY = {
  health: H.HORSE_BASE_HEALTH, width: f(H.HORSE_WIDTH), height: f(H.HORSE_HEIGHT), // setSize(1.4F, 1.6F): float sizes, so a foal's f(width * scale) matches the native float product movement: H.HORSE_BASE_SPEED,
  ai: { wander: 0.7, panic: 1.2, mate: 1, follow: 1 }, damage: 0, drop: 0,
};
const KEEP = ["items", "type", "variant", "temper", "tame", "saddled", "chested", "armor", "owner", "bred", "reproduced", "speed", "jump", "maxHealth"];
const GRASS = 1; // the project's grass block id (ai.js)
const seedFrom = (random) => new JavaRandom(Math.floor(random() * 2 ** 31));

// The view horse.js works on: record fields merged with the shared record's age, health and love.
// `maxHealth` stays the base (createChild averages bases); `liveMaxHealth` is getMaxHealth with saved modifiers (feeding, breeding readiness).
export const view = (e) => ({ ...H.blankHorse(), ...e.horse, age: e.growingAge ?? 0, health: e.health, inLove: (e.love ?? 0) > 0, liveMaxHealth: maxHealthOf(e, e.horse?.maxHealth) });
function apply(e, h, world) {
  const was = e.growingAge ?? 0;
  for (const k of KEEP) e.horse[k] = h[k];
  if (Array.isArray(e.horse.items)) ensureItems(e.horse); // a chest just attached grows the stack list
  e.growingAge = h.age;
  e.health = h.health;
  if (h.inLove && !(e.love > 0)) e.love = 600;
  if (h.loveFed) e.love = 600; // wf.f(yz) (setInLove) runs for every golden apple or carrot a tame adult is given, in love or not
  if (h.age !== was) growSize(e, was, world); // EntityAgeable.addGrowth / setGrowingAge resizes the box at once
}
export function growSize(e, was, world) {
  const k0 = H.growthScale(was), k1 = H.growthScale(e.growingAge);
  if (k1 !== k0) resizeBox(e, f(H.HORSE_WIDTH) * k0, f(H.HORSE_HEIGHT) * k0, f(H.HORSE_WIDTH) * k1, f(H.HORSE_HEIGHT) * k1, world);
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

// wi.a(wf) canMateWith for two live horse records (a rider or a mount on either side blocks, wi.cT: l == null && m == null).
const busy = (e) => !!(e.rider || e.riddenBy || e.ridingEntity);
export const horseCanMate = (a, b) => b.type === "horse" && H.canMateWith(view(a), view(b), busy(a), busy(b));

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
      if (e.horse) { e.horse.eating = false; e.eatTicks = 0; } // wi.i(yz) (bytecode-read): o(false) and p(false) on mounting stop the grass eating and the rear
      e.rearing = false; e.rearTicks = 0;
      rider.jumpCounter = 0;
      rider.jumpPower = 0;
      seats.updateRiderPosition(vehicle);
      return true;
    },
    // `landing`: EntityPlayer.mountEntity(null) runs dismountEntity on the server (sv.m, bytecode-read), then S08 puts the client player on that spot, so the drawn dismount
    // jumps from the copy's seat to the first clear spot beside the mount (or its top). The run-around buck lands the same way (executed, horse-rear-reference.json).
    dismount(world, rider, landing = true) {
      const v = rider.vehicle;
      if (!v) return false;
      const e = v.entity;
      const spot = landing && e && world ? dismountSpot(world, rider, { x: e.x, minY: e.y, height: f(mobs.size(e)[1]), z: e.z }, (box) => Minecarts.prototype.boxes.call({ railKind: () => null }, world, null, box, []).length === 0) : null;
      if (e) e.rider = null;
      Object.assign(rider, { ...spot, vehicle: null, fallDistance: 0, jumpCounter: 0, jumpPower: 0 });
      return true;
    },
    // Entity.updateRiderPosition: feet = posY + mountedOffset (height * 0.75 * scale) - 0.5 (probe: rider eye at y + 1.2 + 1.12).
    updateRiderPosition(v) {
      const e = v.entity, rider = e?.rider;
      if (!rider) return;
      const r = rearSeat(e.horseAnim?.rearAmount ?? 0, e.renderYawOffset ?? 0), lift = r.dy; // wi.ac(): the rider also shifts 0.7 * bM along the body yaw (horse-copy.js)
      // EntityPig keeps Entity.getMountedYOffset (height * 0.75, pig-saddle.js).
      // Any other mob a save seats the player on (level.dat Player.Riding) keeps Entity.getMountedYOffset: height * 0.75 (mob-riding.js).
      const offset = e.type === "pig" ? PIG_MOUNTED_OFFSET : e.type === "horse" ? H.mountedOffset(view(e)) : mountedYOffset(mobs.size(e)[1]);
      Object.assign(rider, { x: e.x + r.dx, y: e.y + offset - 0.5 + lift, z: e.z + r.dz });
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
  // rx.e -> setGrowingAge -> wi.a(boolean) -> setSize(1.4 * ci(), 1.6 * ci()) each tick of a foal's growth (bytecode-read; b45 records). Entity.setSize keeps the box minimum and, when the width grows
  // outside the first update, calls moveEntity(oldWidth - width, 0, oldWidth - width) (entities.js resizeBox).
  proto.horseGrowSize = function (e, was) { growSize(e, was, this.world); };
  proto.horseRear = function (e, sound = false) {
    e.rearing = true;
    e.rearTicks = 1; // makeHorseRear starts the counter at 1
    if (e.horse) { e.horse.eating = false; e.eatTicks = 0; } // wi.p(true) calls o(false) (bytecode-read): rearing stops the eating
    if (sound) this.horseAngry(e);
  };
  // wi.aT (the hurt sound getter, executed in horse-sounds-reference.json `flags`): cS() opens the mouth (bE = 1, flag 128), then nextInt(3) == 0 starts the rear (cU: bF = 1, p(true), which stops the eating).
  proto.horseHurt = function (e, rand) {
    e.mouthTicks = 1;
    if (rand.nextInt(3) === 0) this.horseRear(e);
  };
  proto.horseAngry = function (e) {
    e.mouthTicks = 1; // wi.cJ -> cv() -> cS(): the angry sound getter opens the mouth (bE = 1, flag 128)
    const sound = H.angrySound(e.horse.type);
    // wi.cJ: playSound(cv(), bf(), bg()); bg() draws the horse's own rand twice (a foal adds 0.5), as the talk sound does (b45 feed-wild-170: three rears shift the stream).
    const rand = entityRandom(e);
    if (sound) this.events.push({ sound, volume: f(H.SOUND_VOLUME), pitch: f(f(f(rand.nextFloat() - rand.nextFloat()) * f(0.2)) + (e.growingAge < 0 ? f(1.5) : 1)), position: { x: e.x, y: e.y, z: e.z } });
  };
  // Per tick (EntityHorse.onUpdate / onLivingUpdate): the rearing timer, regeneration, taming while ridden and the land sound.
  proto.horseTick = function (e) {
    const rand = entityRandom(e);
    if (!e.rider) { e.stepHeight = e.jumpFactor = undefined; e.moveStrafing = 0; } // wi.e(): no rider restores 0.5 and 0.02
    if (e.mouthTicks > 0 && ++e.mouthTicks > 30) e.mouthTicks = 0; // wi.h(): the mouth counter bE ends above 30 and clears flag 128 (started by every sound getter, wi.cS)
    if (e.rearing && ++e.rearTicks > 20) { e.rearing = false; e.rearTicks = 0; } // the rear counter starts at 1 and ends above 20 (b44pd records: AI resumes 20 ticks after the rear)
    // the horse's own animation counters from its own flags (wi.h(); the same stepHorseAnim as the client copy, executed in horse-rear-reference.json `anim`)
    const anim = (e.horseAnim ??= newHorseAnim());
    anim.flags = horseFlagsOf(e);
    stepHorseAnim(anim);
    if (e.onGround) { e.jumpingHorse = false; if (!e.rider) e.jumpPower = 0; }
    const max = maxHealthOf(e, e.horse.maxHealth);
    // wi.e (bytecode-read): nextInt(200) moves the tail before wf.e (EntityWorld, ahead of the AI); after it (server side) nextInt(900) with a live horse heals 1 (the draw is not gated on health),
    // then a horse not eating and with no rider draws nextInt(300) and starts eating when the block below is grass; eating stops after 50 ticks.
    if (rand.nextInt(900) === 0 && e.health > 0) e.health = Math.min(max, e.health + 1);
    if (!e.horse.eating && !e.rider && !e.riddenBy && rand.nextInt(300) === 0 && this.world.get(Math.floor(e.x), Math.floor(e.y) - 1, Math.floor(e.z)) === GRASS) e.horse.eating = true;
    if (e.horse.eating && (e.eatTicks = (e.eatTicks ?? 0) + 1) > 50) { e.eatTicks = 0; e.horse.eating = false; }
  };
  // EntityAIRunAroundLikeCrazy.updateTask (vg.e, run by the AI task of an untamed horse with a rider, ai.js RunAround): nextInt(50) == 0, then for a player rider
  // nextInt(100) < temper tames the horse (setTamedBy, status 7), otherwise temper + 5 (capped at 100); the rider is thrown off and the horse rears with the angry sound (status 6).
  // The status 6 and 7 particles are the client's (handleHealthUpdate), so the server's Entity.rand draws nothing for them (b47h records: executed).
  // The client's own Random draws the particles of statuses 6 and 7 (EntityHorse.spawnHorseParticles, seven per call).
  proto.horseParticles = function (e, name) { burst(this.fx, name, 7, e, new JavaRandom(BigInt(Math.floor(Math.random() * 2 ** 48))), 0.5); };
  proto.horseRunAround = function (e) {
    const rand = entityRandom(e);
    if (rand.nextInt(50) !== 0) return;
    const rider = e.rider, mob = !rider && e.riddenBy && this.entities.includes(e.riddenBy) ? e.riddenBy : null;
    if (rider?.player) {
      if (rand.nextInt(H.MAX_TEMPER) < e.horse.temper) {
        e.horse.tame = true; e.horse.owner = "player";
        this.horseParticles?.(e, "heart");
        return;
      }
      e.horse.temper = Math.min(H.MAX_TEMPER, e.horse.temper + 5);
      // EntityPlayer.mountEntity(null) on the server runs EntityLivingBase.dismountEntity (yz.a(sa) -> sv.m(sa)): the rider lands on the first clear spot of the search around its seat, or
      // on top of the horse, and the network handler moves the server player there. Executed (HorseRearProbe, horse-rear-reference.json `buck`: a real EntityPlayerMP and the unchanged
      // vg.e()). The b47h records used to leave the player at the seat (their stub ignored setPlayerLocation); they were re-recorded with the spot applied. The horse's own push
      // from that spot comes in its collideWithNearbyEntities this tick, and the mobs' copy of the player moves with it.
      this.horseSeats.dismount(this.world, rider, true);
      e.rider = null;
      if (this.ai.player) Object.assign(this.ai.player, { x: rider.x, y: rider.y, z: rider.z });
    } else if (mob) mountEntity(mob, null, (m) => this.size(m)[1]);
    else return;
    this.horseRear(e, true);
    this.horseParticles?.(e, "smoke");
  };
  // wi.b(F) fall damage and the land sound (probe: fall rows): over 1 block plays mob.horse.land at 0.4, over 6 hurts.
  // EntityLiving.onEntityUpdate's roll at the horse's 400 interval, then wi.t(): idle sound at 0.8 volume, nextInt(10) == 0 rears.
  proto.horseTalk = function (e, livingSoundRoll) {
    const rand = entityRandom(e);
    if (!livingSoundRoll(e, rand, H.TALK_INTERVAL)) return;
    e.mouthTicks = 1; // wi.t() (the living sound getter) calls cS()
    const out = H.livingSound(e.horse.type, rand);
    const pitch = f(f(f(rand.nextFloat() - rand.nextFloat()) * f(0.2)) + (e.growingAge < 0 ? f(1.5) : 1));
    this.events.push({ sound: out.sound, volume: f(H.SOUND_VOLUME), pitch, position: { x: e.x, y: e.y, z: e.z } });
    // wi.t(): nextInt(10) == 0 && !isMovementBlocked() (bh: a saddled rider, eating or rearing) rears, so a rearing horse keeps its counter (b47h sound-R-170 records, executed).
    if (out.rearing && !(e.rider && e.horse.saddled) && !e.rearing && !e.horse.eating) this.horseRear(e);
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
    const eatSound = () => (e.mouthTicks = 1, this.events.push({ sound: "eating", volume: 1, pitch: f(1 + f(f(rand.nextFloat() - rand.nextFloat()) * f(0.2))), position: { x: e.x, y: e.y, z: e.z } }));
    const fed = id != null ? H.feedHorse(h, id, { creative }) : null;
    if (fed?.used) {
      apply(e, fed.horse, this.world);
      take(1);
      eatSound();
      return true;
    }
    const out = H.interactHorse(h, id, { sneak: !!ctx.sneak });
    if (!out.result) return false;
    apply(e, out.horse, this.world);
    if (out.action === "rear") { this.horseRear(e, true); if (!creative && stack && stack.count <= 0) survival.inventory.main[survival.inventory.current] = null; /* interactWith destroys a spent held stack */ }
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
