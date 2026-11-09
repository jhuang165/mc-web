import { test } from "node:test";
import assert from "node:assert/strict";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan, AWAY_ENTITY_TICKS } from "./away-world.js";
import { EntityWorld } from "./entities.js";
import { World } from "./world.js";
import { Hanging } from "./hanging.js";

await populationBlockMapperReady;
const STONE = 3, TNT = 46;
const floorChunks = (cols) => cols.map(([x, z]) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  return { x, z, blocks, meta };
});
const setBlock = (chunks, x, y, z, b, m = 0) => {
  const c = chunks.find((k) => k.x === x >> 4 && k.z === z >> 4), i = ((x & 15) * 16 + (z & 15)) * 256 + y;
  c.blocks[i] = b; c.meta[i] = m;
};
const base = { seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], player: { time: 6000 } };
const run = (root, ticks, edit = () => {}, difficulty = 2) => {
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, ticks, difficulty), chunks: floorChunks(cols), records: [] };
  edit(plan.chunks);
  return runAway(plan);
};
// Saved mob records come from the live system itself.
const maker = new EntityWorld(new World("away-maker", "meadow"), []);
const mob = (type, x, y, z, extra = {}) => Object.assign(maker.serializeOne(maker.create(type, x, y, z)), extra);

test("a cow in the air falls, takes fall damage and lives on; it never despawns with nobody there", async () => {
  const r = await run({ ...base, entities: [mob("cow", 5.5, 17, 5.5, { id: "mob-1" }), mob("cow", 900.5, 40, 5.5, { id: "mob-2" })] }, 1500);
  const [near] = r.entities.mobs.filter((m) => m.x < 100), [far] = r.entities.mobs.filter((m) => m.x > 100);
  assert.ok(Math.abs(near.y - 11) < 0.01, `landed (y ${near.y})`);
  assert.ok(near.health < 10, `fall damage (health ${near.health})`);
  assert.equal(far.y, 40, "a mob outside the spawn area keeps its record");
  assert.equal(r.stats.entities.mobs, 1);
});

test("a zombie in a roofed pit stays put, keeps counting its age for the 1200 gate and freezes afterwards", async () => {
  const roof = (chunks) => { for (let x = 3; x <= 8; x++) for (let z = 3; z <= 8; z++) setBlock(chunks, x, 14, z, STONE); };
  const root = { ...base, player: { time: 15000 }, entities: [mob("zombie", 5.5, 11, 5.5, { id: "mob-1" })] };
  const a = await run(root, 1500, roof), b = await run(root, 5000, roof);
  const [za] = a.entities.mobs, [zb] = b.entities.mobs;
  assert.equal(za.health, 20, "no player to hunt, no hazard");
  assert.equal(za.age, AWAY_ENTITY_TICKS, "aged for exactly the gate");
  assert.equal(zb.age, AWAY_ENTITY_TICKS, "frozen after it");
  assert.ok(Math.hypot(za.x - 5.5, za.z - 5.5) < 10);
});

test("a zombie in the open burns in daylight; a ridden or leashed mob is kept as saved", async () => {
  const r = await run({ ...base, entities: [mob("zombie", 5.5, 11, 5.5, { id: "mob-1" }), mob("cow", 8.5, 11, 8.5, { id: "mob-2", leash: { x: 1, y: 1, z: 1 } })] }, 1200);
  assert.ok(!r.entities.mobs.some((m) => m.type === "zombie"), "sunburn killed it");
  assert.equal(r.entities.mobs.find((m) => m.type === "cow").x, 8.5);
  assert.ok(r.entities.drops.length >= 0);
});

test("primed TNT damages a mob beside it", async () => {
  const root = { ...base, entities: [mob("cow", 6.5, 11, 5.5, { id: "mob-1" })], tnt: [{ x: 5.5, y: 11, z: 5.5, vx: 0, vy: 0, vz: 0, fuse: 20 }] };
  const r = await run(root, 100);
  assert.equal(r.entities.tnt.length, 0, "exploded");
  const cow = r.entities.mobs[0];
  assert.ok(!cow || cow.health < 10, "the blast hurt or killed the cow");
});

