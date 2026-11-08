// EntityHorse (wi) rules, 1.7.10. Pure functions over a plain state object; every
// rule is checked against public/research/horse-reference.json (tools/probes/HorseProbe.java,
// which drives the unchanged obfuscated classes). Items without a native probe row are
// labelled "bytecode-derived" with the class/method that holds the rule.
import { JavaRandom } from "./java-random.js";

const f = Math.fround;
export const HORSE_WIDTH = 1.4;
export const HORSE_HEIGHT = 1.6;
export const HORSE_BASE_HEALTH = 53;
export const HORSE_BASE_SPEED = f(0.225);
export const HORSE_BASE_JUMP = 0.7;
export const MAX_TEMPER = 100;
export const MAX_SPAWN_GROUP = 6;
export const TALK_INTERVAL = 400;
export const SOUND_VOLUME = 0.8;
export const TYPES = { horse: 0, donkey: 1, mule: 2, zombie: 3, skeleton: 4 };
export const ARMOR_VALUES = [0, 5, 7, 11]; // wi.aV
// Original item ids: saddle 329, iron/gold/diamond horse armour 417/418/419, chest block 54.
export const SADDLE_ID = 329;
export const HORSE_ARMOR_IDS = { 417: 1, 418: 2, 419: 3 };
// Item -> heal / growth seconds / temper (wi.a(yz) feed switch). Hay block 170 heals 20.
export const FEEDS = {
  296: { name: "wheat", heal: 2, growth: 60, temper: 3 },
  353: { name: "sugar", heal: 1, growth: 30, temper: 3 },
  297: { name: "bread", heal: 7, growth: 180, temper: 3 },
  170: { name: "hay", heal: 20, growth: 180, temper: 0 },
  260: { name: "apple", heal: 3, growth: 60, temper: 3 },
  396: { name: "goldenCarrot", heal: 4, growth: 60, temper: 5 },
  322: { name: "goldenApple", heal: 10, growth: 240, temper: 10 },
};
export const HORSE_DROPS = { 0: 334, 1: 334, 2: 334, 3: 367, 4: 352 }; // wi.u()

export const canWearArmor = (type) => type === 0; // wi.cB
export const canCarryChest = (type) => type === 1 || type === 2; // wi.cC
export const isUndeadOrMule = (type) => type >= 2; // wi.cF
export const isUndead = (type) => type === 3 || type === 4; // wi.cE

const nd = (r) => r.nextDouble();
export const rollMaxHealth = (r) => f(15 + r.nextInt(8) + r.nextInt(9)); // wi.cV
export const rollJump = (r) => 0.4000000059604645 + nd(r) * 0.2 + nd(r) * 0.2 + nd(r) * 0.2; // wi.cW
export const rollSpeed = (r) => (0.44999998807907104 + nd(r) * 0.3 + nd(r) * 0.3 + nd(r) * 0.3) * 0.25; // wi.cX

export function blankHorse() {
  return {
    type: 0, variant: 0, age: 0, tame: false, saddled: false, chested: false, bred: false,
    eating: false, rearing: false, inLove: false, temper: 0, health: HORSE_BASE_HEALTH, maxHealth: HORSE_BASE_HEALTH,
    speed: HORSE_BASE_SPEED, jump: HORSE_BASE_JUMP, armor: 0, owner: "", reproduced: false,
  };
}

// wi.a(sy) onSpawnWithEgg. Follow range (wf.a -> rx.a) takes one nextGaussian first.
export function spawnHorse(r, group = null, base = blankHorse()) {
  const followBonus = r.nextGaussian() * 0.05; // EntityLiving.onSpawnWithEgg's followRange "Random spawn bonus" (interchange-spawn-reference.json)
  let type;
  let variant;
  if (group) {
    type = group.type;
    variant = (group.variant & 255) | (r.nextInt(5) << 8);
  } else if (r.nextInt(10) === 0) {
    type = 1;
    variant = 0;
  } else {
    const colour = r.nextInt(7);
    const marking = r.nextInt(5);
    type = 0;
    variant = colour | (marking << 8);
  }
  const h = { ...base, type, variant };
  if (r.nextInt(5) === 0) h.age = -24000;
  if (type === 3 || type === 4) {
    h.maxHealth = 15;
    h.speed = f(0.2);
  } else {
    h.maxHealth = rollMaxHealth(r);
    h.speed = type === 0 ? rollSpeed(r) : f(0.175);
  }
  h.jump = type === 1 || type === 2 ? 0.5 : rollJump(r);
  h.health = h.maxHealth;
  return { horse: h, group: { type, variant }, followBonus };
}

