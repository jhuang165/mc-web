// Batch 54 (effects2): replays of tools/probes/MobEffects2Probe.java, the unchanged 1.7.10 classes (public/research/mob-effects-reference.json):
// b54order (effect map order), b54import (what a load keeps), b54inst (instant health and damage), b54hb (health boost modifier), b54jump (jump boost).
import test from 'node:test';
import assert from 'node:assert/strict';
import reference from '../public/research/mob-effects-reference.json' with { type: 'json' };
import { decodeNbt, NBT } from './nbt.js';
import { javaMobFromNbt } from './java-mobs.js';
import { EntityWorld, jump } from './entities.js';
import { addMobEffect, tickMobEffects, readMobEffects, effectsInMapOrder } from './mob-effects.js';
import { maxHealthOf } from './mob-riding.js';
import { livingAttributesNbt } from './mob-attribute-list.js';
import { JavaRandom } from './java-random.js';

const TYPE = { Pig: 'pig', Zombie: 'zombie', Skeleton: 'skeleton', PigZombie: 'pigman', Villager: 'villager', Spider: 'spider', Sheep: 'sheep', Wolf: 'wolf', Slime: 'slime',
  EntityHorse: 'horse', Chicken: 'chicken', Bat: 'bat', Cow: 'cow', Squid: 'squid', Blaze: 'blaze', SnowMan: 'snow_golem', LavaSlime: 'magma_cube', Ozelot: 'ocelot' };
const flat = { get: () => 0, getMeta: () => 0, solid: () => false, surface: () => 0, spawn: () => ({ x: 0, y: 0, z: 0 }), numericSeed: 1 };
const tagOf = (hex) => decodeNbt(Uint8Array.from(hex.match(/../g).map((b) => parseInt(b, 16)))).tag.value;
const size = { width: 0.6, height: 1.8 };
const rng = () => new JavaRandom(7);
const row = (x) => [x.id, x.amplifier, x.duration, x.ambient ? 1 : 0];
const mobWorld = (kind, extra = {}) => { const w = new EntityWorld(flat, [{ type: TYPE[kind], x: 64.5, y: 1, z: 64.5, health: 1, ...extra }], () => 0.5); return [w, w.entities[0]]; };
const baseOf = (e) => ({ pig: 10, zombie: 20, skeleton: 20, pigman: 20, villager: 20, spider: 16, sheep: 8, wolf: 8, slime: 1, horse: 53, magma_cube: 1, ocelot: 10 })[e.type];
const upto = (rows) => rows;

test('the effect list a mob writes is in HashMap order: buckets, insertion order inside one, a table that grows at 13 entries and never shrinks', () => {
  assert.equal(reference.order.length, 52);
  let wide = 0;
  for (const r of reference.order) {
    assert.equal(r.error, null);
    const e = { type: 'pig', effects: [], health: 10 };
    for (const [op, a, b, c] of r.ops) {
      if (op === 'put') { const at = e.effects.findIndex((x) => x.id === a); const entry = { id: a, amplifier: b, duration: c }; if (at >= 0) e.effects[at] = entry; else e.effects.push(entry); if (e.effects.length > 12) e.effectsWide = true; }
      else if (op === 'add') addMobEffect(e, a, c, b);
      else for (let i = 0; i < a; i++) tickMobEffects(e, size, 10, rng(), undefined, undefined);
    }
    assert.deepEqual(effectsInMapOrder(e).map(row), r.effects, `seed ${r.seed}`);
    if (e.effectsWide) wide++;
  }
  assert.ok(wide >= 4, 'some records grow the table');
});

test('a load keeps what the native reader keeps: list order, the last of a repeated id in the first one\'s place, any duration, ids 1 to 23 only', () => {
  const pig = reference.imports.find((r) => r.kind === 'Pig' && r.case === 0);
  const base = tagOf(pig.nbt);
  for (const r of reference.imports.filter((x) => x.kind !== 'EntityHorse')) {
    const items = reference.importCases[r.case].map(([id, amplifier, duration, ambient]) => new Map([['Id', { type: NBT.BYTE, value: (id << 24) >> 24 }], ['Amplifier', { type: NBT.BYTE, value: (amplifier << 24) >> 24 }],
      ['Duration', { type: NBT.INT, value: duration }], ['Ambient', { type: NBT.BYTE, value: ambient }]]));
    const tag = new Map(base);
    tag.set('id', { type: NBT.STRING, value: r.kind });
    tag.set('ActiveEffects', { type: NBT.LIST, value: { elementType: NBT.COMPOUND, items } });
    const rec = javaMobFromNbt(tag, { shiftX: 0, shiftZ: 0 });
    assert.ok(rec, r.kind);
    const kept = readMobEffects(rec.effects);
    assert.deepEqual(effectsInMapOrder({ effects: [...kept] }).map(row), r.effects, `${r.kind} case ${r.case}`);
    // the first update drops a spent effect and counts the others down
    const e = { type: TYPE[r.kind], effects: kept, health: 10 };
    tickMobEffects(e, size, 10, rng(), undefined, undefined);
    assert.deepEqual(effectsInMapOrder(e).map(row), r.afterTick, `${r.kind} case ${r.case} tick`);
  }
});

