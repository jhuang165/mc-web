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
