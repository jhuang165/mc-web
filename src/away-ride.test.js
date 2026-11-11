import { test } from "node:test";
import assert from "node:assert/strict";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";
import { EntityWorld } from "./entities.js";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { Experience } from "./experience.js";
import { placeAwayDeath } from "./away-death.js";
import { replayPlayerCommands } from "./away-commands.js";
import { Minecarts } from "./minecarts.js";

await populationBlockMapperReady;
const STONE = 3, COMMAND_BLOCK = 139;
const floorChunks = (cols) => cols.map(([x, z]) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  return { x, z, blocks, meta };
});
const setBlock = (chunks, x, y, z, b) => { const c = chunks.find((k) => k.x === x >> 4 && k.z === z >> 4); c.blocks[((x & 15) * 16 + (z & 15)) * 256 + y] = b; };
const base = { seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], player: { time: 6000 } };
const run = (root, ticks, trace) => {
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, ticks, 2), chunks: floorChunks(cols), records: [], trace };
  for (const t of root.commandBlocks ?? []) setBlock(plan.chunks, t.x, t.y, t.z, COMMAND_BLOCK);
  return runAway(plan);
};
const maker = new EntityWorld(new World("away-maker", "meadow"), []);
const mob = (type, x, y, z, extra = {}) => Object.assign(maker.serializeOne(maker.create(type, x, y, z)), extra);

test("a mob riding another mob runs with it: both fall, the rider keeps its seat and the saved link", async () => {
  const root = { ...base, entities: [mob("pig", 5.5, 20, 5.5, { id: "mob-1" }), mob("skeleton", 5.5, 21, 5.5, { id: "mob-2", riding: "mob-1" })] };
  const r = await run(root, 200);
  const pig = r.entities.mobs.find((m) => m.type === "pig"), rider = r.entities.mobs.find((m) => m.type === "skeleton");
  assert.ok(pig.y < 12, `pig landed (y ${pig.y})`);
  assert.equal(rider.riding, "mob-1", "still riding");
  assert.ok(rider.y > pig.y + 0.1, `rider sits above its mount (${rider.y} vs ${pig.y})`);
  assert.equal(r.stats.entities.mobs, 2);
});

test("a pair whose mount is outside the loaded area stays exactly as saved; one inside it moves", async () => {
  const far = { ...base, entities: [mob("pig", 900.5, 20, 5.5, { id: "mob-1" }), mob("skeleton", 900.5, 21, 5.5, { id: "mob-2", riding: "mob-1" })] };
  const r = await run({ ...far, entities: [...far.entities, mob("cow", 5.5, 20, 5.5, { id: "mob-3" })] }, 200);
  assert.deepEqual(r.entities.mobs.filter((m) => m.x > 100).map((m) => [m.id, m.y, m.riding]), [["mob-1", 20, undefined], ["mob-2", 21, "mob-1"]]);
});

test("a mob on a lead to the absent player keeps the lead and runs", async () => {
  const r = await run({ ...base, entities: [mob("cow", 5.5, 20, 5.5, { id: "mob-1", leash: { holder: "player" } })] }, 200);
  const cow = r.entities.mobs[0];
  assert.ok(cow.y < 12, "fell");
  assert.deepEqual(cow.leash, { holder: "player" }, "the lead stays on and nothing pulls (the holder is in another world)");
});

test("a mob riding a minecart travels the cart's tick: the cart moves the rider with it", async () => {
  const carts = new Minecarts(); carts.spawnEmpty({ x: 5.5, y: 20, z: 5.5 });
  const saved = carts.toJSON(), id = saved.carts[0].id;
  const root = { ...base, minecarts: saved, entities: [mob("pig", 5.5, 20, 5.5, { id: "mob-1", riding: `cart-${id}` })] };
  const r = await run(root, 100);
  const cart = r.entities.minecarts.carts[0], pig = r.entities.mobs[0];
  assert.ok(cart.y < 20 || cart.posY < 20, "the cart fell");
  assert.equal(pig.riding, `cart-${cart.id}`, "still seated");
});

test("shadow kill: the death is recorded at the firing with the traced place, inventory and cause; drops land in that dimension and the live player dies on return", async () => {
  const sv = new Survival({}, "survival"); sv.inventory.add({ id: 303, count: 4, damage: 0 });
  const xp = new Experience({}); xp.add(200);
  const snap = { state: JSON.parse(JSON.stringify(sv.serialize())), experience: xp.serialize(), mode: 0, level: 0 };
  const trace = { samples: [[0, -1, 12.5, 40, -7.5, [20, 20, 5, 0, []]]], states: [[0, snap]] };
  const root = { ...base, redstone: { version: 1, clock: 0, time: 0, pending: [[3, 11, 3, 137, 30, 0, 1]], events: [] },
    commandBlocks: [{ x: 3, y: 11, z: 3, command: "effect @p 7 1 5", successCount: 0, customName: "@", trackOutput: true, lastOutput: null }] };
  const r = await run(root, 100, trace);
  const d = r.playerDeath;
  assert.ok(d, "a death was recorded");
  assert.ok(d.tick >= 29 && d.tick <= 31, `tick ${d.tick}`);
  assert.equal(d.dimension, -1); assert.equal(d.x, 12.5); assert.equal(d.z, -7.5);
  assert.equal(d.cause, "magic");
  assert.equal(d.stacks.reduce((n, s) => n + s.count, 0), 4);
  const rec = { ...base }, placed = placeAwayDeath(rec, d);
  assert.equal(placed.dimension, -1);
  assert.equal(rec.portalArrivals[-1].drops.reduce((n, o) => n + o.stack.count, 0), 4);
  assert.ok(Math.abs(rec.portalArrivals[-1].drops[0].x - 12.5) < 1e-9);
  assert.equal(placed.points, 49 > 0 ? 7 * new Experience(d.experience).level : 0);
  assert.ok(rec.portalArrivals[-1].xpOrbs.length > 0);
  // keepInventory: nothing drops
  const kept = placeAwayDeath({ ...base, gameRules: { keepInventory: "true" } }, d);
  assert.equal(kept.drops, 0); assert.equal(kept.orbs, 0);
  // The replay does not re-run the inventory/xp/effect entries once the death took over.
  const out = replayPlayerCommands(r.playerCommands, { host: { print() {} }, records: r.commandBlocks, death: true });
  assert.equal(out.applied, 1); assert.equal(out.byDelta, 1);
});

test("the wall stamp follows the measured trip: tick n is wall + n * wallStep and the last tick lands at the return", () => {
  const root = { ...base };
  const p = awayPlan(root, [], 100, 2, 100000, 90000, 100);
  assert.equal(p.wall, 90000); assert.equal(p.wallStep, 100, "10 s of real time over 100 ticks");
  const q = awayPlan(root, [], 100, 2, 100000);
  assert.equal(q.wall, 100000 - 5000); assert.equal(q.wallStep, 50);
});