export const growthScale = (age) => (age >= 0 ? 1 : f(0.5 + f(f(age + 24000) / 24000) * 0.5)); // ci()

// wi.a(yz) when the player feeds a stack. Returns null when the item is not a feed.
export function feedHorse(h, itemId, { creative = false } = {}) {
  const feed = FEEDS[itemId];
  if (!feed || isUndead(h.type)) return null; // zombie/skeleton horses ignore food (probe: result false/mount)
  const out = { ...h };
  let used = false;
  if (h.health < h.maxHealth && feed.heal > 0) {
    out.health = Math.min(h.maxHealth, h.health + feed.heal);
    used = true;
  }
  if (h.age < 0 && feed.growth > 0) {
    out.age = Math.min(0, h.age + feed.growth * 20);
    used = true;
  }
  // Golden apple / golden carrot put a tame adult in love (wf.f(yz)).
  if ((itemId === 396 || itemId === 322) && h.tame && h.age >= 0 && !h.inLove) {
    out.inLove = true;
    used = true;
  }
  // Temper rises whenever the horse is untamed or something above was used (probe: a tame
  // adult at full health is just mounted with temper unchanged).
  if ((used || !h.tame) && feed.temper > 0) {
    out.temper = Math.min(MAX_TEMPER, h.temper + feed.temper);
    used = true;
  }
  if (!used && !h.tame) used = true;
  return { horse: out, used, consume: used && !creative };
}

// wi.a(yz) for a non-feed click (empty hand, saddle, horse armour, chest, anything else).
// Fitted to and tested against the 280 probe `interact` rows. Returns the action the caller
// performs: "rear" (angry sound, rearing), "gui" (horse inventory), "chest" (donkey/mule chest placed,
// mob.chickenplop), "mount" or "none".
export function interactHorse(h, heldId, { sneak = false } = {}) {
  const adult = h.age >= 0;
  const wildUndead = isUndead(h.type) && !h.tame;
  const held = heldId != null;
  if (!h.tame && held && !isUndead(h.type)) return { result: true, action: "rear", horse: { ...h, rearing: true } };
  if (h.tame && HORSE_ARMOR_IDS[heldId] && canWearArmor(h.type)) return { result: true, action: "gui", horse: h };
  if (h.tame && heldId === 54 && canCarryChest(h.type) && !h.chested && !(sneak && adult)) return { result: true, action: "chest", horse: { ...h, chested: true }, consume: 1 };
  if (wildUndead || !adult) return { result: false, action: "none", horse: h };
  if (h.tame && (sneak || heldId === SADDLE_ID)) return { result: true, action: "gui", horse: h };
  return { result: true, action: "mount", horse: h };
}

// vg.e() taming task, one tick with a rider present.
export function tameTick(h, r, rider = "player") {
  if (r.nextInt(50) !== 0) return { horse: h, status: null, dismount: false };
  if (rider && r.nextInt(MAX_TEMPER) < h.temper) {
    return { horse: { ...h, tame: true, owner: rider }, status: 7, dismount: false };
  }
  // cJ(): the angry sound takes pitch (nextFloat - nextFloat) * 0.2 + 1 (two draws; fits all 150 probe seeds).
  r.nextFloat();
  r.nextFloat();
  return { horse: { ...h, temper: Math.min(MAX_TEMPER, h.temper + 5), rearing: true }, status: 6, dismount: true };
}

// wi.w(int): the jump bar value sent by the client when the key is released.
export function jumpPower(saddled, p) {
  if (!saddled) return { power: 0, held: false, rearing: false };
  if (p < 0) return { power: f(0.4), held: false, rearing: false };
  return { power: p >= 90 ? 1 : f(f(0.4) + f(f(f(0.4) * p) / 90)), held: true, rearing: true };
}
// EntityPlayerSP jump counter (bytecode-unverified, recalled): hold counter -> bar fill.
export const heldJumpPower = (counter) => (counter < 10 ? counter * 0.1 : 0.8 + (2 / (counter - 9)) * 0.1);

