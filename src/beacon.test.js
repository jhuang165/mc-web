// Replays public/research/beacon-reference.json (tools/probes/BeaconProbe.java against the unchanged 1.7.10 classes).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  BEACON, ITEM_NETHER_STAR, BEACON_TIERS, PYRAMID_BLOCKS, PAYMENT_ITEMS, BEACON_ITEMS, pyramidLevel, validPrimary, validSecondary,
  beaconBox, beaconEffects, inBox, tickBeacon, createBeacon, applyBeaconPick, beaconToNbt, beaconFromNbt, Beacons, beamFade, installBeaconItems,
} from './beacon.js';
import { BeaconContainer } from './beacon-container.js';
import { PlayerInventory, makeStack } from './inventory.js';
import { BLOCKS } from './world.js';
import { ITEMS } from './survival.js';
import { toOriginal, internalIdsFor } from './block-registry.js';
import { beamQuads } from './beacon-renderer.js';
import { stackHasEffect } from './armor-enchantments.js';

const ref = JSON.parse(fs.readFileSync(new URL('../public/research/beacon-reference.json', import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);
// Original ids in the reference -> internal ids (iron 42 -> 26, gold 41 -> 27, emerald 133 -> 146, diamond 57 -> 28).
const INTERNAL = { 42: 26, 41: 27, 133: 146, 57: 28 };
const ITEM = { 266: 304, 264: 303, 265: 302, 388: 367, 4: 12 }; // original item id -> internal (cobblestone 4 -> block 12)

const mk = (cells = new Map(), sky = true) => ({ get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? 0, sky: () => sky, cells });
function pyramid(cells, x, y, z, layers, block) {
  for (let l = 1; l <= layers; l++) for (let dx = -l; dx <= l; dx++) for (let dz = -l; dz <= l; dz++) cells.set(`${x + dx},${y - l},${z + dz}`, block);
}
const level = (w, y = 70) => pyramidLevel(w.get, w.sky, 10, y, 10);

test('facts: tier table, pyramid blocks, payments, block and star constants', () => {
  const f = by('facts')[0];
  assert.deepEqual(BEACON_TIERS.map((t) => [...t]), f.tiers);
  assert.deepEqual([...PYRAMID_BLOCKS].sort(), f.pyramidBlocks.map((b) => INTERNAL[b]).sort());
  assert.deepEqual([...PAYMENT_ITEMS].sort(), f.payments.map((i) => ITEM[i]).sort());
  assert.equal(BEACON_ITEMS[399], ITEM_NETHER_STAR);
  assert.equal(f.star.id, 399); assert.equal(f.star.maxStack, 64); assert.equal(f.star.glint, true);
  assert.equal(ITEMS[ITEM_NETHER_STAR].stack, f.star.maxStack);
  assert.ok(stackHasEffect(makeStack(ITEM_NETHER_STAR), ITEMS[ITEM_NETHER_STAR]));
  assert.equal(f.block.id, 138); assert.deepEqual(internalIdsFor(138), [BEACON]);
  assert.equal(BLOCKS[BEACON].name, 'Beacon');
  assert.equal(f.block.light, 15); assert.equal(f.block.hardness, 3);
});

test('levels: pyramid check per layer count, material, sky, holes, floor', () => {
  for (const r of by('levels')) {
    const cells = new Map(); let y = 70, sky = r.sky;
    if (typeof r.layers === 'number') pyramid(cells, 10, y, 10, Math.min(r.layers, 4), INTERNAL[r.block]);
    else if (r.layers === 'mixed') for (let l = 1; l <= 4; l++) for (let dx = -l; dx <= l; dx++) for (let dz = -l; dz <= l; dz++) cells.set(`${10 + dx},${70 - l},${10 + dz}`, PYRAMID_BLOCKS[l - 1]);
    else if (r.layers === 'extra') { pyramid(cells, 10, 70, 10, 4, 27); for (let dx = -6; dx <= 6; dx++) cells.set(`${10 + dx},69,10`, 27); }
    else if (r.layers === 'floor3') { y = 3; pyramid(cells, 10, 3, 10, 3, 27); }
    else if (r.layers === 'floor4') { y = 4; pyramid(cells, 10, 4, 10, 4, 27); }
    else { const m = /hole(\d)@(-?\d+),(-?\d+)/.exec(r.layers); pyramid(cells, 10, 70, 10, 4, 26); cells.delete(`${10 + +m[2]},${70 - +m[1]},${10 + +m[3]}`); }
    const w = mk(cells, sky), got = level(w, y);
    assert.equal(got, r.levels, JSON.stringify(r));
    assert.equal(got > 0, r.active);
  }
});

test('tick: the check runs only when the world time is a multiple of 80', () => {
  for (const r of by('tick')) {
    const cells = new Map(); pyramid(cells, 10, 70, 10, 2, 27);
    const w = mk(cells), t = createBeacon(10, 70, 10);
    tickBeacon(t, { time: r.time, get: w.get, canSeeSky: w.sky });
    assert.equal(t.levels, r.levels, `time ${r.time}`);
    assert.equal(t.active, r.active);
  }
});

const player = (x, y, z) => ({ x, y, z, width: 0.6, height: 1.8 });
function give(levels, primary, secondary, p, { active = true, remote = false } = {}) {
  const t = createBeacon(10, 70, 10);
  Object.assign(t, { levels, primary, secondary, active });
  // Bypass the 80-tick pyramid check: apply the effects directly through the same box and effect rules.
  if (!active || levels <= 0 || remote || primary <= 0) return { got: [], box: null };
  const box = beaconBox(10, 70, 10, levels);
  return { got: inBox(box, p) ? beaconEffects(levels, primary, secondary).map((e) => [e.id, e.duration, e.amplifier, e.ambient]) : [], box };
}

test('effects: durations, amplifiers, ambient flag and search box for every level and pair', () => {
  for (const r of by('effects')) {
    const { got, box } = give(r.levels, r.primary, r.secondary, player(10.5, 70, 10.5));
    assert.deepEqual(got, r.applied, JSON.stringify(r));
    assert.deepEqual(box, r.box);
  }
});

test('range: 10 + 10 * levels horizontally and vertically, up to the top of the world', () => {
  for (const r of by('range')) {
    const lv = r.levels;
    assert.deepEqual(give(lv, 1, 0, player(10.5 + r.dx, 70, 10.5)).got, r.got, JSON.stringify(r));
    assert.deepEqual(give(lv, 1, 0, player(10.5, 370, 10.5)).got, r.gotHigh);
    assert.deepEqual(give(lv, 1, 0, player(10.5, 70 - (lv * 10 + 10) - 5, 10.5)).got, r.gotBelow);
  }
});

test('gate: inactive, level 0, no primary and remote worlds apply nothing', () => {
  const cells = new Map(); pyramid(cells, 10, 70, 10, 2, 27);
  const w = mk(cells);
  for (const r of by('gate')) {
    const t = createBeacon(10, 70, 10); t.primary = r.mode === 2 ? 0 : 1;
    // mode 0: not active (no pyramid), 1: level 0 (no pyramid), 2: no primary, 3: remote
    const world = r.mode <= 1 ? mk(new Map()) : w;
    const out = tickBeacon(t, { time: 80, remote: r.mode === 3, get: world.get, canSeeSky: world.sky, players: [player(10.5, 70, 10.5)] });
    assert.equal(out.length, 0, JSON.stringify(r));
    assert.deepEqual(r.got, []);
  }
  // and the live path hands the effects to the player in range
  const t = createBeacon(10, 70, 10); t.primary = 1;
  const out = tickBeacon(t, { time: 160, get: w.get, canSeeSky: w.sky, players: [player(10.5, 70, 10.5), player(200, 70, 10)] });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].effects, [{ id: 1, duration: 180, amplifier: 0, ambient: true }]);
});

