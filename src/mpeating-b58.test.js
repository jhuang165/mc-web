// Remote players eating and drinking: replays public/research/mpeating-reference.json (tools/probes/MpEatingProbe.java through tools/verify-mpeating.mjs, the
// unchanged EntityPlayer.updateItemUse on an EntityOtherPlayerMP) against the crumbs a remote client spawns and the sounds the server sends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { World } from './world.js';
import { JavaRandom } from './java-random.js';
import { Fx, itemCrumbs } from './fx.js';
import { ExplosionParticles } from './explosion-particles.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { createRemoteUse, tickRemoteUse, remoteEye, useAction } from './multiplayer/remote-eating.js';
import { useFlags } from './multiplayer/presence.js';
import { ITEMS } from './survival.js';

const ref = JSON.parse(await readFile(new URL('../public/research/mpeating-reference.json', import.meta.url)));
const use = ref.records.filter(r => r.case === 'use');
// Vanilla ids of the probe -> this build's own item ids (the fish and golden apple metas are separate items here).
const OURS = { 260: 200, 297: 201, 322: 372, 349: 701, 350: 705, 357: 369, 364: 205 };
const raw = n => { const r = new JavaRandom(0); r.seed = BigInt(n); return r; };
// The probe world (stone below y 64); the Fx draws Math.random for each particle constructor, so the crumbs share the one raw stream (as fx.test.js does).
function system(math, seed) {
  const r = raw(math), random = () => r.nextDouble();
  let first = seed;
  const entityRandom = () => { const v = first ?? 0; first = null; return raw(v); };
  const get = (x, y, z) => (y < 64 ? 3 : 0), calls = [];
  const fx = new Fx({ random, entityRandom, world: { get, getMeta: () => 0, solid: (x, y, z) => get(x, y, z) === 3 }, explosions: new ExplosionParticles({ random, entityRandom: () => new JavaRandom(0) }) });
  fx.viewer = [10.5, 65.62, 10.5];
  const spawn = fx.spawn.bind(fx);
  fx.spawn = (name, ...args) => { calls.push([name, ...args.slice(0, 6)]); return spawn(name, ...args); };
  return { fx, calls, random };
}
const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

test('probe: remote eating draws crumbs from the item icon, drinks and swords make none', () => {
  assert.equal(use.length, 18);
  for (const r of use) {
    const crumbs = r.calls.length;
    if (r.item in OURS) assert.equal(crumbs, r.n); else assert.equal(crumbs, 0);
  }
  assert.ok(use.filter(r => r.item === 335 || r.item === 373).every(r => r.sounds[0][0] === 'random.drink' && r.sounds[0][4] === 0.5));
  assert.ok(use.filter(r => r.item in OURS).every(r => r.sounds.length === 1 && r.sounds[0][0] === 'random.eat' && (r.sounds[0][4] === 0.5 || r.sounds[0][4] === 1)));
  assert.ok(use.filter(r => r.item === 267 || r.item === 261).every(r => r.sounds.length === 0 && r.calls.length === 0));
});

test('crumbs replay: itemCrumbs from the remote eye matches updateItemUse call for call', () => {
  for (const r of use.filter(r => r.item in OURS)) {
    const { fx, calls, random } = system(r.math, null), rand = new JavaRandom(r.seed);
    // The probe's eye is posY + getEyeHeight 1.82F at feet 64; remoteEye turns a presence entry's radians into the Java degrees.
    const eye = remoteEye({ x: 10.5, y: 64, z: 10.5, yaw: Math.fround((180 - r.yaw) * Math.PI / 180), pitch: Math.fround(-r.pitch * Math.PI / 180) });
    assert.equal(eye.y, r.eye);
    itemCrumbs(fx, r.n, 'iconcrack_' + OURS[r.item], { ...eye, yaw: r.yaw, pitch: r.pitch }, rand, random);
    assert.deepEqual(calls.map(([n, ...v]) => v), r.calls.map(([n, ...v]) => v), `item ${r.item} meta ${r.meta} n ${r.n}`);
    assert.ok(calls.every(c => c[0] === 'iconcrack_' + OURS[r.item]));
    // The eat sound follows the crumbs on the same Entity.rand: nextInt(2), then two nextFloat.
    const volume = Math.fround(0.5 + Math.fround(0.5 * rand.nextInt(2))), pitch = Math.fround(Math.fround(Math.fround(rand.nextFloat() - rand.nextFloat()) * Math.fround(0.2)) + 1);
    assert.deepEqual([r.sounds[0][4], r.sounds[0][5]], [volume, pitch]);
  }
});

