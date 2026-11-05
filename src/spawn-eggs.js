// Spawn egg (original 383, ItemMonsterPlacer), Bottle o' Enchanting (384, ItemExpBottle) and fire charge (385, ItemFireball) of
// Minecraft Java 1.7.10. Pure rules plus the item installers; the live use paths are in spawn-egg-use.js. Truth is
// public/research/spawn-eggs-reference.json (tools/probes/SpawnEggProbe.java, the unchanged original classes), checked by
// spawn-eggs.test.js; anything the probe could not run is marked "bytecode-derived". Notes: public/research/spawn-eggs.md.
// Browser ids 383-385 are glowstone dust, glass bottle and potion, so the three originals take 1950-1952 (original-items.js).
export const ITEM_SPAWN_EGG = 1950, ITEM_EXP_BOTTLE = 1951, ITEM_FIRE_CHARGE = 1952;
export const SPAWN_EGG_ITEMS = Object.freeze({ 383: ITEM_SPAWN_EGG, 384: ITEM_EXP_BOTTLE, 385: ITEM_FIRE_CHARGE });

// EntityList.entityEggs in registration order (hash map of id -> [primary colour, secondary colour]): damage (EntityList id),
// the EntityList string id (also the /summon name) and both colours (ItemMonsterPlacer.getColorFromItemStack passes 0 and 1).
export const SPAWN_EGGS = Object.freeze([
  [50, "Creeper", 894731, 0], [51, "Skeleton", 12698049, 4802889], [52, "Spider", 3419431, 11013646], [54, "Zombie", 44975, 7969893],
  [55, "Slime", 5349438, 8306542], [56, "Ghast", 16382457, 12369084], [57, "PigZombie", 15373203, 5009705], [58, "Enderman", 1447446, 0],
  [59, "CaveSpider", 803406, 11013646], [60, "Silverfish", 7237230, 3158064], [61, "Blaze", 16167425, 16775294],
  [62, "LavaSlime", 3407872, 16579584], [65, "Bat", 4996656, 986895], [66, "Witch", 3407872, 5349438], [90, "Pig", 15771042, 14377823],
  [91, "Sheep", 15198183, 16758197], [92, "Cow", 4470310, 10592673], [93, "Chicken", 10592673, 16711680], [94, "Squid", 2243405, 7375001],
  [95, "Wolf", 14144467, 13545366], [96, "MushroomCow", 10489616, 12040119], [98, "Ozelot", 15720061, 5653556],
  [100, "EntityHorse", 12623485, 15656192], [120, "Villager", 5651507, 12422002],
].map(([damage, entity, primary, secondary]) => Object.freeze({ damage, entity, primary, secondary })));
const BY_DAMAGE = new Map(SPAWN_EGGS.map((e) => [e.damage, e]));
export const eggOf = (damage) => BY_DAMAGE.get(damage | 0) ?? null;
// ItemMonsterPlacer.getColorFromItemStack: pass 0 is the primary colour, any other pass the secondary; an unregistered id is white.
export const eggColor = (damage, pass) => { const e = eggOf(damage); return e ? (pass === 0 ? e.primary : e.secondary) : 0xffffff; };

// ItemMonsterPlacer.onItemUse: the spawn point is the clicked block offset by the face (side 0 y-, 1 y+, 2 z-, 3 z+, 4 x-, 5 x+),
// centred in x and z, +0.5 in y on the top face of a fence (render type 11). `fence` is the clicked block's fence-ness.
const SIDE = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
export const sideOffset = (side) => SIDE[side] ?? [0, 0, 0];
export function eggSpawnPoint([x, y, z], side, fence) {
  const [dx, dy, dz] = sideOffset(side);
  return { x: x + dx + 0.5, y: y + dy + (side === 1 && fence ? 0.5 : 0), z: z + dz + 0.5 };
}
// ItemMonsterPlacer.onItemRightClick on water: the spawn is at the water block's integer coordinates (no centring, no offset).
export const eggWaterPoint = ([x, y, z]) => ({ x, y, z });
// MathHelper.wrapAngleTo180_float; the egg's yaw is wrapAngleTo180(nextFloat() * 360).
export function wrapAngleTo180(value) {
  let v = Math.fround(value) % 360;
  if (v >= 180) v = Math.fround(v - 360);
  if (v < -180) v = Math.fround(v + 360);
  return v + 0;
}
export const eggYaw = (roll) => wrapAngleTo180(Math.fround(Math.fround(roll) * 360));

