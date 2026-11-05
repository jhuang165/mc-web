// Magma cube and zombie pigman inside the EntityWorld: registration, anger, fireproofing, lightning conversion, /summon and Java NBT.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EntityWorld, ENTITY_TYPES, HOSTILE } from "./entities.js";
import { Survival } from "./survival.js";
import { summonedMobRecord, javaMobFromNbt } from "./java-mobs.js";
import { NBT } from "./nbt.js";
import { SUMMONABLE } from "./commands.js";

const grass = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const world = (mobs) => new EntityWorld(grass, mobs.map((m, i) => ({ id: "mob-" + i, x: 64.5, y: 0, z: 64.5, health: 20, ...m })), () => 0.5);

test("both mobs are registered, summonable and hostile", () => {
  assert.ok(ENTITY_TYPES.magma_cube && ENTITY_TYPES.pigman);
  assert.equal(SUMMONABLE.LavaSlime, "magma_cube");
  assert.equal(SUMMONABLE.PigZombie, "pigman");
  assert.ok(HOSTILE.has("pigman"));
});

test("a player hit angers every pigman within 32 blocks, not those beyond", () => {
  const w = world([{ type: "pigman" }, { type: "pigman", x: 80.5 }, { type: "pigman", x: 102.5 }]);
  const [hit, near, far] = w.entities;
  w.attackEntityFrom(hit, 1, { player: true, name: "player", from: { x: 60, z: 64.5 } });
  assert.ok(hit.angerLevel >= 400 && hit.angerLevel < 800);
  assert.ok(near.angerLevel >= 400);
  assert.ok(!far.angerLevel);
});

test("pigman and magma cube survive fire and lava", () => {
  const w = world([{ type: "pigman" }, { type: "magma_cube", size: 2, health: 4 }]);
  for (const e of w.entities) {
    w.burn?.(e, 5);
    assert.ok(!(e.fire > 0), e.type + " is fireproof");
  }
});

test("lightning turns a pig into a pigman with a golden sword at the same place", () => {
  const w = world([{ type: "pig", x: 10.5, z: 3.5, health: 10 }]);
  const pig = w.entities[0], made = w.pigStruck(pig);
  assert.equal(made.type, "pigman");
  assert.equal(made.held.id, 119);
  assert.deepEqual([made.x, made.z], [10.5, 3.5]);
  assert.ok(!w.entities.includes(pig));
  assert.ok(w.entities.includes(made));
});

test("LavaSlime and PigZombie /summon records round trip through Java NBT", () => {
  const { record: m } = summonedMobRecord("magma_cube", new Map([["Size", { type: NBT.INT, value: 3 }]]));
  assert.equal(m.type, "magma_cube");
  assert.equal(m.size, 4); // Size is size - 1 in NBT
  const { record: p } = summonedMobRecord("pigman", new Map([["Anger", { type: NBT.SHORT, value: 123 }]]));
  assert.equal(p.type, "pigman");
  assert.equal(p.angerLevel, 123);
  assert.ok(javaMobFromNbt);
});

test("pigman anger and held sword survive serialize and restore", () => {
  const w = world([{ type: "pigman", angerLevel: 300, held: { id: 119, damage: 0, count: 1 } }]);
  const back = new EntityWorld(grass, JSON.parse(JSON.stringify(w.serialize()))).entities[0];
  assert.equal(back.angerLevel, 300);
  assert.equal(back.held.id, 119);
});
