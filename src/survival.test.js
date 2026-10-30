import { test } from "node:test";
import assert from "node:assert/strict";
import { Survival, ITEMS, RECIPES, matchRecipe, craftingResult } from "./survival.js";
import { makeStack } from "./inventory.js";
import { World } from "./world.js";

// Lays one item per filled cell through real slot clicks, then takes one result.
function craftOnce(p, cells, size = 2) {
  const c = size === 2 ? p.openInventory() : p.openWorkbench(),
    inv = p.inventory,
    slotOf = (index) => c.slots.findIndex((s) => s.inventory === inv && s.index === index);
  cells.forEach((id, i) => {
    const at = id ? inv.find(id) : -1;
    if (at < 0) return;
    c.click(slotOf(at), 0, 0);
    c.click(1 + i, 1, 0);
    c.click(slotOf(at), 0, 0);
  });
  const made = c.click(0, 0, 0);
  if (inv.cursor) inv.add(inv.cursor);
  inv.cursor = null;
  c.close();
  for (const s of c.drops) inv.add(s);
  return made;
}

test("gold tools are fast but cannot harvest iron ore, and beef smelts into steak", () => {
  const p = new Survival({ inventory: { 116: 1 } }),
    f = p.furnace("1,2,3");
  assert.ok(p.mining(3, 116).progress > p.mining(3, 0).progress);
  assert.equal(p.mining(16, 116).harvest, false);
  f.items[0] = makeStack(204);
  f.items[1] = makeStack(301);
  for (let i = 0; i < 200; i++) p.tick();
  assert.deepEqual(f.items[2], makeStack(205));
  assert.equal(f.items[0], null);
});

