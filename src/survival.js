import {miningState,blockWear} from "./mining.js";
import { BLOCKS, HOTBAR, WOOL, WOOL_COLORS, DYE, DYES, RED_FLOWER, RED_FLOWERS, YELLOW_FLOWER, SAPLING, WEB, WATER, LAVA, CARROTS, POTATOES } from "./world.js";
import {PlayerInventory,PlayerContainer,WorkbenchContainer,FurnaceContainer,ChestContainer,makeStack} from "./inventory.js";
import {CHEST_SLOTS,FACING,newChest,openChest} from "./chest.js";
import { Effects } from "./status-effects.js";

import {CARROT,POTATO,BAKED_POTATO,POISONOUS_POTATO} from './crops.js';

export const ITEMS = Object.fromEntries(
  BLOCKS.map((b, id) => [id, { ...b, id, block: id > 0, stack: 64 }]),
);
// ItemCloth: the stack's damage value is the wool colour and names the item.
ITEMS[WOOL].variants = WOOL_COLORS.map((c) => c.label + " wool");
// BlockFlower: the red flower's metadata names the species. ItemDye (id 351):
// damage 0-15 names the dye; damage 15 replaces the old internal bone meal.
ITEMS[RED_FLOWER].variants = RED_FLOWERS.map((f) => f.label);
ITEMS[YELLOW_FLOWER].name = "Dandelion";
ITEMS[DYE] = { id: DYE, name: "Dye", variants: DYES.map((d) => d.label), stack: 64, color: "#ede9d8", glyph: "●" };
const toolMaterials = [
  ["Wooden", 0, 59, 2, 7],
  ["Stone", 1, 131, 4, 12],
  ["Iron", 2, 250, 6, 302],
  ["Diamond", 3, 1561, 8, 303],
];
const toolKinds = ["pickaxe", "axe", "shovel", "sword"];
for (let kind = 0; kind < 4; kind++)
  for (let tier = 0; tier < 4; tier++) {
    const [name, level, durability, speed, ingredient] = toolMaterials[tier],
      id = 100 + kind * 4 + tier;
    ITEMS[id] = {
      id,
      name: `${name} ${toolKinds[kind]}`,
      kind: toolKinds[kind],
      tier: level,
      durability,
      speed,
      ingredient,
      stack: 1,
      color: ["#aa8553", "#969b96", "#cdd5d2", "#65c8bb"][tier],
      glyph: ["⛏", "⚒", "♠", "†"][kind],
    };
  }
for (let kind = 0; kind < 4; kind++) {
  const id = 116 + kind;
  ITEMS[id] = {
    id,
    name: `Golden ${toolKinds[kind]}`,
    kind: toolKinds[kind],
    tier: 0,
    durability: 32,
    speed: 12,
    ingredient: 304,
    stack: 1,
    color: "#e5c35e",
    glyph: ["⛏", "⚒", "♠", "†"][kind],
  };
}
// ItemSword/ItemTool attack modifiers: kind base plus ToolMaterial damage.
for (const item of Object.values(ITEMS))
  if (item.kind in { sword: 1, axe: 1, pickaxe: 1, shovel: 1 })
    item.attack = { sword: 4, axe: 3, pickaxe: 2, shovel: 1 }[item.kind] + (item.name.startsWith("Golden") ? 0 : item.tier);
