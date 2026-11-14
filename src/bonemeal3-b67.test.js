// Batch 67 (bonemeal3): bone meal draws every gate from the world Random (sapling gate and tree generator, grass spread), checked against the executed records
// (public/research/bone-meal-reference.json, tools/probes/BoneMealProbe.java: the next world Random draw after ItemDye.func_150919_a), and the dispenser path
// (BehaviorDispenseBoneMeal, kq: func_150919_a, aux 2005 when it returns true, the click 1000 / failed click 1001).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World, YELLOW_FLOWER, RED_FLOWER } from './world.js';
import { Trees } from './trees.js';
import { Farming } from './farming.js';
import { JavaRandom } from './java-random.js';
import { toOriginal, fromOriginal } from './block-registry.js';
import { useBoneMeal } from './bone-meal.js';
import { Dispensing } from './dispense.js';
import { makeStack } from './inventory.js';
import { treeRegistryReady } from './tree-growth.js';

await treeRegistryReady;

const reference = JSON.parse(readFileSync(new URL('../public/research/bone-meal-reference.json', import.meta.url), 'utf8'));
const OX = 64, OZ = 64, DY = -44;
const native = (w, x, y, z) => toOriginal(w.get(x, y, z), w.getMeta(x, y, z)) ?? [0, 0];
const place = (w, x, y, z, id, meta) => {
  const m = id === 0 ? { id: 0, meta: 0 } : fromOriginal(id, meta);
  assert.ok(id === 0 || m?.exact, `mapped ${id}:${meta}`);
  w.put(x, y, z, m.id, m.meta, false);
};

function replay(r) {
  const w = new World('bonemeal3-' + r.name, r.biome === 4 ? 'forest' : 'meadow', 11);
  for (let x = OX - 9; x <= OX + 9; x++) for (let z = OZ - 9; z <= OZ + 9; z++) for (let y = 11; y <= 36; y++) {
    if (y < 19) place(w, x, y, z, 1, 0); else if (y === 19) place(w, x, y, z, r.soil, 0); else place(w, x, y, z, 0, 0);
  }
  const cy = (r.cy ?? 64) + DY;
  place(w, OX, cy, OZ, r.block, r.meta);
  for (const [x, y, z, id, meta] of r.extra) place(w, OX + x, y + DY, OZ + z, id, meta);
  const seed = BigInt(r.seed), rand = new JavaRandom(seed);
  // The trees' and the grass' own Randoms are seeded differently on purpose: only the world Random passed in may be used.
  const other = new JavaRandom(seed ^ 0x5deece66dn);
  const host = { world: w, rand, grassRandom: other, trees: new Trees(w, { random: other }), farming: new Farming(w), flowers: { yellow: YELLOW_FLOWER, red: RED_FLOWER } };
  return { w, out: useBoneMeal(host, OX, cy, OZ), rand, cy };
}

test('grass block and sapling bone meal replay the executed cells and world Random draw counts', () => {
  const picked = reference.records.filter(r => /^(grass|sapling)/.test(r.name));
  assert.ok(picked.length >= 100, 'records ' + picked.length);
  let grown = 0, gateFailed = 0, planted = 0;
  for (const r of picked) {
    const { w, out, rand, cy } = replay(r), label = `${r.name} seed ${r.seed}`;
    assert.equal(out.used, r.returned, `${label}: used`);
    const expect = new Map();
    for (const [x, y, z, id, meta] of r.sets) expect.set(`${x},${y},${z}`, [id, meta]);
    for (const [k, [id, meta]] of expect) {
      const [x, y, z] = k.split(',').map(Number);
      assert.deepEqual(native(w, OX + x, y + DY, OZ + z), [id, meta], `${label}: cell ${k}`);
    }
    assert.deepEqual(native(w, OX, cy, OZ), r.here, `${label}: clicked cell`);
    assert.equal(rand.nextInt(1000000), r.next, `${label}: world Random draws`);
    if (r.name.startsWith('sapling-marked') && r.sets.some(s => s[3] === 17 || s[3] === 162)) grown++;
    if (r.name.startsWith('sapling') && r.sets.length === 0) gateFailed++;
    if (r.name.startsWith('grass') && r.sets.length) planted++;
  }
  assert.ok(grown >= 10 && gateFailed >= 10 && planted >= 10, `coverage ${grown} ${gateFailed} ${planted}`);
});