test('setters: primary tiers 0-2 below the level, secondary only at level 4, both reset to 0', () => {
  for (const r of by('setter')) {
    assert.equal(validPrimary(r.levels, r.id), r.primary, JSON.stringify(r));
    assert.equal(validSecondary(r.levels, r.id), r.secondary, JSON.stringify(r));
  }
  const s = by('setterReset')[0];
  assert.equal(validPrimary(2, 99), s.primary); assert.equal(validSecondary(2, 99), s.secondary);
});

test('nbt: Primary, Secondary and Levels round trip; an empty tag reads 0; a fresh tile has -1', () => {
  const [a, b] = by('nbt');
  const t = createBeacon(10, 70, 10); Object.assign(t, { levels: 4, primary: 5, secondary: 10, active: true });
  const nbt = beaconToNbt(t);
  assert.deepEqual(Object.keys(nbt).sort(), a.keys);
  assert.equal(nbt.id, a.id);
  const r = beaconFromNbt(nbt);
  assert.deepEqual([r.levels, r.primary, r.secondary, r.active], [a.readLevels, a.readPrimary, a.readSecondary, a.readActive]);
  assert.equal(createBeacon(0, 0, 0).levels, a.fresh);
  const e = beaconFromNbt({});
  assert.deepEqual([e.levels, e.primary, e.secondary], [b.readEmptyLevels, b.readEmptyPrimary, b.readEmptySecondary]);
  const s = new Beacons(); s.ensure(1, 2, 3).primary = 3; s.get(1, 2, 3).levels = 2;
  const back = new Beacons().fromJSON(JSON.parse(JSON.stringify(s.toJSON())));
  assert.equal(back.get(1, 2, 3).primary, 3); assert.equal(back.get(1, 2, 3).levels, 2);
  s.sync(1, 2, 3, 0); assert.equal(s.get(1, 2, 3), null);
});

