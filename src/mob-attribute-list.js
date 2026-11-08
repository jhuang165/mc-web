// The Attributes list every EntityLivingBase writes (EntityLivingBase.writeEntityToNBT -> SharedMonsterAttributes.func_111257_a), for every
// living class of the port, and the reader's side (func_151475_a). Probed, not recalled: tools/probes/InterchangeLinkProbe.java constructs each of the
// 29 constructible EntityList living classes and writes it (public/research/interchange-links-reference.json, `attrs` and `attrVariant` records):
//   - the list is always maxHealth, knockbackResistance, movementSpeed, followRange, then attackDamage (only for classes that register it) or
//     horse.jumpStrength (horse) or zombie.spawnReinforcements (zombie and pigman, after attackDamage);
//   - bases are per class (table below); wolf maxHealth is 20 once tamed (setTamed), slime and magma cube maxHealth is size * size, a horse
//     writes its rolled maxHealth, movementSpeed and jumpStrength;
//   - potion effect modifiers are not saved (AttributeModifier.isSaved is false for them: probed, none appear), the baby zombie/pigman speed
//     boost ("Baby speed boost", operation 1, amount 0.5, UUID b9766b59-9566-4402-bc1f-2ee2a276d836) is saved;
//   - mobs spawned through onSpawnWithEgg also carry a followRange "Random spawn bonus" (operation 1, gaussian * 0.05, random UUID), and zombies and
//     pigmen the knockbackResistance one: the port keeps those as `modifiers` (zombies) or as the final followRange / knockbackResistance value.
// A record keeps what the port models (maxHealth, followRange, knockbackResistance, modifiers, horse speed and jump) and `attributeBases` for any
// other base that differs from the class default, so export -> import -> export is stable.
import { NBT } from "./nbt.js";
import { nbtGet } from "./nbt-get.js";
import { longsUuid, uuidLongs, newUuid, deriveUuid } from "./entity-uuid.js";
import { cleanModifiers, modifiedValue, LEADER_BONUS } from "./mob-attributes.js";

const N = { H: "generic.maxHealth", K: "generic.knockbackResistance", S: "generic.movementSpeed", F: "generic.followRange", A: "generic.attackDamage", J: "horse.jumpStrength" };
const RAW = {
  Bat: { H: 6, K: 0, S: 0.699999988079071, F: 16 },
  Blaze: { H: 20, K: 0, S: 0.10000000149011612, F: 16, A: 6 },
  CaveSpider: { H: 12, K: 0, S: 0.800000011920929, F: 16, A: 2 },
  Chicken: { H: 4, K: 0, S: 0.25, F: 16 },
  Cow: { H: 10, K: 0, S: 0.20000000298023224, F: 16 },
  Creeper: { H: 20, K: 0, S: 0.25, F: 16, A: 2 },
  EnderDragon: { H: 200, K: 0, S: 0.10000000149011612, F: 16 },
  Enderman: { H: 40, K: 0, S: 0.30000001192092896, F: 16, A: 7 },
  EntityHorse: { H: 53, K: 0, S: 0.22499999403953552, F: 16, J: 0.7 },
  Ghast: { H: 10, K: 0, S: 0.10000000149011612, F: 16 },
  Giant: { H: 100, K: 0, S: 0.5, F: 16, A: 50 },
  LavaSlime: { H: 4, K: 0, S: 0.20000000298023224, F: 16 },
  MushroomCow: { H: 10, K: 0, S: 0.20000000298023224, F: 16 },
  Ozelot: { H: 10, K: 0, S: 0.30000001192092896, F: 16 },
  Pig: { H: 10, K: 0, S: 0.25, F: 16 },
  PigZombie: { H: 20, K: 0, S: 0.5, F: 40, A: 5 },
  Sheep: { H: 8, K: 0, S: 0.23000000417232513, F: 16 },
  Silverfish: { H: 8, K: 0, S: 0.6000000238418579, F: 16, A: 1 },
  Skeleton: { H: 20, K: 0, S: 0.25, F: 16, A: 2 },
  Slime: { H: 1, K: 0, S: 0.10000000149011612, F: 16 },
  SnowMan: { H: 4, K: 0, S: 0.20000000298023224, F: 16 },
  Spider: { H: 16, K: 0, S: 0.800000011920929, F: 16, A: 2 },
  Squid: { H: 10, K: 0, S: 0.10000000149011612, F: 16 },
  Villager: { H: 20, K: 0, S: 0.5, F: 16 },
  VillagerGolem: { H: 100, K: 0, S: 0.25, F: 16 },
  Witch: { H: 26, K: 0, S: 0.25, F: 16, A: 2 },
  WitherBoss: { H: 300, K: 0, S: 0.6000000238418579, F: 40, A: 2 },
  Wolf: { H: 8, K: 0, S: 0.30000001192092896, F: 16 },
  Zombie: { H: 20, K: 0, S: 0.23000000417232513, F: 40, A: 3 },
};
// Java entity id -> [[attribute name, default base]] in the native list order.
export const JAVA_ATTRIBUTE_BASES = Object.freeze(Object.fromEntries(Object.entries(RAW).map(([id, v]) => [id, Object.freeze(Object.entries(v).map(([k, base]) => [N[k], base]))])));
export const REINFORCEMENTS = "zombie.spawnReinforcements";
export const BABY_BOOST = Object.freeze({ name: "Baby speed boost", attribute: "generic.movementSpeed", amount: 0.5, operation: 1, uuid: "b9766b59-9566-4402-bc1f-2ee2a276d836" });
export const SPAWN_BONUS = "Random spawn bonus";
const OWN_MAX_HEALTH_IDS = new Set(["Wolf", "Slime", "LavaSlime", "EntityHorse"]);
const isZombieLike = (id) => id === "Zombie" || id === "PigZombie";
const tag = (type, value) => ({ type, value });