test('a world Random passed in is the only stream a sapling or grass block touches', () => {
  const w = new World('bonemeal3-streams', 'meadow', 11);
  for (let x = 54; x <= 74; x++) for (let z = 54; z <= 74; z++) for (let y = 11; y <= 36; y++) place(w, x, y, z, y < 19 ? 1 : y === 19 ? 2 : 0, 0);
  place(w, 64, 20, 64, 6, 0);
  const own = new JavaRandom(7n), twin = new JavaRandom(7n), world = new JavaRandom(99n), ref = new JavaRandom(99n);
  const trees = new Trees(w, { random: own });
  const out = useBoneMeal({ world: w, trees, farming: new Farming(w), flowers: { yellow: YELLOW_FLOWER, red: RED_FLOWER }, rand: world }, 64, 20, 64);
  assert.equal(out.used, true);
  assert.equal(own.nextInt(1 << 30), twin.nextInt(1 << 30), 'the tree Random was not drawn from');
  assert.equal(trees.random, own, 'the tree Random is restored');
  place(w, 60, 19, 60, 2, 0);
  const grassOwn = new JavaRandom(3n), grassTwin = new JavaRandom(3n);
  useBoneMeal({ world: w, trees, farming: new Farming(w), flowers: { yellow: YELLOW_FLOWER, red: RED_FLOWER }, grassRandom: grassOwn, rand: world }, 60, 19, 60);
  assert.equal(grassOwn.nextInt(1 << 30), grassTwin.nextInt(1 << 30), 'the grass Random was not drawn from');
  assert.notEqual(world.nextInt(1 << 30), ref.nextInt(1 << 30), 'the world Random advanced');
});

// ---- the dispenser ----
function dispenseWith(block, meta, { host = {}, damage = 15, count = 3, seed = 1n } = {}) {
  const w = new World('bonemeal3-dispense', 'meadow', 11);
  for (let x = 54; x <= 74; x++) for (let z = 54; z <= 74; z++) for (let y = 11; y <= 36; y++) place(w, x, y, z, y < 19 ? 1 : y === 19 ? 2 : 0, 0);
  place(w, 65, 20, 64, block, meta);
  const rand = new JavaRandom(seed), aux = [];
  const trees = new Trees(w, { random: new JavaRandom(5n) }), farming = new Farming(w), spawned = [];
  const ctx = { world: w, trees, farming, flowers: { yellow: YELLOW_FLOWER, red: RED_FLOWER }, items: { spawn: (...a) => spawned.push(a) } };
  const eng = new Dispensing({ aux: (id, x, y, z, data) => aux.push([id, data]), boneMeal: (x, y, z, o, r) => useBoneMeal({ ...ctx, rand: r }, x, y, z).used, ...host });
  const view = { rand, getBlock: (x, y, z) => toOriginal(w.get(x, y, z), w.getMeta(x, y, z))?.[0] ?? 0, getBlockMetadata: (x, y, z) => toOriginal(w.get(x, y, z), w.getMeta(x, y, z))?.[1] ?? 0 };
  const stack = makeStack(351, count, damage);
  const out = eng.dispense(view, 64, 20, 64, 5, stack); // facing 5: east
  return { w, aux, stack: out, spawned, rand };
}

test('the dispenser fertilises mushrooms, cocoa, double plants and grass through the IGrowable path: stack spent, aux 2005 data 0, click 1000', () => {
  for (const [block, meta] of [[39, 0], [40, 0], [127, 0], [31, 1]]) {
    const r = dispenseWith(block, meta);
    assert.equal(r.stack.count, 2, `${block}: one bone meal used`);
    assert.ok(r.aux.some(a => a[0] === 2005 && a[1] === 0), `${block}: 2005`);
    assert.ok(r.aux.some(a => a[0] === 1000), `${block}: click`);
  }
  assert.deepEqual(native(dispenseWith(127, 0).w, 65, 20, 64), [127, 4]);
  assert.deepEqual(native(dispenseWith(31, 1).w, 65, 20, 64), [175, 2]);
  assert.equal(dispenseWith(175, 0).spawned.length, 1, 'a sunflower drops itself');
});

test('a refused block keeps the stack, sends no 2005 and turns the click into 1001 (the shared flag); gate failures still spend the stack', () => {
  const r = dispenseWith(83, 0); // sugar cane is not IGrowable
  assert.equal(r.stack.count, 3);
  assert.ok(!r.aux.some(a => a[0] === 2005));
  assert.ok(r.aux.some(a => a[0] === 1001) && !r.aux.some(a => a[0] === 1000));
  // A mushroom whose 40 % gate fails (some seed in 1..40) is still spent and sparkles.
  let failed = 0;
  for (let seed = 1n; seed <= 40n; seed++) {
    const d = dispenseWith(39, 0, { seed });
    assert.equal(d.stack.count, 2);
    if (native(d.w, 65, 20, 64)[0] === 39) failed++;
  }
  assert.ok(failed > 5);
  // Other dyes are thrown as items: no fertilising.
  const dye = dispenseWith(39, 0, { damage: 4 });
  assert.ok(!dye.aux.some(a => a[0] === 2005));
});

test('the dispenser hooks in single player and on the server route through useBoneMeal with the dispenser world Random', () => {
  const read = f => readFileSync(new URL(f, import.meta.url), 'utf8');
  assert.match(read('./main.js'), /boneMeal: \(x, y, z, original, rand\) => \{ const g = useBoneMeal\(/);
  assert.match(read('./multiplayer/server-container-ticks.js'), /boneMeal: \(x, y, z, original, rand\) => \{ const g = useBoneMeal\(/);
});
