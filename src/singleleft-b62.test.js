// Batch 62 (singleleft). Saved order: frozen entities skipped by the chunk-list queries, the ids of a reloaded rider and its mount (executed saved-order9-reference.json,
// SavedOrderLoginProbe). Tracker: flag rises beyond the first and dead entities' entries (away-trace.js). Mob copies: the enderman copy's wet teleport draws and move
// (executed mobcopies2-reference.json `watertp`, MobCopies2Probe on the unchanged 1.7.10 classes).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { awayEntities } from "./away-entities.js";
import { plain } from "./legacy-ai-replay.js";
import { Weather } from "./weather.js";
import { trackChunkLoads, unloadQueued, liveOrder, nearSpawn, isFrozen } from "./saved-order.js";
import { FallingBlocks } from "./falling.js";
import { newOrb } from "./experience.js";
import { AwayTrace, bindTrace, applyTick } from "./away-trace.js";
import { ClientEntity } from "./entity-tracker.js";
import { JavaRandom } from "./java-random.js";
import { EntityWorld } from "./entities.js";
import { WATER } from "./world.js";
import { populationBlockMapperReady } from "./population-world.js";

await populationBlockMapperReady;

const STONE = 3, K = ["item", "cow", "orb", "item", "cart", "orb", "cow", "arrow"];
const run = () => {
  const world = plain([]), tiles = { furnaces: {}, chests: {}, dispensers: {}, brewing: {}, hoppers: {} }, rt = { redstone: { collide() {} }, flush() {}, fluidChanges() {} };
  return awayEntities({ entities: {}, editSequence: 0, ticks: 0, idBase: 1 }, { world, ticking: () => true, entityTicks: () => true, rt, fire: { ignite() {} }, weather: new Weather(), tiles, readStack: (s) => s, maxStack: () => 64, mobs: undefined });
};
const idNum = (e) => { const id = e.entityId ?? e.id; return typeof id === "string" ? Number(/(\d+)$/.exec(id)[1]) : id; };
const indexOf = (e, chunks) => { const c = chunks.find((k) => Math.floor(e.x / 16) === k[0] && Math.floor(e.z / 16) === k[1]); return Math.round((e.x - c[0] * 16 - 1) / 0.5); };

// ---- saved order: ids of a reloaded rider and its mount (executed) ----
const ref9 = JSON.parse(readFileSync(new URL("../public/research/saved-order9-reference.json", import.meta.url))).cases;
function build(c) {
  const ents = run(), { items, xp, mobs } = ents, falling = new FallingBlocks(plain([]), {}, []);
  ents.attachFalling(falling, []);
  const made = [];
  c.specs.forEach(([, y, chunk], i) => {
    const kind = K[i % K.length], x = c.chunks[chunk][0] * 16 + 1 + 0.5 * i, z = c.chunks[chunk][1] * 16 + 8.5;
    let e;
    if (kind === "item") { items.spawn({ id: STONE, count: 3, damage: 0 }, x, y, z, { motion: [0, 0, 0] }); e = items.items.at(-1); }
    else if (kind === "orb") { e = newOrb(5, x, y, z, () => 0); xp.orbs.push(e); xp.joined(e); }
    else if (kind === "cart") { e = ents.minecarts.spawnCart(1, { x, y, z, items: [] }); Object.assign(e, { x, y, z }); }
    else if (kind === "cow") { e = mobs.create("cow", x, y, z); Object.assign(e, { x, y, z }); mobs.entities.push(e); }
    else throw new Error(kind);
    made.push(e);
  });
  c.specs.forEach(([, , , mount], i) => { if (mount >= 0) { made[i].ridingEntity = made[mount]; made[mount].passenger = made[i]; } });
  return { mobs, made, ents };
}
for (const c of ref9) {
  test(`reloaded rider and mount take ids in creation order (executed ${c.name})`, () => {
    const { mobs, made } = build(c), keeps = nearSpawn({ x: c.spawn[0], z: c.spawn[1] });
    mobs.withBalls(mobs.entities.slice());
    trackChunkLoads(mobs, { x: c.player[0], z: c.player[1] }, c.view, keeps, false);
    c.path.forEach(([x, z], i) => { trackChunkLoads(mobs, { x, z }, c.view, keeps, false); if (c.mask[i]) unloadQueued(mobs); });
    const loaded = liveOrder(mobs, mobs.withBalls(mobs.entities.slice()));
    assert.ok(loaded.length > 0);
    const byIndex = made.map((e, i) => [i, idNum(e)]).sort((a, b) => a[1] - b[1]).map((p) => p[0]);
    const want = c.ids.after.slice().sort((a, b) => a[1] - b[1]).map((p) => p[0]);
    assert.deepEqual(byIndex, want, "ids ascend in the native creation order");
  });
}

// ---- saved order: frozen entities are out of the chunk-list queries ----
test("an item of an unloaded chunk is not picked up, not hurt by an explosion and not merged into", () => {
  const { mobs, ents } = build({ chunks: [[0, 0], [1, 0], [2, 0], [3, 0]], specs: [] }), { items } = ents;
  items.spawn({ id: STONE, count: 3, damage: 0 }, 15.9, 5, 8.5, { motion: [0, 0, 0] }); // chunk 0
  items.spawn({ id: STONE, count: 3, damage: 0 }, 16.1, 5, 8.5, { motion: [0, 0, 0] }); // chunk 1
  const [a, b] = items.items;
  mobs.withBalls(mobs.entities.slice());
  trackChunkLoads(mobs, { x: 40.5, z: 8.5 }, 2, null, false);
  trackChunkLoads(mobs, { x: 56.5, z: 8.5 }, 2, null, false); // chunk 3 centre: chunks 1..5 stay, chunk 0 is queued
  unloadQueued(mobs);
  assert.equal(isFrozen(a), true);
  assert.equal(isFrozen(b), false);
  const got = items.collect({ x: 16, y: 5, z: 8.5 }, 0.6, 1.8, (s) => { s.count = 0; return true; });
  assert.deepEqual(got.map((p) => p.item), [b], "only the loaded item gives anything");
  const hp = a.health;
  items.explode(plain([]), 15.9, 5.1, 8.5, 4);
  assert.equal(a.health, hp);
  assert.equal(a.dead || false, false);
});