// wi.a(rx) createChild type/variant/attribute rules over plain states.
export function childOf(a, b, r) {
  const child = blankHorse();
  child.type = a.type === b.type ? a.type : a.type + b.type === 1 ? 2 : 0; // other mixes stay the default type 0 (probe pairs 2x0, 0x3)
  if (child.type === 0) {
    const i1 = r.nextInt(9);
    const colour = i1 < 4 ? a.variant & 255 : i1 < 8 ? b.variant & 255 : r.nextInt(7);
    const j1 = r.nextInt(5);
    const marking = j1 < 2 ? a.variant & 65280 : j1 < 4 ? b.variant & 65280 : (r.nextInt(5) << 8) & 65280;
    child.variant = colour | marking;
  }
  child.maxHealth = f((a.maxHealth + b.maxHealth + rollMaxHealth(r)) / 3);
  child.jump = (a.jump + b.jump + rollJump(r)) / 3;
  child.speed = (a.speed + b.speed + rollSpeed(r)) / 3;
  child.health = Math.min(HORSE_BASE_HEALTH, child.maxHealth); // original leaves 53 > max; clamped (documented)
  return child;
}

// wi.cT(): ready to breed.
export const canBreed = (h, ridden = false) =>
  !ridden && h.tame && h.age >= 0 && !isUndeadOrMule(h.type) && h.health >= h.maxHealth;
// wi.a(wf) canMateWith (love is checked by the caller).
export function canMateWith(a, b, rideA = false, rideB = false) {
  if (a === b) return false;
  if (!canBreed(a, rideA) || !canBreed(b, rideB)) return false;
  return a.type === b.type || a.type + b.type === 1;
}

export const fallDamage = (distance) => Math.max(0, Math.ceil(f(distance * 0.5) - 3)); // wi.b(float)
export const mountedOffset = (h) => f(f(HORSE_HEIGHT) * 0.75) * growthScale(h.age); // ae()

export const deathSound = (t) => ["mob.horse.death", "mob.horse.donkey.death", "mob.horse.donkey.death", "mob.horse.zombie.death", "mob.horse.skeleton.death"][t];
export const angrySound = (t) => (t === 3 || t === 4 ? null : t === 0 ? "mob.horse.angry" : "mob.horse.donkey.angry");

// Save format (wi.b(dh) / a(dh)) subset the port round-trips.
export function writeNbt(h, inventory = []) {
  const tag = {
    EatingHaystack: h.eating ? 1 : 0, ChestedHorse: h.chested ? 1 : 0, HasReproduced: h.reproduced ? 1 : 0,
    Bred: h.bred ? 1 : 0, Type: h.type, Variant: h.variant, Temper: h.temper, Tame: h.tame ? 1 : 0,
    OwnerUUID: h.owner || "",
  };
  if (h.chested) tag.Items = inventory.filter((s) => s && s.slot >= 2).map((s) => ({ Slot: s.slot, id: s.id, Count: s.count, Damage: s.damage }));
  return tag;
}
export function readNbt(tag, base = blankHorse()) {
  const h = { ...base };
  h.eating = !!tag.EatingHaystack;
  h.bred = !!tag.Bred;
  h.chested = !!tag.ChestedHorse;
  h.reproduced = !!tag.HasReproduced;
  h.type = tag.Type | 0;
  h.variant = tag.Variant | 0;
  h.temper = tag.Temper | 0;
  h.tame = !!tag.Tame;
  h.owner = typeof tag.OwnerUUID === "string" ? tag.OwnerUUID : "";
  const saddle = tag.SaddleItem;
  if (saddle && typeof saddle === "object" && saddle.id === SADDLE_ID) h.saddled = true;
  else if (tag.Saddle) h.saddled = true; // legacy boolean
  const armor = tag.ArmorItem;
  h.armor = armor && HORSE_ARMOR_IDS[armor.id] ? HORSE_ARMOR_IDS[armor.id] : 0;
  return h;
}

export const newRandom = (seed) => new JavaRandom(seed);

// wi.b(boolean,int) -> EntityLiving.dropFewItems: one draw is consumed first (bound not identified; any
// power-of-two bound fits all 960 probe rows), then nextInt(3) plus nextInt(looting + 1) when looting > 0.
export function dropCount(r, looting = 0) {
  r.nextInt(4);
  return r.nextInt(3) + (looting > 0 ? r.nextInt(looting + 1) : 0);
}

const SOUND_PREFIX = ["mob.horse.", "mob.horse.donkey.", "mob.horse.donkey.", "mob.horse.zombie.", "mob.horse.skeleton."];
// wi.t() living sound: idle, and nextInt(10) == 0 makes the horse rear (cJ). Fitted to the 200 probe sound rows.
export function livingSound(type, r) {
  return { sound: SOUND_PREFIX[type] + "idle", rearing: r.nextInt(10) === 0 };
}
// wi.aT() hurt sound: hit, and nextInt(3) == 0 makes the horse rear.
export function hurtSound(type, r) {
  return { sound: SOUND_PREFIX[type] + "hit", rearing: r.nextInt(3) === 0 };
}