for(const [tier,name,durability,ingredient]of[[0,'Wooden',59,7],[1,'Stone',131,12],[2,'Iron',250,302],[3,'Diamond',1561,303],[0,'Golden',32,304]]){const id=120+Object.values(ITEMS).filter(i=>i.kind==='hoe').length;ITEMS[id]={id,name:name+' hoe',kind:'hoe',tier,durability,speed:1,ingredient,stack:1,color:'#b7a274',glyph:'⚒'};}
ITEMS[125]={id:125,name:"Shears",kind:"shears",durability:238,speed:1,stack:1,color:"#d8d8d8"};
// ItemFlintAndSteel (acw, vanilla 259): maxDamage 64, stack 1, Tools tab; use is in main.js.
ITEMS[126]={id:126,name:"Flint and steel",kind:"flint_and_steel",durability:64,stack:1,texture:"flint_and_steel",color:"#8d8d90",glyph:"✦"};
// ItemBow (abq: Item.bow, Minecraft 261): stack 1, durability 384, EnumAction.bow, max use
// duration 72000. Item.arrow (262) and Item.string (287) are plain items. The ids are this
// build's own (127, 320, 321); see src/bow.js.
ITEMS[127]={id:127,name:"Bow",kind:"bow",texture:"bow_standby",durability:384,stack:1,color:"#8d6a3f",glyph:")"};
ITEMS[320]={id:320,name:"Arrow",texture:"arrow",stack:64,color:"#b0905f",glyph:"\u2191"};
ITEMS[326]={id:326,name:"Spider eye",texture:"spider_eye",food:2,saturation:0.8,stack:64,color:"#803f47",glyph:"●"};
ITEMS[321]={id:321,name:"String",texture:"string",stack:64,color:"#eee",glyph:"~"};
for (const item of [
  {id:312,name:"Snowball",color:"#fff",glyph:"●",stack:16},{id:315,name:"Leather",color:"#a06540",glyph:"▰",texture:"leather"},{id:313,name:"Flint",color:"#555",glyph:"◆"},{id:314,name:"Book",color:"#8d4f39",glyph:"▰"},
  // ItemEgg (344, stack 16), Item.feather (288), and ItemFood chicken (365: 2 hunger, 0.3
  // saturation, 30 s Hunger effect at 30%) and cooked chicken (366: 6, 0.6).
  {id:316,name:"Egg",color:"#e8d8b0",glyph:"●",stack:16},{id:317,name:"Feather",color:"#eee",glyph:"╱"},
  {id:318,name:"Raw chicken",food:2,saturation:0.3,color:"#d9a89a",glyph:"◕"},{id:319,name:"Cooked chicken",food:6,saturation:0.6,color:"#b9824f",glyph:"◕"},
  {id:309,name:"Wheat seeds",color:"#8eab54",glyph:"·"},{id:311,name:"Bone",color:"#dedac6",glyph:"╱"},
  {
    id: 204,
    name: "Raw beef",
    food: 3,
    saturation: 0.3,
    color: "#b87266",
    glyph: "◕",
  },
  {
    id: 205,
    name: "Steak",
    food: 8,
    saturation: 0.8,
    color: "#8c5c40",
    glyph: "◕",
  },
  {
    id: 206,
    name: "Rotten flesh",
    food: 4,
    saturation: 0.1,
    color: "#8c7350",
    glyph: "◕",
  },
  {
    id: 200,
    name: "Apple",
    food: 4,
    saturation: 0.3,
    color: "#bf5c45",
    glyph: "●",
  },
  {
    id: 201,
    name: "Bread",
    food: 5,
    saturation: 0.6,
    color: "#c8a35a",
    glyph: "▰",
  },
  {
    id: 202,
    name: "Raw porkchop",
    food: 3,
    saturation: 0.3,
    color: "#ce968c",
    glyph: "◕",
  },
  {
    id: 203,
    name: "Cooked porkchop",
    food: 8,
    saturation: 0.8,
    color: "#a6784d",
    glyph: "◕",
  },
  { id: 300, name: "Stick", color: "#b0905f", glyph: "╱" },
  { id: 301, name: "Coal", color: "#48534c", glyph: "◆" },
  { id: 302, name: "Iron ingot", color: "#c5d0cd", glyph: "▰" },
  { id: 303, name: "Diamond", color: "#70cfc3", glyph: "◆" },
  { id: 304, name: "Gold ingot", color: "#e5c35e", glyph: "▰" },
  { id: 305, name: "Wheat", color: "#c9ae62", glyph: "♧" },
  { id: 306, name: "Clay brick", color: "#ba7960", glyph: "▰" },
  { id: 307, name: "Clay ball", color: "#acb7bc", glyph: "●" },
  { id: 308, name: "Charcoal", color: "#4e554c", glyph: "◆" },
])
  ITEMS[item.id] = { stack:64,...item };
