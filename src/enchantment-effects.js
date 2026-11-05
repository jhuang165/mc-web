// Minecraft Java 1.7.10 live tool and weapon enchantment effects: the pieces of Block.harvestBlock,
// Block.dropBlockAsItemWithChance (and the per-block overrides), EntityPlayer.getCurrentPlayerStrVsBlock
// and EntityLivingBase.onDeath that depend on Efficiency, Aqua Affinity, Silk Touch, Fortune and
// Looting. Everything is replayed against public/research/enchantment-effects-reference.json
// (tools/verify-enchantment-effects.mjs runs the unchanged 1.7.10 classes).
//
// The rules here work on ORIGINAL block and item ids (the port keeps its own ids; callers map through
// block-registry.js / region-import.js). `rand` is a JavaRandom (World.rand); the draw order is the
// original's, including the three nextFloat draws of Block.dropBlockAsItem for every spawned stack.
import { blockItemId } from './doors-panes.js';
import {
  ENCHANTMENT, getEnchantmentLevel, getEfficiencyModifier, getSilkTouchModifier, getFortuneModifier,
  getLootingModifier, getAquaAffinityModifier, getKnockbackModifier, getFireAspectModifier,
  getEnchantmentModifierLiving, baneSlownessTicks,
} from './enchantments.js';
import { miningState } from './mining.js';
import { ITEMS, MATERIALS } from './survival.js';
import { fromOriginal, toOriginal } from './block-registry.js';
import { itemFromOriginal } from './region-import.js';

const SELF = (id) => ({ id, damage: 0 });
const META = (id, meta) => ({ id, damage: meta });

// Blocks whose original canSilkHarvest is true and what createStackedBlock returns (Block default:
// the block item, damage = meta only when the item has subtypes). Blocks absent from this table are
// harvested normally even under Silk Touch (crops, tall grass, snow layer, spawner, ...).
const SILK = {
  1: SELF, 2: SELF, 3: META, 13: SELF, 16: SELF, 21: SELF, 56: SELF, 129: SELF,
  73: () => SELF(73), 74: () => SELF(73),
  18: (id, meta) => META(id, meta & 3), 161: (id, meta) => META(id, meta & 3),
  20: SELF, 130: SELF, 95: META, 102: SELF, 160: META, 79: SELF, 174: SELF, 80: SELF, 82: SELF, 103: SELF, 47: SELF,
  153: SELF, 155: (id, meta) => META(id, meta === 3 || meta === 4 ? 2 : meta), // BlockOre / BlockQuartz.createStackedBlock
  110: SELF, 99: SELF, 100: SELF, 30: SELF, 120: SELF,
  101: SELF, // BlockPane.canSilkHarvest: iron bars (102, the glass pane, is above)
  // BlockSilverfish.createStackedBlock: the block the egg imitates (stone, cobblestone, a stone brick variant).
  97: (id, meta) => (meta === 1 ? META(4, 0) : meta >= 2 && meta <= 5 ? META(98, meta - 2) : META(1, 0)),
};
// Silk results are keyed by (id, meta): SELF ignores the meta, META keeps it.
const silkStack = (id, meta) => { const s = SILK[id]; if (!s) return null; const r = s === SELF ? SELF(id) : s(id, meta); return r; };

export const hasSilkTouchDrop = (id) => id in SILK;

const range = (rand, min, max) => (min >= max ? min : rand.nextInt(max - min + 1) + min); // MathHelper.getRandomIntegerInRange

// BlockOre.quantityDroppedWithBonus (coal, diamond, emerald, lapis ore).
const oreQuantity = (base) => (rand, fortune) => {
  if (fortune > 0) {
    let j = rand.nextInt(fortune + 2) - 1;
    if (j < 0) j = 0;
    return base(rand) * (j + 1);
  }
  return base(rand);
};
const ONE = () => 1;
// Per-block rules: item (null when nothing), damage, quantity (the original's quantityDroppedWithBonus),
// xp (called after the drops, only when the drop differs from the block's own item).
const RULES = {
  1: { item: () => 4 }, 2: { item: () => 3 }, 3: { item: () => 3 },
  130: { item: () => 49, quantity: () => 8 }, // BlockEnderChest: obsidian, quantityDropped 8 (probe: chests-reference.json facts)
  13: { item: (meta, rand, fortune) => { if (fortune > 3) fortune = 3; return rand.nextInt(10 - fortune * 3) === 0 ? 318 : 13; } },
  16: { item: () => 263, quantity: oreQuantity(ONE), xp: (rand) => range(rand, 0, 2) },
  56: { item: () => 264, quantity: oreQuantity(ONE), xp: (rand) => range(rand, 3, 7) },
  129: { item: () => 388, quantity: oreQuantity(ONE), xp: (rand) => range(rand, 3, 7) },
  21: { item: () => 351, damage: () => 4, quantity: oreQuantity((rand) => 4 + rand.nextInt(5)), xp: (rand) => range(rand, 2, 5) },
  73: { item: () => 331, quantity: (rand, fortune) => 4 + rand.nextInt(2) + rand.nextInt(fortune + 1), xp: (rand) => 1 + rand.nextInt(5) },
  20: { quantity: () => 0 }, 95: { quantity: () => 0 }, 79: { quantity: () => 0, ice: true }, 174: { quantity: () => 0 },
  // BlockPane and BlockEndPortalFrame roll the one-item loop but their getItemDropped is null.
  102: { item: () => null }, 160: { item: () => null }, 120: { item: () => null },
  80: { item: () => 332, quantity: () => 4 }, 82: { item: () => 337, quantity: () => 4 },
  103: { item: () => 360, quantity: (rand, fortune) => Math.min(9, 3 + rand.nextInt(5) + rand.nextInt(1 + fortune)) },
  47: { item: () => 340, quantity: () => 3 }, 110: { item: () => 3 },
  99: { item: () => 39, quantity: (rand) => Math.max(0, rand.nextInt(10) - 7) },
  100: { item: () => 40, quantity: (rand) => Math.max(0, rand.nextInt(10) - 7) },
  30: { item: () => 287 },
  153: { item: () => 406, quantity: oreQuantity(ONE), xp: (rand) => range(rand, 2, 5) }, // BlockOre: nether quartz ore
  31: { item: (meta, rand) => (rand.nextInt(8) === 0 ? 295 : null), quantity: (rand, fortune) => 1 + rand.nextInt(fortune * 2 + 1) },
};
RULES[74] = RULES[73];

