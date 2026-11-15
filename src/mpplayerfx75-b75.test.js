// Batch 75 mpplayerfx75: server player state that reaches the client: the death throw, the attacker's sprint flag, forced and head tracker sends, the S18 y + 1/64, wall-clock idle.
// Facts: .shared-memory/notes/mpplayerfx75-b75-track.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDeathThrow } from './multiplayer/server-death-throw.js';
import { deathThrow, attackedAtOf } from './death-throw.js';
import { ServerPlayerTracker, watcherSig } from './multiplayer/server-player-tracker.js';
import { attackerSlowdown } from './multiplayer/server-attack-slowdown.js';
import { ServerAdmin } from './multiplayer/server-admin.js';

const mk = (over = {}) => ({ position: { x: 8.5, y: 100, z: 8.5 }, yaw: 0, pitch: 0, grounded: true, input: {}, motion: { sprinting: false }, survival: { health: 20, air: 300, fire: 0, effects: { has: () => false } }, ...over });

test('death throw: the server player gets onDeath motion, the knock queue is dropped, drowning keeps the motion', () => {
  const p = { ...mk(), velocity: { x: 0.3, y: -0.5, z: 0 } };
  p.survival.attackedAt = attackedAtOf(true, { x: 8.5, z: 6.5 }); // attacker at -z: the body flies towards +z
  p.survival.knockQueue = [{ kind: 'knock', x: 1, z: 1 }];
  const t = applyDeathThrow(p);
  const want = deathThrow(p.survival.attackedAt, p.position, 180);
  assert.deepEqual(p.velocity, want);
  assert.equal(want.y, Math.trunc(0.10000000149011612 * 8000) / 8000);
  assert.ok(want.z > 0.09 && Math.abs(want.x) < 1e-3);
  assert.equal(p.survival.knockQueue.length, 0);
  assert.deepEqual(t, want);
  const d = { ...mk(), velocity: { x: 0.3, y: -0.5, z: 0 } }; d.survival.lastDamage = 'drowning'; d.survival.attackedAt = p.survival.attackedAt;
  assert.equal(applyDeathThrow(d), null);
  assert.deepEqual(d.velocity, { x: 0.3, y: -0.5, z: 0 }, 'no S12 after drowning');
});

test('attacker slowdown: only the sprint flag, the real motion stays', () => {
  const p = { velocity: { x: 1, y: 0.2, z: -1 }, motion: { sprinting: true } };
  assert.equal(attackerSlowdown(p, { knockback: 0 }), false);
  assert.equal(attackerSlowdown(p, { knockback: 2 }), true);
  assert.deepEqual([p.velocity.x, p.velocity.z, p.motion.sprinting], [1, -1, false]);
});

const rig = (n = 1) => {
  const players = new Map(); const host = { players, rules: {}, ticks: 0 }; const tr = new ServerPlayerTracker(host);
  const targets = []; for (let i = 0; i < n; i++) { const t = mk(); targets.push(t); players.set('p' + i, t); }
  const step = () => { host.ticks++; tr.advance(0, players, host.ticks); return tr.released(0, 'p0'); };
  return { tr, host, t: targets[0], step };
};

test('a sneak toggle or a jump forces the off-beat send; without it the row waits for the 2-tick beat', () => {
  const run = (kind, offset) => {
    const { t, step } = rig(); step(); for (let i = 0; i < offset; i++) step();
    const before = step().x;
    t.position.x += 0.2; // 6.4/32: over the move threshold
    if (kind === 'sneak') t.input.sneak = true;
    if (kind === 'jump') { t.grounded = false; t.position.y += 0.4; }
    if (kind === 'hurt') t.survival.health = 18;
    return step().x !== before;
  };
  for (const kind of ['sneak', 'jump', 'hurt']) for (const off of [0, 1]) assert.equal(run(kind, off), true, `${kind} forces the send (offset ${off})`);
  assert.deepEqual([run('none', 0), run('none', 1)].sort(), [false, true], 'without a force exactly one parity sends at once');
});