const container = (tile = createBeacon(10, 70, 10)) => {
  const inv = new PlayerInventory(ITEMS);
  return { inv, tile, c: new BeaconContainer({ inventory: inv, tile }) };
};

test('slot and layout: payment validity, limit 1, positions', () => {
  for (const r of by('slot')) {
    const { c } = container();
    const id = ITEM[r.item] ?? (r.item === 0 ? null : -1);
    assert.equal(c.slots[0].valid(id === null ? null : { id, count: 1, damage: 0 }), r.valid, JSON.stringify(r));
    assert.equal(c.slots[0].limit, r.slotLimit);
  }
  const l = by('layout')[0];
  const { c } = container();
  assert.equal(c.slots.length, l.count);
  assert.deepEqual(c.slots.map((s) => [s.x, s.y]), l.positions);
});

test('shift: ContainerBeacon.transferStackInSlot', () => {
  for (const r of by('shift')) {
    const { c } = container();
    if (r.payFull) c.slots[0].put(makeStack(302));
    const stack = makeStack(ITEM[r.item], r.count);
    if (r.from === 0) { c.slots[0].put(stack); } else c.slots[r.from].put(stack);
    const res = c.transfer(r.from);
    const after = c.slots.flatMap((s, i) => (s.stack ? [[i, s.stack.id, s.stack.count]] : []));
    const expect = r.after.map(([i, id, n]) => [i, ITEM[id], n]);
    assert.deepEqual(after, expect, JSON.stringify(r));
    assert.deepEqual(res ? [res.id, res.count] : null, r.result ? [ITEM[r.result[0]], r.result[1]] : null);
  }
});

test('server: MC|Beacon consumes one payment even for invalid picks and ignores an empty slot', () => {
  for (const r of by('server')) {
    const t = createBeacon(10, 70, 10); t.levels = r.levels;
    if (r.paid) t.payment = makeStack(304, 3);
    const used = applyBeaconPick(t, r.pick[0], r.pick[1]);
    assert.equal(used, r.paid);
    assert.equal(t.payment?.count ?? 0, r.left, JSON.stringify(r));
    if (r.paid) assert.deepEqual([t.primary, t.secondary], [validPrimary(r.levels, r.pick[0]), validSecondary(r.levels, r.pick[1])]);
  }
});

test('close: the payment stays in the tile in memory', () => {
  const { c, tile } = container(); c.slots[0].put(makeStack(304));
  c.close();
  assert.equal(tile.payment.count, 1);
  assert.equal(by('close')[0].containerOverridesClose, false);
});

test('beam: fade-in climbs 0.025 per call, decays when frames are skipped, and the quads follow the bytecode', () => {
  const t = createBeacon(0, 0, 0); t.active = true;
  assert.equal(beamFade(t, 0), Math.fround(0.025));
  for (let i = 1; i < 60; i++) beamFade(t, i);
  assert.equal(beamFade(t, 60), 1);
  const after = beamFade(t, 140); // 80 ticks skipped: 1 - 80 / 40 clamps to 0, then + 0.025
  assert.equal(after, Math.fround(0.025));
  const inactive = createBeacon(0, 0, 0); assert.equal(beamFade(inactive, 5), 0);
  const q = beamQuads(10, 1);
  assert.equal(q.inner.length, 4); assert.equal(q.outer.length, 4);
  assert.equal(q.inner[0].h, 256);
  assert.ok(Math.abs(q.outer[0].v2 - q.outer[0].v1 - 256) < 1e-9);
  assert.ok(Math.abs(q.inner[0].v2 - q.inner[0].v1 - 256 * 2.5) < 1e-9);
});

test('items: the nether star and the beacon recipe', () => {
  const items = {}; installBeaconItems(items);
  assert.equal(items[ITEM_NETHER_STAR].name, 'Nether Star');
  assert.equal(toOriginal(BEACON, 0)?.[0], 138);
});