// ItemSeedFood (carrot and potato) plant themselves; food values are 1.7.10's.
for(const item of [
 {id:CARROT,name:'Carrot',texture:'carrot',food:4,saturation:0.6,color:'#df8629'},
 {id:POTATO,name:'Potato',texture:'potato',food:1,saturation:0.3,color:'#c4a76a'},
 {id:BAKED_POTATO,name:'Baked potato',texture:'potato_baked',food:6,saturation:0.6,color:'#a47747'},
 {id:POISONOUS_POTATO,name:'Poisonous potato',texture:'potato_poisonous',food:2,saturation:0.3,color:'#91a455'},
])ITEMS[item.id]={stack:64,glyph:'●',...item};
// ItemBucket (abo) and ItemBucketMilk (adi). The empty bucket stacks to 16, the filled
// ones to 1. The ids are this build's own (Minecraft 325, 326, 327, 335); `contains` is
// the liquid a filled bucket places and `bucket` marks every item that has bucket behaviour.
for (const item of [
  { id: 340, name: "Bucket", texture: "bucket_empty", stack: 16, bucket: "empty", color: "#c5d0cd", glyph: "U" },
  { id: 341, name: "Water bucket", texture: "bucket_water", stack: 1, bucket: "filled", contains: WATER, color: "#5f9fbc", glyph: "U" },
  { id: 342, name: "Lava bucket", texture: "bucket_lava", stack: 1, bucket: "filled", contains: LAVA, color: "#d4560f", glyph: "U" },
  { id: 343, name: "Milk bucket", texture: "bucket_milk", stack: 1, bucket: "milk", color: "#f4f4f0", glyph: "U" },
]) ITEMS[item.id] = item;

// ItemArmor: ArmorMaterial durability factor x [11, 16, 15, 13] per piece and
// damage-reduction points; armorType 0 helmet, 1 chestplate, 2 leggings, 3 boots.
export const ARMOR_MATERIALS = [
  ["Leather", 5, [1, 3, 2, 1], 315, "leather"],
  ["Chain", 15, [2, 5, 4, 1], 0, "chainmail"],
  ["Iron", 15, [2, 6, 5, 2], 302, "iron"],
  ["Golden", 7, [2, 5, 3, 1], 304, "gold"],
  ["Diamond", 33, [3, 8, 6, 3], 303, "diamond"],
];
const ARMOR_PIECES = [["helmet", 11], ["chestplate", 16], ["leggings", 15], ["boots", 13]];
const LEATHER_NAMES = ["Leather cap", "Leather tunic", "Leather pants", "Leather boots"];
ARMOR_MATERIALS.forEach(([name, factor, defense, ingredient, texture], m) =>
  ARMOR_PIECES.forEach(([piece, base], armor) => {
    const id = 400 + m * 4 + armor;
    ITEMS[id] = { id, name: m === 0 ? LEATHER_NAMES[armor] : `${name} ${piece}`, armor, defense: defense[armor], durability: base * factor, ingredient, stack: 1, color: "#9a9a9a", glyph: "▣", texture: `${texture}_${piece}`, ...(m === 0 ? { tint: "#a06540", overlay: `${texture}_${piece}_overlay` } : {}) };
  }),
);

export const MATERIALS = {
  1: { hardness: 0.6, drop: 2 },
  2: { hardness: 0.5 },
  3: { hardness: 1.5, kind: "pickaxe", tier: 0, drop: 12 },
  4: { hardness: 2, kind: "axe" },
  5: { hardness: 0.2, drop: 0 },
  6: { hardness: 0.5, kind: "shovel" },
  7: { hardness: 2, kind: "axe" },
  8: { hardness: 2, kind: "pickaxe", tier: 0 },
  9: { hardness: 0.3, drop: 0 },
  11: { hardness: Infinity, drop: 0 },
  12: { hardness: 2, kind: "pickaxe", tier: 0 },
  13: { hardness: 2.5, kind: "axe" },
  14: { hardness: 3.5, kind: "pickaxe", tier: 0 },
  15: { hardness: 3, kind: "pickaxe", tier: 0, drop: 301 },
  16: { hardness: 3, kind: "pickaxe", tier: 1 },
  17: { hardness: 3, kind: "pickaxe", tier: 2, drop: 303 },
  18: { hardness: 3, kind: "pickaxe", tier: 2 },
  19: { hardness: 0.8 },
  20: { hardness: 0 },
  21: { hardness: 1.5, kind: "axe", drop: 314, count:3 },
  22: { hardness: 50, kind: "pickaxe", tier: 3 },
  23: { hardness: 0.2, kind: "shovel",drop:312,count:4 },
  24: { hardness: 0.6, kind: "shovel", drop: 307, count: 4 },
  25: { hardness: 0.6, kind: "shovel" },
  26: { hardness: 5, kind: "pickaxe", tier: 1 },
  27: { hardness: 3, kind: "pickaxe", tier: 2 },
  28: { hardness: 5, kind: "pickaxe", tier: 2 },
  40: { hardness: 1.25, kind: "pickaxe", tier: 0 },
  // BlockSnow (hardness 0.1, shovel only, drops meta+1 snowballs) and BlockIce (0.5, no drop).
  46: { hardness: 0.1, kind: "shovel", drop: 312 },
  47: { hardness: 0.5, drop: 0 },
  41: { hardness: 2.5, kind: "axe" },
};

