// Minecraft Java 1.7.10 potions: Potion (rv), PotionEffect (rw), PotionHelper (aen) and the ItemPotion (adp) naming/tooltip rules,
// ported from the unchanged classes. Evidence: tools/probes/PotionProbe.java -> public/research/potions-reference.json (all 32768
// damage values as digests, ingredient application for every ingredient string, English names), replayed by src/potions.test.js.
// See public/research/potions.md. A potion item's damage value holds the brew: bits 0-4 pick the effect and duration, bit 5 the
// amplifier, bit 13 "drinkable" (8192), bit 14 "splash" (16384).
import { translate as tl } from "./lang.js";
const f = Math.fround;

export const ITEM_GLASS_BOTTLE = 384, ITEM_POTION = 385; // internal ids (original 374 / 373)
export const SPLASH_BIT = 16384, DRINKABLE_BIT = 8192;

// Potion ids (Potion.potionTypes index)
export const POTION = Object.freeze({
  SPEED: 1, SLOWNESS: 2, HASTE: 3, MINING_FATIGUE: 4, STRENGTH: 5, INSTANT_HEALTH: 6, INSTANT_DAMAGE: 7, JUMP_BOOST: 8, NAUSEA: 9,
  REGENERATION: 10, RESISTANCE: 11, FIRE_RESISTANCE: 12, WATER_BREATHING: 13, INVISIBILITY: 14, BLINDNESS: 15, NIGHT_VISION: 16,
  HUNGER: 17, WEAKNESS: 18, POISON: 19, WITHER: 20, HEALTH_BOOST: 21, ABSORPTION: 22, SATURATION: 23,
});
const P = POTION;
const MOVE_UUID = "91aeaa56-376b-4498-935b-2f7f68070635", SLOW_UUID = "7107de5e-7ce8-4030-940e-514c1f160890", STRENGTH_UUID = "648d7064-6a60-4f59-8abe-c2c23a6dd7a9",
  WEAKNESS_UUID = "22653b89-116e-49dc-9b6b-9971489b5be5", HEALTH_UUID = "5d6f0ba2-1186-46ac-b896-c61c5cee99cc";
