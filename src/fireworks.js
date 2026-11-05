// Firework star (ItemFireworkCharge acr, original 402 -> 2070) and firework rocket (ItemFirework acs, original 401 -> 2071),
// their NBT, tooltips, star tint and RecipeFireworks (aey), Minecraft Java 1.7.10. Pure rules; the rocket entity is
// fireworks-live.js / firework-rocket.js and the particles are firework-particles.js.
// Evidence: public/research/fireworks-reference.json (tools/probes/FireworksProbe.java) and public/research/fireworks.md.
//
// Browser stack fields (no NBT writer is needed for gameplay; region-export/import map them to Explosion/Fireworks):
//   star:   stack.explosion = { type, colors:[int], fade:[int], flicker, trail }            (NBT "Explosion")
//   rocket: stack.fireworks = { flight (byte or undefined), explosions:[explosion] }        (NBT "Fireworks")
export const ITEM_FIREWORK_STAR = 2070; // original item 402 (ItemFireworkCharge)
export const ITEM_FIREWORK_ROCKET = 2071; // original item 401 (ItemFirework)
export const FIREWORK_ITEMS = Object.freeze({ 402: ITEM_FIREWORK_STAR, 401: ITEM_FIREWORK_ROCKET });

// Internal ids of the recipe ingredients (src/original-items.js; fireworks.test.js checks them against that table).
export const ING = Object.freeze({ GUNPOWDER: 330, PAPER: 328, DYE: 351, GLOWSTONE_DUST: 383, DIAMOND: 303, FIRE_CHARGE: 1952, FEATHER: 317, GOLD_NUGGET: 394 });
// ItemSkull (original 397) is defined by the wither track; register its internal id(s) here when that track is merged.
export const SKULL_ITEM_IDS = new Set();
export const registerSkullItem = (id) => { SKULL_ITEM_IDS.add(id); };

// ItemDye.field_150922_c (acj.c), index = dye damage (probe record "facts").
export const DYE_COLORS = Object.freeze([1973019, 11743532, 3887386, 5320730, 2437522, 8073150, 2651799, 11250603, 4408131, 14188952, 4312372, 14602026, 6719955, 12801229, 15435844, 15790320]);
// Lang strings item.fireworksCharge.* (en_US.lang): ItemDye.field_150923_a order.
export const DYE_NAMES = Object.freeze(['Black', 'Red', 'Green', 'Brown', 'Blue', 'Purple', 'Cyan', 'Light Gray', 'Gray', 'Pink', 'Lime', 'Yellow', 'Light Blue', 'Magenta', 'Orange', 'White']);
export const SHAPE_NAMES = Object.freeze(['Small Ball', 'Large Ball', 'Star-shaped', 'Creeper-shaped', 'Burst']);
export const LANG = Object.freeze({ flight: 'Flight Duration:', fadeTo: 'Fade to', flicker: 'Twinkle', trail: 'Trail', custom: 'Custom', unknownShape: 'Unknown Shape',
  star: 'Firework Star', rocket: 'Firework Rocket' });
export const STAR_DEFAULT_TINT = 9079434; // ItemFireworkCharge.getColorFromItemStack pass 1 without Colors

// The Explosion compound: Type byte, Colors int[], FadeColors int[], Flicker byte, Trail byte.
const intArray = (v) => Array.isArray(v) ? v.filter(Number.isFinite).map((n) => n | 0) : [];
export function normalizeExplosion(e) {
  if (!e || typeof e !== 'object') return null;
  const out = { type: Number.isFinite(e.type) ? (e.type << 24) >> 24 : 0, colors: intArray(e.colors), fade: intArray(e.fade), flicker: !!e.flicker, trail: !!e.trail };
  return out;
}
export function normalizeFireworks(v) {
  if (!v || typeof v !== 'object') return null;
  const explosions = Array.isArray(v.explosions) ? v.explosions.map(normalizeExplosion).filter(Boolean) : [];
  const out = { explosions };
  if (Number.isFinite(v.flight)) out.flight = (v.flight << 24) >> 24;
  return out;
}
// Merge identity (ItemStack.areItemStackTagsEqual): same NBT.
export const sameFireworkTag = (a, b) => JSON.stringify(a.explosion ?? null) === JSON.stringify(b.explosion ?? null) &&
  JSON.stringify(a.fireworks ?? null) === JSON.stringify(b.fireworks ?? null);
// What a stack copy carries (inventory.read).
export function readFireworkTags(s) {
  const out = {};
  const e = normalizeExplosion(s?.explosion), f = normalizeFireworks(s?.fireworks);
  if (e) out.explosion = e;
  if (f) out.fireworks = f;
  return out;
}

export const makeStar = (explosion) => ({ id: ITEM_FIREWORK_STAR, count: 1, damage: 0, explosion: normalizeExplosion(explosion) });
export const makeRocket = (fireworks) => ({ id: ITEM_FIREWORK_ROCKET, count: 1, damage: 0, ...(fireworks ? { fireworks: normalizeFireworks(fireworks) } : {}) });

