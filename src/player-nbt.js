import { POTION_TYPES, modifierAmount } from "./potions.js";
// EntityPlayerMP attribute list as the unchanged 1.7.10 classes write it (tools/probes/Entnbt95Probe.java, public/research/entnbt95-reference.json):
//  - generic.attackDamage carries the held stack's modifier (EntityLivingBase.onUpdate applies Item.getAttributeModifiers of the held item; AttributeModifier.isSaved
//    is true for it), only swords ("Weapon modifier") and the shovel / pickaxe / axe tiers ("Tool modifier"), all with the Item's shared UUID CB3F55D3-645C-4F38-A497-9C13A33DB5CF;
//  - a sprinting player holds the unsaved sprint modifier on generic.movementSpeed, so that attribute writes an empty `Modifiers` list while it lasts.
// Item id -> [modifier name, amount].
export const HELD_DAMAGE_MODIFIERS = Object.freeze({
  256: ["Tool modifier", 3], 257: ["Tool modifier", 4], 258: ["Tool modifier", 5], 267: ["Weapon modifier", 6], 268: ["Weapon modifier", 4],
  269: ["Tool modifier", 1], 270: ["Tool modifier", 2], 271: ["Tool modifier", 3], 272: ["Weapon modifier", 5], 273: ["Tool modifier", 2],
  274: ["Tool modifier", 3], 275: ["Tool modifier", 4], 276: ["Weapon modifier", 7], 277: ["Tool modifier", 4], 278: ["Tool modifier", 5],
  279: ["Tool modifier", 6], 283: ["Weapon modifier", 4], 284: ["Tool modifier", 1], 285: ["Tool modifier", 2], 286: ["Tool modifier", 3],
});
export const ITEM_MODIFIER_UUID = Object.freeze({ most: -3801225194067177672n, least: -6586624321849018929n });

// ---- batch 96 entnbt96 (tools/probes/Entnbt96Probe.java, public/research/entnbt96-reference.json) ----
// Entity.readFromNBT keeps each Motion component unless it is above 10 in magnitude (then that component is 0); EntityPlayerMP's server copy keeps what knockback and
// explosions gave it (nothing decays it), so the saved Motion is the port's server copy motion (ai.js PlayerView.motion, blocks per tick like native).
export function loadedMotion(values) {
  if (!Array.isArray(values) || values.length !== 3) return null;
  return values.map((v) => (Number.isNaN(v) || Math.abs(v) <= 10 ? v : 0)); // b97 entnbt97 (executed): NaN passes the limit test (the comparison is false) and is kept; infinity is above 10 and reads as 0
}
// JSON turns NaN into null; a stored Motion with null reads back as the NaN it was. Not an array of three numbers (or nulls): null.
export function restoredMotion(values) { return Array.isArray(values) && values.length === 3 && values.every((v) => v === null || typeof v === "number") ? values.map((v) => (v === null ? NaN : v)) : null; }
export function savedMotion(values) { return restoredMotion(values) ?? [0, 0, 0]; }

// PotionEffect modifiers on EntityPlayerMP: applied (and saved with the attribute, AttributeModifier.isSaved) when the effect is added in the session; an effect read from NBT
// comes without them unless the saved Attributes carry them (`bare` effects, status-effects.js). ModifiableAttributeInstance.func_111122_c collects every modifier in a
// HashSet, so the saved Modifiers list is in Java HashMap bucket order of the UUID hash (16 buckets), ties in operation then insertion order.
const uuidBits = (text) => { const h = text.replace(/-/g, ""); return { most: BigInt.asIntN(64, BigInt("0x" + h.slice(0, 16))), least: BigInt.asIntN(64, BigInt("0x" + h.slice(16))) }; };
const bucket = ({ most, least }) => { const hilo = BigInt.asIntN(64, most ^ least), h = Number(BigInt.asIntN(32, hilo >> 32n)) ^ Number(BigInt.asIntN(32, hilo)); return ((h ^ (h >>> 16)) & 15); };
export function savedAttributeModifiers(attribute, held, effects = []) {
  const mods = [];
  if (attribute === "generic.attackDamage" && HELD_DAMAGE_MODIFIERS[held]) { const [name, amount] = HELD_DAMAGE_MODIFIERS[held]; mods.push({ name, amount, operation: 0, ...ITEM_MODIFIER_UUID }); }
  for (const e of effects) {
    const type = POTION_TYPES[e?.id], m = type?.modifier;
    if (!m || m.attribute !== attribute || e.bare === true) continue;
    const amp = ((e.amplifier | 0) << 24) >> 24; // the amplifier is a signed byte
    mods.push({ name: `${type.key} ${amp}`, amount: modifierAmount(type, amp), operation: m.operation, ...uuidBits(m.uuid) });
  }
  return mods.map((m, i) => [m, i]).sort(([a, i], [b, j]) => bucket(a) - bucket(b) || a.operation - b.operation || i - j).map(([m]) => m);
}