for(let id=29;id<=39;id++)MATERIALS[id]={hardness:id<=30?.6:0,kind:id<=30?'shovel':undefined,drop:id<=30?2:0};
MATERIALS[YELLOW_FLOWER]=MATERIALS[RED_FLOWER]={hardness:0};
// BlockSapling: instant break (hardness 0), drops itself (damage 0 for the oak).
MATERIALS[SAPLING]={hardness:0};
MATERIALS[WEB]={hardness:4,drop:321};
MATERIALS[CARROTS]=MATERIALS[POTATOES]={hardness:0,drop:0};
export const RECIPES = [];
function recipe(id, name, rows, keys, output, count = 1) {
  const width = Math.max(...rows.map((r) => r.length));
  RECIPES.push({
    id,
    name,
    width,
    height: rows.length,
    pattern: rows.flatMap((row) =>
      [...row.padEnd(width)].map((c) => keys[c] || 0),
    ),
    output,
    count,
  });
}
recipe("shears","Shears",[" I","I "],{I:302},125);
// RecipesWeapons (afl): bow " #X","# X"," #X" with stick and string (the mirror matches
// too), arrow "X","#","Y" with flint, stick and feather for four arrows.
recipe("bow","Bow",[" #X","# X"," #X"],{"#":300,X:321},127);
recipe("string-wool","Wool",["SS","SS"],{S:321},WOOL);
recipe("arrow","Arrow",["X","#","Y"],{X:313,"#":300,Y:317},320,4);
// CraftingManager: "# #", " # " of iron ingots makes one bucket.
recipe("bucket","Bucket",["I I"," I "],{I:302},340);
recipe("snow","Snow block",["SS","SS"],{S:312},23);
recipe("bookshelf","Bookshelf",["PPP","BBB","PPP"],{P:7,B:314},21);
recipe("planks", "Oak planks", ["L"], { L: 4 }, 7, 4);
recipe("sticks", "Sticks", ["P", "P"], { P: 7 }, 300, 4);
recipe("table", "Crafting table", ["PP", "PP"], { P: 7 }, 13);
recipe("furnace", "Furnace", ["CCC", "C C", "CCC"], { C: 12 }, 14);
recipe("chest", "Chest", ["PPP", "P P", "PPP"], { P: 7 }, 41);
recipe("torch", "Torches", ["C", "S"], { C: 301, S: 300 }, 20, 4);
recipe(
  "charcoal-torch",
  "Torches (charcoal)",
  ["C", "S"],
  { C: 308, S: 300 },
  20,
  4,
);
recipe("bread", "Bread", ["WWW"], { W: 305 }, 201);
recipe("bricks", "Brick block", ["BB", "BB"], { B: 306 }, 8);
for (let kind = 0; kind < 4; kind++)
  for (let tier = 0; tier < 4; tier++) {
    const id = 100 + kind * 4 + tier;
    recipe(
      String(id),
      ITEMS[id].name,
      [
        ["XXX", " S ", " S "],
        ["XX", "XS", " S"],
        ["X", "S", "S"],
        ["X", "X", "S"],
      ][kind],
      { X: ITEMS[id].ingredient, S: 300 },
      id,
    );
  }
for (let kind = 0; kind < 4; kind++) {
  const id = 116 + kind;
  recipe(
    String(id),
    ITEMS[id].name,
    [
      ["XXX", " S ", " S "],
      ["XX", "XS", " S"],
      ["X", "S", "S"],
      ["X", "X", "S"],
    ][kind],
    { X: 304, S: 300 },
    id,
  );
}
for(let id=120;id<=124;id++)recipe(String(id),ITEMS[id].name,['XX',' S',' S'],{X:ITEMS[id].ingredient,S:300},id);

for (let id = 400; id < 420; id++)
  if (ITEMS[id].ingredient)
    recipe(String(id), ITEMS[id].name, [["XXX", "X X"], ["X X", "XXX", "XXX"], ["XXX", "X X", "X X"], ["X X", "X X"]][ITEMS[id].armor], { X: ITEMS[id].ingredient }, id);