// ---- tooltips ----
const colorName = (c) => { const i = DYE_COLORS.indexOf(c); return i >= 0 ? DYE_NAMES[i] : LANG.custom; };
// ItemFireworkCharge.func_92107_a(NBTTagCompound, List): the lines of one Explosion; `prefix` indents lines 1+.
export function explosionLines(e, prefix = '') {
  const lines = [], t = e.type;
  lines.push(t >= 0 && t <= 4 ? SHAPE_NAMES[t] : LANG.unknownShape);
  if (e.colors.length) lines.push(prefix + e.colors.map(colorName).join(', '));
  if (e.fade.length) lines.push(prefix + LANG.fadeTo + ' ' + e.fade.map(colorName).join(', '));
  if (e.trail) lines.push(prefix + LANG.trail);
  if (e.flicker) lines.push(prefix + LANG.flicker);
  return lines;
}
// ItemFireworkCharge/ItemFirework.addInformation (the star name itself comes from item-names.js).
export function fireworkLines(stack) {
  if (!stack) return [];
  if (stack.id === ITEM_FIREWORK_STAR) return stack.explosion ? explosionLines(stack.explosion, '') : [];
  if (stack.id !== ITEM_FIREWORK_ROCKET || !stack.fireworks) return [];
  const lines = [];
  if (Number.isFinite(stack.fireworks.flight)) lines.push(LANG.flight + ' ' + stack.fireworks.flight);
  for (const e of stack.fireworks.explosions) lines.push(...explosionLines(e, '  '));
  return lines;
}
// ItemFireworkCharge.getColorFromItemStack: pass 0 white; pass 1 the colour (integer channel average of several).
export function starTint(stack, pass) {
  if (pass !== 1) return 0xFFFFFF;
  const colors = stack?.explosion?.colors;
  if (!colors || !colors.length) return STAR_DEFAULT_TINT;
  if (colors.length === 1) return colors[0];
  let r = 0, g = 0, b = 0;
  for (const c of colors) { r += (c & 0xFF0000) >> 16; g += (c & 0xFF00) >> 8; b += c & 255; }
  const n = colors.length;
  return (Math.trunc(r / n) << 16) | (Math.trunc(g / n) << 8) | Math.trunc(b / n);
}
export const starTintComponents = (stack) => { const c = starTint(stack, 1); return [(c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255]; };

// ---- RecipeFireworks (aey.a matches / aey.a result) ----
// Only the ingredients below may be present; the shape of the grid does not matter (it also works in 2x2).
const SHAPE_TYPE = (id) => id === ING.FIRE_CHARGE ? 1 : id === ING.FEATHER ? 4 : id === ING.GOLD_NUGGET ? 2 : SKULL_ITEM_IDS.has(id) ? 3 : 0;
export function fireworksResult(cells) {
  let paper = 0, gunpowder = 0, dyes = [], stars = [], effects = 0, shapes = [];
  let flicker = false, trail = false;
  for (const s of cells) {
    if (!s) continue;
    const id = s.id;
    if (id === ING.PAPER) paper++;
    else if (id === ING.GUNPOWDER) gunpowder++;
    else if (id === ING.DYE) dyes.push(DYE_COLORS[(s.damage ?? 0) & 15]);
    else if (id === ITEM_FIREWORK_STAR) stars.push(s);
    else if (id === ING.GLOWSTONE_DUST) { flicker = true; effects++; }
    else if (id === ING.DIAMOND) { trail = true; effects++; }
    else if (SHAPE_TYPE(id)) shapes.push(SHAPE_TYPE(id));
    else return null;
  }
  const extras = effects + dyes.length + shapes.length;
  if (gunpowder > 3 || paper > 1) return null;
  // Rocket: paper, 1-3 gunpowder, only stars besides.
  if (paper === 1 && gunpowder >= 1 && extras === 0) {
    const explosions = stars.map((s) => s.explosion).filter(Boolean);
    if (!explosions.length) return makeRocket(null); // the original sets no NBT without a star tag (probe: rocket-gp-1..3)
    return makeRocket({ flight: gunpowder, explosions });
  }
  // Star: one gunpowder, one or more dyes, optional glowstone (twinkle), diamond (trail) and at most one shape item.
  if (paper === 0 && gunpowder === 1 && stars.length === 0 && dyes.length > 0 && shapes.length <= 1)
    return makeStar({ type: shapes[0] ?? 0, colors: dyes, fade: [], flicker, trail });
  // Fade: one star that has an Explosion plus dyes only.
  if (paper === 0 && gunpowder === 0 && stars.length === 1 && dyes.length > 0 && dyes.length === extras && stars[0].explosion)
    return makeStar({ ...stars[0].explosion, fade: dyes });
  return null;
}

// ---- items ----
export function installFireworkItems(items) {
  items[ITEM_FIREWORK_STAR] = { id: ITEM_FIREWORK_STAR, name: LANG.star, texture: 'fireworks_charge', stack: 64, color: '#8a8a8a' };
  items[ITEM_FIREWORK_ROCKET] = { id: ITEM_FIREWORK_ROCKET, name: LANG.rocket, texture: 'fireworks', stack: 64, color: '#b04a3a' };
}