// The base the port derives for one attribute of this record (before any `attributeBases` override).
export function derivedBase(e, javaId, name, fallback) {
  if (name === N.H) {
    if (javaId === "Wolf" && e.owner) return 20; // EntityTameable.setTamed -> maxHealth 20
    if ((javaId === "Slime" || javaId === "LavaSlime")) { const s = Number.isInteger(e.size) && e.size >= 1 ? e.size : 1; return s * s; }
    if (javaId === "EntityHorse" && Number.isFinite(e.horse?.maxHealth)) return e.horse.maxHealth;
  }
  if (javaId === "EntityHorse" && e.horse) { if (name === N.S && Number.isFinite(e.horse.speed)) return e.horse.speed; if (name === N.J && Number.isFinite(e.horse.jump)) return e.horse.jump; }
  return fallback;
}
const tableFor = (javaId) => JAVA_ATTRIBUTE_BASES[javaId];

// The modifiers one record contributes for one attribute: stored ones (operation order, as ModifiableAttributeInstance.func_111122_c), the baby boost
// the growingAge flag stands for and, when no stored modifier covers it, the follow range / knockback resistance spawn bonus the port keeps as a value.
function modifiersFor(e, javaId, name, base) {
  const stored = cleanModifiers(e.modifiers)?.filter((m) => m.attribute === name) ?? [];
  const out = stored.map((m) => ({ name: m.name, amount: m.amount, operation: m.operation, uuid: m.uuid }));
  if (name === N.S && isZombieLike(javaId) && (e.growingAge ?? 0) < 0 && !out.some((m) => m.uuid === BABY_BOOST.uuid)) out.push({ name: BABY_BOOST.name, amount: BABY_BOOST.amount, operation: BABY_BOOST.operation, uuid: BABY_BOOST.uuid });
  if (!stored.length) {
    if (name === N.F && Number.isFinite(e.followRange) && base > 0 && Math.abs(e.followRange - base) > 1e-9) out.push({ name: SPAWN_BONUS, amount: e.followRange / base - 1, operation: 1, uuid: deriveUuid(`followRange|${e.uuid ?? e.id ?? ""}`) });
    // The final value less the base (an imported base override already counts once).
    if (name === N.K && Number.isFinite(e.knockbackResistance) && Math.abs(e.knockbackResistance - base) > 1e-12) out.push({ name: SPAWN_BONUS, amount: e.knockbackResistance - base, operation: 0, uuid: deriveUuid(`knockback|${e.uuid ?? e.id ?? ""}`) });
  }
  return out.sort((a, b) => a.operation - b.operation);
}
const modifierTag = (m) => { const { most, least } = uuidLongs(m.uuid); return new Map([["Name", tag(NBT.STRING, m.name)], ["Amount", tag(NBT.DOUBLE, m.amount)], ["Operation", tag(NBT.INT, m.operation)], ["UUIDMost", tag(NBT.LONG, most)], ["UUIDLeast", tag(NBT.LONG, least)]]); };

// The reinforcement base of a zombie or pigman: the stored value less the leader bonus (mob-attributes.js attributesNbt).
function reinforcementBase(e) {
  const leader = (e.modifiers ?? []).find((m) => m.attribute === REINFORCEMENTS && m.name === LEADER_BONUS)?.amount ?? 0;
  return Math.max(0, Math.min(1, (Number.isFinite(e.reinforcement) ? e.reinforcement : 0) - leader));
}
// [[name, base]] and the modifiers of each, in native order, for one record; null when the class is not a living one.
export function livingAttributes(e, javaId) {
  const rows = tableFor(javaId);
  if (!rows) return null;
  const all = rows.map(([name, fallback]) => [name, e.attributeBases?.[name] ?? derivedBase(e, javaId, name, fallback)]);
  if (isZombieLike(javaId)) all.push([REINFORCEMENTS, reinforcementBase(e)]);
  return all.map(([name, base]) => ({ name, base, modifiers: modifiersFor(e, javaId, name, base) }));
}
// The Attributes list tag (null for an entity with no living class).
export function livingAttributesNbt(e, javaId) {
  const list = livingAttributes(e, javaId);
  if (!list) return null;
  return tag(NBT.LIST, { elementType: NBT.COMPOUND, items: list.map(({ name, base, modifiers }) => {
    const compound = new Map([["Name", tag(NBT.STRING, name)], ["Base", tag(NBT.DOUBLE, base)]]);
    if (modifiers.length) compound.set("Modifiers", tag(NBT.LIST, { elementType: NBT.COMPOUND, items: modifiers.map(modifierTag) }));
    return compound;
  }) });
}

