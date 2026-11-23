// Batch 98 mpobjects98: the client predicts a shear with size-0 shears (as EntityWorld.shear on the server); a joining snapshot carries the live lit set with the live columns.
import test from "node:test";
import assert from "node:assert/strict";
import { populationBlockMapperReady } from "./population-world.js";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { makeStack } from "./inventory.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { predictAnimalUse } from "./multiplayer/animal-use.js";

await populationBlockMapperReady;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
function flat(name) {
  const w = new World(name);
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) w.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return w;
}

test("client predicts a shear with a size-0 pair in hand and keeps the stack", () => {
  const s = new Survival({ slots: [makeStack(125, 1)] }, "survival");
  s.inventory.held.count = 0;
  const sheep = { type: "sheep", growingAge: 0, sheared: false, color: 0, health: 8 };
  const r = predictAnimalUse(sheep, s);
  assert.equal(r.handled, true);
  assert.equal(sheep.sheared, true);
  assert.equal(r.sound, "mob.sheep.shear");
  assert.equal(s.inventory.held?.id, 125, "the stack stays in the hand");
});

test("a normal pair still shears and wears", () => {
  const s = new Survival({ slots: [makeStack(125, 1)] }, "survival");
  const sheep = { type: "sheep", growingAge: 0, sheared: false, color: 0, health: 8 };
  assert.equal(predictAnimalUse(sheep, s).handled, true);
  assert.equal(sheep.sheared, true);
  assert.equal(s.inventory.held.damage, 1);
});

test("snapshot lit is the live set with the live columns in the Overworld and the Nether", { timeout: 300000 }, () => {
  const s = new DedicatedSimulation({}, { world: flat("b98-snap"), gameMode: "creative", mobs: true });
  const a = s.addPlayer("a", "Alice", key(1));
  s.tick();
  s.redstone.lit.add("70,10,70");
  assert.equal(s.snapshot("a").redstone.lit.includes("70,10,70"), true);
  s.dimensions.arrive(a, -1, { at: { x: 64.5, y: 70, z: 64.5 } });
  const n = s.dimensions.nether;
  n.redstone.lit.add("60,70,60");
  assert.equal(s.snapshot("a").redstone.lit.includes("60,70,60"), true);
});