// BlockLeaves.dropBlockAsItemWithChance (BlockOldLeaf 18, BlockNewLeaf 161).
function leaves(id, meta, rand, fortune, emit) {
  const type = meta & 3;
  let b = type === 3 && id === 18 ? 40 : 20;
  if (fortune > 0) { b -= 2 << fortune; if (b < 10) b = 10; }
  if (rand.nextInt(b) === 0) emit(6, id === 161 ? type + 4 : type);
  b = 200;
  if (fortune > 0) { b -= 10 << fortune; if (b < 40) b = 40; }
  if (type === (id === 18 ? 0 : 1) && rand.nextInt(b) === 0) emit(260, 0);
}
// BlockCrops.dropBlockAsItemWithChance (+ BlockPotato's poisonous potato).
const CROPS = { 59: [296, 295], 141: [391, 391], 142: [392, 392] };
function crops(id, meta, rand, fortune, emit) {
  const [crop, seed] = CROPS[id];
  if (rand.nextFloat() <= 1) emit(meta === 7 ? crop : seed, 0); // Block.dropBlockAsItemWithChance with fortune 0
  if (meta >= 7) {
    for (let k = 0; k < 3 + fortune; k++) if (rand.nextInt(15) <= meta) emit(seed, 0);
    if (id === 142 && rand.nextInt(50) === 0) emit(394, 0);
  }
}

export const harvestRuleBlocks = new Set([...Object.keys(RULES).map(Number), 18, 161, 59, 141, 142]);

// Block.harvestBlock for the player: Silk Touch when the block allows it, otherwise the normal drop
// with the Fortune level. Returns null for a block these rules do not cover (the caller keeps its
// own behaviour); otherwise {drops: [{id, count, damage}], xp, water}. `water` is BlockIce leaving
// flowing water when it is not silk-harvested (the caller still checks the block below).
// Silk Touch never reaches dropBlockAsItemWithChance, so it draws the three spawn floats only.
export function harvestBlock(id, meta, { silk = false, fortune = 0, rand }) {
  const out = { drops: [], xp: 0, water: false };
  const spawn = (item, count = 1) => { rand.nextFloat(); rand.nextFloat(); rand.nextFloat(); out.drops.push({ id: item.id, count, damage: item.damage }); };
  if (silk && id in SILK) {
    spawn(silkStack(id, meta));
    return out;
  }
  const emit = (itemId, damage) => spawn({ id: itemId, damage });
  if (id === 18 || id === 161) { leaves(id, meta, rand, fortune, emit); return out; }
  if (id in CROPS) { crops(id, meta, rand, fortune, emit); return out; }
  const rule = RULES[id];
  if (!rule) return null;
  if (rule.ice) out.water = true;
  const n = rule.quantity ? rule.quantity(rand, fortune) : 1;
  for (let k = 0; k < n; k++) {
    if (rand.nextFloat() <= 1) {
      const item = rule.item ? rule.item(meta, rand, fortune) : id;
      if (item != null) emit(item, rule.damage ? rule.damage(meta) : 0);
    }
  }
  if (rule.xp && rule.item && rule.item(0, rand, fortune) !== id) out.xp = rule.xp(rand);
  return out;
}

// A Java-like random for callers that only have a Math.random style function.
export const javaLikeRandom = (random) => ({ nextFloat: () => random(), nextInt: (bound) => (bound === undefined ? Math.floor(random() * 4294967296) - 2147483648 : Math.floor(random() * bound)) });