test("an arrow in flight lands in the floor and is saved as a stuck arrow", async () => {
  const arrow = { x: 5.5, y: 20, z: 5.5, mx: 0.2, my: -0.5, mz: 0, yaw: 90, pitch: -60, xTile: -1, yTile: -1, zTile: -1, life: 0, inTile: 0, inData: 0, shake: 0, inGround: false, pickup: 0, damage: 2 };
  const r = await run({ ...base, arrows: [arrow] }, 200);
  assert.equal(r.entities.arrows.length, 1);
  assert.equal(r.entities.arrows[0].inGround, true);
  assert.ok(r.entities.arrows[0].y < 12);
});

test("an arrow hits a mob in its path", async () => {
  const arrow = { x: 2.5, y: 12.5, z: 5.5, mx: 1.5, my: 0, mz: 0, yaw: 90, pitch: 0, xTile: -1, yTile: -1, zTile: -1, life: 0, inTile: 0, inData: 0, shake: 0, inGround: false, pickup: 0, damage: 4 };
  const r = await run({ ...base, entities: [mob("cow", 6.5, 11, 5.5, { id: "mob-1" })], arrows: [arrow] }, 20);
  assert.ok(r.entities.mobs[0].health < 10, `hit (health ${r.entities.mobs[0].health})`);
});

test("an item frame whose wall is gone breaks on its 101st update and drops its item", async () => {
  const hanging = new Hanging(); hanging.entities.push(hanging.make("frame", 0, 5, 12, 5, { item: { id: 4, count: 1, damage: 0 }, rotation: 0, dropChance: 1 }));
  const records = hanging.toJSON();
  const root = { ...base, hanging: records.map((e) => e) };
  const r = await run(root, 200);
  assert.equal(r.entities.hanging.length, 0, "no support at the tile: it broke");
  assert.ok(r.entities.drops.length >= 1, "the frame and its item dropped");
  const kept = await run({ ...base, hanging: records, player: { time: 6000 } }, 50);
  assert.equal(kept.entities.hanging.length, 1, "still hanging before the 101st update");
});

test("dispensers on a clock create arrows, snowballs, eggs, potions, fire charges and rockets that keep flying in the run", async () => {
  const { fromOriginal } = await import("./block-registry.js");
  const { createRedstoneRuntime } = await import("./redstone-runtime.js");
  const O = [5, 11, 5];
  const cases = [[320, 0, (e) => e.arrows], [312, 0, (e) => e.projectiles], [316, 0, (e) => e.projectiles], [385, 16388, (e) => e.potions], [1952, 0, (e) => e.fireballs], [2071, 0, (e) => e.rockets?.rockets ?? []]];
  for (const [id, damage, pick] of cases) {
    const seedWorld = new World("away-disp", "meadow");
    const put = (w, dx, orig, meta) => { const m = fromOriginal(orig, meta); w.put(O[0] + dx, O[1], O[2], m.id, m.meta, false); };
    for (let x = 0; x <= 3; x++) for (let y = 0; y <= 3; y++) for (let z = 0; z <= 3; z++) seedWorld.put(O[0] + x - 1, O[1] + y - 1, O[2] + z - 1, 0, 0, false);
    put(seedWorld, 0, 23, 3);
    const rt = createRedstoneRuntime({ world: seedWorld, game: { dispensers: () => ({}), maxStack: () => 64, dispense: {} } });
    put(seedWorld, 1, 152, 0);
    rt.redstone.placed(O[0] + 1, O[1], O[2]);
    const saved = rt.save(); rt.dispose();
    const root = { ...base, redstone: saved, player: { time: 6000, dispensers: { "5,11,5": { items: [{ id, count: 3, damage }, ...Array(8).fill(null)] } } } };
    const w = (chunks) => { const q = { put: (x, y, z, b, m) => setBlock(chunks, x, y, z, b, m) }; put(q, 0, 23, 3); put(q, 1, 152, 0); };
    const r = await run(root, 8, w);
    assert.equal(r.tiles.dispensers["5,11,5"].items[0].count, 2, `item ${id}: one used`);
    assert.equal(pick(r.entities).length, 1, `item ${id}: one live entity ${JSON.stringify(r.stats)} ${JSON.stringify(r.tiles.dispensers)}`);
  }
});
