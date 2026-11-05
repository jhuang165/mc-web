import { test } from "node:test";
import assert from "node:assert/strict";
import { viewRecord, storedRecord, rulesOf, DIM_KEYS, TILE_KEYS, gameYaw, mcYaw } from "./dimension-live.js";
import { DimensionWorld, TerrainPeek } from "./dimension-world.js";
import { Teleporter, GAME_IDS } from "./dimensions.js";
import { JavaRandom } from "./java-random.js";

const root = () => ({ id: "w1", seed: "42", biome: "javaStreamed", chunked: true, name: "W", position: { x: 1, y: 70, z: 2, yaw: 0, pitch: 0 }, edits: [], entities: [{ type: "pig" }], fluidTicks: [1], player: { health: 20, chests: { "1,2,3": { items: [] } }, slots: [] }, bed: { spawn: [0, 64, 0] } });

test("a view leaves the root alone and holds only its own dimension state", () => {
  const r = root(), before = JSON.stringify(r), v = viewRecord(r, -1);
  assert.equal(JSON.stringify(r), before);
  assert.equal(v.id, "w1~-1"); assert.equal(v.rootId, "w1"); assert.equal(v.entities, undefined); assert.deepEqual(v.player.chests, {}); assert.equal(v.player.health, 20);
});
test("records round-trip: Overworld fields stay on the root, the view lands in dimensions[-1]", () => {
  const r = root(), v = viewRecord(r, -1);
  v.entities = [{ type: "ghast" }]; v.player.chests = { "9,9,9": { items: [] } }; v.player.health = 7; v.position = { x: 5, y: 60, z: 5 };
  const s = storedRecord(v, r);
  assert.equal(s.id, "w1"); assert.equal(s.dimension, -1); assert.deepEqual(s.entities, [{ type: "pig" }]); assert.deepEqual(Object.keys(s.player.chests), ["1,2,3"]);
  assert.equal(s.player.health, 7); assert.equal(s.position.x, 5);
  assert.deepEqual(s.dimensions[-1].state.entities, [{ type: "ghast" }]); assert.deepEqual(Object.keys(s.dimensions[-1].tiles.chests), ["9,9,9"]);
  const again = viewRecord(s, -1);
  assert.deepEqual(again.entities, [{ type: "ghast" }]); assert.deepEqual(Object.keys(again.player.chests), ["9,9,9"]);
  assert.equal(viewRecord(s, 1).entities, undefined);
});
test("rule flags per dimension", () => {
  const n = rulesOf({ dimension: -1 }), e = rulesOf({ dimension: 1 }), o = rulesOf({});
  assert.deepEqual([n.waterEvaporates, n.bedExplodes, n.compassSpins], [true, true, true]);
  assert.deepEqual([e.waterEvaporates, e.bedExplodes], [false, true]);
  assert.deepEqual([o.waterEvaporates, o.bedExplodes, o.compassSpins], [false, false, false]);
});
test("yaw conversion", () => { assert.ok(Math.abs(mcYaw(gameYaw(90)) - 90) < 1e-9); assert.ok(Math.abs(gameYaw(0) - Math.PI) < 1e-9); });
test("DIM_KEYS and TILE_KEYS do not overlap", () => { assert.deepEqual(DIM_KEYS.filter((k) => TILE_KEYS.includes(k)), []); });

test("DimensionWorld streams a Nether window with bedrock, netherrack and no sky", () => {
  const w = new DimensionWorld("12345", -1);
  assert.ok(w.streamAround(0, 0));
  assert.equal(w.chunks.size, 64); assert.equal(w.hasNoSky, true); assert.equal(w.dimension, -1); assert.equal(w.biomeAt(0, 0).name, "Hell");
  assert.equal(w.get(3, 0, 3), 11); assert.equal(w.get(3, 127, 3), 11);
  let rock = 0; for (let y = 1; y < 127; y++) if (w.get(3, y, 3) === 150) rock++;
  assert.ok(rock > 5);
});
test("DimensionWorld builds an End window with end stone and the 100,0 entrance", () => {
  const w = new DimensionWorld("12345", 1);
  w.streamAround(100, 0);
  assert.equal(w.isEnd, true); assert.equal(w.spawn().x, 100.5);
  let stone = 0; for (const c of w.chunks.values()) for (const b of c.blocks) if (b === 152) stone++;
  assert.ok(stone > 0);
});
test("the Teleporter builds a portal on a Nether terrain peek and records the writes", () => {
  const w = new DimensionWorld("777", -1), peek = new TerrainPeek(w);
  peek.dimension = -1; peek.actualHeight = 128; peek.seed = 777n;
  const e = { x: 8, y: 70, z: 8, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, teleportDirection: 0 };
  new Teleporter(peek, { isSolid: (id) => id !== 0 && id !== 164, random: new JavaRandom(777) }).placeInPortal(e, 8, 70, 8, 0);
  assert.ok(peek.writes.some((x) => x[3] === GAME_IDS.portal));
  assert.notEqual(peek.get(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z)), 11);
});

