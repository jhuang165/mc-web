// Batch 70 spfixes: chicken breeding items (ItemSeeds), mob-versus-mob Smite and Bane, Bane slowness on the hit mob, the display tick of the ender chest.
import test from "node:test";
import assert from "node:assert/strict";
import { EntityWorld, isBreedingItem } from "./entities.js";
import { Survival } from "./survival.js";
import { JavaRandom } from "./java-random.js";
import { randomDisplayTick } from "./display-ticks.js";
import { itemFromOriginal } from "./region-import.js";
import { ENDER_CHEST } from "./chest-blocks.js";

const world = (mobs) => new EntityWorld({ size: 128, height: 256 }, mobs, () => 0.5);
const sword = (id, lvl) => ({ id: 267, count: 1, damage: 0, ...(lvl ? { enchantments: [{ id, lvl }] } : {}) });

test("isBreedingItem: a chicken takes every ItemSeeds (wheat, pumpkin, melon seeds, nether wart), not carrots or wheat; others are unchanged", () => {
  for (const id of [309, 361, 362, 386]) assert.equal(isBreedingItem("chicken", id), true, id);
  for (const id of [305, 391, 392, 0]) assert.equal(isBreedingItem("chicken", id), false, id);
  assert.equal(isBreedingItem("cow", 305), true);
  assert.equal(isBreedingItem("cow", 309), false);
});

test("feed: pumpkin seeds breed a chicken and are taken", () => {
  const ew = world([{ id: "m1", type: "chicken", x: 64, y: 0, z: 64, health: 4 }]), p = new Survival({ inventory: { 361: 2 } });
  assert.equal(ew.feed(ew.entities[0], 361, p), true);
  assert.equal(ew.entities[0].love, 600);
  assert.equal(p.count(361), 1);
});

test("hitMob: Smite counts against an undead victim, Bane against an arthropod, neither against others", () => {
  const dmg = (enchant, victimType) => {
    const e = world([{ id: "a", type: "zombie", x: 64, y: 0, z: 64, health: 20 }]).entities[0];
    const w = world([]);
    e.equipment = [enchant, null, null, null, null];
    const victim = { type: victimType, x: 0, y: 0, z: 0, health: 20 };
    w.entities.push(e, victim);
    let n = null;
    w.attackEntityFrom = (_t, a) => ((n = a), true);
    w.hitMob(e, victim);
    return n;
  };
  const base = dmg(sword(0, 0), "zombie");
  assert.equal(dmg(sword(17, 5), "skeleton"), base + 12.5); // Smite V: 5 * 2.5
  assert.equal(dmg(sword(17, 5), "villager"), base);
  assert.equal(dmg(sword(18, 5), "spider"), base + 12.5);
  assert.equal(dmg(sword(18, 5), "zombie"), base);
});

test("hitMob: a Bane weapon slows an arthropod victim (Slowness IV, 20 + nextInt(10 * level) ticks)", () => {
  const w = world([{ id: "a", type: "zombie", x: 64, y: 0, z: 64, health: 20 }]), e = w.entities[0];
  e.equipment = [sword(18, 2), null, null, null, null];
  const spider = { type: "spider", x: 0, y: 0, z: 0, health: 20 };
  w.entities.push(spider);
  w.attackEntityFrom = () => true;
  w.hitMob(e, spider);
  const slow = spider.effects?.find((x) => x.id === 2);
  assert.ok(slow);
  assert.equal(slow.amplifier, 3);
  assert.ok(slow.duration >= 20 && slow.duration < 40, slow.duration);
  const zombie = { type: "zombie", x: 0, y: 0, z: 0, health: 20 };
  w.entities.push(zombie);
  w.hitMob(e, zombie);
  assert.ok(!zombie.effects?.length);
});

test("player attack with Bane of Arthropods puts Slowness IV on the spider that was hit", () => {
  const flat = { numericSeed: 1, solid: (x, y) => y < 0, get: (x, y) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
  const w = new EntityWorld(flat, []);
  w.fx = { spawn() {} };
  w.worldRandom = new JavaRandom(5);
  const spider = w.create("spider", 8.5, 0, -4.5);
  w.entities.push(spider);
  const tool = itemFromOriginal(267, 0).id, p = new Survival({ slots: [{ ...sword(18, 3), id: tool }] });
  const info = { playerRandom: new JavaRandom(9) };
  const landed = w.attack(spider, tool, p, { x: 10.5, z: -4, yaw: 0 }, 0, false, info);
  assert.equal(landed, true);
  assert.ok(info.slowness >= 20 && info.slowness < 50);
  const slow = spider.effects?.find((x) => x.id === 2);
  assert.ok(slow && slow.amplifier === 3 && slow.duration === info.slowness);
});

test("the ender chest display tick spawns three portal particles", () => {
  const spawned = [], fx = { spawn: (...a) => spawned.push(a) };
  randomDisplayTick({ get: () => 0, getMeta: () => 0 }, 5, 6, 7, ENDER_CHEST, new JavaRandom(42), { fx });
  assert.equal(spawned.length, 3);
  assert.ok(spawned.every((a) => a[0] === "portal"));
});
