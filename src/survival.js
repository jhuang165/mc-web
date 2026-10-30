import { BLOCKS } from "./world.js";

export const ITEMS = Object.fromEntries(
  BLOCKS.map((b, id) => [id, { ...b, id, block: id > 0, stack: 64 }]),
);
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
for(const [tier,name,durability,ingredient]of[[0,'Wooden',59,7],[1,'Stone',131,12],[2,'Iron',250,302],[3,'Diamond',1561,303],[0,'Golden',32,304]]){const id=120+Object.values(ITEMS).filter(i=>i.kind==='hoe').length;ITEMS[id]={id,name:name+' hoe',kind:'hoe',tier,durability,speed:1,ingredient,stack:1,color:'#b7a274',glyph:'⚒'};}
for (const item of [
  {id:309,name:"Wheat seeds",color:"#8eab54",glyph:"·"},{id:310,name:"Bone meal",color:"#ede9d8",glyph:"●"},{id:311,name:"Bone",color:"#dedac6",glyph:"╱"},
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
  ITEMS[item.id] = { ...item, stack: 64 };

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
  21: { hardness: 1.5, kind: "axe", drop: 7 },
  22: { hardness: 50, kind: "pickaxe", tier: 3 },
  23: { hardness: 0.2, kind: "shovel" },
  24: { hardness: 0.6, kind: "shovel", drop: 307, count: 4 },
  25: { hardness: 0.6, kind: "shovel" },
  26: { hardness: 5, kind: "pickaxe", tier: 1 },
  27: { hardness: 3, kind: "pickaxe", tier: 2 },
  28: { hardness: 5, kind: "pickaxe", tier: 2 },
};

for(let id=29;id<=39;id++)MATERIALS[id]={hardness:id<=30?.6:0,kind:id<=30?'shovel':undefined,drop:id<=30?2:0};
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
recipe("planks", "Oak planks", ["L"], { L: 4 }, 7, 4);
recipe("sticks", "Sticks", ["P", "P"], { P: 7 }, 300, 4);
recipe("table", "Crafting table", ["PP", "PP"], { P: 7 }, 13);
recipe("furnace", "Furnace", ["CCC", "C C", "CCC"], { C: 12 }, 14);
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
recipe('bonemeal','Bone meal',['B'],{B:311},310,3);
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
export const SMELTING = {
  204: 205,
  12: 3,
  6: 9,
  16: 302,
  18: 304,
  4: 308,
  202: 203,
  307: 306,
};
export const FUELS = {
  4: 300,
  7: 300,
  13: 300,
  300: 100,
  301: 1600,
  308: 1600,
};
const clamp = (v, min, max, fallback) =>
  Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;

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
    this.inventory = {};
    this.durability = {};
    this.furnaces = {};
    for (const [key, count] of Object.entries(data.inventory || {})) {
      const id = +key;
      if (ITEMS[id] && Number.isInteger(count) && count > 0)
        this.inventory[id] = Math.min(ITEMS[id].stack, count);
    }
    for (const [key, n] of Object.entries(data.durability || {}))
      if (ITEMS[key]?.durability)
        this.durability[key] = clamp(
          n,
          1,
          ITEMS[key].durability,
          ITEMS[key].durability,
        );
    for (const [key, f] of Object.entries(data.furnaces || {})) {
      if (!/^\d+,\d+,\d+$/.test(key) || !f || typeof f !== "object") continue;
      const input =
          Number.isInteger(f.input) && Object.hasOwn(SMELTING, f.input)
            ? f.input
            : 0,
        fuel =
          Number.isInteger(f.fuel) && Object.hasOwn(FUELS, f.fuel) ? f.fuel : 0,
        output = Number.isInteger(f.output) && ITEMS[f.output] ? f.output : 0;
      this.furnaces[key] = {
        input,
        fuel,
        output,
        inputCount: input ? Math.floor(clamp(f.inputCount, 0, 64, 0)) : 0,
        fuelCount: fuel ? Math.floor(clamp(f.fuelCount, 0, 64, 0)) : 0,
        outputCount: output ? Math.floor(clamp(f.outputCount, 0, 64, 0)) : 0,
        burn: Math.floor(clamp(f.burn, 0, 1600, 0)),
        burnTotal: Math.floor(clamp(f.burnTotal, 0, 1600, 0)),
        cook: Math.floor(clamp(f.cook, 0, 199, 0)),
      };
    }
    this.hurtTicks = 0;
    this.lastDamage = "";
  }
  get creative() {
    return this.mode === "creative";
  }
  count(id) {
    return this.inventory[id] || 0;
  }
  room(id) {
    return Math.max(0, (ITEMS[id]?.stack || 0) - this.count(id));
  }
  add(id, n = 1) {
    if (!ITEMS[id] || id === 0) return 0;
    const amount = Math.min(n, this.room(id));
    if (amount > 0) {
      this.inventory[id] = this.count(id) + amount;
      if (ITEMS[id].durability && !this.durability[id])
        this.durability[id] = ITEMS[id].durability;
    }
    return amount;
  }
  take(id, n = 1) {
    if (this.count(id) < n) return false;
    this.inventory[id] -= n;
    if (this.inventory[id] <= 0) delete this.inventory[id];
    return true;
  }
  exhaust(n) {
    if (!this.creative)
      this.exhaustion = Math.fround(Math.min(40, this.exhaustion + n));
  }
  damage(n, reason = "an accident") {
    if (this.creative || this.health <= 0 || n <= 0 || this.hurtTicks > 0)
      return false;
    this.health = Math.max(0, this.health - n);
    this.lastDamage = reason;
    this.hurtTicks = 10;
    return true;
  }
  eat(id) {
    const item = ITEMS[id];
    if (!item?.food || this.food >= 20 || !this.take(id)) return false;
    this.food = Math.min(20, this.food + item.food);
    this.saturation = Math.min(
      this.food,
      this.saturation + item.food * item.saturation * 2,
    );
    return true;
  }
  wear(id) {
    if (this.creative || !ITEMS[id]?.durability || !this.count(id))
      return false;
    this.durability[id] = (this.durability[id] || ITEMS[id].durability) - 1;
    if (this.durability[id] <= 0) {
      this.take(id);
      delete this.durability[id];
      return true;
    }
    return false;
  }
  canCraft(r) {
    return (
      !!r &&
      Object.entries(ingredients(r)).every(([id, n]) => this.count(+id) >= n) &&
      this.room(r.output) >= r.count
    );
  }
  craft(r) {
    if (!this.canCraft(r)) return false;
    for (const [id, n] of Object.entries(ingredients(r))) this.take(+id, n);
    this.add(r.output, r.count);
    return true;
  }
  mining(block, toolId, underwater = false, onGround = true) {
    const m = MATERIALS[block] || { hardness: 1 },
      tool = ITEMS[toolId];
    if (!Number.isFinite(m.hardness)) return { progress: 0, harvest: false };
    const harvest =
      m.tier === undefined ||
      (tool?.kind === "pickaxe" &&
        tool.tier >= m.tier &&
        this.count(toolId) > 0);
    let speed =
      tool && tool.kind === m.kind && this.count(toolId) ? tool.speed : 1;
    if (underwater) speed /= 5;
    if (!onGround) speed /= 5;
    return {
      progress:
        m.hardness === 0 ? 1 : speed / m.hardness / (harvest ? 30 : 100),
      harvest,
    };
  }
  tick({ underwater = false } = {}) {
    this.time++;
    this.hurtTicks = Math.max(0, this.hurtTicks - 1);
    this.tickFurnaces();
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
    return (this.furnaces[key] ??= {
      input: 0,
      inputCount: 0,
      fuel: 0,
      fuelCount: 0,
      output: 0,
      outputCount: 0,
      burn: 0,
      burnTotal: 0,
      cook: 0,
    });
  }
  loadFurnace(key, slot, id) {
    const f = this.furnace(key),
      valid =
        slot === "input" ? SMELTING[id] : slot === "fuel" ? FUELS[id] : false;
    if (
      !valid ||
      (f[slot] && f[slot] !== id) ||
      f[slot + "Count"] >= 64 ||
      !this.take(id)
    )
      return false;
    f[slot] = id;
    f[slot + "Count"]++;
    return true;
  }
  unloadFurnace(key, slot) {
    const f = this.furnace(key),
      id = f[slot],
      n = f[slot + "Count"];
    if (!id || !n) return 0;
    const added = this.add(id, n);
    f[slot + "Count"] -= added;
    if (!f[slot + "Count"]) f[slot] = 0;
    if (slot === "input") f.cook = 0;
    return added;
  }
  tickFurnaces() {
    for (const f of Object.values(this.furnaces)) {
      if (f.burn > 0) f.burn--;
      const out = SMELTING[f.input],
        can =
          !!out &&
          f.inputCount > 0 &&
          f.outputCount < 64 &&
          (!f.outputCount || f.output === out);
      if (can && f.burn <= 0 && f.fuelCount > 0 && FUELS[f.fuel]) {
        f.burn = f.burnTotal = FUELS[f.fuel];
        if (--f.fuelCount === 0) f.fuel = 0;
      }
      if (can && f.burn > 0) {
        if (++f.cook === 200) {
          f.cook = 0;
          f.output = out;
          f.outputCount++;
          if (--f.inputCount === 0) f.input = 0;
        }
      } else f.cook = 0;
    }
  }
  serialize() {
    const {
      health,
      food,
      saturation,
      exhaustion,
      timer,
      air,
      time,
      inventory,
      durability,
      furnaces,
    } = this;
    return {
      health,
      food,
      saturation,
      exhaustion,
      timer,
      air,
      time,
      inventory: { ...inventory },
      durability: { ...durability },
      furnaces: structuredClone(furnaces),
    };
  }
}
