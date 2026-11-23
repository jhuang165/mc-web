// Batch 96 entnbt96: player effects without modifiers on load, the saved potion modifiers, Motion, and SleepTimer, against a real EntityPlayerMP
// (public/research/entnbt96-reference.json from tools/probes/Entnbt96Probe.java, tools/verify-entnbt96.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NBT, decodeNbt } from './nbt.js';
import { javaPlayerFromNbt } from './level-dat.js';
import { levelNbt } from './region-export.js';
import { savedAttributeModifiers, loadedMotion, savedMotion } from './player-nbt.js';
import { Effects } from './status-effects.js';
import { Survival } from './survival.js';
import { BedSleep } from './bed.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/entnbt96-reference.json', import.meta.url), 'utf8'));
const level = JSON.parse(readFileSync(new URL('../public/research/level-dat-reference.json', import.meta.url), 'utf8'));
const fromHex = (h) => decodeNbt(Uint8Array.from(h.match(/../g).map((b) => parseInt(b, 16)))).tag.value;
const plain = (t) => {
  const v = t.value;
  if (t.type === NBT.COMPOUND) return Object.fromEntries([...v].map(([k, x]) => [k, plain(x)]));
  if (t.type === NBT.LIST) return v.items.map((i) => plain({ type: v.elementType, value: i }));
  return v;
};
const row = (name, stage) => ref.players.find((r) => r.name === name && r.stage === stage);
const W = { javaSeed: 1n, originX: 0, originZ: 0, spawn: () => ({ x: 0, y: 64, z: 0 }) };
const rich = () => fromHex(level.players.find((c) => c.name === 'rich').written);
const doubles = (...v) => ({ type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: v } });
// Parses the executed `Attributes=[...]` text into {attribute: [{name, amount, operation, most, least}]} in written order.
function nativeAttributes(out) {
  const text = out.split(';').find((x) => x.startsWith('Attributes=')), found = {};
  for (const a of text.matchAll(/\{Base:[^,]+,(?:Modifiers:\[(.*?)\],)?Name:"([^"]+)",\}/g)) {
    found[a[2]] = [...(a[1] ?? '').matchAll(/\{UUIDMost:(-?\d+)L,UUIDLeast:(-?\d+)L,Amount:([^,]+)d,Operation:(\d),Name:"([^"]+)",\}/g)]
      .map((m) => ({ most: BigInt(m[1]), least: BigInt(m[2]), amount: Number(m[3]), operation: Number(m[4]), name: m[5] }));
  }
  return found;
}
const ATTRS = ['generic.maxHealth', 'generic.knockbackResistance', 'generic.movementSpeed', 'generic.attackDamage'];

test('every potion modifier the real player saves (name, amount, operation, UUID) is what the port writes for that effect', () => {
  assert.equal(ref.potions.length, 46);
  for (const { potion, amp, attrs } of ref.potions) {
    const native = nativeAttributes('Attributes=' + attrs), ported = {};
    for (const a of ATTRS) ported[a] = savedAttributeModifiers(a, 0, [{ id: potion, amplifier: amp, duration: 100 }]);
    for (const a of ATTRS) assert.deepEqual(ported[a], native[a] ?? [], `potion ${potion} amp ${amp} ${a}`);
  }
});

test('several effects, a held weapon and sprinting: the saved Modifiers keep the real list order (HashSet of every modifier)', () => {
  const combos = [[[1, 1], [2, 0]], [[18, 0], [5, 1]], [[1, 0], [2, 2], [5, 0], [18, 1], [21, 2]], [[18, 2], [5, 2], [1, 3], [2, 1], [21, 0]]];
  let rows = 0;
  combos.forEach((combo, c) => {
    for (const held of [0, 276, 257]) {
      const r = row(`combo${c}-held${held}`, 'applied'), native = nativeAttributes(r.out);
      for (const a of ATTRS) assert.deepEqual(savedAttributeModifiers(a, held, combo.map(([id, amplifier]) => ({ id, amplifier, duration: 100 }))), native[a] ?? [], `${r.name} ${a}`);
      rows++;
    }
  });
  assert.equal(rows, 12);
  // the sprint modifier is unsaved: its sprint rows list the same modifiers
  assert.deepEqual(nativeAttributes(row('combo2-held276-sprint', 'applied').out), nativeAttributes(row('combo2-held276', 'applied').out));
});

test('the port exports the potion modifiers of a session effect and none for a loaded (bare) one', () => {
  const session = plain(levelNbt({ mode: 'survival', player: { health: 20, effects: [{ id: 1, amplifier: 1, duration: 100 }, { id: 21, amplifier: 1, duration: 100 }] }, worldSpawn: [0, 64, 0] }, W).tag.value.get('Data').value.get('Player'));
  const speed = session.Attributes.find((a) => a.Name === 'generic.movementSpeed').Modifiers;
  assert.equal(speed.length, 1); assert.equal(speed[0].Name, 'potion.moveSpeed 1'); assert.equal(speed[0].Amount, 0.4000000059604645); assert.equal(speed[0].Operation, 2);
  assert.equal(session.Attributes.find((a) => a.Name === 'generic.maxHealth').Modifiers[0].Amount, 8);
  const bare = plain(levelNbt({ mode: 'survival', player: { health: 20, effects: [{ id: 1, amplifier: 1, duration: 100, bare: true }] }, worldSpawn: [0, 64, 0] }, W).tag.value.get('Data').value.get('Player'));
  assert.equal(bare.Attributes.every((a) => a.Modifiers === undefined), true);
  assert.equal(bare.ActiveEffects.length, 1);
});

test('an effect read from NBT is bare: native speed, strength and health boost do nothing until it is added again', () => {
  // executed: loaded speed stays 0.1 through the whole effect and after it ends; applied in the session it is 0.14 and returns to 0.1
  assert.equal(row('speed-loaded', 'load').live.startsWith('speed=0.10000000149011612'), true);
  assert.equal(row('speed-loaded', 'tick50').live.startsWith('speed=0.10000000149011612;'), true);
  assert.equal(row('speed-loaded', 'tick102').live.includes('effects=0'), true);
  assert.equal(row('speed-session', 'applied').live.startsWith('speed=0.14000000268220902'), true);
  assert.equal(row('speed-session', 'tick102').live.startsWith('speed=0.10000000149011612'), true);
  assert.equal(row('strength-loaded', 'load').live.includes('damage=1.0'), true);
  assert.equal(row('healthboost-loaded', 'load').live.includes('maxHealth=20.0'), true);
  assert.equal(row('healthboost-session', 'applied').live.includes('maxHealth=28.0'), true);
  const tag = rich(); // rich player: Speed II 600 ticks and Night Vision, no Modifiers saved
  const loaded = javaPlayerFromNbt(tag);
  assert.equal(loaded.player.effects.find((e) => e.id === 1).bare, true);
  assert.equal(loaded.player.effects.find((e) => e.id === 16).bare, undefined); // Night Vision has no modifier
  const fx = new Effects(loaded.player.effects);
  assert.equal(fx.moveSpeedMultiplier(), 1);
  fx.add({ id: 1, amplifier: 0, duration: 50 }); // addPotionEffect on a loaded effect applies the modifiers (executed: readd rows)
  assert.equal(row('readd', 'same-amp-shorter').live.startsWith('speed=0.14000000268220902'), true);
  assert.equal(row('readd', 'weaker').live.startsWith('speed=0.14000000268220902'), true);
  assert.equal(fx.get(1).bare, undefined);
  assert.equal(fx.moveSpeedMultiplier(), 1 + 0.4000000059604645);
  const strong = new Effects([{ id: 5, amplifier: 1, duration: 10, bare: true }, { id: 18, amplifier: 0, duration: 10, bare: true }]);
  assert.equal(strong.attackDamage(1), 1);
  strong.add({ id: 5, amplifier: 0, duration: 5 });
  assert.equal(strong.attackDamage(1), 1 * (1 + 1.3 * 2));
  const s = new Survival({ effects: [{ id: 21, amplifier: 1, duration: 100, bare: true }] });
  assert.equal(s.maxHealth, 20);
  s.effects.add({ id: 21, amplifier: 1, duration: 100 });
  assert.equal(s.maxHealth, 28);
});

test('an effect whose modifier is in the saved Attributes is not bare (the native Attributes load applies it)', () => {
  const native = row('speed-session-reload', 'load');
  assert.equal(native.live.startsWith('speed=0.14000000268220902'), true);
  const tag = rich();
  const speedAttr = {
    type: NBT.COMPOUND, value: new Map([['Name', { type: NBT.STRING, value: 'generic.movementSpeed' }], ['Base', { type: NBT.DOUBLE, value: 0.1 }],
      ['Modifiers', { type: NBT.LIST, value: { elementType: NBT.COMPOUND, items: [new Map([['Name', { type: NBT.STRING, value: 'potion.moveSpeed 1' }], ['Amount', { type: NBT.DOUBLE, value: 0.4 }], ['Operation', { type: NBT.INT, value: 2 }]])] } }]]),
  };
  tag.set('Attributes', { type: NBT.LIST, value: { elementType: NBT.COMPOUND, items: [speedAttr.value] } });
  assert.equal(javaPlayerFromNbt(tag).player.effects.find((e) => e.id === 1).bare, undefined);
});

test('Motion: native keeps each component up to 10 (above: that component is 0) and the server copy motion is saved', () => {
  assert.equal(row('motion-edge', 'load').out.includes('Motion=[0:10.0d,1:-10.0d,2:9.99d,]'), true);
  assert.equal(row('motion-over', 'load').out.includes('Motion=[0:0.0d,1:0.5d,2:0.0d,]'), true);
  assert.deepEqual(loadedMotion([10, -10, 9.99]), [10, -10, 9.99]);
  assert.deepEqual(loadedMotion([10.5, 0.5, -10.01]), [0, 0.5, 0]);
  assert.deepEqual(loadedMotion([NaN, 0, 0]), [NaN, 0, 0]); // native keeps NaN (executed in b97 entnbt97; b96 assumed it read as 0)
  assert.equal(loadedMotion([1, 2]), null);
  // executed: knockback leaves the server copy's motion and nothing decays it; only landing zeroes Y
  assert.equal(row('knockback', 'tick20').out, row('knockback', 'hit').out);
  assert.equal(row('knockback', 'moved-down').out.includes('Motion=[0:-0.2828427215299509d,1:0.0d,2:-0.2828427215299509d,]'), true);
  const tag = rich(); tag.set('Motion', doubles(0.1, -0.0784000015258789, 0));
  assert.deepEqual(javaPlayerFromNbt(tag).motion, [0.1, -0.0784000015258789, 0]);
  tag.set('Motion', doubles(0, 0, 11));
  assert.deepEqual(javaPlayerFromNbt(tag).motion, [0, 0, 0]);
  assert.equal(javaPlayerFromNbt(tag).lost.includes('Motion'), false);
  const p = plain(levelNbt({ mode: 'survival', player: { health: 20 }, playerState: { motion: [-0.2828427215299509, 0.4000000059604645, 0.25] }, worldSpawn: [0, 64, 0] }, W).tag.value.get('Data').value.get('Player'));
  assert.deepEqual(p.Motion, [-0.2828427215299509, 0.4000000059604645, 0.25]);
  assert.deepEqual(savedMotion(undefined), [0, 0, 0]);
  assert.deepEqual(savedMotion([0, NaN, 0]), [0, NaN, 0]); // b97: NaN is kept natively
  const none = plain(levelNbt({ mode: 'survival', player: { health: 20 }, worldSpawn: [0, 64, 0] }, W).tag.value.get('Data').value.get('Player'));
  assert.deepEqual(none.Motion, [0, 0, 0]);
});

test('AttackTime: no player code sets it, a loaded value just counts down (executed); the export stays 0', () => {
  assert.equal(row('attack-4', 'load').out.includes('AttackTime=4s'), true);
  assert.equal(row('attack-4', 'tick3').out.includes('AttackTime=1s'), true);
  assert.equal(row('attack-4', 'tick10').out.includes('AttackTime=0s'), true);
  const p = plain(levelNbt({ mode: 'survival', player: { health: 20 }, worldSpawn: [0, 64, 0] }, W).tag.value.get('Data').value.get('Player'));
  assert.equal(p.AttackTime, 0);
});

test('SleepTimer: 100 after a bed wake counts to 109 and is saved awake; a saved sleeper loads awake with timer 0', () => {
  // executed (WorldServer double with a bed): the real wakeUpPlayer(false) writes 100, wakeUpPlayer(true) writes 0; a Sleeping 1b load wakes at once
  assert.equal(row('wake-normal', 'woken').out.includes('SleepTimer=100s;Sleeping=0b'), true);
  assert.equal(row('wake-immediate', 'woken').out.includes('SleepTimer=0s;Sleeping=0b'), true);
  assert.equal(row('wake-normal', 'asleep').out.includes('SleepTimer=60s;Sleeping=1b'), true);
  assert.equal(row('sleeping-load', 'load').out.includes('SleepTimer=0s;Sleeping=0b'), true);
  assert.equal(row('sleeping-load-100', 'load').out.includes('SleepTimer=0s;Sleeping=0b'), true);
  assert.equal(row('awake-105', 'load').out.includes('SleepTimer=105s'), true);
  assert.equal(row('awake-timer-300', 'load').out.includes('SleepTimer=300s'), true);
  const world = { get: () => 0, getMeta: () => 0, put() {} };
  const bed = new BedSleep();
  bed.sleeping = true; bed.bed = [3, 64, 4]; bed.timer = 60; bed.pos = { x: 3.5, y: 64.9375, z: 4.5 };
  bed.wake(world, false, false);
  assert.equal(bed.save().timer, 100);
  for (let i = 0; i < 4; i++) bed.tick(world, false);
  assert.equal(bed.save().timer, 104);
  for (let i = 0; i < 5; i++) bed.tick(world, false);
  assert.equal(bed.save().timer, 109);
  bed.tick(world, false);
  assert.equal(bed.save().timer, 0);
  const rec = (b) => plain(levelNbt({ mode: 'survival', player: { health: 20 }, bed: b, worldSpawn: [0, 64, 0] }, W).tag.value.get('Data').value.get('Player'));
  assert.equal(rec({ spawn: null, bed: null, timer: 104 }).SleepTimer, 104);
  assert.equal(rec({ spawn: null, bed: null, timer: 104 }).Sleeping, 0);
  assert.equal(rec({ spawn: null, bed: [3, 64, 4], timer: 60 }).Sleeping, 1);
  assert.equal(rec({ spawn: null, bed: [3, 64, 4], timer: 60 }).SleepTimer, 60);
  // import: an awake timer is kept and counts on; a sleeper's is 0
  const tag = rich(); tag.set('SleepTimer', { type: NBT.SHORT, value: 105 });
  assert.equal(javaPlayerFromNbt(tag).sleepTimer, 105);
  tag.set('Sleeping', { type: NBT.BYTE, value: 1 });
  assert.equal(javaPlayerFromNbt(tag).sleepTimer, 0);
  const back = new BedSleep().restore({ spawn: null, bed: null, timer: 105 });
  assert.equal(back.timer, 105);
  back.tick(world, false);
  assert.equal(back.timer, 106);
  assert.equal(new BedSleep().restore({ spawn: null, bed: [1, 2, 3], timer: 50 }).timer, 0);
});
