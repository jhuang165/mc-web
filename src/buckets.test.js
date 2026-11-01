import { test } from "node:test";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { World, SIZE, HEIGHT, WATER, LAVA } from "./world.js";
import { Fluids } from "./fluids.js";
import { Survival, ITEMS, RECIPES, FUELS, matchRecipe } from "./survival.js";
import { makeStack } from "./inventory.js";
import { JRandom, generateLake, generateSpring } from "./lakes.js";
import {
  BUCKET, WATER_BUCKET, LAVA_BUCKET, MILK_BUCKET, DRINK_TICKS, isBucket, rayTraceBlocks, traceBucket,
  placeContainedLiquid, useBucket, milkCow, finishDrinking,
} from "./buckets.js";
import { SEARCH_ORDER } from "./creative.js";

const STONE = 3, X = 40, Z = 40, FLOOR = 10;
// A flat stone arena with a 3x3 pool dug into it, so every cell is known.
function arena() {
  const w = new World("buckets");
  for (let x = X - 8; x < X + 8; x++)
    for (let z = Z - 8; z < Z + 8; z++) for (let y = 1; y < 30; y++) w.set(x, y, z, y <= FLOOR ? STONE : 0, false);
  return w;
}
const player = (id, count = 1, mode = "survival", extra = []) =>
  new Survival({ slots: [id ? { id, count, damage: 0 } : null, ...extra] }, mode);
const eye = [X + 0.5, FLOOR + 2.62, Z + 0.5], down = [0, -1, 0];

test("buckets: ids, stack sizes, recipe and icons", () => {
  assert.equal(ITEMS[BUCKET].stack, 16);
  for (const id of [WATER_BUCKET, LAVA_BUCKET, MILK_BUCKET]) assert.equal(ITEMS[id].stack, 1);
  assert.deepEqual([BUCKET, WATER_BUCKET, LAVA_BUCKET, MILK_BUCKET].map((i) => ITEMS[i].texture), ["bucket_empty", "bucket_water", "bucket_lava", "bucket_milk"]);
  assert.ok([BUCKET, WATER_BUCKET, LAVA_BUCKET, MILK_BUCKET].every((id) => isBucket(ITEMS[id])));
  // Three iron ingots in a V (ShapedRecipes "# #", " # ").
  assert.equal(matchRecipe([302, 0, 302, 0, 302, 0], 3)?.output, BUCKET);
  assert.equal(matchRecipe([302, 302, 302, 0, 0, 0], 3), null);
  assert.equal(RECIPES.filter((r) => r.output === BUCKET).length, 1);
  // Creative Miscellaneous order: bucket, water, lava, ..., milk.
  const order = SEARCH_ORDER.filter((id) => [BUCKET, WATER_BUCKET, LAVA_BUCKET, MILK_BUCKET].includes(id));
  assert.deepEqual(order, [BUCKET, WATER_BUCKET, LAVA_BUCKET, MILK_BUCKET]);
});

test("ray trace: an empty bucket hits liquid sources only, a filled one looks through liquid", () => {
  const w = arena();
  w.set(X, FLOOR, Z, WATER, false);
  const w2 = [X + 0.5, FLOOR + 1.5, Z + 0.5], to = [X + 0.5, FLOOR - 2, Z + 0.5];
  assert.deepEqual(rayTraceBlocks(w, w2, to, true, false).block, [X, FLOOR, Z]);
  // Hitting the top face of a source: side 1 (up), point on the surface plane y = FLOOR + 1.
  assert.equal(rayTraceBlocks(w, w2, to, true, false).side, 1);
  assert.equal(rayTraceBlocks(w, w2, to, true, false).point[1], FLOOR + 1);
  // The same ray with liquids ignored lands on the stone below.
  assert.deepEqual(rayTraceBlocks(w, w2, to, false, true).block, [X, FLOOR - 1, Z]);
  // A flowing cell (metadata > 0) is not a hit when stopping on liquid.
  w.put(X, FLOOR, Z, WATER, 3, false);
  assert.deepEqual(rayTraceBlocks(w, w2, to, true, false).block, [X, FLOOR - 1, Z]);
  // Reach is 5 blocks.
  const far = traceBucket(w, [X + 0.5, FLOOR + 7, Z + 0.5], down, false);
  assert.equal(far, null);
});