// ---- tracker: flag rises beyond the first, dead entities' entries ----
test("away trace: the tracker clears airBorne after each send, so a later rise is replayed too", () => {
  const e = { entityId: 7, x: 1, y: 0, z: 1, mx: 0, my: 0, mz: 0, airBorne: false };
  const trace = new AwayTrace(() => [e]);
  const flagAt = [false, true, false, false, true, true, false, true];
  flagAt.forEach((on, i) => { e.x = i; e.airBorne = on; trace.sample(); });
  const rows = trace.finish([[e, { ord: 0 }]]).rows, rise = rows[0].fields.indexOf("!airBorne");
  const stride = rows[0].fields.length + 1, ends = [];
  for (let k = 0; k < rows[0].data.length; k += stride) ends.push(rows[0].data[k + 1 + rise]);
  assert.equal(ends.at(-1), 4, "four separate rises: ticks 1, 4, 5 (set again after the clear) and 7"); // tick 5 is on again after the clear
  const bound = bindTrace({ rows }, () => e), seen = [];
  const absent = new Set();
  for (let i = 0; i < flagAt.length; i++) { e.airBorne = false; applyTick(bound, i, absent); seen.push(e.airBorne); }
  assert.deepEqual(seen, [false, true, false, false, true, true, false, true]);
});
test("away trace: an entity sampled and then gone leaves a ghost [id, first, last] for the HashSet order", () => {
  const live = { entityId: 11, x: 0, y: 0, z: 0 }, dying = { entityId: 12, x: 0, y: 0, z: 0 }, list = [live, dying];
  const trace = new AwayTrace(() => list);
  trace.sample(); trace.sample();
  list.pop(); // died on tick 2
  live.x = 3; trace.sample(); live.x = 4; trace.sample();
  const out = trace.finish([[live, { ord: 0 }]]);
  assert.deepEqual(out.ghosts, [[12, 0, 1]]);
});

// ---- mob copies: the enderman copy's wet teleport (executed watertp) ----
class Log extends JavaRandom {
  constructor(seed) { super(BigInt(seed)); this.log = []; }
  nextDouble() { this.log.push("d"); return super.nextDouble(); }
  nextFloat() { this.log.push("f"); return super.nextFloat(); }
  nextBoolean() { this.log.push("b"); return super.nextBoolean(); }
  nextInt(n) { const v = super.nextInt(n); if (n !== undefined) this.log.push(`${n}:${v}`); return v; }
}
const ref2 = JSON.parse(readFileSync(new URL("../public/research/mobcopies2-reference.json", import.meta.url), "utf8"));
// MobMoveProbe's world with step 2: floor at y < 0, and a two-block-high wall (floor top y 2) for z >= 2; the probe's pool is x 7..13, z -9..-3, y <= 4
const tpWorld = { numericSeed: 1, solid: (x, y, z) => y < 0 || (z >= 2 && y < 2), get: (x, y, z) => (y < 0 || (z >= 2 && y < 2) ? 1 : x >= 7 && x <= 13 && z >= -9 && z <= -3 && y <= 4 ? WATER : 0), getMeta: () => 0, surface: () => 0 };
for (const r of ref2.mobs.filter((x) => x.case === "watertp")) {
  test(`enderman copy in water, seed ${r.seed}: the teleport draws and the moves match the executed ya.e (160 ticks)`, () => {
    const [w, h] = [r.width, r.height], host = { world: tpWorld, size: () => [w, h] }, P = EntityWorld.prototype, m = { type: "enderman", size: 1 };
    const c = new ClientEntity("enderman"); c.present = true; c.rand = new Log(r.seed); c.width = w; c.height = h;
    const hooks = [(e) => P.moveClient.call(host, e, m), (e) => P.clientAfterMove.call(host, e, m), (e) => P.clientEnvironment.call(host, e, m), (e) => P.clientLiving.call(host, e, m)];
    let teleports = 0, wetDraws = 0;
    r.ticks.forEach((t, i) => {
      [c.x, c.y, c.z, c.vx, c.vy, c.vz] = t.pre; c.px = c.x; c.py = c.y; c.pz = c.z;
      c.rand.log.length = 0; c.dead = false;
      c.step(...hooks);
      assert.equal(c.rand.log.join(" "), t.row[0], `tick ${i}`);
      if (t.row[0].includes(" 64:")) wetDraws++;
      if (t.row[2].filter((p) => p === "portal").length > 100) teleports++;
      const next = r.ticks[i + 1];
      if (next) assert.ok(Math.abs(c.x - next.pre[0]) < 1e-9 && Math.abs(c.y - next.pre[1]) < 1e-9 && Math.abs(c.z - next.pre[2]) < 1e-9, `position after tick ${i}`);
    });
    assert.ok(wetDraws > 0, "the copy was wet");
    assert.equal(teleports, 1, "one teleport succeeded");
  });
}