// id: [name key, liquid colour, instant, bad, effectiveness, status icon index (-1 none), attribute modifier or null, English name, English "Potion of" name]
const T = (id, key, color, instant, bad, eff, icon, mod, name, postfix) => ({ id, key, color, instant, bad, effectiveness: eff, icon, modifier: mod, name, postfix });
export const POTION_TYPES = Object.freeze({
  [P.SPEED]: T(1, "potion.moveSpeed", 8171462, false, false, 1, 0, { attribute: "generic.movementSpeed", uuid: MOVE_UUID, base: 0.20000000298023224, operation: 2 }, "Speed", "Potion of Swiftness"),
  [P.SLOWNESS]: T(2, "potion.moveSlowdown", 5926017, false, true, 0.5, 1, { attribute: "generic.movementSpeed", uuid: SLOW_UUID, base: -0.15000000596046448, operation: 2 }, "Slowness", "Potion of Slowness"),
  [P.HASTE]: T(3, "potion.digSpeed", 14270531, false, false, 1.5, 2, null, "Haste", "Potion of Haste"),
  [P.MINING_FATIGUE]: T(4, "potion.digSlowDown", 4866583, false, true, 0.5, 3, null, "Mining Fatigue", "Potion of Dullness"),
  [P.STRENGTH]: T(5, "potion.damageBoost", 9643043, false, false, 1, 4, { attribute: "generic.attackDamage", uuid: STRENGTH_UUID, base: 3, operation: 2, scale: 1.3 / 3 }, "Strength", "Potion of Strength"),
  [P.INSTANT_HEALTH]: T(6, "potion.heal", 16262179, true, false, 1, -1, null, "Instant Health", "Potion of Healing"),
  [P.INSTANT_DAMAGE]: T(7, "potion.harm", 4393481, true, true, 0.5, -1, null, "Instant Damage", "Potion of Harming"),
  [P.JUMP_BOOST]: T(8, "potion.jump", 7889559, false, false, 1, 10, null, "Jump Boost", "Potion of Leaping"),
  [P.NAUSEA]: T(9, "potion.confusion", 5578058, false, true, 0.25, 11, null, "Nausea", "Potion of Nausea"),
  [P.REGENERATION]: T(10, "potion.regeneration", 13458603, false, false, 0.25, 7, null, "Regeneration", "Potion of Regeneration"),
  [P.RESISTANCE]: T(11, "potion.resistance", 10044730, false, false, 1, 14, null, "Resistance", "Potion of Resistance"),
  [P.FIRE_RESISTANCE]: T(12, "potion.fireResistance", 14981690, false, false, 1, 15, null, "Fire Resistance", "Potion of Fire Resistance"),
  [P.WATER_BREATHING]: T(13, "potion.waterBreathing", 3035801, false, false, 1, 16, null, "Water Breathing", "Potion of Water Breathing"),
  [P.INVISIBILITY]: T(14, "potion.invisibility", 8356754, false, false, 1, 8, null, "Invisibility", "Potion of Invisibility"),
  [P.BLINDNESS]: T(15, "potion.blindness", 2039587, false, true, 0.25, 13, null, "Blindness", "Potion of Blindness"),
  [P.NIGHT_VISION]: T(16, "potion.nightVision", 2039713, false, false, 1, 12, null, "Night Vision", "Potion of Night Vision"),
  [P.HUNGER]: T(17, "potion.hunger", 5797459, false, true, 0.5, 9, null, "Hunger", "Potion of Hunger"),
  [P.WEAKNESS]: T(18, "potion.weakness", 4738376, false, true, 0.5, 5, { attribute: "generic.attackDamage", uuid: WEAKNESS_UUID, base: 2, operation: 0, scale: -0.25 }, "Weakness", "Potion of Weakness"),
  [P.POISON]: T(19, "potion.poison", 5149489, false, true, 0.25, 6, null, "Poison", "Potion of Poison"),
  [P.WITHER]: T(20, "potion.wither", 3484199, false, true, 0.25, 17, null, "Wither", "Potion of Decay"),
  [P.HEALTH_BOOST]: T(21, "potion.healthBoost", 16284963, false, false, 1, 18, { attribute: "generic.maxHealth", uuid: HEALTH_UUID, base: 4, operation: 0 }, "Health Boost", "Potion of Health Boost"),
  [P.ABSORPTION]: T(22, "potion.absorption", 2445989, false, false, 1, 18, null, "Absorption", "Potion of Absorption"),
  [P.SATURATION]: T(23, "potion.saturation", 16262179, true, false, 1, -1, null, "Saturation", "Potion of Saturation"),
});
// Potion.func_111183_a(amplifier, modifier): the amount of an attribute modifier at an amplifier (PotionAttackDamage scales 130%/-50% steps).
export function modifierAmount(type, amplifier) {
  const m = type.modifier;
  if (!m) return 0;
  if (type.id === P.STRENGTH) return 1.3 * (amplifier + 1); // PotionAttackDamage: strength adds 130% per level, weakness subtracts 0.5 per level
  if (type.id === P.WEAKNESS) return -0.5 * (amplifier + 1);
  return m.base * (amplifier + 1);
}

