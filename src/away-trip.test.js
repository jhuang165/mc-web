import { test } from "node:test";
import assert from "node:assert/strict";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";
import { DimensionLive, viewRecord } from "./dimension-live.js";
import { GAME_IDS } from "./dimensions.js";
import { EntityWorld } from "./entities.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs } from "./experience.js";

// Batch 41 awaytrip: follow the mobs, items and orbs that left the Overworld through a portal during an away run to the Nether's saved lists,
// then load them the way main.js does when the player goes there (EntityWorld, ItemEntities.load, ExperienceOrbs).
await populationBlockMapperReady;
const STONE = 3, PORTAL = 164; // 164: the internal id of original block 90
const floorChunks = (cols) => cols.map(([x, z]) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  return { x, z, blocks, meta };
});
const setBlock = (chunks, x, y, z, b) => { const c = chunks.find((k) => k.x === x >> 4 && k.z === z >> 4); c.blocks[((x & 15) * 16 + (z & 15)) * 256 + y] = b; };
const flat = { streaming: true, inside: () => true, height: 128, dimension: -1, numericSeed: 1, getMeta: () => 0, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 8.5, y: 0, z: 8.5 }) };
const pig = (id, x) => ({ id, type: "pig", x, y: 11, z: 5.5, vx: 0, vy: 0, vz: 0, yaw: 0, health: 10, onGround: true });

async function trip() {
  const root = { id: "w1", seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], chunked: true, name: "W", position: { x: 1, y: 70, z: 2, yaw: 0, pitch: 0 }, edits: [], player: { health: 20, chests: {} },
    entities: [pig("mob-1", 3.5), pig("mob-2", 20.5)], drops: [{ stack: { id: 4, count: 2, damage: 0 }, x: 3.5, y: 11, z: 5.5, mx: 0, my: 0, mz: 0, age: 0, delay: 0 }],
    xpOrbs: [{ x: 3.5, y: 11.3, z: 5.5, value: 3, age: 0, vx: 0, vy: 0, vz: 0, onGround: true }] };
  const cols = stateColumns(root), chunks = floorChunks(cols);
  for (let y = 11; y <= 13; y++) { setBlock(chunks, 3, y, 5, PORTAL); setBlock(chunks, 4, y, 5, PORTAL); }
  const result = await runAway({ ...awayPlan(root, cols, 150), chunks, records: [] });
  const live = new DimensionLive({ active: () => root, worlds: () => [root], dirty() {}, save: async () => {}, sound() {}, player: () => ({ x: 3.5, y: 11, z: 5.5, yaw: 0 }), openWorld: async () => {}, ticks: () => 150 });
  live.readEdits = async () => [];
  live.away = { rootId: root.id, ticks0: 0, tripMs: 0, columns: [], chunks: [], records: [], trace: { samples: [], states: [] }, ready: Promise.resolve(true),
    worker: { postMessage() { setTimeout(() => this.onmessage({ data: { type: "result", result } }), 0); }, terminate() {} } };
  assert.ok(await live.finishAway(root));
  return { root, live, result };
}

test("batch 41: away travellers reach the Nether lists once each, with unique ids, at the portal the Teleporter built", async () => {
  const { root, live, result } = await trip();
  assert.deepEqual(result.entities.portalTravel.map((t) => t.kind).sort(), ["item", "mob", "orb"]);
  assert.deepEqual(root.entities.map((m) => m.id), ["mob-2"], "the pig that stayed is the only Overworld mob");
  assert.equal(root.drops.length, 0); assert.equal(root.xpOrbs.length, 0);
  // The Nether already holds saved mobs whose ids have a gap (kills): the arrival needs an id above all of them.
  const view = viewRecord(root, -1);
  view.entities = [{ id: "mob-3", type: "pig", x: 30.5, y: 40, z: 30.5, health: 10 }, { id: "mob-5", type: "pig", x: 31.5, y: 40, z: 31.5, health: 10 }];
  const placed = [];
  live.deliverArrivals({ set: (x, y, z, id) => { if (id === GAME_IDS.portal) placed.push([x, y, z]); } }, view);
  assert.ok(placed.length > 0, "the Teleporter built a portal for the arrivals");
  const near = (e) => placed.some((p) => Math.abs(p[0] + 0.5 - e.x) < 6 && Math.abs(p[2] + 0.5 - e.z) < 6 && Math.abs(p[1] - e.y) < 8);
  const mobs = new EntityWorld(flat, view.entities);
  const ids = mobs.entities.map((m) => m.id);
  assert.equal(mobs.entities.length, 3); assert.equal(new Set(ids).size, 3, `ids ${ids}`);
  const arrived = mobs.entities.find((m) => !["mob-3", "mob-5"].includes(m.id));
  assert.ok(Number(arrived.id.slice(4)) > 5, `new id ${arrived.id} is above every saved id`);
  assert.ok(near(arrived), `pig at ${arrived.x},${arrived.y},${arrived.z} is next to the Nether portal ${JSON.stringify(placed[0])}`);
  assert.equal(arrived.portalCooldown, 300);
  const items = new ItemEntities(Math.random); items.load(view.drops, (s) => s);
  assert.equal(items.items.length, 1); assert.ok(near(items.items[0]), "item arrives at the portal");
  const orbs = new ExperienceOrbs(view.xpOrbs);
  assert.equal(orbs.orbs.length, 1); assert.ok(near(orbs.orbs[0]), "orb arrives at the portal");
  assert.equal(new Set(orbs.orbs.map((o) => o.id)).size, orbs.orbs.length);
});