// The record fields an Attributes list sets (EntityLivingBase.readEntityFromNBT reads it before HealF): the saved modifiers (the baby boost is the
// growingAge flag), followRange and knockbackResistance as final values, a zombie or pigman's maxHealth above 20 and reinforcement, and
// `attributeBases` for any other base that differs from what the record itself implies. `record` is the mob after its own fields were read.
export function livingAttributeFields(compound, record, javaId) {
  const list = nbtGet(compound, "Attributes", NBT.LIST), rows = tableFor(javaId);
  if (!rows || list?.elementType !== NBT.COMPOUND) return {};
  const known = new Set([...rows.map(([n]) => n), ...(isZombieLike(javaId) ? [REINFORCEMENTS] : [])]);
  const bases = {}, modifiers = [];
  for (const a of list.items) {
    const name = nbtGet(a, "Name", NBT.STRING, "");
    if (!known.has(name)) continue;
    const base = nbtGet(a, "Base", NBT.DOUBLE);
    if (Number.isFinite(base)) bases[name] = base;
    const mods = nbtGet(a, "Modifiers", NBT.LIST);
    for (const m of mods?.elementType === NBT.COMPOUND ? mods.items : []) {
      const amount = nbtGet(m, "Amount", NBT.DOUBLE), operation = nbtGet(m, "Operation", NBT.INT);
      if (!Number.isFinite(amount) || ![0, 1, 2].includes(operation) || modifiers.length >= 32) continue;
      const most = nbtGet(m, "UUIDMost", NBT.LONG), least = nbtGet(m, "UUIDLeast", NBT.LONG);
      const uuid = most !== undefined && least !== undefined ? longsUuid(most, least) : newUuid();
      // The child flag stands for the baby boost of a baby zombie or pigman; an adult keeps a saved one (EntityZombie.readEntityFromNBT calls setChild
      // only for IsBaby true, so the modifier stays: probed `babyBoost`, movementSpeed 0.345 on an adult zombie).
      if (uuid === BABY_BOOST.uuid && name === BABY_BOOST.attribute && amount === BABY_BOOST.amount && operation === BABY_BOOST.operation && isZombieLike(javaId) && (record.growingAge ?? 0) < 0) continue;
      modifiers.push({ attribute: name, name: nbtGet(m, "Name", NBT.STRING, ""), amount, operation, uuid });
    }
  }
  const out = {}, holder = { modifiers };
  if (modifiers.length) out.modifiers = modifiers;
  const fallback = Object.fromEntries(rows);
  const baseOf = (name) => bases[name] ?? derivedBase(record, javaId, name, fallback[name]);
  const follow = modifiedValue(holder, N.F, baseOf(N.F), 0, 2048);
  if (modifiers.some((m) => m.attribute === N.F) || follow !== fallback[N.F]) out.followRange = follow;
  const knock = modifiedValue(holder, N.K, baseOf(N.K), 0, 1);
  if (knock > 0 || javaId === "Zombie") out.knockbackResistance = knock; // a loaded zombie keeps its saved 0 (no fresh spawn roll)
  // Any class but those deriving their own maximum (tamed wolf, slime size, horse roll) keeps a max health its list changes (no 2048 cap: probed
  // `modEffect` clamp, 3020 kept); the zombie leader bonus is one such modifier.
  if (!OWN_MAX_HEALTH_IDS.has(javaId)) {
    const maxHealth = modifiedValue(holder, N.H, baseOf(N.H), 0, Number.MAX_VALUE);
    if (maxHealth !== fallback[N.H]) out.maxHealth = maxHealth;
  }
  if (isZombieLike(javaId)) {
    if (bases[REINFORCEMENTS] !== undefined || modifiers.some((m) => m.attribute === REINFORCEMENTS)) out.reinforcement = modifiedValue(holder, REINFORCEMENTS, bases[REINFORCEMENTS] ?? 0, 0, 1);
  }
  const overrides = {};
  for (const [name, base] of Object.entries(bases)) {
    if (name === REINFORCEMENTS) continue;
    if (base !== derivedBase(record, javaId, name, fallback[name])) overrides[name] = base;
  }
  if (Object.keys(overrides).length) out.attributeBases = overrides;
  return out;
}