// PotionHelper requirement strings and amplifier strings (the HashMaps n and o), ingredient effect strings.
export const REQUIREMENTS = Object.freeze({
  [P.REGENERATION]: "0 & !1 & !2 & !3 & 0+6", [P.SPEED]: "!0 & 1 & !2 & !3 & 1+6", [P.FIRE_RESISTANCE]: "0 & 1 & !2 & !3 & 0+6",
  [P.INSTANT_HEALTH]: "0 & !1 & 2 & !3", [P.POISON]: "!0 & !1 & 2 & !3 & 2+6", [P.WEAKNESS]: "!0 & !1 & !2 & 3 & 3+6",
  [P.INSTANT_DAMAGE]: "!0 & !1 & 2 & 3", [P.SLOWNESS]: "!0 & 1 & !2 & 3 & 3+6", [P.STRENGTH]: "0 & !1 & !2 & 3 & 3+6",
  [P.NIGHT_VISION]: "!0 & 1 & 2 & !3 & 2+6", [P.INVISIBILITY]: "!0 & 1 & 2 & 3 & 2+6", [P.WATER_BREATHING]: "0 & !1 & 2 & 3 & 2+6",
});
export const AMPLIFIERS = Object.freeze({ [P.SPEED]: "5", [P.HASTE]: "5", [P.STRENGTH]: "5", [P.INSTANT_HEALTH]: "5", [P.INSTANT_DAMAGE]: "5", [P.REGENERATION]: "5", [P.RESISTANCE]: "5", [P.POISON]: "5" });
export const INGREDIENT = Object.freeze({
  netherWart: "+4", sugar: "-0+1-2-3&4-4+13", ghastTear: "+0-1-2-3&4-4+13", spiderEye: "-0-1+2-3&4-4+13", fermentedSpiderEye: "-0+3-4+13",
  speckledMelon: "+0-1+2-3&4-4+13", blazePowder: "+0-1-2+3&4-4+13", magmaCream: "+0+1-2-3&4-4+13", goldenCarrot: "-0+1+2-3+13&4-4",
  pufferfish: "+0-1+2+3+13&4-4", glowstone: "+5-6-7", redstone: "-5+6-7", gunpowder: "+14&13-13",
});
const PREFIXES = ["potion.prefix.mundane", "potion.prefix.uninteresting", "potion.prefix.bland", "potion.prefix.clear", "potion.prefix.milky", "potion.prefix.diffuse", "potion.prefix.artless", "potion.prefix.thin", "potion.prefix.awkward", "potion.prefix.flat", "potion.prefix.bulky", "potion.prefix.bungling", "potion.prefix.buttered", "potion.prefix.smooth", "potion.prefix.suave", "potion.prefix.debonair", "potion.prefix.thick", "potion.prefix.elegant", "potion.prefix.fancy", "potion.prefix.charming", "potion.prefix.dashing", "potion.prefix.refined", "potion.prefix.cordial", "potion.prefix.sparkling", "potion.prefix.potent", "potion.prefix.foul", "potion.prefix.odorless", "potion.prefix.rank", "potion.prefix.harsh", "potion.prefix.acrid", "potion.prefix.gross", "potion.prefix.stinky"];
const PREFIX_NAMES = ["Mundane", "Uninteresting", "Bland", "Clear", "Milky", "Diffuse", "Artless", "Thin", "Awkward", "Flat", "Bulky", "Bungling", "Buttered", "Smooth", "Suave", "Debonair", "Thick", "Elegant", "Fancy", "Charming", "Dashing", "Refined", "Cordial", "Sparkling", "Potent", "Foul", "Odorless", "Rank", "Harsh", "Acrid", "Gross", "Stinky"];

// PotionHelper.checkFlag / func_77909_a: the five-bit prefix index
const isSet = (meta, bit) => (meta & (1 << bit)) !== 0;
const bitCount = (n) => { let c = 0; while (n > 0) { n &= n - 1; c++; } return c; };
const prefixIndex = (meta) => (isSet(meta, 5) ? 16 : 0) | (isSet(meta, 4) ? 8 : 0) | (isSet(meta, 3) ? 4 : 0) | (isSet(meta, 2) ? 2 : 0) | (isSet(meta, 1) ? 1 : 0);
export const potionPrefixKey = (meta) => PREFIXES[prefixIndex(meta)];
export const potionPrefix = (meta) => PREFIX_NAMES[prefixIndex(meta)];

// PotionHelper.func_77904_a: one term of a requirement string
function term(unset, mult, negate, mode, bit, factor, meta) {
  let r = 0;
  if (unset) r = isSet(meta, bit) ? 0 : 1;
  else if (mode !== -1) {
    if (mode === 0 && bitCount(meta) === bit) r = 1;
    else if (mode === 1 && bitCount(meta) > bit) r = 1;
    else if (mode === 2 && bitCount(meta) < bit) r = 1;
  } else r = isSet(meta, bit) ? 1 : 0;
  if (mult) r *= factor;
  if (negate) r *= -1;
  return r;
}
// PotionHelper.func_77912_a: evaluate a requirement string (`|` or, `&` and, `!` not, `*` multiplier, `=<>` bit-count tests, `-` negate)
function parse(s, begin, end, meta) {
  if (begin >= s.length || end < 0 || begin >= end) return 0;
  const bar = s.indexOf("|", begin);
  if (bar >= 0 && bar < end) {
    const l = parse(s, begin, bar - 1, meta);
    if (l > 0) return l;
    const r = parse(s, bar + 1, end, meta);
    return r > 0 ? r : 0;
  }
  const amp = s.indexOf("&", begin);
  if (amp >= 0 && amp < end) {
    const l = parse(s, begin, amp - 1, meta);
    if (l <= 0) return 0;
    const r = parse(s, amp + 1, end, meta);
    return r <= 0 ? 0 : l > r ? l : r;
  }
  let star = false, hasFactor = false, hasBit = false, unset = false, negate = false, mode = -1, bit = 0, factor = 0, sum = 0;
  const flush = () => {
    sum += term(unset, hasFactor, negate, mode, bit, factor, meta);
    hasBit = unset = negate = star = hasFactor = false;
    bit = factor = 0;
    mode = -1;
  };
  for (let i = begin; i < end; i++) {
    const c = s[i];
    if (c >= "0" && c <= "9") {
      if (star) { factor = c.charCodeAt(0) - 48; hasFactor = true; } else { bit = bit * 10 + c.charCodeAt(0) - 48; hasBit = true; }
    } else if (c === "*") star = true;
    else if (c === "!") { if (hasBit) flush(); unset = true; }
    else if (c === "-") { if (hasBit) flush(); negate = true; }
    else if (c !== "=" && c !== "<" && c !== ">") { if (c === "+" && hasBit) flush(); }
    else {
      if (hasBit) flush();
      mode = c === "=" ? 0 : c === "<" ? 2 : 1;
    }
  }
  if (hasBit) sum += term(unset, hasFactor, negate, mode, bit, factor, meta);
  return sum;
}

