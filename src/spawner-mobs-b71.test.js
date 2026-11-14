// Batch 71 mobfixes71: spawners for Squid, Bat, LavaSlime and Villager (MobSpawnerBaseLogic with EntityLiving.getCanSpawnHere of each class, bytecode-read in the 1.7.10
// jar: squid ws.by = 45 < posY < 63 and no entity in the box, NO water needed; bat we.by = box minY below 63 and the light roll; magma cube yf.by = not Peaceful and the space
// checks; villager = EntityCreature.by with path weight 0 = the space checks only). Every random draw comes from a seeded JavaRandom; the outcomes asserted do not depend on the
// mobs' own Entity.rand (no Math.random).
import { test } from "node:test";
import assert from "node:assert/strict";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { MobSpawners, SPAWNER_ENTITY_IDS, spawnerType, spawnerDisplayEntity, makeSpawner, readNBT, spawnerJSON, countsAs } from "./mob-spawner.js";
import { PEACEFUL } from "./difficulty.js";

const flat = { numericSeed: 123, getMeta: () => 0, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64, y: 0, z: 64 }) };
const OCT = () => new Date(2026, 5, 15); // not near Halloween: the bat's coin flip is not drawn

function run({ id, y, light = 0, difficulty, seed = 11, ticks = 6000 }) {
  const m = new EntityWorld(flat, [], () => 0.5), spawners = new MobSpawners(), random = new JavaRandom(seed);
  if (difficulty !== undefined) m.difficulty = difficulty;
  m.worldRandom = random;
  spawners.add({ x: 66, y, z: 64, entityId: id });
  const ctx = { ...m.spawnerHooks({ skyLight: () => 0, lightValue: () => light, thunderLightValue: () => light, date: OCT, limit: 1000 }), random, players: [{ x: 64, y, z: 64 }] };
  const real = m.create.bind(m);
  let made = 0; // each new mob gets its own seeded Entity.rand (the bat's coin flip and light roll differ per mob)
  m.create = (...a) => { const e = real(...a); setEntityRandom(e, new JavaRandom(5 + made++)); return e; };
  let n = 0;
  for (let i = 0; i < ticks; i++) n += spawners.tick(ctx).length;
  return { m, n, ctx };
}

test("the four ids are in the spawner table", () => {
  for (const [id, type] of [["Squid", "squid"], ["Bat", "bat"], ["LavaSlime", "magma_cube"], ["Villager", "villager"]]) {
    assert.equal(SPAWNER_ENTITY_IDS[id], type);
    assert.equal(spawnerType(id), type);
  }
});

test("squid: only the height band 45 < y < 63 decides (no water needed natively)", () => {
  assert.ok(run({ id: "Squid", y: 50 }).m.entities.some((e) => e.type === "squid"));
  assert.equal(run({ id: "Squid", y: 30 }).n, 0);
  assert.equal(run({ id: "Squid", y: 70 }).n, 0);
});

test("bat: below y 63 and a light roll (light 4 or more never passes outside Halloween)", () => {
  assert.ok(run({ id: "Bat", y: 20, light: 0 }).m.entities.some((e) => e.type === "bat"));
  assert.equal(run({ id: "Bat", y: 20, light: 5 }).n, 0);
  assert.equal(run({ id: "Bat", y: 70, light: 0 }).n, 0);
});

test("magma cube: spawns on Normal, refused on Peaceful", () => {
  assert.ok(run({ id: "LavaSlime", y: 5 }).m.entities.some((e) => e.type === "magma_cube"));
  assert.equal(run({ id: "LavaSlime", y: 5, difficulty: PEACEFUL }).n, 0);
});

test("villager: EntityLiving's space checks only, so light and ground do not matter", () => {
  for (const light of [0, 15]) assert.ok(run({ id: "Villager", y: 5, light }).m.entities.some((e) => e.type === "villager"), `light ${light}`);
});

test("the spawner caps at six nearby of its own class; a Slime spawner counts magma cubes (EntityMagmaCube extends EntitySlime)", () => {
  const { m } = run({ id: "Villager", y: 5 });
  assert.equal(m.entities.filter((e) => e.type === "villager").length, 6);
  assert.equal(countsAs("slime", "magma_cube"), true);
  assert.equal(countsAs("magma_cube", "slime"), false);
});

test("display entity: type, and the size and profession the renderers read", () => {
  const show = (id) => { const s = makeSpawner(1, 2, 3); s.entityId = id; return spawnerDisplayEntity(s, 1); };
  assert.equal(show("Squid").type, "squid");
  assert.equal(show("Bat").type, "bat");
  assert.equal(show("LavaSlime").type, "magma_cube");
  assert.equal(show("LavaSlime").size, 1);
  assert.equal(show("Slime").size, 1);
  assert.equal(show("Villager").profession, 0);
  assert.equal(show("Pig").size, undefined);
});

test("the saved EntityId round-trips through the spawner NBT reader and writer", () => {
  for (const id of ["Squid", "Bat", "LavaSlime", "Villager"]) {
    const s = makeSpawner(0, 0, 0);
    readNBT(s, { EntityId: id });
    assert.equal(spawnerJSON(s).EntityId, id);
    assert.ok(spawnerType(spawnerJSON(s).EntityId));
  }
});
