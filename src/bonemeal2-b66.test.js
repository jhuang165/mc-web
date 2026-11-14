// Batch 66 (bonemeal2): bone meal on every IGrowable of 1.7.10, replayed against the executed ItemDye.func_150919_a records (public/research/bone-meal-reference.json,
// tools/probes/BoneMealProbe.java), and the server wiring (use stat, S28 2005 sparkles).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World, DYE } from './world.js';
import { Trees } from './trees.js';
import { Farming } from './farming.js';
import { JavaRandom } from './java-random.js';
import { toOriginal, fromOriginal } from './block-registry.js';
import { useBoneMeal, sparkleHeight } from './bone-meal.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { useOnBlock } from './multiplayer/server-use.js';
import { makeStack } from './inventory.js';
import { STAT } from './stats.js';

const reference = JSON.parse(readFileSync(new URL('../public/research/bone-meal-reference.json', import.meta.url), 'utf8'));
const records = reference.records.filter(r => !/^(grass|sapling-marked)/.test(r.name)); // b67 added the grass and marked-sapling Random-stream records (bonemeal3-b67.test.js)
const OX = 64, OZ = 64, DY = -44; // the probe's y 64 is y 20 here (a plain World is 64 high)
const native = (w, x, y, z) => toOriginal(w.get(x, y, z), w.getMeta(x, y, z)) ?? [0, 0];
const place = (w, x, y, z, id, meta) => {
  const m = id === 0 ? { id: 0, meta: 0 } : fromOriginal(id, meta);
  assert.ok(id === 0 || m?.exact, `mapped ${id}:${meta}`);
  w.put(x, y, z, m.id, m.meta, false);
};

function replay(r) {
  const w = new World('bonemeal2-' + r.name);
  for (let x = OX - 9; x <= OX + 9; x++) for (let z = OZ - 9; z <= OZ + 9; z++) for (let y = 11; y <= 36; y++) {
    if (y < 19) place(w, x, y, z, 1, 0); else if (y === 19) place(w, x, y, z, r.soil, 0); else place(w, x, y, z, 0, 0);
  }
  place(w, OX, 64 + DY, OZ, r.block, r.meta);
  for (const [x, y, z, id, meta] of r.extra) place(w, OX + x, y + DY, OZ + z, id, meta);
  const seed = BigInt(r.seed), rand = new JavaRandom(seed), spawned = [];
  const host = { world: w, rand, trees: new Trees(w, { random: new JavaRandom(seed) }), farming: new Farming(w), items: { spawn: (stack, x, y, z, o) => spawned.push({ stack, x, y, z, o }) } };
  const out = useBoneMeal(host, OX, 64 + DY, OZ);
  return { w, out, rand, spawned, host };
}

test('the bone meal replay matches every executed ItemDye.func_150919_a record: used flag, resulting cells, drops and world Random draws', () => {
  assert.ok(records.length > 200);
  let grew = 0, dropped = 0, failedGen = 0;
  for (const r of records) {
    const { w, out, rand, spawned } = replay(r), label = `${r.name} seed ${r.seed}`;
    assert.equal(out.used, r.returned, `${label}: used`);
    assert.equal(r.stack, r.returned ? 0 : 1, `${label}: the original spends the stack exactly when it returns true`);
    // The final cell of every write the original made (last write wins), and the clicked cell.
    const expect = new Map();
    for (const [x, y, z, id, meta] of r.sets) expect.set(`${x},${y},${z}`, [id, meta]);
    for (const [k, [id, meta]] of expect) {
      const [x, y, z] = k.split(',').map(Number), got = native(w, OX + x, y + DY, OZ + z);
      assert.deepEqual(got, [id, meta], `${label}: cell ${k}`);
    }
    assert.deepEqual(native(w, OX, 64 + DY, OZ), r.here, `${label}: clicked cell`);
    if (r.block === 6) { // sapling: the gate and the mark come from the trees' own Random (same seed): 45 %, then meta | 8
      continue;
    }
    assert.equal(rand.nextInt(1000000), r.next, `${label}: world Random draws`);
    assert.equal(spawned.length, r.items.length, `${label}: drops`);
    r.items.forEach(([id, count, damage, x, y, z, delay], i) => {
      const s = spawned[i];
      assert.equal(s.stack.id, 69); assert.equal(id, 175);
      assert.equal(s.stack.count, count); assert.equal(s.stack.damage, damage);
      assert.equal(s.x - OX, x, `${label}: drop x`); assert.equal(s.y - DY, y, `${label}: drop y`); assert.equal(s.z - OZ, z, `${label}: drop z`);
      assert.equal(s.o.delay, delay);
    });
    if (r.name.startsWith('mushroom') && r.here[0] >= 99) grew++;
    if (r.name.startsWith('mushroom') && r.sets.length === 2) failedGen++;
    if (r.items.length) dropped++;
  }
  assert.ok(grew >= 5 && failedGen >= 3 && dropped >= 8, `coverage ${grew} ${failedGen} ${dropped}`);
});