test("1.7.10 exhaustion threshold is strictly greater than four; saturation drains first", () => {
  const p = new Survival({ food: 20, saturation: 5, exhaustion: 4 });
  p.tick();
  assert.equal(p.saturation, 5);
  p.exhaust(0.01);
  p.tick();
  assert.equal(p.saturation, 4);
  assert.equal(p.food, 20);
  p.saturation = 0;
  p.exhaustion = 4.1;
  p.tick();
  assert.equal(p.food, 19);
});
test("natural regeneration requires eighteen food and eighty ticks", () => {
  const p = new Survival({ health: 18, food: 18 });
  for (let i = 0; i < 79; i++) p.tick();
  assert.equal(p.health, 18);
  p.tick();
  assert.equal(p.health, 19);
  assert.equal(p.exhaustion, 3);
  const hungry = new Survival({ health: 18, food: 17 });
  for (let i = 0; i < 160; i++) hungry.tick();
  assert.equal(hungry.health, 18);
});
test("normal starvation stops at one health and drowning starts after air runs out", () => {
  const p = new Survival({ health: 2, food: 0 });
  for (let i = 0; i < 160; i++) p.tick();
  assert.equal(p.health, 1);
  const swimmer = new Survival();
  for (let i = 0; i < 319; i++) swimmer.tick({ underwater: true });
  assert.equal(swimmer.health, 20);
  swimmer.tick({ underwater: true });
  assert.equal(swimmer.health, 18);
  for (let i = 0; i < 20; i++) swimmer.tick({ underwater: true });
  assert.equal(swimmer.health, 16);
  swimmer.tick();
  assert.equal(swimmer.air, 300);
});
test("food consumes one item, caps hunger, and adds saturation", () => {
  const p = new Survival({ food: 15, saturation: 0, inventory: { 201: 2 } });
  assert.equal(p.eat(201), true);
  assert.equal(p.food, 20);
  assert.equal(p.saturation, 6);
  assert.equal(p.count(201), 1);
  assert.equal(p.eat(201), false);
  assert.equal(p.count(201), 1);
});
test("shaped recipes support translation and horizontal mirroring and reject extra items", () => {
  assert.equal(matchRecipe([0, 4, 0, 0], 2)?.output, 7);
  assert.equal(matchRecipe([7, 0, 0, 7], 2), null);
  const axe = [7, 7, 0, 300, 7, 0, 300, 0, 0];
  assert.equal(matchRecipe(axe, 3)?.output, 104);
  const extra = [...axe];
  extra[8] = 4;
  assert.equal(matchRecipe(extra, 3), null);
  assert.equal(matchRecipe([7, 7, 7, 300], 2), null);
});
test("survival progression crafts through grid slots and stops when resources run out", () => {
  const p = new Survival();
  p.add(4, 3);
  assert.deepEqual(craftOnce(p, [4]), makeStack(7, 4));
  assert.equal(p.count(4), 2);
  assert.equal(p.count(7), 4);
  craftOnce(p, [7, 0, 7]);
  assert.equal(p.count(7), 2);
  assert.equal(p.count(300), 4);
  const before = p.serialize();
  assert.equal(craftOnce(p, [7, 7, 7, 7]), null);
  assert.deepEqual(p.serialize(), before);
  craftOnce(p, [4]);
  craftOnce(p, [7, 7, 7, 7]);
  assert.equal(p.count(13), 1);
  assert.equal(p.count(7), 2);
});
test("shift-clicking the result crafts until the grid runs out", () => {
  const p = new Survival({ slots: [makeStack(4, 5)] }),
    c = p.openInventory();
  c.click(36, 0, 0);
  c.click(1, 0, 0);
  c.click(0, 0, 1);
  assert.equal(p.count(7), 20);
  assert.equal(c.grid.stacks[0], null);
  assert.equal(c.result.stack, null);
});
test("pickaxe tiers govern ore drops, and unowned tools cannot harvest", () => {
  const p = new Survival({ inventory: { 100: 1, 101: 1, 102: 1 } });
  assert.equal(p.mining(16, 100).harvest, false);
  assert.equal(p.mining(16, 101).harvest, true);
  assert.equal(p.mining(17, 101).harvest, false);
  assert.equal(p.mining(17, 102).harvest, true);
  assert.equal(p.mining(17, 103).harvest, false);
  assert.equal(p.mining(11, 102).progress, 0);
  assert.ok(p.mining(3, 101).progress > p.mining(3, 100).progress);
});
test("tool damage is per stack, survives saves, and breaks past the maximum", () => {
  const p = new Survival({ slots: [makeStack(100, 1, 58), makeStack(100)] });
  assert.equal(p.wear(100), false);
  const q = new Survival(p.serialize());
  assert.equal(q.held.damage, 59);
  assert.equal(q.inventory.main[1].damage, 0);
  assert.equal(q.wear(100), true);
  assert.equal(q.held, null);
  assert.equal(q.count(100), 1);
  const creative = new Survival({ slots: [makeStack(100, 1, 59)] }, "creative");
  assert.equal(creative.wear(100), false);
  assert.equal(creative.held.damage, 59);
  const legacy = new Survival({ inventory: { 100: 1, 4: 3 }, durability: { 100: 2 }, hotbar: [4] });
  assert.deepEqual(legacy.inventory.main[0], makeStack(4, 3));
  assert.deepEqual(legacy.inventory.main[9], makeStack(100, 1, ITEMS[100].durability - 2));
});
test("furnaces require fuel and smelt every two hundred ticks", () => {
  const p = new Survival(),
    key = "1,2,3",
    f = p.furnace(key);
  f.items[0] = makeStack(16, 9);
  for (let i = 0; i < 200; i++) p.tick();
  assert.equal(f.items[2], null);
  f.items[1] = makeStack(301);
  for (let i = 0; i < 199; i++) p.tick();
  assert.equal(f.items[2], null);
  p.tick();
  assert.deepEqual(f.items[2], makeStack(302));
  for (let i = 0; i < 1400; i++) p.tick();
  assert.equal(f.items[2].count, 8);
  assert.equal(f.items[0].count, 1);
  for (let i = 0; i < 200; i++) p.tick();
  assert.equal(f.items[2].count, 8);
  const c = p.openFurnace(key);
  c.click(2, 0, 1);
  assert.equal(p.count(302), 8);
  assert.equal(f.items[2], null);
});
test("a mid-smelt save resumes without duplicating or losing inputs and fuel", () => {
  const p = new Survival(),
    key = "2,3,4";
  Object.assign(p.furnace(key), { items: [makeStack(6, 2), makeStack(301), null] });
  for (let i = 0; i < 100; i++) p.tick();
  const q = new Survival(p.serialize()),
    f = q.furnace(key);
  for (let i = 0; i < 100; i++) q.tick();
  assert.deepEqual(f.items, [makeStack(6), null, makeStack(9)]);
  assert.equal(f.cook, 0);
  const legacy = new Survival({ furnaces: { [key]: { input: 6, inputCount: 2, fuel: 301, fuelCount: 1, output: 9, outputCount: 3, cook: 50 } } });
  assert.deepEqual(legacy.furnace(key).items, [makeStack(6, 2), makeStack(301), makeStack(9, 3)]);
});
test("old terrain is stable, new terrain adds ore, and both have safe spawns", () => {
  const old = new World("Overworld", "meadow", 1),
    modern = new World("Overworld", "meadow", 2);
  assert.equal(old.data.includes(16), false);
  assert.equal(modern.data.includes(16), true);
  assert.notDeepEqual(old.data, modern.data);
});
test("untrusted saved resources and stats are bounded", () => {
  const p = new Survival({
    health: -100,
    food: 900,
    saturation: Infinity,
    inventory: { 301: 10000, 100: 10, 666: 5 },
    durability: { 100: -10 },
    furnaces: { "bad key": {} },
  });
  assert.equal(p.health, 0);
  assert.equal(p.food, 20);
  assert.equal(p.count(301), 64);
  assert.equal(p.count(100), 1);
  assert.equal(p.count(666), 0);
  assert.equal(Object.keys(p.furnaces).length, 0);
  const q = new Survival({ slots: [{ id: 4, count: 900 }, { id: 666, count: 1 }, { id: 100, count: 3, damage: 9999 }, { id: 7, count: -2 }, "bad"], current: 40 });
  assert.deepEqual(q.inventory.main.slice(0, 5), [makeStack(4, 64), null, makeStack(100, 1, ITEMS[100].durability), null, null]);
  assert.equal(q.inventory.current, 8);
});
test("armor reduces blockable damage, wears each piece, and survives saves", () => {
  const iron = [411, 410, 409, 408].map((id) => makeStack(id)),
    p = new Survival({ armor: iron });
  assert.equal(p.armorValue, 15);
  assert.equal(p.damage(3, "a zombie", true), true);
  const afterHit = Math.fround(20 - Math.fround(Math.fround(3 * 10) / 25));
  assert.equal(p.health, afterHit);
  assert.deepEqual(p.inventory.armor.map((s) => s.damage), [1, 1, 1, 1]);
  p.hurtTicks = 0;
  p.damage(3, "a fall");
  assert.equal(p.health, Math.fround(afterHit - 3));
  assert.deepEqual(p.inventory.armor.map((s) => s.damage), [1, 1, 1, 1]);
  const q = new Survival(p.serialize());
  assert.deepEqual(q.inventory.armor, p.inventory.armor);
  assert.equal(new Survival({ armor: [makeStack(408)] }).inventory.armor[0], null);
  const worn = new Survival({ armor: [makeStack(403, 1, 64)] });
  worn.damage(2, "a zombie", true);
  assert.deepEqual(worn.inventory.armor[0], makeStack(403, 1, 65));
  worn.hurtTicks = 0;
  worn.damage(2, "a zombie", true);
  assert.equal(worn.inventory.armor[0], null);
  assert.equal(worn.broken, 403);
  assert.equal(ITEMS[409].durability, 240);
  assert.equal(craftingResult([302, 0, 302, 302, 302, 302, 302, 302, 302].map((id) => (id ? makeStack(id) : null)), 3).id, 409);
});