test('remote use state: the flag starts a 32 tick count, crumbs every 4 ticks from 24 down, a held change or release clears it', () => {
  const st = createRemoteUse(), at = [], held = { id: 200 };
  const tick = (using, h = held) => { const before = at.length; tickRemoteUse(st, { using, held: h }, id => at.push(id)); return at.length - before; };
  tick(true);
  assert.equal(st.count, 32);
  const ticks = [];
  for (let j = 1; j <= 40; j++) if (tick(true)) ticks.push(j);
  // the pre-decrement count 24, 20 ... 4 and then 0, -4, -8 (the count keeps falling while the flag stays set)
  assert.deepEqual(ticks, [9, 13, 17, 21, 25, 29, 33, 37]);
  assert.ok(at.every(id => id === 200));
  tick(false); assert.equal(st.stack, null); assert.equal(st.flag, false);
  at.length = 0;
  tick(true); for (let j = 0; j < 9; j++) tick(true);
  assert.equal(at.length, 1);
  tick(true, { id: 201 }); // another stack in hand: the item in use is cleared and the flag still set starts nothing
  assert.equal(st.stack, null);
  for (let j = 0; j < 40; j++) tick(true, { id: 201 });
  assert.equal(at.length, 1);
  const sword = createRemoteUse(), n = [];
  for (let j = 0; j < 80; j++) tickRemoteUse(sword, { using: true, held: { id: 115 } }, id => n.push(id));
  assert.deepEqual(n, [], 'a sword blocks without crumbs');
  assert.equal(useAction({ id: 343 }), 'drink');
  assert.equal(useAction({ id: 115 }), null);
  assert.ok(ITEMS[200].food && !ITEMS[115].food);
  assert.deepEqual(useFlags({ using: true, held: { id: 200 } }), { blocking: false, aimedBow: false }, 'eating changes no third-person pose');
});

function pair(hotbar, bobX = 67.5) {
  const world = new World('mpeating-b58');
  for (let x = 20; x <= 110; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 22; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival' }), a = s.addPlayer('a', 'Alice', key(1)), b = s.addPlayer('b', 'Bob', key(2));
  a.position.copy({ x: 64.5, y: 10, z: 64.5 }); b.position.copy({ x: bobX, y: 10, z: 64.5 });
  s.input('a', { type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: [...hotbar, ...Array(9 - hotbar.length).fill(null)] });
  s.input('b', { type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
  for (let i = 0; i < 3; i++) s.tick();
  a.survival.food = 10;
  return { s, a, b };
}
const take = p => { const out = p.soundsOut ?? []; p.soundsOut = null; return out; };

test('server: eating sends random.eat to the other player on the 4 tick schedule, with the native draws, and a burp at the end to both', () => {
  const { s, a, b } = pair([{ id: 200 }]);
  const probe = use.find(r => r.item === 260 && r.n === 5), probeEnd = use.find(r => r.item === 260 && r.n === 16);
  a.rand = new JavaRandom(probe.seed); s.soundRand = new JavaRandom(7);
  take(a); take(b);
  s.queueUse('a', true); s.tick();
  const log = [];
  for (let k = 1; k <= 33; k++) { s.tick(); log.push([k, take(a), take(b)]); }
  const heard = log.filter(([, , o]) => o.length);
  assert.deepEqual(heard.map(([k, , o]) => [k, o.map(x => x.name)]), [[9, ['random.eat']], [13, ['random.eat']], [17, ['random.eat']], [21, ['random.eat']], [25, ['random.eat']], [29, ['random.eat']], [32, ['random.eat', 'random.burp']]]);
  assert.deepEqual([heard[0][2][0].volume, heard[0][2][0].pitch], [probe.sounds[0][4], probe.sounds[0][5]]);
  assert.deepEqual([heard[0][2][0].x, heard[0][2][0].y, heard[0][2][0].z], [64.5, 10, 64.5]);
  assert.ok(log.every(([, own]) => own.every(x => x.name === 'random.burp')), 'the eater is excluded from the eat sounds, not from the burp');
  assert.equal(log.find(([k]) => k === 32)[1].length, 1);
  const w = new JavaRandom(7), pitch = Math.fround(Math.fround(w.nextFloat() * Math.fround(0.1)) + Math.fround(0.9));
  assert.equal(heard.at(-1)[2][1].pitch, pitch); assert.equal(heard.at(-1)[2][1].volume, 0.5);
  assert.ok(probeEnd.sounds[0][0] === 'random.eat');
  assert.equal(a.itemInUse, null);
});

test('server: milk plays random.drink from the world random, no burp; far players hear nothing', () => {
  const { s, a, b } = pair([{ id: 343 }]), probe = use.find(r => r.item === 335);
  s.soundRand = raw(probe.worldSeed);
  take(a); take(b); s.queueUse('a', true); s.tick();
  const names = [];
  for (let k = 1; k <= 33; k++) { s.tick(); names.push(...take(b).map(x => x.name)); if (k === 9) { assert.equal(names.length, 0 + 1); } }
  assert.deepEqual(names, Array(7).fill('random.drink'));
  const far = pair([{ id: 200 }], 64.5 + 17);
  take(far.a); take(far.b); far.s.queueUse('a', true); far.s.tick();
  for (let k = 0; k < 34; k++) { far.s.tick(); assert.deepEqual(take(far.b), []); }
  // a Creative-style refusal: a sword in use makes no sound at all
  const sw = pair([{ id: 115 }]); take(sw.b); sw.s.queueUse('a', true);
  for (let k = 0; k < 60; k++) { sw.s.tick(); assert.deepEqual(take(sw.b), []); }
});