test("TerrainPeek reads the same cells as the streamed window (Overworld terrain too)", async () => {
  const { World } = await import("./world.js");
  for (const w of [new DimensionWorld("99", 1), new World("99", "javaStreamed", 12, "default")]) {
    w.streamAround(40, -25);
    const peek = new TerrainPeek(w);
    for (const [x, z] of [[40, -25], [33, -30], [47, -18], [20, -40]]) for (let y = 0; y < 120; y += 7) assert.equal(peek.get(x, y, z), w.get(x, y, z), `${x},${y},${z}`);
  }
});

const arrival = async (record, from, at) => {
  const { DimensionLive } = await import("./dimension-live.js");
  const live = new DimensionLive({ sound() {} });
  live.readEdits = async () => [];
  const spawned = []; live.onDragonSpawn = (p) => spawned.push(p);
  const { World } = await import("./world.js");
  const w = record.dimension ? new DimensionWorld(record.seed, record.dimension) : new World(record.seed, "javaStreamed", 12, "default");
  record.transit = { from, ...at, yaw: 0, dir: 2 };
  await live.arrive(w, record);
  const p = record.position;
  if (p) w.streamAround(p.x, p.z);
  live.applyWrites(w, record);
  return { w, p, spawned, live, record };
};
const near = (w, p, id) => { let n = 0; for (let x = -3; x <= 3; x++) for (let y = -3; y <= 4; y++) for (let z = -3; z <= 3; z++) if (w.get(Math.floor(p.x) + x, Math.floor(p.y) + y, Math.floor(p.z) + z) === id) n++; return n; };

test("Overworld -> Nether: 1/8 coordinates and a built portal around the player", async () => {
  const { w, p } = await arrival({ id: "w~-1", rootId: "w", seed: "5", dimension: -1 }, 0, { x: 800, y: 70, z: -400 });
  assert.ok(Math.abs(p.x - 100) < 40 && Math.abs(p.z + 50) < 40, `${p.x},${p.z}`);
  assert.ok(near(w, p, 164) >= 2, "portal blocks near the arrival");
  // placeInExistingPortal puts the player inside the portal (the 10-tick cooldown stops an immediate bounce back).
  assert.ok([0, 164].includes(w.get(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))));
  assert.ok(w.solid(Math.floor(p.x), Math.floor(p.y) - 1, Math.floor(p.z)) || near(w, p, 22) > 0);
});
test("Nether -> Overworld: 8x coordinates and a portal there", async () => {
  const { w, p } = await arrival({ id: "w", seed: "5" }, -1, { x: 50, y: 60, z: 20 });
  assert.ok(Math.abs(p.x - 400) < 60 && Math.abs(p.z - 160) < 60, `${p.x},${p.z}`);
  assert.ok(near(w, p, 164) >= 2);
});
test("Overworld -> End: obsidian platform at 100,0, dragon hook once", async () => {
  const r = { id: "w~1", rootId: "w", seed: "5", dimension: 1 };
  const { w, p, spawned } = await arrival(r, 0, { x: 3, y: 70, z: 3 });
  assert.deepEqual([p.x, p.z], [100, 0]);
  assert.equal(w.get(100, 48, 0), 22); assert.equal(w.get(100, 49, 0), 0); assert.equal(w.get(102, 48, -2), 22);
  assert.equal(spawned.length, 1); assert.equal(r.dragonSpawned, true);
});
test("End exit without a bed leaves the position to the world spawn", async () => {
  const { p } = await arrival({ id: "w", seed: "5" }, 1, { x: 100, y: 49, z: 0 });
  assert.equal(p, null);
});
