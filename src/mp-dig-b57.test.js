import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { useFlags } from './multiplayer/presence.js';
import { bipedPose } from './player-renderer.js';
const seed = (s, id, message) => { s.serverItems.adopt(s.players.get(id), message, true); return s.input(id, message); }; // b61: a Survival server ignores the client's hotbar mirror; tests seed the inventory

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = (hotbar, extra = {}) => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: [...hotbar, ...Array(9 - hotbar.length).fill(null)], ...extra });
function fixture(gameMode) {
  const world = new World('mp-dig-b57');
  for (let x = 20; x <= 110; x++) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 22; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({}, { world, gameMode });
}
// Alice at (64.5, 10, 64.5) looks along -z at the cell (64, 11, 61); Bob stands near or far.
function pair(gameMode, bobX = 66.5, hotbar = [{ id: 3 }]) {
  const s = fixture(gameMode), a = s.addPlayer('a', 'Alice', key(1)), b = s.addPlayer('b', 'Bob', key(2));
  a.position.copy({ x: 64.5, y: 10, z: 64.5 }); b.position.copy({ x: bobX, y: 10, z: 64.5 });
  seed(s, 'a', input(hotbar)); s.input('b', input([]));
  s.world.set(64, 11, 61, 2); // dirt
  for (let i = 0; i < 3; i++) s.tick(); // the players settle onto the floor
  return { s, a, b };
}
const drain = p => { const out = p.cracksOut ?? []; p.cracksOut = null; return out; };

test('survival dig: a finish before 0.7 of the server damage leaves the block and resends it', () => {
  const { s, a } = pair('survival');
  const rate = s.digRate(a, [64, 11, 61]), line = Math.fround(0.7);
  assert.ok(rate > 0 && rate < 0.2, 'dirt by hand takes many ticks');
  s.queueDig('a', 0); s.tick();
  s.queueDig('a', 2); s.tick();
  assert.equal(s.world.get(64, 11, 61), 2, 'an immediate finish does not break');
  assert.deepEqual(a.blocks?.[0]?.slice(0, 5) ?? [64, 11, 61, 2, 0], [64, 11, 61, 2, 0]);
  assert.equal(a.dig.state.received, true);
  assert.ok(Math.fround(rate * 3) < line);
});

test('survival dig: exact 0.7 rule, delayed break at damage 1, and plain edit is refused', () => {
  const { s, a } = pair('survival');
  assert.equal(s.queueEdit('a', { place: false }), true); s.tick();
  assert.equal(s.world.get(64, 11, 61), 2, 'edit {place:false} cannot break for a survival player');
  const rate = s.digRate(a, [64, 11, 61]);
  s.queueDig('a', 0); s.tick();
  const start = a.dig.state.cur;
  let waited = 0;
  while (Math.fround(rate * (a.dig.state.cur - start + 1 + 1)) < Math.fround(0.7) && waited < 200) { s.tick(); waited++; }
  s.queueDig('a', 2); s.tick(); // the finish is handled after this tick's count, so ticks + 1 is now past 0.7
  assert.equal(s.world.get(64, 11, 61), 0, 'broken at the 0.7 line');
});

test('survival dig: a finish short of 0.7 waits and the server tick breaks it at damage 1', () => {
  const { s, a } = pair('survival');
  s.queueDig('a', 0); s.tick();
  s.queueDig('a', 2); s.tick();
  assert.equal(a.dig.state.received, true, 'the timer remembers the cell');
  let n = 0;
  while (s.world.get(64, 11, 61) && n < 100) { s.tick(); n++; }
  assert.equal(s.world.get(64, 11, 61), 0);
  assert.ok(n > 3, 'not at once');
});

test('S25 crack stages go to the other players within 32 blocks, never the digger, and -1 clears them', () => {
  const { s, a, b } = pair('survival');
  const far = s.addPlayer('c', 'Carol', key(3)); far.position.copy({ x: 64.5 + 40, y: 10, z: 64.5 });
  drain(a); drain(b); drain(far);
  s.queueDig('a', 0); s.tick();
  const first = drain(b);
  assert.equal(first.length, 1);
  assert.deepEqual({ ...first[0], stage: undefined }, { id: 'a', x: 64, y: 11, z: 61, stage: undefined });
  assert.equal(first[0].stage, Math.trunc(Math.fround(Math.fround(s.digRate(a, [64, 11, 61])) * 10)));
  assert.deepEqual(drain(a), [], 'the digger gets none');
  assert.deepEqual(drain(far), [], 'beyond 32 blocks (squared distance 1024) gets none');
  const stages = [];
  for (let i = 0; i < 40; i++) { s.tick(); stages.push(...drain(b).map(c => c.stage)); }
  assert.ok(stages.length >= 2 && stages.every((v, i) => i === 0 || v > stages[i - 1]), 'the stage climbs as the timer counts');
  s.queueDig('a', 1); s.tick();
  assert.equal(drain(b).at(-1).stage, -1, 'the abort clears it (this tick\'s own count may precede it)');
  s.queueDig('a', 0); s.tick(); drain(b);
  far.position.copy({ x: 64.5 + 31, y: 10, z: 64.5 }); // 31 blocks in x, 3 in z of the cell: inside
  s.queueDig('a', 1); s.tick();
  assert.equal(drain(far).length, 2, 'inside 32 blocks: the start stage and the abort');
});