// ---- the dedicated server ----
const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
function fixture() {
  const world = new World('bonemeal2-b66');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: false });
  const p = s.addPlayer('a', 'ax', key(1));
  p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  s.input('a', { type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
  p.survival.inventory.main[0] = makeStack(DYE, 40, 15); p.survival.inventory.current = 0;
  return { s, p };
}
const click = (s, p, x, y, z) => useOnBlock(s, p, { block: [x, y, z], adjacent: [x, y + 1, z] }, DYE);
const used = p => p.stats.get(`stat.useItem.${DYE}`) ?? 0;
const put = (w, x, y, z, id, meta) => place(w, x, y, z, id, meta);

test('the server fertilises a mushroom (stack spent and counted whether or not it grows), tall grass, a double plant (drops itself) and cocoa; dead bushes, reeds and full cocoa are refused', () => {
  const { s, p } = fixture();
  put(s.world, 64, 10, 64, 40, 0);
  assert.equal(click(s, p, 64, 10, 64), true);
  assert.equal(used(p), 1);
  assert.equal(p.survival.held.count, 39);
  put(s.world, 66, 10, 64, 31, 1); // tall grass on the grass floor (web id 1)
  assert.equal(click(s, p, 66, 10, 64), true);
  assert.deepEqual(native(s.world, 66, 10, 64), [175, 2]);
  assert.deepEqual(native(s.world, 66, 11, 64), [175, 8]);
  put(s.world, 68, 10, 64, 31, 0); // dead bush
  const before = p.survival.held.count;
  assert.equal(click(s, p, 68, 10, 64), false);
  assert.equal(p.survival.held.count, before);
  put(s.world, 70, 10, 64, 175, 0); put(s.world, 70, 11, 64, 175, 8); // a sunflower
  const items = s.items.items.length;
  assert.equal(click(s, p, 70, 10, 64), true);
  assert.equal(s.items.items.length, items + 1);
  assert.equal(s.items.items.at(-1).stack.id, 69);
  put(s.world, 72, 10, 64, 175, 2); put(s.world, 72, 11, 64, 175, 8); // double tall grass: refused
  assert.equal(click(s, p, 72, 10, 64), false);
  put(s.world, 74, 10, 64, 127, 0);
  assert.equal(click(s, p, 74, 10, 64), true);
  assert.deepEqual(native(s.world, 74, 10, 64), [127, 4]);
  assert.equal(click(s, p, 74, 10, 64), true);
  assert.equal(click(s, p, 74, 10, 64), false, 'age 2 is full');
  put(s.world, 76, 10, 64, 83, 0); // sugar cane
  assert.equal(click(s, p, 76, 10, 64), false);
});

test('a used bone meal sends S28 2005 to players of the dimension within 64 blocks, and the client handler draws the sparkles', async () => {
  const { s, p } = fixture();
  const far = s.addPlayer('b', 'bx', key(2));
  far.position.copy({ x: 64.5 + 200, y: 10, z: 64.5 }); far.previous.copy(far.position);
  put(s.world, 64, 10, 64, 39, 0);
  p.itemsOut = []; far.itemsOut = [];
  assert.equal(click(s, p, 64, 10, 64), true);
  assert.deepEqual(p.itemsOut.filter(m => m.type === 'aux').map(m => m.events[0]), [{ id: 2005, x: 64, y: 10, z: 64, data: 0 }]);
  assert.equal(far.itemsOut.filter(m => m.type === 'aux').length, 0);
  const { dispenserAux } = await import('./multiplayer/client-containers.js');
  const got = [];
  assert.equal(dispenserAux({ id: 2005, x: 1, y: 2, z: 3, data: 0 }, { sparkle: (...a) => got.push(a) }), true);
  assert.deepEqual(got, [[1, 2, 3]]);
});

test('sparkle heights follow the bytecode-read block bounds', () => {
  const w = new World('bonemeal2-height');
  const at = (id, meta) => { place(w, 40, 20, 40, id, meta); return sparkleHeight(w, 40, 20, 40); };
  assert.equal(at(6, 0), Math.fround(0.8));
  assert.equal(at(31, 1), Math.fround(0.8));
  assert.equal(at(39, 0), Math.fround(Math.fround(0.2) * 2));
  assert.equal(at(59, 0), 0.25);
  assert.equal(at(104, 3), Math.fround(8 / 16));
  assert.equal(at(127, 4), 0.75);
  assert.equal(at(175, 0), 1);
  assert.equal(at(99, 10), 1);
});