// PotionEffect (rw)
export const makeEffect = (id, duration, amplifier = 0, splash = false) => ({ id, duration, amplifier, splash });
export const effectsEqual = (a, b) => a.id === b.id && a.duration === b.duration && a.amplifier === b.amplifier && !!a.splash === !!b.splash;
export const effectListsEqual = (a, b) => (a === b) || (!!a && !!b && a.length === b.length && a.every((e, i) => effectsEqual(e, b[i])));
const javaRound = (x) => Math.floor(x + 0.5);

// PotionHelper.getPotionEffects(meta, includeUsable): the effects of a potion damage value, or null (water, awkward, mundane, ...).
export function getPotionEffects(meta) {
  let list = null;
  for (let id = 1; id < 24; id++) {
    const type = POTION_TYPES[id], req = REQUIREMENTS[id];
    if (!type || req === undefined) continue;
    let j = parse(req, 0, req.length, meta);
    if (j <= 0) continue;
    let k = 0;
    const amps = AMPLIFIERS[id];
    if (amps !== undefined) { k = parse(amps, 0, amps.length, meta); if (k < 0) k = 0; }
    if (type.instant) j = 1;
    else {
      j = 1200 * (j * 3 + (j - 1) * 2);
      j >>= k;
      j = javaRound(j * type.effectiveness);
      if (meta & SPLASH_BIT) j = javaRound(j * 0.75 + 0.5);
    }
    (list ??= []).push(makeEffect(id, j, k, !!(meta & SPLASH_BIT)));
  }
  return list;
}
// PotionHelper.calcPotionLiquidColor: the average of the effects' colours weighted by amplifier + 1 (3694022 water-blue without effects).
export function potionLiquidColor(effects) {
  if (!effects || !effects.length) return 3694022;
  let r = f(0), g = f(0), b = f(0), n = f(0);
  for (const e of effects) {
    const c = POTION_TYPES[e.id].color;
    for (let j = 0; j <= e.amplifier; j++) {
      r = f(r + f(((c >> 16) & 255) / 255));
      g = f(g + f(((c >> 8) & 255) / 255));
      b = f(b + f((c & 255) / 255));
      n = f(n + 1);
    }
  }
  r = f(f(r / n) * 255);
  g = f(f(g / n) * 255);
  b = f(f(b / n) * 255);
  return ((Math.trunc(r) << 16) | (Math.trunc(g) << 8) | Math.trunc(b)) | 0;
}
export const potionColor = (meta) => potionLiquidColor(getPotionEffects(meta));
export const isSplashDamage = (meta) => (meta & SPLASH_BIT) !== 0;
// ItemPotion.isEffectInstant(meta): every effect is instant (false for water)
export function isInstantPotion(meta) {
  const list = getPotionEffects(meta);
  if (!list) return false;
  return list.every((e) => POTION_TYPES[e.id].instant);
}

// PotionHelper.applyIngredient(meta, effect string) with brewBitOperations
function bitOp(meta, bit, andFlag, negateFlag, notFlag) {
  if (andFlag) { if (!isSet(meta, bit)) return 0; }
  else if (negateFlag) meta &= ~(1 << bit);
  else if (notFlag) { if (!isSet(meta, bit)) meta |= 1 << bit; else meta &= ~(1 << bit); }
  else meta |= 1 << bit;
  return meta;
}
export function applyIngredient(meta, s) {
  let k = 0, num = false, minus = false, not = false, and = false;
  const run = () => { meta = bitOp(meta, k, and, minus, not); num = minus = not = and = false; k = 0; };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c >= "0" && c <= "9") { k = k * 10 + c.charCodeAt(0) - 48; num = true; }
    else if (c === "!") { if (num) run(); not = true; }
    else if (c === "-") { if (num) run(); minus = true; }
    else if (c === "+") { if (num) run(); }
    else if (c === "&") { if (num) run(); and = true; }
  }
  if (num) run();
  return meta & 32767;
}

