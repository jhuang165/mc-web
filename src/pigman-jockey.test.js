// EntityPigZombie.onSpawnWithEgg (yh.a): EntityZombie's GroupData rolls, then setVillager(false). A pigman can be a child and a chicken
// jockey, never a villager. Replayed against public/research/pigman-jockey-reference.json (tools/probes/PigmanJockeyProbe.java).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EntityWorld } from "./entities.js";
import { JavaRandom } from "./java-random.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/pigman-jockey-reference.json", import.meta.url)));
const flat = () => ({ height: 256, numericSeed: 1, get: (x, y, z) => (y <= 64 ? 1 : 0), getMeta: () => 0, solid: (x, y, z) => y <= 64, surface: () => 65, biomeAt: () => ({ id: 1 }) });
const nextLong = (r) => BigInt.asIntN(64, (BigInt(r.next(32)) << 32n) + BigInt(r.next(32)));

for (const run of ref.runs) test(`pigman spawns on difficulty ${run.difficulty}: child flags and chicken jockeys follow the native rolls`, () => {
  const mobs = new EntityWorld(flat(), []);
  mobs.difficulty = run.difficulty;
  const world = (mobs.worldRandom = new JavaRandom(BigInt(run.worldRand))), events = [];
  let children = 0, villagers = 0, chickens = 0;
  for (let i = 0; i < run.spawns; i++) {
    mobs.entities = [];
    const e = mobs.create("pigman", 0.5, 12.1, 0.5);
    mobs.entities.push(e);
    mobs.onSpawnWithEgg(e);
    const child = e.growingAge < 0, villager = !!e.villager, chicken = mobs.entities.some((o) => o.type === "chicken");
    if (child) children++;
    if (villager) villagers++;
    if (chicken) chickens++;
    if (child || villager || chicken) events.push([i, child, villager, chicken, !!e.ridingEntity]);
  }
  assert.deepEqual(events, run.events);
  assert.deepEqual([children, villagers, chickens], [run.children, run.villagers, run.chickens]);
  assert.equal(String(nextLong(world)), run.nextLong);
});

test("a pigman jockey rides its chicken, flagged as a chicken jockey", () => {
  const run = ref.runs[0], mobs = new EntityWorld(flat(), []);
  mobs.worldRandom = new JavaRandom(BigInt(run.worldRand));
  const hit = run.events.find((e) => e[3]);
  for (let i = 0; i <= hit[0]; i++) {
    mobs.entities = [];
    const e = mobs.create("pigman", 0.5, 12.1, 0.5);
    mobs.entities.push(e);
    mobs.onSpawnWithEgg(e);
    if (i === hit[0]) {
      assert.equal(e.ridingEntity.type, "chicken");
      assert.equal(e.ridingEntity.chickenJockey, true);
      assert.ok(e.growingAge < 0);
    }
  }
});
