// Batch 83 mppiston83: block drops from the redstone engine. The dedicated server's LiveRedstone gets a `drop` hook (server-redstone-drops.js), the piston-destroyed
// blocks drop what their 1.7.10 class drops (redstone-drops.js), gamerule doTileDrops gates dropBlockAsItem_do, and single player spawns at the engine's position
// without a second dropBlock spread.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, REDSTONE_BLOCK, RED_FLOWER } from "./world.js";
import { fromOriginal } from "./block-registry.js";
import { itemFromOriginal } from "./region-import.js";
import { JavaRandom } from "./java-random.js";
import { harvestBlock } from "./enchantment-effects.js";
import { crushDrops, CRUSH_ITEMS, CRUSH_IDS, spawnRedstoneDrop } from "./redstone-drops.js";
import { LiveRedstone } from "./redstone-live.js";
import { ItemEntities } from "./item-entities.js";
import { setGameRuleSource } from "./game-rules.js";
import { Skulls, SKULL, ITEM_SKULL } from "./skull.js";
import { PISTON } from "./dispenser-piston.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";

const src = (f) => readFileSync(new URL(`./${f}`, import.meta.url), "utf8");
const f = Math.fround, at = (r) => f(r.nextFloat() * f(0.7)) + f(0.3) * 0.5;
const state = (r) => r.nextInt(1 << 30); // the next draw: equal values mean equal Random states
const ids = (list) => list.map((d) => [d.id, d.damage]);
const internal = (o, m = 0) => fromOriginal(o, m).id;

test("every drop item maps to the port item region-import gives the original id", () => {
  for (const [orig, port] of Object.entries(CRUSH_ITEMS)) assert.equal(itemFromOriginal(Number(orig), 0)?.id, port, `original item ${orig}`);
  assert.equal(itemFromOriginal(351, 3)?.id, CRUSH_ITEMS[351], "cocoa beans are dye 351:3");
  assert.equal(itemFromOriginal(122, 0)?.id, 171, "the dragon egg (redstone-live DROP_ITEMS 122)");
});

test("quantityDropped 0 blocks (liquids, fire, snow layer, cake, vine) drop nothing and draw nothing", () => {
  for (const id of [8, 9, 10, 11, 51, 78, 92, 106]) {
    const r = new JavaRandom(7n), ref = new JavaRandom(7n);
    assert.deepEqual(crushDrops(id, 0, 0, 0, 0, r), [], `id ${id}`);
    assert.equal(state(r), state(ref), `id ${id} draws nothing`);
  }
  assert.equal(crushDrops(1, 0, 0, 0, 0, new JavaRandom(1n)), null, "stone is not a crush id");
  assert.equal(crushDrops(69, 0, 0, 0, 0, new JavaRandom(1n)), null, "a lever keeps the engine's own drop");
});

test("tall grass, web, melon, leaves and crops draw like enchantment-effects harvestBlock at fortune 0 (executed rules)", () => {
  const cases = [[31, 1], [30, 0], [103, 0], [18, 0], [18, 3], [161, 1], [59, 3], [59, 7], [141, 7], [142, 7]];
  for (const [id, meta] of cases) for (let s = 0n; s < 60n; s++) {
    const a = new JavaRandom(s), b = new JavaRandom(s);
    const mine = crushDrops(id, meta, 0, 0, 0, a), theirs = harvestBlock(id, meta, { fortune: 0, rand: b });
    assert.deepEqual(mine.map((d) => d.id), theirs.drops.map((d) => itemFromOriginal(d.id, d.damage).id), `id ${id}:${meta} seed ${s}`);
    assert.equal(state(a), state(b), `id ${id}:${meta} seed ${s} same draws`);
  }
});

test("each drop is an EntityItem at x + rand * 0.7F + 0.15 (three floats after the rolls)", () => {
  const r = new JavaRandom(3n), ref = new JavaRandom(3n);
  const [d] = crushDrops(30, 0, 5, 6, 7, r);
  assert.ok(ref.nextFloat() <= 1, "the chance roll");
  assert.deepEqual([d.x, d.y, d.z], [5 + at(ref), 6 + at(ref), 7 + at(ref)]);
  assert.deepEqual([d.id, d.count, d.damage], [321, 1, 0]);
});