for (const [block, ingot] of [
  [26, 302],
  [27, 304],
  [28, 303],
]) {
  recipe(
    "pack-" + block,
    ITEMS[block].name,
    ["III", "III", "III"],
    { I: ingot },
    block,
  );
  recipe("unpack-" + block, ITEMS[ingot].name, ["B"], { B: block }, ingot, 9);
}
// ShapelessRecipes (afi): the listed ingredients, as {id, damage} (damage null
// matches any), must match the grid's non-empty stacks one to one in any order.
// RecipesDyes order and counts, from public/research/dyes-reference.json.
export const SHAPELESS = [];
function shapeless(output, count, damage, ...ingredients) {
  SHAPELESS.push({ output, count, damage, ingredients: ingredients.map((i) => (Array.isArray(i) ? { id: i[0], damage: i[1] } : { id: i, damage: null })) });
}
const dye = (n) => [DYE, n];
for (let i = 0; i < 16; i++) shapeless(WOOL, 1, 15 - i, dye(i), [WOOL, 0]);
shapeless(DYE, 4, 13, dye(4), dye(1), dye(1), dye(15));
shapeless(DYE, 3, 7, dye(0), dye(15), dye(15));
shapeless(DYE, 3, 13, dye(4), dye(1), dye(9));
for (const [out, n, a, b] of [[9, 2, 1, 15], [14, 2, 1, 11], [10, 2, 2, 15], [8, 2, 0, 15], [7, 2, 8, 15], [12, 2, 4, 15], [6, 2, 4, 2], [5, 2, 4, 1], [13, 2, 5, 9]])
  shapeless(DYE, n, out, dye(a), dye(b));
// ItemStack -> dye: dandelion, red flowers (metadata -> dye) and bone.
const FLOWER_DYES = [1, 12, 13, 7, 1, 14, 7, 9, 7];
shapeless(DYE, 1, 11, YELLOW_FLOWER);
RED_FLOWERS.forEach((_, m) => shapeless(DYE, 1, FLOWER_DYES[m], [RED_FLOWER, m]));
shapeless(DYE, 3, 15, 311);
// RecipesTools: ShapelessRecipes iron ingot + flint -> flint and steel.
shapeless(126, 1, 0, 302, 313);
export function matchShapeless(stacks) {
  const filled = stacks.filter(Boolean);
  for (const r of SHAPELESS) {
    if (r.ingredients.length !== filled.length) continue;
    const left = [...r.ingredients];
    let ok = true;
    for (const s of filled) {
      const i = left.findIndex((w) => w.id === s.id && (w.damage === null || w.damage === s.damage));
      if (i < 0) { ok = false; break; }
      left.splice(i, 1);
    }
    if (ok) return r;
  }
  return null;
}
export function matchRecipe(grid, size) {
  for (const r of RECIPES) {
    if (r.width > size || r.height > size) continue;
    for (let ox = 0; ox <= size - r.width; ox++)
      for (let oy = 0; oy <= size - r.height; oy++)
        for (const mirror of [false, true]) {
          let matches = true;
          for (let y = 0; y < size; y++)
            for (let x = 0; x < size; x++) {
              const rx = x - ox,
                ry = y - oy;
              const expected =
                rx >= 0 && rx < r.width && ry >= 0 && ry < r.height
                  ? r.pattern[ry * r.width + (mirror ? r.width - 1 - rx : rx)]
                  : 0;
              if ((grid[y * size + x] || 0) !== expected) matches = false;
            }
          if (matches) return r;
        }
  }
  return null;
}
export function ingredients(recipe) {
  const counts = {};
  for (const id of recipe.pattern) if (id) counts[id] = (counts[id] || 0) + 1;
  return counts;
}
// CraftingManager.findMatchingRecipe: two single damageable items of one kind
// repair with a 5% bonus before any recipe is consulted.
export function craftingResult(cells, size) {
  const filled = cells.filter(Boolean), [a, b] = filled, max = a && ITEMS[a.id]?.durability;
  if (filled.length === 2 && a.id === b.id && a.count === 1 && b.count === 1 && max)
    return makeStack(a.id, 1, Math.max(0, max - (max - a.damage + max - b.damage + Math.floor((max * 5) / 100))));
  const r = matchRecipe(cells.map((c) => c?.id || 0), size);
  if (r) return makeStack(r.output, r.count);
  const sl = matchShapeless(cells);
  return sl ? makeStack(sl.output, sl.count, sl.damage) : null;
}
// FurnaceRecipes and TileEntityFurnace.getItemBurnTime for this build's items,
// checked against the original classes in public/research/inventory-reference.json.
export const SMELTING = {
  [POTATO]: BAKED_POTATO,
  204: 205,
  12: 3,
  6: 9,
  24: 40,
  15: 301,
  16: 302,
  17: 303,
  18: 304,
  4: 308,
  202: 203,
  318: 319,
  307: 306,
};
export const FUELS = {
  4: 300,
  7: 300,
  13: 300,
  21: 300,
  41: 300,
  100: 200,
  104: 200,
  108: 200,
  112: 200,
  120: 200,
  300: 100,
  301: 1600,
  308: 1600,
  // TileEntityFurnace.getItemBurnTime: a sapling burns for 100 ticks.
  [SAPLING]: 100,
};
// TileEntityFurnace.getItemBurnTime: a lava bucket burns 20000 ticks and, like every
// Item with a container item, leaves the empty bucket behind when it is used up.
FUELS[342] = 20000;
const CONTAINER_ITEMS = { 342: 340 };
const clamp = (v, min, max, fallback) =>
  Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
