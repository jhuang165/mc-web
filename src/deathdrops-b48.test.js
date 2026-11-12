// Batch 48: a mob's death drops and experience join the loaded-entity list in the dying entity's own turn (EntityWorld.flushLoot), live walk and away run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";
import { EntityWorld } from "./entities.js";
import { World } from "./world.js";

await populationBlockMapperReady;
const STONE = 3;
const floorChunks = (cols) => cols.map(([x, z]) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  return { x, z, blocks, meta };
});
const base = { seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], player: { time: 6000 } };
const run = (root, ticks) => { const cols = stateColumns(root), plan = { ...awayPlan(root, cols, ticks, 2), chunks: floorChunks(cols), records: [] }; return runAway(plan); };
const maker = new EntityWorld(new World("b48-maker", "meadow"), []);
const mob = (type, x, y, z, extra = {}) => Object.assign(maker.serializeOne(maker.create(type, x, y, z)), extra);

test("batch 48: the away run's falling cow dies in its own turn and its drop is first ticked in that same pass", async () => {
  const at = async (n) => (await run({ ...base, entities: [mob("cow", 5.5, 25, 5.5, { id: "mob-1", health: 1 })] }, n)).entities;
  let death = null;
  for (let n = 1; n <= 60 && death === null; n++) { const e = await at(n); if (e.drops.length) death = n; }
  assert.ok(death, "the cow burned to death");
  const e = await at(death + 5);
  assert.ok(e.drops.length > 0);
  // spawned in the cow's turn at tick `death - 1` and ticked in that pass: after death + 5 passes the item has aged death-pass + 5 ticks; one pass later (the old drain) would be one tick less
  const ages = (await at(death)).drops.map((d) => d.age);
  assert.ok(ages.every((a) => a === 1), `a drop spawned in the dying mob's own turn ticks once in it (ages ${ages})`);
});

test("batch 48: flushLoot spawns queued drops and orbs between two entries, leaves the rest, and skips bottle orbs", () => {
  const w = new EntityWorld(new World("b48-flush", "meadow"), []);
  const got = [];
  w.spawnLoot = (evs) => got.push(...evs);
  w.events.push({ sound: "mob.cow.hurt", position: { x: 0, y: 0, z: 0 } }, { drop: 334, count: 1, position: { x: 1, y: 2, z: 3 } }, { xp: 3, position: { x: 1, y: 2, z: 3 } }, { xp: 7, bottle: true, position: { x: 0, y: 0, z: 0 } }, { sound: "x" });
  w.flushLoot();
  assert.deepEqual(got.map((e) => e.drop ?? e.xp), [334, 3]);
  assert.deepEqual(w.events.map((e) => e.sound ?? "bottle"), ["mob.cow.hurt", "bottle", "x"]);
  w.events.push({ drop: 335, count: 1, position: { x: 0, y: 0, z: 0 } });
  w.flushLoot();
  assert.equal(got.length, 3, "a later call scans only what was queued since");
  w.spawnLoot = null;
  w.events.push({ drop: 1, count: 1, position: { x: 0, y: 0, z: 0 } });
  w.flushLoot();
  assert.ok(w.events.some((e) => e.drop === 1), "without a host hook the event waits for drain()");
});

// Executed: tools/probes/EntityListProbe.java death-fall-cow-* (the real EntityCow with 1 health falls and dies on landing).
import { entityListReference, replayEntityList, entityListDivergence } from "./entity-list-replay.js";
const rec = (n) => entityListReference.find((r) => r.name === n);
const DEATHS = ["death-fall-cow-hit", "death-fall-cow-nohit", "death-fall-cow-item-after", "death-fall-cow-item-before"];

test("batch 48 (executed record): the dying cow's loot and orbs join in its own turn, as the real 1.7.10 walk does", () => {
  for (const n of DEATHS) assert.equal(entityListDivergence(rec(n), replayEntityList(rec(n))), null, n);
  // the record itself: the items are updated in the pass they spawn (age 1, pickup delay 9 at the landing tick); the orbs (recentlyHit 100 only) appear at deathTime 20
  const hit = rec("death-fall-cow-hit"), nohit = rec("death-fall-cow-nohit"), spawned = (r, t) => r.rows[t][3].length;
  assert.equal(hit.rows[13][3].length, 2);
  assert.equal(hit.rows[13][3][0][8], 1);
  assert.equal(hit.rows[13][3][0][9], 9);
  assert.equal(spawned(hit, 33), 4, "two item stacks and two orbs once deathTime reaches 20");
  assert.equal(spawned(nohit, 39), 2, "nobody hit it: no experience");
});

test("batch 48: the record needs the in-turn spawn; with the loot drained after the walk the items are a tick late", () => {
  const c = rec("death-fall-cow-hit");
  assert.notEqual(entityListDivergence(c, replayEntityList(c, null, "lootInTurn")), null);
});

// Batch 48: live carts, boats and hanging entities report their join (main.js wires the hooks the classes already call).
import { readFileSync } from "node:fs";
import { Minecarts } from "./minecarts.js";
import { Boats } from "./boats.js";
import { Hanging } from "./hanging.js";
import { entityWalkers } from "./entity-simulation.js";
import { plain } from "./legacy-ai-replay.js";

test("batch 48: a cart, boat and painting placed after a mob take a stamp after it and walk after it", () => {
  const ew = new EntityWorld(plain([]), []);
  const minecarts = new Minecarts(), boats = new Boats(), hanging = new Hanging({ random: () => new (class { nextInt() { return 0; } })() });
  ew.walks = entityWalkers(() => ({ state: { minecarts, boats, hanging, world: ew.world, items: { items: [] }, arrows: { list: [] }, projectiles: { balls: [] }, primed: [] }, hooks: {} }));
  minecarts.joined = (e) => ew.joined(e, "cart"); boats.joined = (e) => ew.joined(e, "boat");
  const cow = ew.create("cow", 0.5, 0, 0.5); ew.entities.push(cow);
  const cart = minecarts.spawnEmpty({ x: 5.5, y: 1, z: 5.5 }), boat = boats.spawnBoat({ x: 8.5, y: 1, z: 5.5 });
  const seq = (e) => ew.orderSeqs.get(e);
  assert.ok(seq(cart) > 0 && seq(boat) > seq(cart), "stamped in placement order");
  const order = ew.withBalls([cow]);
  assert.deepEqual(order.map((e) => (e === cow ? "cow" : e === cart ? "cart" : e === boat ? "boat" : "?")), ["cow", "cart", "boat"]);
});

test("batch 48: main.js hands the live carts, boats and hanging entities the join hook", () => {
  const src = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.match(src, /boats\.joined = joinedAs\("boat"\)/);
  assert.match(src, /minecarts\.joined = joinedAs\("cart"\)/);
  assert.match(src, /hanging\.joined = joinedAs\("hanging"\)/);
});