// --- Names and tooltips (ItemPotion.getItemStackDisplayName / addInformation; English lang strings of the 1.7.10 jar) -------------
const L = { "potion.potency.1": "II", "potion.potency.2": "III", "potion.potency.3": "IV" };
export function potionName(meta) {
  if (meta === 0) return "Water Bottle";
  let prefix = "";
  if (isSplashDamage(meta)) prefix = "Splash ";
  const list = getPotionEffects(meta);
  if (list && list.length) return prefix + POTION_TYPES[list[0].id].postfix;
  return PREFIX_NAMES[prefixIndex(meta)] + " Potion"; // effect-less splash bottles carry no "Splash" word
}
// StringUtils.ticksToElapsedTime
export function durationString(ticks) {
  let seconds = Math.trunc(ticks / 20);
  const minutes = Math.trunc(seconds / 60);
  seconds %= 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}
const decimal = (x) => String(Number(x.toFixed(2))); // DecimalFormat("#.##")
// Tooltip lines of a potion stack as { text, color } (the original's section-sign colours: gray 7, red c, purple 5, blue 9).
export function potionTooltip(meta) {
  if (meta === 0) return []; // ItemPotion.addInformation returns early for the plain water bottle
  const lines = [], list = getPotionEffects(meta), mods = [];
  if (list && list.length) {
    for (const e of list) {
      const type = POTION_TYPES[e.id];
      let text = tl(type.key, type.name);
      if (type.modifier) mods.push([type, e]);
      if (e.amplifier > 0) text += " " + (tl(`potion.potency.${e.amplifier}`, L[`potion.potency.${e.amplifier}`] ?? `potion.potency.${e.amplifier}`));
      if (e.duration > 20) text += ` (${durationString(e.duration)})`;
      lines.push({ text, color: type.bad ? "#ff5555" : "#aaaaaa" });
    }
  } else lines.push({ text: tl("potion.empty", "No Effects"), color: "#aaaaaa" });
  const attrNames = { "generic.movementSpeed": "Speed", "generic.maxHealth": "Max Health", "generic.attackDamage": "Attack Damage" };
  const rows = [];
  for (const [type, e] of mods) {
    const amount = modifierAmount(type, e.amplifier), op = type.modifier.operation, shown = op === 1 || op === 2 ? amount * 100 : amount;
    if (amount > 0) rows.push({ text: `+${decimal(shown)}${op === 0 ? "" : "%"} ${tl(`attribute.name.${type.modifier.attribute}`, attrNames[type.modifier.attribute])}`, color: "#5555ff" });
    else if (amount < 0) rows.push({ text: `-${decimal(shown * -1)}${op === 0 ? "" : "%"} ${tl(`attribute.name.${type.modifier.attribute}`, attrNames[type.modifier.attribute])}`, color: "#ff5555" });
  }
  if (rows.length) lines.push({ text: "", color: "#aaaaaa" }, { text: tl("potion.effects.whenDrank", "When Applied:"), color: "#aa00aa" }, ...rows);
  return lines;
}
// One-line tooltip form used by the probe: section-sign codes joined with "|".
export const potionTooltipText = (meta) => potionTooltip(meta).map((l) => (l.text ? ({ "#aaaaaa": "§7", "#ff5555": "§c", "#aa00aa": "§5", "#5555ff": "§9" }[l.color] ?? "") + l.text : "")).join("|");

// Damage values the creative inventory lists (ItemPotion.getSubItems): water, then the usual brew chain (a representative set).
export const POTION_CREATIVE = Object.freeze([0, 8193, 8225, 8257, 8194, 8226, 8258, 8195, 8227, 8259, 8196, 8228, 8260, 8197, 8229, 8261, 8198, 8230, 8262, 8200, 8232, 8264, 8201, 8233, 8265, 8202, 8234, 8266, 8204, 8236, 8268, 8206, 8238, 8270, 16385, 16417, 16449, 16386, 16418, 16450, 16387, 16419, 16451, 16388, 16420, 16452, 16389, 16421, 16453, 16390, 16422, 16454, 16392, 16424, 16456, 16393, 16425, 16457, 16394, 16426, 16458, 16396, 16428, 16460, 16398, 16430, 16462]);