test('an instant block breaks at the start and shows no crack; air under a start sends stage 10', () => {
  const { s, a, b } = pair('survival');
  s.world.set(64, 11, 61, 0); s.world.set(64, 10, 61, 44); // red flower, hardness 0, selectable only low in its cell: look a little down
  seed(s, 'a', input([{ id: 3 }], { pitch: -0.32 }));
  drain(b);
  s.queueDig('a', 0); s.tick();
  assert.equal(s.world.get(64, 10, 61), 0);
  assert.deepEqual(drain(b), []);
  seed(s, 'a', input([{ id: 3 }])); s.world.set(64, 11, 60, 2);
  s.queueDig('a', 0); s.tick();
  assert.deepEqual(drain(b).map(c => c.stage), [Math.trunc(Math.fround(Math.fround(s.digRate(a, [64, 11, 60])) * 10))], 'the ray passes the air to the next block');
});

test('a Creative player still breaks at once, through dig status 0 or edit, and 1 / 2 do nothing', () => {
  const { s } = pair('creative');
  s.queueDig('a', 2); s.tick(); assert.equal(s.world.get(64, 11, 61), 2);
  s.queueDig('a', 0); s.tick(); assert.equal(s.world.get(64, 11, 61), 0);
  s.world.set(64, 11, 61, 2); s.queueEdit('a', { place: false }); s.tick(); assert.equal(s.world.get(64, 11, 61), 0);
  assert.equal(s.queueDig('a', 7), false);
});

test('item in use: sword blocks, bow draws, held change clears, eating needs hunger and ends after 32 ticks', () => {
  const { s, a } = pair('survival', 66.5, [{ id: 115 }, { id: 127 }, { id: 200 }, { id: 320 }]);
  const using = () => s.presence().find(p => p.id === 'a').using;
  s.queueUse('a', true); s.tick();
  assert.equal(using(), true); assert.equal(a.itemInUse.block, true);
  seed(s, 'a', input([{ id: 115 }, { id: 127 }, { id: 200 }, { id: 320 }], { current: 1 })); s.tick();
  assert.equal(using(), false, 'a held item change clears the use');
  s.queueUse('a', true); s.tick();
  assert.equal(a.itemInUse.bow, true);
  for (let i = 0; i < 10; i++) s.tick();
  assert.ok(a.itemInUse.ticks >= 10);
  s.queueUse('a', false); s.tick(); assert.equal(using(), false);
  seed(s, 'a', input([{ id: 115 }, { id: 127 }, { id: 200 }, { id: 320 }], { current: 2 }));
  s.queueUse('a', true); s.tick(); assert.equal(using(), false, 'a full player cannot eat');
  a.survival.food = 10;
  s.queueUse('a', true); s.tick(); assert.equal(using(), true);
  for (let i = 0; i < 31; i++) s.tick();
  assert.equal(using(), true, 'still eating at 31 ticks');
  s.tick();
  assert.equal(using(), false, 'the 32 tick eat is over');
  const c = pair('creative', 66.5, [{ id: 200 }]);
  c.s.queueUse('a', true); c.s.tick(); assert.equal(c.s.presence()[0].using, false, 'a Creative player cannot eat');
});

test('remote pose: a sword in use blocks, a bow in use aims, eating changes nothing; aimedBow raises both arms', () => {
  assert.deepEqual(useFlags({ using: true, held: { id: 115 } }), { blocking: true, aimedBow: false });
  assert.deepEqual(useFlags({ using: true, held: { id: 127 } }), { blocking: false, aimedBow: true });
  assert.deepEqual(useFlags({ using: true, held: { id: 200 } }), { blocking: false, aimedBow: false });
  assert.deepEqual(useFlags({ using: false, held: { id: 127 } }), { blocking: false, aimedBow: false });
  const rest = bipedPose({ heldRight: 1 }), bow = bipedPose({ heldRight: 1, aimedBow: true });
  assert.ok(bow.rightArm.rot[0] < -1.5 && bow.leftArm.rot[0] < -1.5 && rest.rightArm.rot[0] > -1);
  assert.ok(Math.abs(bow.rightArm.rot[1] - -0.1) < 1e-6 && Math.abs(bow.leftArm.rot[1] - 0.5) < 1e-6, 'right arm -0.1, left 0.1 + 0.4 along a level head');
});