test("filling an empty bucket: source only, survival swaps and creative keeps", () => {
  const w = arena();
  w.set(X, FLOOR, Z, WATER, false);
  const p = player(BUCKET, 1);
  const r = useBucket(w, p, eye, down);
  assert.equal(r.action, "pick");
  assert.equal(w.get(X, FLOOR, Z), 0);
  assert.deepEqual(p.inventory.held, makeStack(WATER_BUCKET));
  // Flowing water is never picked up.
  w.put(X, FLOOR, Z, WATER, 1, false);
  const q = player(BUCKET, 1);
  assert.equal(useBucket(w, q, eye, down), null);
  assert.equal(q.inventory.held.id, BUCKET);
  // Lava becomes a lava bucket.
  w.put(X, FLOOR, Z, LAVA, 0, false);
  const l = player(BUCKET, 1);
  useBucket(w, l, eye, down);
  assert.equal(l.inventory.held.id, LAVA_BUCKET);
  // Creative removes the liquid and keeps the stack.
  w.put(X, FLOOR, Z, WATER, 0, false);
  const c = player(BUCKET, 1, "creative");
  useBucket(w, c, eye, down);
  assert.equal(w.get(X, FLOOR, Z), 0);
  assert.equal(c.inventory.held.id, BUCKET);
});

test("filling from a stack of buckets puts the full one in the inventory, or drops it when full", () => {
  const w = arena();
  w.set(X, FLOOR, Z, WATER, false);
  const p = player(BUCKET, 3);
  useBucket(w, p, eye, down);
  assert.equal(p.inventory.held.id, BUCKET);
  assert.equal(p.inventory.held.count, 2);
  assert.equal(p.count(WATER_BUCKET), 1);
  // Full inventory: nothing fits, so the filled bucket is thrown.
  const w2 = arena();
  w2.set(X, FLOOR, Z, WATER, false);
  const full = player(BUCKET, 2);
  for (let i = 1; i < 36; i++) full.inventory.main[i] = makeStack(1, 64);
  const dropped = [];
  useBucket(w2, full, eye, down, { drop: (s) => dropped.push(s) });
  assert.deepEqual(dropped, [makeStack(WATER_BUCKET)]);
  assert.equal(full.inventory.held.count, 1);
});

test("a filled bucket places against the clicked face and turns into an empty bucket", () => {
  const w = arena();
  const p = player(WATER_BUCKET);
  const r = useBucket(w, p, eye, down);
  assert.deepEqual(r.cells, [[X, FLOOR + 1, Z]]);
  assert.equal(w.get(X, FLOOR + 1, Z), WATER);
  assert.equal(w.getMeta(X, FLOOR + 1, Z), 0);
  assert.deepEqual(p.inventory.held, makeStack(BUCKET));
  // Creative keeps the full bucket.
  const w2 = arena(), c = player(LAVA_BUCKET, 1, "creative");
  useBucket(w2, c, eye, down);
  assert.equal(w2.get(X, FLOOR + 1, Z), LAVA);
  assert.equal(c.inventory.held.id, LAVA_BUCKET);
});

test("a filled bucket ignores liquid it is aimed through and cannot place into a solid block", () => {
  const w = arena();
  w.set(X, FLOOR + 1, Z, WATER, false);
  const p = player(LAVA_BUCKET);
  const r = useBucket(w, p, eye, down);
  // The water cell is skipped; the stone below is hit and the cell above it (the water) is replaced.
  assert.deepEqual(r.cells, [[X, FLOOR + 1, Z]]);
  assert.equal(w.get(X, FLOOR + 1, Z), LAVA);
  assert.equal(placeContainedLiquid(w, X, FLOOR, Z, WATER), false);
  assert.equal(w.get(X, FLOOR, Z), STONE);
});

