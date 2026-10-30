import { test } from "node:test";
import assert from "node:assert/strict";
import { Survival, ITEMS, RECIPES, matchRecipe } from "./survival.js";
import { World } from "./world.js";

test("gold tools are fast but cannot harvest iron ore, and beef smelts into steak", () => {
  const p = new Survival({ inventory: { 116: 1, 204: 1, 301: 1 } });
  assert.ok(p.mining(3, 116).progress > p.mining(3, 0).progress);
  assert.equal(p.mining(16, 116).harvest, false);
  p.loadFurnace("1,2,3", "input", 204);
  p.loadFurnace("1,2,3", "fuel", 301);
  for (let i = 0; i < 200; i++) p.tick();
  assert.equal(p.furnace("1,2,3").output, 205);
  assert.equal(p.furnace("1,2,3").outputCount, 1);
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
test("survival progression consumes inputs atomically and stops when resources run out", () => {
  const p = new Survival();
  p.add(4, 3);
  const planks = RECIPES.find((r) => r.id === "planks"),
    sticks = RECIPES.find((r) => r.id === "sticks"),
    table = RECIPES.find((r) => r.id === "table");
  assert.equal(p.craft(planks), true);
  assert.equal(p.count(4), 2);
  assert.equal(p.count(7), 4);
  assert.equal(p.craft(sticks), true);
  assert.equal(p.count(7), 2);
  assert.equal(p.count(300), 4);
  const before = p.serialize();
  assert.equal(p.craft(table), false);
  assert.deepEqual(p.serialize(), before);
  p.craft(planks);
  assert.equal(p.craft(table), true);
  assert.equal(p.count(13), 1);
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
test("tool durability survives saves and a broken tool is removed", () => {
  const p = new Survival({ inventory: { 100: 1 }, durability: { 100: 2 } });
  assert.equal(p.wear(100), false);
  const q = new Survival(p.serialize());
  assert.equal(q.durability[100], 1);
  assert.equal(q.wear(100), true);
  assert.equal(q.count(100), 0);
  q.add(100);
  assert.equal(q.durability[100], ITEMS[100].durability);
});
test("furnaces require fuel and smelt every two hundred ticks", () => {
  const p = new Survival({ inventory: { 16: 9, 301: 1 } }),
    key = "1,2,3";
  for (let i = 0; i < 9; i++) p.loadFurnace(key, "input", 16);
  for (let i = 0; i < 200; i++) p.tick();
  assert.equal(p.furnace(key).outputCount, 0);
  p.loadFurnace(key, "fuel", 301);
  for (let i = 0; i < 199; i++) p.tick();
  assert.equal(p.furnace(key).outputCount, 0);
  p.tick();
  assert.equal(p.furnace(key).output, 302);
  assert.equal(p.furnace(key).outputCount, 1);
  for (let i = 0; i < 1400; i++) p.tick();
  assert.equal(p.furnace(key).outputCount, 8);
  assert.equal(p.furnace(key).inputCount, 1);
  for (let i = 0; i < 200; i++) p.tick();
  assert.equal(p.furnace(key).outputCount, 8);
  assert.equal(p.unloadFurnace(key, "output"), 8);
  assert.equal(p.count(302), 8);
});
test("a mid-smelt save resumes without duplicating or losing inputs and fuel", () => {
  const p = new Survival({ inventory: { 6: 2, 301: 1 } }),
    key = "2,3,4";
  p.loadFurnace(key, "input", 6);
  p.loadFurnace(key, "input", 6);
  p.loadFurnace(key, "fuel", 301);
  for (let i = 0; i < 100; i++) p.tick();
  const q = new Survival(p.serialize());
  for (let i = 0; i < 100; i++) q.tick();
  assert.equal(q.furnace(key).outputCount, 1);
  assert.equal(q.furnace(key).inputCount, 1);
  assert.equal(q.count(301), 0);
  assert.equal(q.furnace(key).cook, 0);
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
});
