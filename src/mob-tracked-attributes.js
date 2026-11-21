// b89 mobpackets89: the watched attributes of a mob, the rows of the S20 (entity properties) packet the dedicated server's mob tracker sends.
//
// Bytecode-read (javap -c -p, 1.7.10 jar):
//   * SharedMonsterAttributes (yj) <clinit>: generic.maxHealth (20, 0..Double.MAX_VALUE) and generic.movementSpeed ((double)0.7F) are RangedAttribute.setShouldWatch(true)
//     (to.a(true)); generic.followRange, generic.knockbackResistance and generic.attackDamage are not. EntityHorse (wi): horse.jumpStrength (0.7, 0..2) is watched;
//     EntityZombie (yq): zombie.spawnReinforcements is not. So no S20 ever carries follow range, knockback resistance, attack damage or the reinforcement chance.
//   * ServersideAttributeMap.func_111149_a (tq.a(tn)): an instance joins the dirty set (tq.b()) only when its attribute is watched; ModifiableAttributeInstance.setBaseValue
//     (tn.a(double)) returns when the value is unchanged, otherwise (and on every applyModifier / removeModifier) it flags itself dirty (tn.f -> tl.a(tn)). Registering an
//     attribute (tq.b(th)) flags nothing.
//   * EntityTrackerEntry.tryStartWachingThis (my.b(mw)): S20 `il(id, tq.c())`, every watched instance, when the collection is not empty (every living entity has two).
//   * EntityTrackerEntry.func_111190_b (my.b()), from sendLocationToAllClients' gated branch: S20 `il(id, tq.b())` of the dirty set when it is not empty, then the set is cleared.
// Executed (tools/probes/MobPackets89Probe.java, public/research/mobpackets89-reference.json): the dirty set after each living class's constructor is the watched attributes whose
// base the class sets away from the default (maxHealth 20, movementSpeed (double)0.7F); onSpawnWithEgg adds a horse's three (its random stats) and a baby zombie's speed; potion
// effects that carry modifiers (Speed, Slowness, Health Boost) dirty their attribute on every add, even when the same effect is added again and the value does not change.
//
// A row is { name, base, mods: [[amount, operation], ...], value }: the base the instance holds, its modifiers (the stored ones of an imported Attributes list and the live
// ones: potion effects, the baby, enderman, pigman, witch and ocelot boosts), and the value they give. The native packet carries each modifier's UUID too; the copy reads only
// the value (see remote-mobs.js).
import { ENTITY_TYPES, moveSpeedModifiers } from "./entities.js";
import { liveAttribute, healthBoostExtra, BABY_BOOST_UUID } from "./mob-attributes.js";
import { maxHealthOf } from "./mob-riding.js";

// The default values of the watched attributes (RangedAttribute's default): a base that differs was set by the constructor, so it is in the first dirty set.
export const WATCHED_DEFAULTS = Object.freeze({ "generic.maxHealth": 20, "generic.movementSpeed": Math.fround(0.7), "horse.jumpStrength": 0.7 });
// Entities the mob tracker carries that are not EntityLivingBase (no attribute map, no S20).
const NOT_LIVING = new Set(["ender_crystal"]);

const storedOf = (e, name) => {
  const out = [];
  for (const m of e.modifiers ?? []) if (m.attribute === name && m.uuid !== BABY_BOOST_UUID) out.push([m.amount, m.operation]);
  return out;
};

// The watched attribute rows of a living mob (an empty list for anything else).
export function watchedAttributes(e) {
  const t = ENTITY_TYPES[e?.type];
  if (!t || NOT_LIVING.has(e.type)) return [];
  const rows = [];
  // generic.maxHealth: the port's maximum (mob-riding.js maxHealthOf) with the Health Boost modifier; the base is the same maximum without any modifier
  {
    const name = "generic.maxHealth", typeBase = e.horse?.maxHealth ?? t.health, boost = healthBoostExtra(e), stored = storedOf(e, name);
    const value = maxHealthOf(e, typeBase);
    const base = boost.length || stored.length ? maxHealthOf({ ...e, modifiers: (e.modifiers ?? []).filter((m) => m.attribute !== name), effects: (e.effects ?? []).filter((x) => x.id !== 21) }, typeBase) : value;
    rows.push({ name, base, mods: [...stored, ...boost], value });
  }
  // generic.movementSpeed: the type's base (a horse's own), the stored modifiers, then the live ones (entities.js aiMoveSpeed reads the same value)
  {
    const name = "generic.movementSpeed", typeBase = e.horse?.speed ?? t.movement, live = moveSpeedModifiers(e);
    rows.push({ name, base: e.attributeBases?.[name] ?? typeBase, mods: [...storedOf(e, name), ...live], value: liveAttribute(e, name, typeBase, live) });
  }
  if (e.type === "horse" && e.horse) {
    const name = "horse.jumpStrength", typeBase = e.horse.jump ?? 0.7;
    rows.push({ name, base: e.attributeBases?.[name] ?? typeBase, mods: storedOf(e, name), value: liveAttribute(e, name, typeBase) });
  }
  return rows;
}

// The rows a mob's first tracker pass sends: the dirty set its construction and spawn left. A row is in it when the class's constructor sets that base away from the default
// (the type's own maximum health or speed: a tamed wolf's 20 was set over the constructor's 8), when the base now differs from the default (a horse's rolled jump), or when it
// carries a modifier (each applyModifier flags it).
const madeBase = (e, name) => { const t = ENTITY_TYPES[e.type]; return name === "generic.maxHealth" ? t.health : name === "generic.movementSpeed" ? t.movement : undefined; };
export const firstDirty = (e, rows) => rows.filter((r) => { const d = WATCHED_DEFAULTS[r.name], m = madeBase(e, r.name); return (m !== undefined && m !== d) || (e.type === "horse" && r.name !== "horse.jumpStrength") || r.base !== d || r.mods.length > 0; });
// A row's identity for the change test of later passes.
export const rowKey = (r) => `${r.base}|${r.value}|${r.mods.map((m) => m[0] + ":" + m[1]).join(",")}`;