test('instant health and instant damage fire on every update while time is left, reversed for the undead, through the hurt window', () => {
  assert.equal(reference.instant.length, 144);
  for (const r of reference.instant) {
    const [w, e] = mobWorld(r.kind, { health: r.health0 });
    e.effects = readMobEffects([{ id: r.id, amplifier: r.amp, duration: r.dur }]);
    e.health = r.health0;
    r.ticks.forEach((step, i) => {
      tickMobEffects(e, size, () => maxHealthOf(e, baseOf(e)), rng(), undefined, (m, n, name) => w.attackEntityFrom(m, n, { name }));
      assert.equal(e.health, step.health, `${r.kind} ${r.id}/${r.amp}/${r.dur} from ${r.health0} tick ${i + 1}`);
      assert.deepEqual(e.effects.map((x) => [x.id, x.amplifier, x.duration, 0]), step.effects, `${r.kind} ${r.id} effects tick ${i + 1}`);
    });
  }
});

test('health boost adds 4 * (amplifier + 1) to the maximum when added, is clamped away on a re-add and at its end, and a load alone adds nothing', () => {
  assert.equal(reference.healthBoost.length, 63);
  for (const r of reference.healthBoost) {
    const extra = r.kind === 'Slime' ? { size: Math.sqrt(r.max0) } : r.kind === 'EntityHorse' ? { horse: { maxHealth: r.max0, type: 0 } } : {};
    const [, e] = mobWorld(r.kind, { health: r.max0, ...extra });
    const max = () => maxHealthOf(e, baseOf(e));
    assert.equal(max(), r.max0, `${r.kind} base`);
    e.health = r.max0;
    const at = (step, label) => { assert.equal(max(), step.max, `${label} max`); assert.equal(e.health, step.health, `${label} health`); assert.deepEqual(effectsInMapOrder(e).map((x) => [x.id, x.amplifier, x.duration, 0]), step.effects, `${label} effects`); };
    const name = `${r.kind} ${r.mode} ${r.amp}`;
    if (r.mode === 'put') e.effects = readMobEffects([{ id: 21, amplifier: r.amp, duration: r.dur }]); else addMobEffect(e, 21, r.dur, r.amp);
    let i = 0;
    at(r.steps[i++], `${name} add`);
    e.health = max();
    at(r.steps[i++], `${name} fill`);
    if (r.mode === 'readd') {
      addMobEffect(e, 21, r.dur + 2, r.amp + 1); at(r.steps[i++], `${name} readd`);
      e.health = max(); addMobEffect(e, 21, r.dur + 10, 0); at(r.steps[i++], `${name} readdLower`);
      e.health = max(); at(r.steps[i++], `${name} fill again`);
    }
    for (let k = 0; k < r.dur + 14 && e.effects.some((x) => x.id === 21); k++) {
      tickMobEffects(e, size, max, rng(), undefined, undefined);
      const left = e.effects.find((x) => x.id === 21);
      if (k < 3 || !left || left.duration < 3) at(r.steps[i++], `${name} tick ${k}`);
    }
    at(r.steps[i++], `${name} end`);
    assert.equal(i, r.steps.length, name);
    // the modifier is not saved: the written Attributes carry no Modifiers, and the maxHealth base is the unboosted one
    const attrs = tagOf(r.nbt).get('Attributes').value.items;
    assert.ok(attrs.every((a) => !a.has('Modifiers')), `${name} saved modifiers`);
  }
});

test('the exported Attributes of a boosted mob hold no potion modifier and the unboosted base', () => {
  const [, e] = mobWorld('Pig', { health: 10 });
  addMobEffect(e, 21, 100, 1);
  assert.equal(maxHealthOf(e, 10), 18);
  const list = livingAttributesNbt(e, 'Pig');
  const max = list.value.items.find((a) => a.get('Name').value === 'generic.maxHealth');
  assert.equal(max.get('Base').value, 10);
  assert.equal(max.has('Modifiers'), false);
});

test('Jump Boost raises the mob jump by (amplifier + 1) * 0.1F, the magma cube ignores it, and a fall is shortened by it (executed jumps and falls)', () => {
  assert.equal(reference.jump.length, 91);
  for (const r of reference.jump) {
    const effects = r.amp === -1000 ? [] : [{ id: 8, amplifier: r.amp, duration: 100 }];
    const size = r.kind === 'LavaSlime' ? Math.round((r.plain - 0.41999998688697815) / 0.1) : undefined;
    const e = { type: TYPE[r.kind], effects, ...(size ? { size } : {}) };
    jump(e);
    assert.equal(e.vy, r.vy, `${r.kind} ${r.amp}`);
    if (r.kind === 'LavaSlime') assert.equal(r.vy, r.plain);
    if (r.kind === 'LavaSlime') continue;
    const [w, mob] = mobWorld(r.kind, { health: r.falls.length ? 1 : 1 });
    // EntityChicken, EntityBat, EntityOcelot, EntityBlaze and EntitySnowman override fall to nothing (executed: no damage at any distance); the walk's landing call skips them (entities.js).
    const noFall = ['chicken', 'bat', 'ocelot', 'blaze', 'snow_golem'].includes(mob.type);
    for (const f of r.falls) {
      if (noFall) { assert.equal(f.health, { chicken: 4, bat: 6, ocelot: 10, blaze: 20, snow_golem: 4 }[mob.type], `${r.kind} takes no fall damage`); continue; }
      mob.health = { pig: 10, ocelot: 10, cow: 10, squid: 10, spider: 16, wolf: 8, chicken: 4, bat: 6, snow_golem: 4 }[mob.type] ?? 20;
      mob.hurt = 0;
      mob.effects = effects.map((x) => ({ ...x }));
      w.fall(mob, f.distance);
      assert.equal(mob.health, f.health, `${r.kind} amp ${r.amp} fall ${f.distance}`);
    }
  }
});
