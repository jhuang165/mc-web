// The Attributes list of a zombie or zombie pigman (EntityLivingBase.writeEntityToNBT: SharedMonsterAttributes.func_111257_a), with the
// AttributeModifiers the spawn rolls add, probed in interchange-reference.json (InterchangeProbe, 72 records):
//   generic.maxHealth 20 (+ "Leader zombie bonus", operation 2, amount 1 to 4),
//   generic.knockbackResistance 0 (+ "Random spawn bonus", operation 0), generic.movementSpeed 0.23 (pigman 0.5),
//   generic.followRange 40 (+ "Random spawn bonus" operation 1, "Random zombie-spawn bonus" operation 2 above 1), generic.attackDamage 3 (pigman 5),
//   zombie.spawnReinforcements (random 0 to 0.1, + "Leader zombie bonus", operation 0, amount 0.5 to 0.75).
// Each modifier is { Name, Amount, Operation, UUIDMost, UUIDLeast }. A record keeps them as e.modifiers: { attribute, name, amount, operation, uuid }.
import { NBT } from "./nbt.js";
import { nbtGet } from "./nbt-get.js";
import { attributeValue } from "./difficulty.js";
import { longsUuid, uuidLongs, newUuid, isUuid } from "./entity-uuid.js";

export const ZOMBIE_ATTRIBUTES = Object.freeze({
  zombie: { "generic.maxHealth": 20, "generic.knockbackResistance": 0, "generic.movementSpeed": 0.23000000417232513, "generic.followRange": 40, "generic.attackDamage": 3 },
  pigman: { "generic.maxHealth": 20, "generic.knockbackResistance": 0, "generic.movementSpeed": 0.5, "generic.followRange": 40, "generic.attackDamage": 5 },
});
export const MODIFIED_ATTRIBUTES = new Set([...Object.keys(ZOMBIE_ATTRIBUTES.zombie), "zombie.spawnReinforcements"]);
export const LEADER_BONUS = "Leader zombie bonus";

// A saved modifier list cleaned the way the loader would accept it (a known attribute, a finite amount, operation 0 to 2).
export function cleanModifiers(list) {
  if (!Array.isArray(list)) return undefined;
  const out = list.slice(0, 32).filter((m) => m && MODIFIED_ATTRIBUTES.has(m.attribute) && typeof m.name === "string" && Number.isFinite(m.amount) && [0, 1, 2].includes(m.operation))
    .map((m) => ({ attribute: m.attribute, name: m.name, amount: m.amount, operation: m.operation, uuid: isUuid(m.uuid) ? m.uuid.toLowerCase() : newUuid() }));
  return out.length ? out : undefined;
}
// ModifiableAttributeInstance.getAttributeValue over this record's modifiers for one attribute.
export const modifiedValue = (e, attribute, base, min = -Infinity, max = Infinity) =>
  attributeValue(base, (e.modifiers ?? []).filter((m) => m.attribute === attribute).map((m) => [m.amount, m.operation]), min, max);
export const leaderAmount = (e, attribute) => (e.modifiers ?? []).find((m) => m.attribute === attribute && m.name === LEADER_BONUS)?.amount;

const tag = (type, value) => ({ type, value });
const entries = (o) => new Map(Object.entries(o));
// The Attributes list tag for a zombie or pigman record (`reinforcementBase` is the spawnReinforcements base, the stored value less the leader bonus).
export function attributesNbt(e, type) {
  const bases = ZOMBIE_ATTRIBUTES[type];
  if (!bases) return null;
  const leader = leaderAmount(e, "zombie.spawnReinforcements") ?? 0;
  const reinforcement = Math.max(0, Math.min(1, (Number.isFinite(e.reinforcement) ? e.reinforcement : 0) - leader));
  const all = { ...bases, "zombie.spawnReinforcements": reinforcement };
  const items = Object.entries(all).map(([name, base]) => {
    const compound = { Name: tag(NBT.STRING, name), Base: tag(NBT.DOUBLE, base) };
    const mods = (e.modifiers ?? []).filter((m) => m.attribute === name);
    if (mods.length) {
      compound.Modifiers = tag(NBT.LIST, { elementType: NBT.COMPOUND, items: mods.map((m) => {
        const { most, least } = uuidLongs(m.uuid);
        return entries({ Name: tag(NBT.STRING, m.name), Amount: tag(NBT.DOUBLE, m.amount), Operation: tag(NBT.INT, m.operation), UUIDMost: tag(NBT.LONG, most), UUIDLeast: tag(NBT.LONG, least) });
      }) });
    }
    return entries(compound);
  });
  return tag(NBT.LIST, { elementType: NBT.COMPOUND, items });
}

// Read the Attributes list of a zombie or pigman compound into { modifiers, maxHealth, reinforcement } (EntityLivingBase.readEntityFromNBT
// -> SharedMonsterAttributes.func_151475_a: base value, then each modifier). maxHealth is only given when it exceeds the type's 20.
export function attributeFieldsFromNbt(compound) {
  const list = nbtGet(compound, "Attributes", NBT.LIST);
  if (list?.elementType !== NBT.COMPOUND) return {};
  const modifiers = [], bases = {};
  for (const a of list.items) {
    const name = nbtGet(a, "Name", NBT.STRING, "");
    if (!MODIFIED_ATTRIBUTES.has(name)) continue;
    const base = nbtGet(a, "Base", NBT.DOUBLE);
    if (Number.isFinite(base)) bases[name] = base;
    const mods = nbtGet(a, "Modifiers", NBT.LIST);
    for (const m of mods?.elementType === NBT.COMPOUND ? mods.items : []) {
      const amount = nbtGet(m, "Amount", NBT.DOUBLE), operation = nbtGet(m, "Operation", NBT.INT);
      if (!Number.isFinite(amount) || ![0, 1, 2].includes(operation) || modifiers.length >= 32) continue;
      const most = nbtGet(m, "UUIDMost", NBT.LONG), least = nbtGet(m, "UUIDLeast", NBT.LONG);
      modifiers.push({ attribute: name, name: nbtGet(m, "Name", NBT.STRING, ""), amount, operation, uuid: most !== undefined && least !== undefined ? longsUuid(most, least) : newUuid() });
    }
  }
  const out = {};
  if (modifiers.length) out.modifiers = modifiers;
  const holder = { modifiers };
  const maxHealth = modifiedValue(holder, "generic.maxHealth", bases["generic.maxHealth"] ?? 20, 0, 2048);
  if (maxHealth > 20) out.maxHealth = maxHealth;
  if (bases["zombie.spawnReinforcements"] !== undefined || modifiers.some((m) => m.attribute === "zombie.spawnReinforcements"))
    out.reinforcement = modifiedValue(holder, "zombie.spawnReinforcements", bases["zombie.spawnReinforcements"] ?? 0, 0, 1);
  return out;
}