export const burnTime = (s) => (s ? FUELS[s.id] || 0 : 0);
export const smeltingResult = (s) => (s && SMELTING[s.id] ? makeStack(SMELTING[s.id]) : null);
// Saves before 0.7 kept one aggregate count and remaining durability per item.
// Hotbar choices keep their slots; everything else fills the main rows.
function legacySlots({ inventory, durability, hotbar }, creative) {
  const slots = Array(36).fill(null), left = new Map();
  for (const [key, n] of Object.entries(inventory && typeof inventory === "object" ? inventory : {}))
    if (ITEMS[+key] && +key && Number.isInteger(n) && n > 0) left.set(+key, Math.min(ITEMS[+key].stack, n));
  const stack = (id) => {
    const max = ITEMS[id].durability, remaining = durability?.[id];
    return makeStack(id, left.get(id), max && Number.isFinite(remaining) ? Math.max(0, Math.min(max - 1, Math.round(max - remaining))) : 0);
  };
  (Array.isArray(hotbar) ? hotbar : creative ? HOTBAR : []).slice(0, 9).forEach((id, i) => {
    if (left.has(id)) { slots[i] = stack(id); left.delete(id); }
    else if (creative && id && ITEMS[id]) slots[i] = makeStack(id);
  });
  const order = [...Array.from({ length: 27 }, (_, i) => i + 9), ...Array.from({ length: 9 }, (_, i) => i)];
  for (const id of left.keys()) {
    const i = order.find((i) => !slots[i]);
    if (i !== undefined) slots[i] = stack(id);
  }
  return slots;
}
function legacyFurnace(f, read) {
  if (Array.isArray(f.items)) return [0, 1, 2].map((i) => read(f.items[i]));
  return ["input", "fuel", "output"].map((slot) => read({ id: f[slot], count: f[slot + "Count"] }));
}

