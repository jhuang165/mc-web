// MobSpawnerBaseLogic's SpawnData / SpawnPotentials (agq with its WeightedRandomMinecart entries agr), Minecraft Java 1.7.10.
// An entry is { type, weight, props } where `props` is the Properties compound as a src/nbt.js Map, so /summon-style tags
// and region NBT feed it unchanged. JSON helpers keep a save free of Maps and BigInts. Notes: public/research/spawner-cart.md.
import { NBT } from "./nbt.js";

const MINECART_TYPES = ["MinecartRideable", "MinecartChest", "MinecartFurnace"];
const int = (t) => (t && typeof t.value === "number" ? t.value | 0 : undefined);

// agr(logic, compound): Weight (int, 0 when absent), Properties (compound) and Type (string, default "Pig"); the legacy Type "Minecart"
// becomes MinecartRideable, MinecartChest or MinecartFurnace by Properties.Type (0, 1, 2; absent is 0, anything else stays "Minecart").
export function readEntry(tag, fallbackType = "Pig") {
  const props = tag.get("Properties")?.type === NBT.COMPOUND ? tag.get("Properties").value : new Map();
  let type = tag.get("Type")?.type === NBT.STRING ? tag.get("Type").value : fallbackType;
  if (type === "Minecart") type = MINECART_TYPES[int(props.get("Type")) ?? 0] ?? type; // a Properties.Type outside 0..2 keeps "Minecart"
  return { type, weight: tag.get("Weight") && typeof tag.get("Weight").value === "number" ? int(tag.get("Weight")) : 0, props };
}
// agq.a(dh) SpawnData: agr(logic, compound, EntityId) where the compound is itself the Properties and Type is the EntityId.
export function readSpawnData(compound, entityId) {
  return { ...readEntry(new Map([["Properties", { type: NBT.COMPOUND, value: compound }], ["Type", { type: NBT.STRING, value: entityId }]]), entityId), weight: 1 };
}
// agr.a(): Properties, Type, Weight.
export function entryToNbt(e) {
  return new Map([["Properties", { type: NBT.COMPOUND, value: e.props }], ["Type", { type: NBT.STRING, value: e.type }], ["Weight", { type: NBT.INT, value: e.weight }]]);
}

// WeightedRandom.getRandomItem(rand, list): total weight, nextInt(total), subtract until it falls below zero.
export function pickWeighted(random, entries) {
  let total = 0;
  for (const e of entries) total += e.weight;
  if (total <= 0) return null;
  let r = random.nextInt(total);
  for (const e of entries) {
    r -= e.weight;
    if (r < 0) return e;
  }
  return null;
}

// NBT tree <-> JSON ({t, v}; longs as decimal strings, lists keep elementType).
export function nbtToJson(tag) {
  switch (tag.type) {
    case NBT.COMPOUND: return { t: tag.type, v: [...tag.value].map(([k, v]) => [k, nbtToJson(v)]) };
    case NBT.LIST: return { t: tag.type, e: tag.value.elementType, v: tag.value.items.map((i) => nbtToJson({ type: tag.value.elementType, value: i })) };
    case NBT.LONG: return { t: tag.type, v: String(tag.value) };
    case NBT.BYTE_ARRAY: case NBT.INT_ARRAY: return { t: tag.type, v: [...tag.value] };
    default: return { t: tag.type, v: tag.value };
  }
}
export function nbtFromJson(j) {
  if (!j || typeof j !== "object" || !Number.isInteger(j.t)) return null;
  if (j.t === NBT.COMPOUND) return { type: NBT.COMPOUND, value: compoundFromJson(j) };
  if (j.t === NBT.LIST) {
    const items = (Array.isArray(j.v) ? j.v : []).map((i) => nbtFromJson(i)).filter(Boolean).map((i) => i.value);
    return { type: NBT.LIST, value: { elementType: j.e, items } };
  }
  if (j.t === NBT.LONG) return { type: j.t, value: BigInt(j.v) };
  return { type: j.t, value: j.v };
}
export function compoundFromJson(j) {
  const out = new Map();
  for (const [k, v] of Array.isArray(j?.v) ? j.v : []) {
    const t = nbtFromJson(v);
    if (typeof k === "string" && t) out.set(k, t);
  }
  return out;
}
export const entryToJson = (e) => ({ type: e.type, weight: e.weight, props: nbtToJson({ type: NBT.COMPOUND, value: e.props }) });
export const entryFromJson = (j) => (j && typeof j.type === "string" ? { type: j.type, weight: Number.isInteger(j.weight) ? j.weight : 1, props: compoundFromJson(j.props) } : null);

// A src/nbt.js tag tree as the [type, value] pairs the region exporter and Minecarts.toNBT use
// (compound [10, {key: pair}], list [9, elementType, items]).
export function tagToPair(tag) {
  if (tag.type === NBT.COMPOUND) return [10, compoundToPairs(tag.value)];
  if (tag.type === NBT.LIST) {
    const et = tag.value.elementType;
    return [9, et, tag.value.items.map((i) => (et === NBT.COMPOUND ? compoundToPairs(i) : et === NBT.LIST ? tagToPair({ type: et, value: i }).slice(1) : i))];
  }
  return [tag.type, tag.value];
}
export const compoundToPairs = (map) => Object.fromEntries([...map].map(([k, v]) => [k, tagToPair(v)]));
// MobSpawnerBaseLogic.b(dh) keys of a spawner state as pairs, in the original's order.
export function spawnerPairs(s) {
  const out = { EntityId: [8, s.entityId], Delay: [2, s.delay], MinSpawnDelay: [2, s.minSpawnDelay], MaxSpawnDelay: [2, s.maxSpawnDelay], SpawnCount: [2, s.spawnCount], MaxNearbyEntities: [2, s.maxNearbyEntities], RequiredPlayerRange: [2, s.requiredPlayerRange], SpawnRange: [2, s.spawnRange] };
  if (s.spawnData) out.SpawnData = [10, compoundToPairs(s.spawnData.props)];
  if (s.potentials?.length || s.spawnData) out.SpawnPotentials = [9, 10, (s.potentials?.length ? s.potentials : [s.spawnData]).map((e) => compoundToPairs(entryToNbt(e)))];
  return out;
}
