import test from "node:test";
import assert from "node:assert/strict";
import { entityListDivergence } from "./entity-list-replay.js";
import { awayOrderReference, replayAwayOrder } from "./away-order-replay.js";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";
import { Dispensing, ITEM } from "./dispense.js";
import { JavaRandom } from "./java-random.js";

await populationBlockMapperReady;

// Batch 50: the away run walks one entity list in join order, as World.updateEntities does (public/research/away-order-reference.json, executed AwayOrderProbe).
for (const c of awayOrderReference) {
  test(`away run list order ${c.name}`, () => {
    assert.equal(entityListDivergence(c, replayAwayOrder(c)), null);
  });
}

// Dispenser behaviours kz (fire charge) and ku (exp bottle), bytecode-read in batch 50.
test("a fire charge dispense draws its acceleration from world.rand, not an entity Random", () => {
  const w = { rand: new JavaRandom(42) }, mirror = new JavaRandom(42), balls = [];
  const engine = new Dispensing({ fireball: (b) => balls.push(b), rng: () => assert.fail("no entity Random"), entityRandom: null });
  engine.entityRandom = () => assert.fail("no entity Random");
  const stack = { id: ITEM.FIRE_CHARGE, count: 2, damage: 0 };
  engine.behaviourFor(stack).stack.call(engine, w, 4, 5, 6, 3, stack);
  const ax = mirror.nextGaussian() * 0.05, ay = mirror.nextGaussian() * 0.05, az = mirror.nextGaussian() * 0.05;
  assert.deepEqual(balls[0], { x: 4.5, y: 5.5, z: 6.5 + 1, ax, ay, az: az + 1 });
  assert.equal(stack.count, 1);
  assert.equal(w.rand.nextInt(1000), mirror.nextInt(1000), "the fire charge consumed exactly three gaussians");
});

test("an exp bottle dispense throws a bottle with the potion velocity (1.1F * 1.25F) and inaccuracy (6F * 0.5F)", () => {
  const thrown = [], r = new JavaRandom(9);
  const engine = new Dispensing({ thrown: (kind, e) => thrown.push({ kind, e }) });
  engine.entityRandom = () => r;
  const stack = { id: ITEM.EXP_BOTTLE, count: 1, damage: 0 };
  const potion = { id: ITEM.POTION, count: 1, damage: 16384 }, thrownPotion = [];
  const p = new Dispensing({ thrown: (kind, e) => thrownPotion.push({ kind, e }) });
  p.entityRandom = () => new JavaRandom(9);
  engine.behaviourFor(stack).stack.call(engine, {}, 0, 0, 0, 5, stack);
  p.behaviourFor(potion).stack.call(p, {}, 0, 0, 0, 5, potion);
  assert.equal(thrown[0].kind, "expBottle");
  for (const k of ["x", "y", "z", "mx", "my", "mz"]) assert.equal(thrown[0].e[k], thrownPotion[0].e[k], k);
  assert.equal(stack.count, 0);
});

// The away run's dispenser host joins the entities it creates to the list walk and sends bottles through the potion list.
const STONE = 3;
const base = { seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0] };
async function dispenseRun(id, ticks) {
  const { World } = await import("./world.js");
  const { fromOriginal } = await import("./block-registry.js");
  const { createRedstoneRuntime } = await import("./redstone-runtime.js");
  const O = [5, 20, 5], put = (w, dx, orig, meta) => { const m = fromOriginal(orig, meta); w.put(O[0] + dx, O[1], O[2], m.id, m.meta, false); };
  const seed = new World("away-b50", "meadow");
  for (let x = 0; x <= 3; x++) for (let y = 0; y <= 3; y++) for (let z = 0; z <= 3; z++) seed.put(O[0] + x - 1, O[1] + y - 1, O[2] + z - 1, 0, 0, false);
  put(seed, 0, 23, 1); // facing up: the thrown entity stays above the floor
  const rt = createRedstoneRuntime({ world: seed, game: { dispensers: () => ({}), maxStack: () => 64, dispense: {} } });
  put(seed, 1, 152, 0); rt.redstone.placed(O[0] + 1, O[1], O[2]);
  const saved = rt.save(); rt.dispose();
  const root = { ...base, redstone: saved, player: { dispensers: { "5,20,5": { items: [{ id, count: 1, damage: 0 }, ...Array(8).fill(null)] } } } };
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, ticks), records: [] };
  plan.chunks = cols.map(([x, z]) => {
    const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
    const set = (x, y, z, b, m) => { if (x >> 4 === cx && z >> 4 === cz) { const i = ((x & 15) * 16 + (z & 15)) * 256 + y; blocks[i] = b; meta[i] = m; } };
    const cx = x, cz = z; for (const [dx, o, m] of [[0, 23, 1], [1, 152, 0]]) { const b = fromOriginal(o, m); set(O[0] + dx, O[1], O[2], b.id, b.meta); }
    return { x, z, blocks, meta };
  });
  return runAway(plan);
}
test("an away exp bottle dispense is thrown (it used to be a dropped item) and an away fire charge flies", async () => {
  const bottle = await dispenseRun(1951, 8), fire = await dispenseRun(1952, 8);
  assert.equal(bottle.entities.drops.length, 0, "the bottle is not dropped as an item");
  assert.equal(bottle.entities.potions.length, 1, "a bottle is in flight (the potion list)");
  assert.equal(bottle.entities.potions[0].kind, "expBottle");
  assert.equal(fire.entities.fireballs.length, 1, "the fire charge is a live fireball");
});

// Away items and orbs have their own Entity.rand each (as freshEntityRandom does live), seeded so the run still replays.
test("away items and orbs each own a seeded Entity.rand", async () => {
  const { awayEntities } = await import("./away-entities.js");
  const { plain } = await import("./legacy-ai-replay.js");
  const { Weather } = await import("./weather.js");
  const build = () => awayEntities({ entities: {}, editSequence: 3, ticks: 40, idBase: 1 }, { world: plain([]), ticking: () => true, entityTicks: () => true, rt: { redstone: { collide() {} }, flush() {}, fluidChanges() {} }, fire: { ignite() {} }, weather: new Weather(), tiles: { furnaces: {}, chests: {}, dispensers: {}, brewing: {}, hoppers: {} }, readStack: (s) => s, maxStack: () => 64 });
  const draws = (host, objs) => objs.map((o) => [host.rng(o)(), host.rng(o)()]);
  const a = build(), b = build(), objs = [{}, {}, {}];
  const first = draws(a.items, objs), again = draws(b.items, [{}, {}, {}]);
  assert.deepEqual(first, again, "the same run draws the same streams");
  assert.notDeepEqual(first[0], first[1], "two items do not share one stream");
  assert.notEqual(a.items.rng(objs[0]), a.xp.random, "an item does not draw from the run's shared stream");
  const orbs = draws(a.xp, objs);
  assert.notDeepEqual(orbs[0], orbs[1]);
});