export class Survival {
  constructor(data = {}, mode = "survival") {
    data = data && typeof data === "object" ? data : {};
    this.mode = mode === "survival" ? "survival" : "creative";
    this.health = clamp(data.health, 0, 20, 20);
    this.food = Math.floor(clamp(data.food, 0, 20, 20));
    this.saturation = clamp(data.saturation, 0, this.food, 5);
    this.exhaustion = clamp(data.exhaustion, 0, 40, 0);
    this.timer = Math.floor(clamp(data.timer, 0, 80, 0));
    this.air = Math.floor(clamp(data.air, -20, 300, 300));
    this.time = Math.floor(clamp(data.time, 0, Number.MAX_SAFE_INTEGER, 0));
    this.effects = new Effects(data.effects);
    this.inventory = new PlayerInventory(ITEMS, Array.isArray(data.slots) ? data.slots : legacySlots(data, this.creative), data.armor);
    this.inventory.creative = this.creative;
    this.inventory.current = Math.floor(clamp(data.current, 0, 8, 0));
    this.furnaces = {};
    for (const [key, f] of Object.entries(data.furnaces || {})) {
      if (!/^\d+,\d+,\d+$/.test(key) || !f || typeof f !== "object") continue;
      this.furnaces[key] = {
        items: legacyFurnace(f, (s) => this.inventory.read(s)),
        burn: Math.floor(clamp(f.burn, 0, 20000, 0)),
        burnTotal: Math.floor(clamp(f.burnTotal, 0, 20000, 0)),
        cook: Math.floor(clamp(f.cook, 0, 199, 0)),
      };
    }
    // TileEntityChest contents and facing metadata; lid state is not saved.
    this.chests = {};
    for (const [key, c] of Object.entries(data.chests || {})) {
      if (!/^\d+,\d+,\d+$/.test(key) || !c || typeof c !== "object") continue;
      const chest = newChest(FACING[c.facing] ? c.facing : 3);
      if (Array.isArray(c.items)) c.items.slice(0, CHEST_SLOTS).forEach((s, i) => (chest.items[i] = this.inventory.read(s)));
      this.chests[key] = chest;
    }
    this.hurtTicks = 0;
    this.fire = 0;
    this.lastDamage = "";
    this.broken = 0;
  }
  get creative() {
    return this.mode === "creative";
  }
  get held() {
    return this.inventory.held;
  }
  count(id) {
    return this.inventory.count(id);
  }
  // Adds through InventoryPlayer.addItemStackToInventory; returns the amount stored.
  add(id, n = 1, damage = 0) {
    if (!ITEMS[id] || id === 0 || n <= 0) return 0;
    const s = makeStack(id, n, damage);
    this.inventory.add(s);
    return n - s.count;
  }
  // Placing, eating and feeding shrink the held stack in 1.7.10.
  take(id, n = 1) {
    if (this.count(id) < n) return false;
    const inv = this.inventory;
    for (let k = 0; k < n; k++)
      if (inv.held?.id === id) { if (--inv.held.count <= 0) inv.main[inv.current] = null; }
      else inv.consume(id);
    return true;
  }
  exhaust(n) {
    if (!this.creative)
      this.exhaustion = Math.fround(Math.min(40, this.exhaustion + n));
  }
  // Mob attacks are blockable; falls, drowning and starvation bypass armor.
  damage(n, reason = "an accident", blockable = false) {
    if (this.creative || this.health <= 0 || n <= 0 || this.hurtTicks > 0)
      return false;
    if (blockable) n = this.applyArmor(n);
    this.health = Math.max(0, Math.fround(this.health - n));
    this.lastDamage = reason;
    this.hurtTicks = 10;
    return true;
  }
  get armorValue() {
    return this.inventory.armor.reduce((total, s) => total + (ITEMS[s?.id]?.defense || 0), 0);
  }
  // EntityLivingBase.applyArmorCalculations and InventoryPlayer.damageArmor:
  // damage x (25 - armor) / 25; each piece loses max(1, damage / 4) durability.
  applyArmor(n) {
    const reduced = Math.fround(Math.fround(n * (25 - this.armorValue)) / 25),
      wear = Math.floor(Math.max(1, Math.fround(n / 4)));
    for (let i = 36; i < 40; i++) {
      const s = this.inventory.getStack(i);
      if (s && ITEMS[s.id]?.armor !== undefined && this.inventory.damage(i, wear)) this.broken = s.id;
    }
    return reduced;
  }
  eat(id, random = Math.random) {
    const item = ITEMS[id];
    if (!item?.food || this.food >= 20 || !this.take(id)) return false;
    this.food = Math.min(20, this.food + item.food);
    this.saturation = Math.min(
      this.food,
      this.saturation + item.food * item.saturation * 2,
    );
    this.effects.food(id, random);
    return true;
  }
  // Damages the held stack (or the first of that item); `broken` names a break.
  wear(id, amount = 1) {
    const inv = this.inventory, i = inv.held?.id === id ? inv.current : inv.find(id);
    if (i < 0 || !inv.damage(i, amount)) return false;
    this.broken = id;
    return true;
  }
  openInventory() {
    return new PlayerContainer(this.inventory, { craft: craftingResult });
  }
  openWorkbench() {
    return new WorkbenchContainer(this.inventory, { craft: craftingResult });
  }
  openFurnace(key, onSmelt) {
    return new FurnaceContainer(this.inventory, this.furnace(key).items, { smelts: (s) => !!smeltingResult(s), burnTime, onSmelt });
  }
  // BlockChest.onBlockActivated: null when the lid is blocked.
  openChest(world, x, y, z) {
    const found = openChest(world, this.chests, x, y, z);
    return found && Object.assign(new ChestContainer(this.inventory, found.inventory), { title: found.title, keys: found.keys });
  }
  mining(block, toolId, underwater = false, onGround = true) {
    return miningState(block,MATERIALS[block],this.count(toolId)?ITEMS[toolId]:null,{underwater,onGround});
  }
  wearBlock(block,toolId){return this.wear(toolId,blockWear(block,MATERIALS[block]||{},ITEMS[toolId]));}