test("placing into a plant breaks it first", () => {
  const w = arena();
  w.set(X, FLOOR + 1, Z, 39, false);
  const broken = [];
  const p = player(WATER_BUCKET);
  useBucket(w, p, eye, down, { destroy: (...a) => broken.push(a) });
  assert.deepEqual(broken, [[X, FLOOR + 1, Z, 39]]);
  assert.equal(w.get(X, FLOOR + 1, Z), WATER);
});

test("tracked placement starts the fluid simulation; lava next to water hardens", () => {
  const w = arena();
  const fl = new Fluids(w); // installs world.onChange
  const p = player(WATER_BUCKET);
  useBucket(w, p, eye, down);
  assert.equal(w.edits.has(`${X},${FLOOR + 1},${Z}`), true);
  for (let i = 0; i < 40; i++) fl.tick();
  assert.equal(w.get(X + 1, FLOOR + 1, Z), WATER);
});

test("milk: cow gives a milk bucket, drinking returns an empty one", () => {
  const p = player(BUCKET, 1);
  assert.equal(milkCow(p), true);
  assert.deepEqual(p.inventory.held, makeStack(MILK_BUCKET));
  assert.equal(DRINK_TICKS, 32);
  assert.equal(finishDrinking(p), true);
  assert.deepEqual(p.inventory.held, makeStack(BUCKET));
  const stack = player(BUCKET, 4);
  milkCow(stack);
  assert.equal(stack.inventory.held.count, 3);
  assert.equal(stack.count(MILK_BUCKET), 1);
  // Creative players cannot milk, and a creative drink keeps the bucket.
  assert.equal(milkCow(player(BUCKET, 1, "creative")), false);
  const c = player(MILK_BUCKET, 1, "creative");
  finishDrinking(c);
  assert.equal(c.inventory.held.id, MILK_BUCKET);
  assert.equal(milkCow(player(WATER_BUCKET)), false);
});

test("a lava bucket burns for 20000 ticks and leaves an empty bucket", () => {
  assert.equal(FUELS[LAVA_BUCKET], 20000);
  assert.equal(FUELS[WATER_BUCKET] ?? 0, 0);
  const p = new Survival({});
  const f = p.furnace("1,2,3");
  f.items[0] = makeStack(15);
  f.items[1] = makeStack(LAVA_BUCKET);
  p.tickFurnaces();
  assert.equal(f.burn, 20000);
  assert.equal(f.burnTotal, 20000);
  assert.deepEqual(f.items[1], makeStack(BUCKET));
  // A save keeps a full lava bucket's burn time.
  const saved = new Survival(JSON.parse(JSON.stringify(p.serialize())));
  assert.equal(saved.furnaces["1,2,3"].burnTotal, 20000);
});

test("java.util.Random matches the JDK for known seeds", () => {
  // new Random(42): nextInt() is -1170105035, then 234785527.
  const r = new JRandom(42);
  assert.equal(r.next(32), -1170105035);
  assert.equal(r.next(32), 234785527);
  assert.equal(new JRandom(0).nextLong(), -4962768465676381896n);
  const d = new JRandom(0).nextDouble();
  assert.ok(Math.abs(d - 0.730967787376657) < 1e-15);
  assert.equal(new JRandom(0).nextInt(10), 0);
  assert.equal(new JRandom(0).nextInt(16), 11);
});

// World generation: lakes and springs from generationVersion 5.
const liquids = (w) => {
  const out = [], data = w.snapshot().data;
  for (let i = 0; i < data.length; i++) if (data[i] === WATER || data[i] === LAVA) out.push(i);
  return out;
};
test("lakes and springs generate deterministically from version 5", () => {
  const a = new World("Minecraft"), b = new World("Minecraft"), c = new World("Overworld");
  assert.deepEqual(a.snapshot(), b.snapshot());
  assert.notDeepEqual(a.snapshot().data, c.snapshot().data);
  assert.equal(a.generationVersion, 8); // the default; snow.test.js pins that 6 only adds snow and ice, trees.test.js that 7 only regrows trees, plants.test.js that 8 only adds beaches and sugar cane
  // Versions 1 to 3 are byte for byte what they were before lakes existed (sha1 of the
  // block array taken from the generator before this change), so old saves keep their terrain.
  const sha = (w) => createHash("sha1").update(w.snapshot().data).digest("hex").slice(0, 12);
  const pinned = { "1:Overworld": "d3d75dd65871", "1:Minecraft": "ebcdf3132eac", "2:Overworld": "1d1b3410087d",
    "2:Minecraft": "20a9cba14ab9", "3:Overworld": "86feac00a1f0", "3:Minecraft": "4d89721f604a" };
  for (const [key, hash] of Object.entries(pinned)) {
    const [v, seed] = key.split(":");
    assert.equal(sha(new World(seed, "meadow", +v)), hash, key);
  }
  // Version 5 adds liquid that version 3 does not have.
  assert.ok(liquids(a).length > liquids(new World("Minecraft", "meadow", 3)).length);
});