// The live player break with Silk Touch or Fortune on the held tool: Block.harvestBlock in the port's ids.
// Returns null when neither enchantment is on the stack, the block is not covered, or a drop has no
// counterpart in this build (the caller keeps its normal path); otherwise
// {drops: [{id, count, damage?}], xp, silk, water}. Silk drops carry no damage: the caller derives it
// from the broken block's metadata as it does for any block that drops itself.
export function enchantedBreakDrops(block, meta, held, rand) {
  const silk = getSilkTouchModifier(held), fortune = getFortuneModifier(held);
  if (!silk && !fortune) return null;
  const orig = toOriginal(block, meta);
  if (!orig) return null;
  const [id, originalMeta] = orig;
  if (!harvestRuleBlocks.has(id) && !(silk && id in SILK)) return null;
  const silkTaken = silk && id in SILK;
  // Resolve every drop before consuming randomness, so an unmappable result falls back untouched.
  if (silkTaken) {
    const stack = silkStack(id, originalMeta), b = fromOriginal(stack.id, stack.damage);
    if (!b) return null;
  }
  const r = harvestBlock(id, originalMeta, { silk, fortune, rand });
  if (!r) return null;
  const drops = [];
  for (const d of r.drops) {
    if (silkTaken) { const sb = fromOriginal(d.id, d.damage).id; drops.push({ id: blockItemId(sb), count: d.count, ...(sb === 140 || sb === 141 ? { damage: d.damage } : {}) }); }
    else {
      const item = itemFromOriginal(d.id, d.damage);
      if (!item) continue;
      drops.push({ id: item.id, count: d.count, damage: item.damage });
    }
  }
  return { drops, xp: r.xp, silk: silkTaken, water: r.water };
}

// ---- digging --------------------------------------------------------------

// Enchantment levels the player mining speed needs: Efficiency from the held tool, Aqua Affinity
// from the worn armour (EnchantmentHelper.getAquaAffinityModifier looks at the helmet).
export function miningEnchantments(held, armor = []) {
  return { efficiency: held ? getEfficiencyModifier(held) : 0, aquaAffinity: getAquaAffinityModifier(armor.filter(Boolean)) };
}

// Survival.mining with the player's live enchantments (Efficiency of the held tool, Aqua Affinity of the
// worn helmet). Without either it is exactly survival.mining, so stubbed or older callers behave as before.
export function playerMiningState(survival, block, toolId, underwater = false, onGround = true) {
  const state = enchantedMiningState(survival, block, toolId, underwater, onGround), haste = survival.effects?.digSpeedMultiplier?.() ?? 1;
  // EntityPlayer.getBreakSpeed: Haste and Mining Fatigue scale the break speed (progress is linear in it).
  return haste === 1 || !(state.progress > 0) ? state : { ...state, progress: Math.max(0, Math.fround(state.progress * haste)) };
}
function enchantedMiningState(survival, block, toolId, underwater, onGround) {
  const held = survival.held, tool = held && held.id === toolId ? held : null;
  const { efficiency, aquaAffinity } = miningEnchantments(tool, survival.inventory?.armor);
  if (!efficiency && !aquaAffinity) return survival.mining(block, toolId, underwater, onGround);
  return miningState(block, MATERIALS[block], survival.count(toolId) ? ITEMS[toolId] : null, { underwater, onGround, efficiency, aquaAffinity });
}

// ---- attacking ------------------------------------------------------------

// EntityLivingBase.getCreatureAttribute of this build's mobs (zombies and skeletons are undead,
// spiders arthropods, everything else EnumCreatureAttribute.UNDEFINED).
export const creatureAttribute = (type) => (type === "zombie" || type === "skeleton" ? "UNDEAD" : type === "spider" || type === "cave_spider" ? "ARTHROPOD" : "UNDEFINED");

// What the held weapon adds to EntityPlayer.attackTargetEntityWithCurrentItem: Sharpness/Smite/Bane
// damage (getEnchantmentModifierLiving), Knockback and Fire Aspect levels, and the Looting level.
export function weaponEnchantments(held, type) {
  if (!held) return { damage: 0, knockback: 0, fireAspect: 0, looting: 0 };
  return {
    damage: getEnchantmentModifierLiving(held, creatureAttribute(type)),
    knockback: getKnockbackModifier(held),
    fireAspect: getFireAspectModifier(held),
    looting: getLootingModifier(held),
  };
}

// EnchantmentHelper.func_151385_b(attacker, target) for Bane of Arthropods: the player's worn armour in
// slot order, then the held item, each rolling 20 + nextInt(10 * level) on the player's own Random for
// an arthropod target. Returns the slowness IV duration, the longest of the rolls (PotionEffect.combine).
export function arthropodSlowness(armor, held, type, rand) {
  if (creatureAttribute(type) !== "ARTHROPOD") return null;
  let ticks = null;
  for (const stack of [...(armor ?? []), held]) {
    const level = stack ? getEnchantmentLevel(ENCHANTMENT.baneOfArthropods.id, stack) : 0;
    if (level > 0) ticks = Math.max(ticks ?? 0, baneSlownessTicks(level, rand)); // same amplifier: PotionEffect.combine keeps the longer
  }
  return ticks;
}