test("the class overrides: bed, dead bush, double plant, stems, nether wart, cocoa, plants, skull", () => {
  const one = (id, meta, opts) => crushDrops(id, meta, 0, 0, 0, new JavaRandom(11n), opts);
  assert.deepEqual(ids(one(26, 2)), [[472, 0]], "bed foot: the bed item");
  { const r = new JavaRandom(11n), ref = new JavaRandom(11n); assert.deepEqual(crushDrops(26, 10, 0, 0, 0, r), []); assert.equal(state(r), state(ref), "bed head: no draws"); }
  { const r = new JavaRandom(11n), ref = new JavaRandom(11n); assert.deepEqual(crushDrops(32, 0, 0, 0, 0, r), []); ref.nextFloat(); assert.equal(state(r), state(ref), "dead bush: the chance float only"); }
  assert.deepEqual(ids(one(175, 4)), [[69, 4]], "double plant lower half: itself, meta & 7");
  for (const m of [2, 3, 8, 11]) assert.deepEqual(one(175, m), [], `double plant meta ${m}: nothing`);
  // Stems: chance float (no item), then three nextInt(15) <= meta seeds.
  for (const [id, seed] of [[104, 361], [105, 362]]) for (let s = 0n; s < 20n; s++) {
    const ref = new JavaRandom(s); ref.nextFloat(); let n = 0;
    for (let i = 0; i < 3; i++) if (ref.nextInt(15) <= 7) { n++; at(ref); at(ref); at(ref); }
    const r = new JavaRandom(s), out = crushDrops(id, 7, 0, 0, 0, r);
    assert.deepEqual(out.map((d) => d.id), Array(n).fill(seed)); assert.equal(state(r), state(ref));
  }
  // Nether wart: 1 below age 3, 2 + nextInt(3) ripe; no chance roll. Cocoa: 1 bean, 3 at age 2 (meta 8..11).
  assert.deepEqual(ids(one(115, 1)), [[386, 0]]);
  { const ref = new JavaRandom(11n); assert.equal(one(115, 3).length, 2 + ref.nextInt(3)); }
  assert.deepEqual(ids(one(127, 4)), [[351, 3]]);
  assert.deepEqual(ids(one(127, 9)), [[351, 3], [351, 3], [351, 3]]);
  // Plants through the port cell: sapling clamp, rose rawDamage, dandelion 0.
  assert.deepEqual(ids(one(6, 7)), [[48, 5]], "sapling clamp(meta & 7, 0, 5)");
  assert.deepEqual(one(38, 12, { cell: { block: RED_FLOWER, meta: 12 } }).map((d) => [d.id, d.damage, d.rawDamage]), [[44, 0, 12]], "a rose past its variants keeps rawDamage");
  assert.deepEqual(ids(one(38, 3, { cell: { block: RED_FLOWER, meta: 3 } })), [[44, 3]]);
  // Skull: the tile's type (and SkullOwner for a player head), nothing with bit 8.
  assert.deepEqual(ids(one(144, 1, { skull: { type: 4 } })), [[ITEM_SKULL, 4]]);
  const head = one(144, 1, { skull: { type: 3, profile: { name: "Steve", properties: [] } } })[0];
  assert.equal(head.skullOwner, "Steve"); assert.ok(head.skullRaw);
  assert.deepEqual(one(144, 9, { skull: { type: 4 } }), []);
});

test("doTileDrops false: the rolls still draw, the three position floats do not", () => {
  const r = new JavaRandom(5n), ref = new JavaRandom(5n);
  assert.deepEqual(crushDrops(30, 0, 0, 0, 0, r, { tileDrops: false }), []);
  ref.nextFloat(); assert.equal(state(r), state(ref));
  // LiveRedstone reads the gamerule (engine path: the chance float only).
  const w = new World("mppiston83");
  const drops = [], lr = new LiveRedstone(w, { drop: (x, y, z, d) => drops.push(d) });
  setGameRuleSource((name) => name !== "doTileDrops");
  try {
    lr.rand = new JavaRandom(9n);
    lr.dropBlockAsItem(0, 10, 0, 69, 0);
    lr.dropBlockAsItem(0, 10, 0, 30, 0);
    assert.deepEqual(drops, []);
    const ref2 = new JavaRandom(9n); ref2.nextFloat(); ref2.nextFloat();
    assert.equal(state(lr.rand), state(ref2), "one chance float each");
    assert.equal(lr.doTileDrops, true, "the engine's own flag is restored");
  } finally { setGameRuleSource(null); }
  lr.dropBlockAsItem(0, 10, 0, 69, 0);
  assert.deepEqual(drops.map((d) => d.id), [1108], "with the rule on the lever drops");
});

