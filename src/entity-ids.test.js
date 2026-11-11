import { test } from "node:test";
import assert from "node:assert/strict";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";
import { EntityIds, bindIds } from "./entity-ids.js";
import { EntityWorld } from "./entities.js";
import { Minecarts } from "./minecarts.js";
import { Boats } from "./boats.js";
import { Hanging } from "./hanging.js";
import { ExperienceOrbs } from "./experience.js";

// Batch 42 globalids: one Entity.nextEntityID (executed in tools/probes/EntityIdProbe.java, public/research/entity-ids-reference.json).
await populationBlockMapperReady;
const flat = { streaming: true, inside: () => true, height: 128, dimension: -1, numericSeed: 1, getMeta: () => 0, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 8.5, y: 0, z: 8.5 }), isLoaded: () => true };
const pig = (id, x = 3.5) => ({ ...(id ? { id } : {}), type: "pig", x, y: 11, z: 5.5, vx: 0, vy: 0, vz: 0, yaw: 0, health: 10, onGround: true });

test("EntityIds: take counts up, reserve keeps the counter above an existing id, bindIds shares it", () => {
  const ids = new EntityIds();
  assert.deepEqual([ids.take(), ids.take()], [1, 2]);
  ids.reserve("mob-9"); ids.reserve(4); ids.reserve("zombie"); ids.reserve(-3);
  assert.equal(ids.next, 10);
  const a = bindIds({}, ids), b = bindIds({}, ids);
  a.nextId++; assert.equal(b.nextId, 11);
  b.nextId = 20; assert.equal(ids.next, 20);
  ids.reserveRecord({ entities: [{ id: "mob-30" }], minecarts: { carts: [{ id: 41 }] }, boats: [{ id: 35 }], hanging: [{ id: 7 }, null] });
  assert.equal(ids.next, 42);
});

test("mobs, carts, boats, hanging entities and orbs of two worlds draw from one counter and never repeat", () => {
  const ids = new EntityIds();
  const overworld = new EntityWorld({ ...flat, dimension: 0 }, [], () => 0.5, ids);
  const nether = new EntityWorld(flat, [], () => 0.5, ids);
  const carts = new Minecarts({ ids }), boats = new Boats({ ids }), hanging = new Hanging({ ids }), orbs = new ExperienceOrbs([], Math.random, ids);
  const seen = [];
  seen.push(overworld.create("pig", 1, 11, 1).id, nether.create("pig", 1, 11, 1).id, overworld.create("cow", 2, 11, 2).id);
  seen.push("cart-" + carts.spawnChest({ x: 1, y: 11, z: 1, items: [] }).id);
  seen.push(boats.spawnBoat({ x: 2, y: 11, z: 2 }).id, hanging.make("painting", 0, 1, 11, 1).id);
  orbs.spawn(3, { x: 1, y: 11, z: 1 }); seen.push(orbs.orbs[0].id);
  const numbers = seen.map((s) => Number(String(s).replace(/^\D+/, "")));
  assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6, 7], `consecutive across worlds and kinds: ${seen}`);
});

test("a world loaded later keeps its saved ids and the counter starts above every one, in any list", () => {
  const ids = new EntityIds();
  ids.reserveRecord({ entities: [], boats: [{ id: 50 }] });
  const saved = [pig("mob-3"), pig("mob-9", 5.5), pig(null, 6.5), pig("mob-3", 7.5)];
  const w = new EntityWorld(flat, saved, () => 0.5, ids);
  const got = w.entities.map((m) => m.id);
  assert.equal(got[0], "mob-3"); assert.equal(got[1], "mob-9");
  assert.equal(new Set(got).size, 4, `unique: ${got}`);
  assert.ok(got.slice(2).every((id) => Number(id.slice(4)) > 9), `arrival and duplicate renumbered above the saved ids: ${got}`);
  const next = w.create("pig", 1, 11, 1).id;
  assert.ok(!got.includes(next) && Number(next.slice(4)) > Math.max(...got.map((id) => Number(id.slice(4)))));
});

test("a second world on the same counter hands an arrival an id the first world's mobs do not hold", () => {
  const ids = new EntityIds();
  const a = new EntityWorld(flat, [pig(null), pig(null, 4.5)], () => 0.5, ids);
  const b = new EntityWorld(flat, [pig(null, 5.5)], () => 0.5, ids);
  const all = [...a.entities, ...b.entities].map((m) => m.id);
  assert.equal(new Set(all).size, 3, all);
});

test("a world built without a shared counter counts from 1 as before", () => {
  const w = new EntityWorld(flat, [], () => 0.5);
  assert.equal(w.create("pig", 1, 11, 1).id, "mob-1");
  assert.equal(new Minecarts().spawnChest({ x: 1, y: 11, z: 1, items: [] }).id, 1);
});

test("the away run counts from the page's counter (plan.idBase): a boat saved without an id gets one above it", async () => {
  const root = { id: "w1", seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], chunked: true, name: "W", position: { x: 1, y: 70, z: 2, yaw: 0, pitch: 0 }, edits: [], player: { health: 20, chests: {} },
    entities: [pig("mob-7")], boats: [{ x: 6.5, y: 11, z: 6.5, motion: [0, 0, 0], rotation: [0, 0] }] };
  const cols = stateColumns(root), chunks = cols.map(([x, z]) => ({ x, z, blocks: new Uint8Array(65536), meta: new Uint8Array(65536) }));
  for (const c of chunks) for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) c.blocks[(lx * 16 + lz) * 256 + y] = 3;
  const result = await runAway({ ...awayPlan(root, cols, 5), chunks, records: [], idBase: 500 });
  const boats = result.entities?.boats ?? result.boats ?? [];
  assert.ok(boats.length >= 1, JSON.stringify(Object.keys(result.entities ?? result)));
  assert.ok(boats[0].id >= 500, `boat id ${boats[0].id}`);
  assert.ok(result.entities.mobs.every((m) => m.id === "mob-7"), "the saved mob keeps its id");
});