  tick({ underwater = false, inWater = false, inLava = false } = {}) {
    this.time++;
    this.hurtTicks = Math.max(0, this.hurtTicks - 1);
    this.tickFurnaces();
    // Entity.onEntityUpdate (sa.C): water puts the fire out; a burning entity takes
    // 1 (onFire, ignores armor) whenever the counter is a multiple of 20; lava
    // deals 4 (lava, armor applies) and sets fire for 15 s. The hurt-resistance
    // window (hurtTicks) still gates every hit.
    if (inWater) this.fire = 0;
    if (this.fire > 0) {
      if (this.fire % 20 === 0) this.damage(1, "burning");
      this.fire--;
    }
    if (inLava) {
      this.damage(4, "lava", true);
      this.fire = Math.max(this.fire, 300);
    }
    this.effects.tick(this);
    if (this.creative) return;
    if (underwater) {
      this.air--;
      if (this.air === -20) {
        this.air = 0;
        this.damage(2, "drowning");
      }
    } else this.air = 300;
    if (this.exhaustion > 4) {
      this.exhaustion = Math.fround(this.exhaustion - 4);
      if (this.saturation > 0)
        this.saturation = Math.max(0, this.saturation - 1);
      else this.food = Math.max(0, this.food - 1);
    }
    if (this.food >= 18 && this.health < 20 && this.health > 0) {
      if (++this.timer >= 80) {
        this.health = Math.min(20, this.health + 1);
        this.exhaust(3);
        this.timer = 0;
      }
    } else if (this.food <= 0) {
      if (++this.timer >= 80) {
        if (this.health > 1) this.damage(1, "starvation");
        this.timer = 0;
      }
    } else this.timer = 0;
  }
  furnace(key) {
    return (this.furnaces[key] ??= { items: [null, null, null], burn: 0, burnTotal: 0, cook: 0 });
  }
  // TileEntityFurnace.canSmelt, updateEntity and smeltItem.
  canSmelt(f) {
    const [input, , output] = f.items, result = smeltingResult(input);
    if (!result) return false;
    if (!output) return true;
    if (output.id !== result.id || output.damage !== result.damage) return false;
    const total = output.count + result.count;
    return total <= 64 && total <= (ITEMS[output.id]?.stack ?? 64);
  }
  tickFurnaces() {
    for (const f of Object.values(this.furnaces)) {
      if (f.burn > 0) f.burn--;
      if (f.burn === 0 && this.canSmelt(f)) {
        f.burn = f.burnTotal = burnTime(f.items[1]);
        // TileEntityFurnace.updateEntity: a used-up fuel stack becomes its container item.
        if (f.burn > 0 && f.items[1] && --f.items[1].count === 0) f.items[1] = CONTAINER_ITEMS[f.items[1].id] ? makeStack(CONTAINER_ITEMS[f.items[1].id]) : null;
      }
      if (f.burn > 0 && this.canSmelt(f)) {
        if (++f.cook === 200) {
          f.cook = 0;
          const result = smeltingResult(f.items[0]);
          if (!f.items[2]) f.items[2] = result;
          else f.items[2].count += result.count;
          if (--f.items[0].count <= 0) f.items[0] = null;
        }
      } else f.cook = 0;
    }
  }
  serialize() {
    const { health, food, saturation, exhaustion, timer, air, time, furnaces, chests } = this;
    return {
      health,
      food,
      saturation,
      exhaustion,
      timer,
      air,
      time,
      effects: this.effects.serialize(),
      slots: this.inventory.serialize(),
      armor: this.inventory.serializeArmor(),
      current: this.inventory.current,
      furnaces: structuredClone(furnaces),
      chests: Object.fromEntries(Object.entries(chests).map(([key, c]) => [key, { facing: c.facing, items: c.items.map((s) => (s ? { ...s } : null)) }])),
    };
  }
}