// EntityXPOrb.getXPSplit: the largest orb size (2477, 1237, 617, 307, 149, 73, 37, 17, 7, 3, 1) not above the remaining value.
export function xpSplit(n) {
  for (const size of [2477, 1237, 617, 307, 149, 73, 37, 17, 7, 3]) if (n >= size) return size;
  return 1;
}
// EntityExpBottle.onImpact: 3 + nextInt(5) + nextInt(5) experience in getXPSplit orbs. `rand.nextInt(n)` is the world's Random.
export function expBottleOrbs(rand) {
  let left = 3 + rand.nextInt(5) + rand.nextInt(5);
  const orbs = [];
  while (left > 0) { const part = xpSplit(left); left -= part; orbs.push(part); }
  return orbs;
}
// EntityExpBottle constants (EntityThrowable.func_70182_d velocity 0.7, func_70183_g pitch offset -20, getGravityVelocity 0.07).
export const EXP_BOTTLE = Object.freeze({ velocity: 0.7, pitchOffset: -20, gravity: 0.07, width: 0.25, height: 0.25 });

// Items for survival.js. The egg's variants are the 1.7.10 en_US names by damage (item-names.js rewrites them from the lang data).
export function installSpawnEggItems(items) {
  const egg = { id: ITEM_SPAWN_EGG, name: "Spawn", texture: "spawn_egg", stack: 64, color: "#8c7d52", glyph: "E" };
  egg.variants = Array.from({ length: 121 }, (_, d) => (eggOf(d) ? `Spawn ${eggOf(d).entity}` : "Spawn"));
  items[ITEM_SPAWN_EGG] = egg;
  // ItemExpBottle.hasEffect is always true (the enchantment glint).
  items[ITEM_EXP_BOTTLE] = { id: ITEM_EXP_BOTTLE, name: "Bottle o' Enchanting", texture: "experience_bottle", stack: 64, alwaysGlint: true, color: "#9be45c", glyph: "B" };
  items[ITEM_FIRE_CHARGE] = { id: ITEM_FIRE_CHARGE, name: "Fire Charge", texture: "fireball", stack: 64, color: "#c8541a", glyph: "F" };
}
// RecipesFire charge (CraftingManager): shapeless blaze powder + (coal or charcoal) + gunpowder -> 3 fire charges.
export function installSpawnEggRecipes({ shapeless }) {
  for (const coal of [301, 308]) shapeless(ITEM_FIRE_CHARGE, 3, 0, 388, coal, 330);
}

// Two-layer egg icon for the 3D item views (drops, first and third person): spawn_egg tinted by the primary colour under spawn_egg_overlay
// tinted by the secondary, composed once per damage on a canvas. Before both images have loaded (and outside a browser) the untinted base is used.
const BASE = "/media/1.7.10/items/spawn_egg.png", OVERLAY = "/media/1.7.10/items/spawn_egg_overlay.png", composed = new Map();
let images = null;
function loadImages() {
  if (images || typeof Image === "undefined" || typeof document === "undefined") return images;
  images = [BASE, OVERLAY].map((src) => { const img = new Image(); img.src = src; return img; });
  return images;
}
loadImages();
export function spawnEggTexture(damage = 0) {
  const e = eggOf(damage), key = e ? e.damage : -1;
  if (composed.has(key)) return composed.get(key);
  const imgs = loadImages();
  if (!imgs || !imgs.every((i) => i.complete && i.naturalWidth)) return BASE;
  const url = composeEgg(imgs, eggColor(damage, 0), eggColor(damage, 1));
  composed.set(key, url);
  return url;
}
function composeEgg([base, overlay], primary, secondary) {
  const canvas = document.createElement("canvas"), g = canvas.getContext("2d");
  canvas.width = base.naturalWidth; canvas.height = base.naturalHeight;
  const layer = (img, color) => {
    const c = document.createElement("canvas"), x = c.getContext("2d");
    c.width = canvas.width; c.height = canvas.height;
    x.drawImage(img, 0, 0, c.width, c.height);
    x.globalCompositeOperation = "multiply";
    x.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
    x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = "destination-in";
    x.drawImage(img, 0, 0, c.width, c.height);
    g.drawImage(c, 0, 0);
  };
  layer(base, primary);
  layer(overlay, secondary);
  return canvas.toDataURL("image/png");
}
// The inventory icon: both layers as tinted-item masks (container-ui.css .tinted-item > i multiplies --base by --tint).
export function spawnEggIconHtml(damage = 0) {
  const hex = (c) => `#${(c & 0xffffff).toString(16).padStart(6, "0")}`;
  return `<span class="vanilla-item-icon tinted-item" aria-hidden="true"><i style="--tint:${hex(eggColor(damage, 0))};--base:url('${BASE}')"></i><i style="--tint:${hex(eggColor(damage, 1))};--base:url('${OVERLAY}')"></i></span>`;
}