test("LiveRedstone: a crushed water cell drops nothing (it dropped a Water item), wheat its crop and seeds, a skull from the hooked store", () => {
  const w = new World("mppiston83b"), drops = [], skulls = new Skulls();
  const lr = new LiveRedstone(w, { drop: (x, y, z, d) => drops.push(d), skulls: () => skulls });
  w.put(3, 10, 3, internal(9), 0, false);
  lr.dropBlockAsItem(3, 10, 3, 9, 0);
  assert.deepEqual(drops, []);
  w.put(3, 10, 3, internal(59, 7), 0, false);
  lr.rand = new JavaRandom(4n);
  lr.dropBlockAsItem(3, 10, 3, 59, 7);
  assert.equal(drops[0].id, 305, "ripe wheat: wheat first");
  assert.ok(drops.slice(1).every((d) => d.id === 309), "then seeds");
  drops.length = 0;
  w.put(3, 10, 3, SKULL, 1, false); skulls.create(3, 10, 3, 2);
  lr.dropBlockAsItem(3, 10, 3, 144, 1);
  assert.deepEqual(drops.map((d) => [d.id, d.damage]), [[ITEM_SKULL, 2]]);
  drops.length = 0;
  lr.dropBlockAsItem(3, 10, 3, 122, 0);
  assert.deepEqual(drops.map((d) => d.id), [171], "the dragon egg's item");
});

test("spawnRedstoneDrop: one EntityItem at the given position, delay 10, tags kept (no second spread)", () => {
  const items = new ItemEntities(), e = spawnRedstoneDrop(items, 1.25, 2.5, 3.75, { id: 44, count: 1, damage: 0, rawDamage: 12 });
  assert.deepEqual([e.x, e.z, e.delay, e.stack.id, e.stack.rawDamage], [1.25, 3.75, 10, 44, 12]);
  assert.equal(items.items.length, 1);
  assert.match(src("main.js"), /drop: \(x, y, z, d\) => spawnRedstoneDrop\(items, x, y, z, d\)/);
});

// The server: a piston crushing a flower and dust losing its block drop into the dimension's items (Survival), none in Creative.
function server(gameMode) {
  const world = new World("b83-mppiston");
  for (let x = 50; x <= 80; x++) for (let z = 55; z <= 75; z++) for (let y = 9; y <= 20; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({}, { world, gameMode, mobs: false });
}
test("server pistons and redstone support loss drop items (server-redstone-drops.js); Creative keeps none", () => {
  for (const mode of ["survival", "creative"]) {
    const s = server(mode);
    s.world.set(61, 10, 64, RED_FLOWER, false, 0);
    s.world.put(60, 10, 64, PISTON, 5, false); s.world.put(60, 10, 63, REDSTONE_BLOCK, 0, false);
    s.redstone.placed?.(60, 10, 63); s.redstone.notifyBlocksOfNeighborChange?.(60, 10, 63, 0);
    for (let i = 0; i < 4; i++) s.tick();
    assert.notEqual(s.world.get(61, 10, 64), RED_FLOWER, `${mode}: the flower is gone`);
    // Redstone dust on a dirt block that is then removed.
    s.world.set(70, 10, 64, 3, true, 0); s.world.set(70, 11, 64, internal(55), true, 0);
    s.world.set(70, 10, 64, 0, true, 0);
    assert.notEqual(s.world.get(70, 11, 64), internal(55), `${mode}: the dust popped off`);
    const got = s.items.items.map((e) => e.stack.id).sort((a, b) => a - b);
    if (mode === "survival") {
      assert.deepEqual(got, [44, 360], "the poppy and the redstone");
      const poppy = s.items.items.find((e) => e.stack.id === 44), dust = s.items.items.find((e) => e.stack.id === 360);
      assert.equal(dust.delay, 10, "dropBlockAsItem_do's pickup delay (no tick since)");
      assert.ok(poppy, "the crushed poppy");
      assert.ok(dust.x > 70.15 && dust.x < 70.85 && dust.z > 64.15 && dust.z < 64.85, "inside the cell, one spread");
    } else assert.deepEqual(got, []);
  }
  assert.match(src("multiplayer/server-nether.js"), /drop: serverRedstoneDrop\(sim, \(\) => n\.items\)/);
});

test("server nether wart losing its soul sand drops its warts (NetherLive had no drop hook on the server)", () => {
  const s = server("survival"), SOUL_SAND = internal(88), WART = internal(115, 3);
  s.world.set(70, 10, 64, SOUL_SAND, true, 0); s.world.set(70, 11, 64, WART, true, 3);
  s.world.set(70, 10, 64, 0, true, 0);
  assert.equal(s.world.get(70, 11, 64), 0);
  const n = s.items.items.filter((e) => e.stack.id === 386).length;
  assert.ok(n >= 2 && n <= 4, `a ripe wart drops 2 + nextInt(3), got ${n}`);
});