test('watcherSig reads sneak, sprint, item use, fire, health, air', () => {
  const a = mk(), b = mk();
  assert.equal(watcherSig(a), watcherSig(b));
  for (const f of [p => { p.input.sneak = true; }, p => { p.motion.sprinting = true; }, p => { p.itemInUse = {}; }, p => { p.survival.fire = 5; }, p => { p.survival.health = 19; }, p => { p.survival.air = 299; }]) { const c = mk(); f(c); assert.notEqual(watcherSig(c), watcherSig(a)); }
});

test('head packet: rows carry the S19 angle with its own baseline, equal to the body yaw after a turn', () => {
  const { t, step } = rig(); const r0 = step();
  assert.ok(Math.abs(r0.head - r0.yaw) < 1e-9);
  t.yaw = 1.0; // a large turn: look and head packets on the next beat
  let r; for (let i = 0; i < 3; i++) r = step();
  assert.ok(Math.abs(r.head - r.yaw) < 1e-9, 'same angle, separate packet');
  assert.ok(Math.abs(r.head - 1.0) < 0.05);
  // a pitch-only look refreshes the body baseline but not the head's: a 3-step yaw turn (below 4) never moves either
  t.yaw = 1.0 + 3 * 2 * Math.PI / 256; for (let i = 0; i < 4; i++) r = step();
  assert.ok(Math.abs(r.head - 1.0) < 0.05, 'under 4/256 turns send nothing');
});

test('S18 teleport carries y + 1/64 until a relative move packet', () => {
  const { t, step } = rig(); step();
  t.position.x += 20; // a delta over 127/32 blocks: teleport
  let r; for (let i = 0; i < 3; i++) r = step();
  assert.ok(Math.abs(r.x - t.position.x) < 1 / 32 + 1e-9);
  assert.ok(Math.abs(r.y - (100 + 1 / 64)) < 1 / 32 + 1e-9 && r.y > 100, `lifted ${r.y}`);
  t.position.x += 0.5; for (let i = 0; i < 3; i++) r = step();
  assert.ok(r.y <= 100 + 1 / 32 && Math.abs(r.y - Math.floor(100 * 32) / 32) < 1e-9, 'a move packet drops the lift');
});

test('idle kick counts wall-clock ms from an injected clock', () => {
  let now = 5000; const a = new ServerAdmin({}, { clock: () => now }); a.idleMinutes = 1; a.join('p');
  now += 60000; assert.deepEqual(a.idle(), [], 'exactly 60000 ms is not over');
  now += 1; assert.deepEqual(a.idle(), ['p']);
  a.activity('p', { type: 'dig', status: 0 }); assert.deepEqual(a.idle(), []);
  now += 90000; a.activity('p', { type: 'input', current: 0, controls: { forward: 1 } }); assert.deepEqual(a.idle(), ['p'], 'movement is not activity');
  // a lagging server (few ticks, much time) still kicks
  a.idleMinutes = 0; assert.deepEqual(a.idle(), [], 'off');
});

test('dedicated server: a killed player flies off with the throw and respawn clears it', async () => {
  const { World } = await import('./world.js');
  const { DedicatedSimulation } = await import('./multiplayer/simulation.js');
  const world = new World('mpplayerfx75');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: false });
  const a = s.addPlayer('a', 'ax', '00000000-0000-0000-0000-000000000001');
  a.position.copy({ x: 64.5, y: 10, z: 64.5 }); a.previous.copy(a.position);
  s.tick(); s.tick();
  a.survival.protection = 0; const from = { x: 64.5, y: 10, z: 60.5, isPlayer: false };
  a.survival.damage(40, 'a zombie', true, 'mob', from);
  s.tick();
  assert.equal(a.dead, true);
  const z0 = a.position.z;
  assert.ok(a.velocity.z > 0.05 || a.position.z > z0 - 1e-9, 'thrown away from the attacker (+z)');
  for (let i = 0; i < 4; i++) s.tick();
  assert.ok(a.position.z > z0 + 0.1, `the body moved ${a.position.z - z0}`);
  s.serverSurvival.respawn(a);
  assert.deepEqual([a.velocity.x, a.velocity.y, a.velocity.z], [0, 0, 0]);
});