test("generated liquid is settled: untracked, source level, and no fluid ticks on load", () => {
  for (const seed of ["Minecraft", "d", "a"]) {
    const w = new World(seed);
    assert.equal(w.edits.size, 0);
    // Generated liquid is all source level (red flowers carry their own metadata).
    const { data, meta } = w.snapshot();
    assert.equal(meta.every((m, i) => m === 0 || (data[i] !== WATER && data[i] !== LAVA)), true);
    const fl = new Fluids(w);
    fl.wake(); // wakes liquid next to saved edits: there are none
    assert.equal(fl.pending.size, 0);
    assert.deepEqual(fl.tick(), []);
  }
  // 'd' has a lava lake: lava exists, and it is walled with stone and open above.
  const w = new World("d");
  let lava = 0;
  for (const b of w.snapshot().data) if (b === LAVA) lava++;
  assert.ok(lava > 20);
});

test("a lake needs solid ground below the surface line and no liquid above it", () => {
  const flat = () => {
    const w = new World("lake", "meadow", 1);
    for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) for (let y = 1; y < HEIGHT; y++) w.put(x, y, z, y <= 30 ? STONE : 0, 0, false);
    return w;
  };
  const w = flat();
  assert.equal(generateLake(w, new JRandom(7), 56, 45, 56, WATER), true);
  let water = 0;
  for (let x = 40; x < 72; x++) for (let z = 40; z < 72; z++) for (let y = 26; y < 34; y++) {
    if (w.get(x, y, z) === WATER) { water++; assert.ok(y < 30); }
  }
  assert.ok(water > 30);
  // A lake that would sit next to open water above the line is refused.
  const tries = [];
  for (let s = 1; s <= 40; s++) {
    const t = flat();
    t.put(50, 30, 56, WATER, 0, false);
    tries.push(generateLake(t, new JRandom(s), 56, 45, 56, WATER));
  }
  assert.ok(tries.includes(false) && tries.includes(true));
  // A lava lake walls itself in with stone.
  const l = flat();
  l.put(56, 30, 56, 0, 0, false);
  assert.equal(generateLake(l, new JRandom(3), 56, 45, 56, LAVA), true);
  let lava = 0;
  for (let x = 40; x < 72; x++) for (let z = 40; z < 72; z++) for (let y = 26; y < 30; y++) if (l.get(x, y, z) === LAVA) lava++;
  assert.ok(lava > 10);
});

test("springs: three stone sides and one air side only", () => {
  const w = new World("spring", "meadow", 1);
  for (let x = 20; x < 30; x++) for (let z = 20; z < 30; z++) for (let y = 1; y < 30; y++) w.put(x, y, z, STONE, 0, false);
  w.put(25, 20, 24, 0, 0, false);
  assert.equal(generateSpring(w, 25, 20, 25, WATER), true);
  assert.equal(w.get(25, 20, 25), WATER);
  assert.equal(w.getMeta(25, 20, 25), 0);
  // Fully enclosed stone has no air side: nothing happens.
  assert.equal(generateSpring(w, 27, 15, 27, LAVA), true);
  assert.equal(w.get(27, 15, 27), STONE);
  // Sand above fails the check outright.
  w.put(27, 21, 27, 6, 0, false);
  assert.equal(generateSpring(w, 27, 20, 27, LAVA), false);
});
