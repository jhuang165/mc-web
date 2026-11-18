// Batch 81 exhaust81: EntityPlayer.addMovementStat (yz.k) / addMountedMovementStat (yz.l) replayed against the executed records of a real
// EntityPlayerMP (public/research/movement-stats-reference.json, tools/probes/MovementStatProbe.java), and the live exhaustion paths
// (player-environment.js finishPlayerMovement for single player and the dedicated server).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { movementStat, movementExhaustion, TELEPORT_SQUARED } from './movement-stat.js';
import { addMovementStat, addMountedMovementStat } from './stats-live.js';
import { jumpExhaustion } from './player-movement.js';
import { finishPlayerMovement } from './player-environment.js';
import { Stats, STAT } from './stats.js';
import { World, WATER, LADDER } from './world.js';
import { Survival } from './survival.js';
import { PlayerMotion } from './player-movement.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';

const f32 = Math.fround;
const ref = JSON.parse(readFileSync(new URL('../public/research/movement-stats-reference.json', import.meta.url)));
// The probe prints floats with Float.toString (the shortest decimal of the float): back to the float.
for (const r of [...ref.moves, ...ref.direct, ...ref.mounted]) for (const k of ['exBefore', 'exJump', 'exAfter']) if (k in r) r[k] = f32(r[k]);
const charged = (before, e) => f32(Math.min(40, before + e)); // FoodStats.addExhaustion
const recorder = () => { const rec = []; return { rec, increment: (id, n) => rec.push([id, n]) }; };
const move = (r) => ({ dx: r.dx, dy: r.dy, dz: r.dz, dive: r.eye, swim: r.inWater, ladder: r.ladder, ground: r.onGround, sprinting: r.sprint, riding: !!r.riding });

test('the reference covers every branch: walk, sprint, jump, swim, dive, ladder, air, Creative and riding', () => {
  const names = new Set(ref.moves.map((m) => m.name));
  for (const n of ['walk', 'sprint', 'jump', 'sprint-jump', 'swim', 'dive', 'ladder', 'ladder-slide', 'wade-out']) assert.ok(names.has(n), n);
  const ids = new Set([...ref.moves, ...ref.direct, ...ref.mounted].flatMap((r) => r.stats.map((s) => s[0])));
  for (const s of ['walk', 'swim', 'dive', 'climb', 'fly', 'minecart', 'boat', 'pig', 'horse']) assert.ok(ids.has(STAT[s]), s);
  assert.ok(ref.moves.some((m) => m.ladder && m.dy > 0 && m.exAfter === m.exJump), 'a climbing tick costs nothing');
});

test('direct yz.k calls: stats and exhaustion match the executed EntityPlayerMP (rounding edges, branch order, Creative, riding)', () => {
  for (const r of ref.direct) {
    const s = recorder(), e = addMovementStat(s, move(r));
    assert.deepEqual(s.rec, r.stats, r.name);
    assert.equal(r.creative ? r.exBefore : charged(r.exBefore, e), r.exAfter, r.name); // EntityPlayer.addExhaustion: nothing under disableDamage
  }
  const at = (n) => ref.direct.find((r) => r.name === n);
  assert.equal(at('sprint-1').exAfter, f32(f32(f32(0.099999994) * 100) * f32(0.01)), 'sprinting uses 0.099999994F');
  assert.deepEqual(at('walk-0.004').stats, [], 'under half a centimetre is nothing');
  assert.equal(at('air-sprint').exAfter, 0, 'airborne moves cost nothing');
  assert.equal(at('ladder-ground').exAfter, 0, 'the ladder branch wins over onGround');
});

test('executed movement ticks: every tick replays (the jump, then the move yz.e(FF) reports)', () => {
  let ticks = 0;
  for (const r of ref.moves) {
    const jumped = r.jump.length > 0;
    if (jumped) {
      assert.deepEqual(r.jump, [[STAT.jump, 1]], `${r.name} ${r.tick}`);
      assert.equal(r.exJump, charged(r.exBefore, jumpExhaustion(r.sprint)), `${r.name} ${r.tick} jump`);
    } else assert.equal(r.exJump, r.exBefore);
    const s = recorder(), e = addMovementStat(s, move(r));
    assert.deepEqual(s.rec, r.stats, `${r.name} ${r.tick}`);
    assert.equal(charged(r.exJump, e), r.exAfter, `${r.name} ${r.tick}`);
    ticks++;
  }
  assert.ok(ticks >= 300);
});

test('yz.l: the 3-D distance by vehicle class, never exhaustion', () => {
  const kind = { xs: 'minecart', xi: 'boat', wo: 'pig', wi: 'horse', yq: 'zombie' };
  for (const r of ref.mounted) {
    const s = recorder();
    addMountedMovementStat(s, { dx: r.dx, dy: r.dy, dz: r.dz, kind: kind[r.vehicle] });
    assert.deepEqual(s.rec, r.stats, `${r.name} ${r.vehicle}`);
    assert.equal(r.exAfter, r.exBefore);
  }
});

function fixture(mode = 'survival') {
  const world = new World('movement-stat');
  for (let x = 60; x <= 70; x++) for (let z = 60; z <= 70; z++) for (let y = 9; y < 20; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  return { world, position: { x: 64.5, y: 10, z: 64.5 }, survival: new Survival({}, mode), motion: new PlayerMotion(), grounded: true, fallDistance: 0, landedFall: 0 };
}
const step = (s, d, extra = {}) => {
  const oldPosition = { ...s.position };
  s.position = { x: s.position.x + d[0], y: s.position.y + d[1], z: s.position.z + d[2] };
  finishPlayerMovement(s, { inWater: false, inLavaNow: false, oldPosition, ...extra });
  return s.survival.exhaustion;
};

test('finishPlayerMovement charges yz.k: centimetres on the ground, none in the air, on a ladder, riding, teleporting or in Creative', () => {
  const s = fixture();
  assert.equal(step(s, [0.2156, 0, 0]), charged(0, movementExhaustion({ dx: 0.2156, dy: 0, dz: 0, ground: true })));
  assert.equal(s.survival.exhaustion, f32(f32(f32(0.01) * 22) * f32(0.01)));
  const before = s.survival.exhaustion;
  s.motion.sprinting = true;
  assert.equal(step(s, [0, 0, 0.2806]), charged(before, f32(f32(f32(0.099999994) * 28) * f32(0.01))));
  const walked = s.survival.exhaustion;
  s.grounded = false;
  assert.equal(step(s, [0.36, 0.42, 0]), walked, 'airborne sprint-jump tick');
  s.grounded = true;
  assert.equal(step(s, [0.3, 0, 0], { riding: true }), walked, 'riding');
  assert.equal(step(s, [8, 0, 8]), walked, 'teleport-sized move (over the TELEPORT_SQUARED of the stats)');
  assert.ok(8 * 8 * 2 > TELEPORT_SQUARED);
  // A ladder at the feet (sv.h_ at floor(minY)): climbing and walking into it cost nothing.
  s.world.put(Math.floor(s.position.x), 10, Math.floor(s.position.z), LADDER, 3, false);
  s.position.y = 10;
  assert.equal(step(s, [0, 0.1176, 0]), walked, 'climbing');
  s.position.y = 10;
  assert.equal(step(s, [0.2, 0, 0], { onLadder: true }), walked, 'ladder wins over onGround');
  const c = fixture('creative');
  assert.equal(step(c, [1, 0, 0]), 0, 'Creative: disableDamage');
});

test('under water: the eye in water charges the 3-D distance, the body alone the horizontal one', () => {
  const s = fixture();
  for (let y = 10; y <= 12; y++) for (let x = 63; x <= 66; x++) s.world.put(x, y, 64, WATER, 0, false);
  s.grounded = false;
  step(s, [0, -0.3, 0], { inWater: true });
  assert.equal(s.survival.exhaustion, f32(f32(f32(0.015) * 30) * f32(0.01)), 'the eye is in water (y 10 + 1.62): dive, vertical counts');
  const s2 = fixture();
  s2.grounded = false;
  step(s2, [0, -0.3, 0], { inWater: true, eyeInWater: false });
  assert.equal(s2.survival.exhaustion, 0, 'swimming at the surface: horizontal only');
  step(s2, [0.1, -0.2, 0.05], { inWater: true, eyeInWater: false });
  assert.equal(s2.survival.exhaustion, f32(f32(f32(0.015) * 11) * f32(0.01)));
});

test('movementStat: riding returns nothing; the climb uses Math.round(double) of dy', () => {
  assert.deepEqual(movementStat({ dx: 1, dy: 1, dz: 1, dive: true, riding: true }), { stat: null, amount: 0, exhaustion: 0 });
  assert.equal(movementStat({ dx: 0, dy: 0.115, dz: 0, ladder: true }).amount, 12);
  const st = new Stats();
  addMovementStat(st, { dx: 0.3, dy: 0, dz: 0.4, ground: true });
  assert.equal(st.get(STAT.walk), 50);
});

test('dedicated server: a sprinting player is charged the walk centimetres of each tick at 0.099999994F', () => {
  const world = new World('movement-stat-mp');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 14; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: false });
  const p = sim.addPlayer('a', 'ax', '00000000-0000-0000-0000-000000000001');
  p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  const input = { type: 'input', controls: { ...IDLE_INPUT, forward: 1, sprint: true }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) };
  sim.input('a', input); sim.tick();
  let sprinted = 0;
  for (let i = 0; i < 20; i++) {
    const ex = p.survival.exhaustion, cm = p.stats.get(STAT.walk);
    sim.input('a', input); sim.tick();
    const d = p.stats.get(STAT.walk) - cm;
    const factor = p.motion.sprinting ? f32(0.099999994) : f32(0.01);
    if (p.motion.sprinting && d > 0) sprinted++;
    assert.equal(p.survival.exhaustion, d > 0 ? charged(ex, f32(f32(factor * d) * f32(0.01))) : ex, `tick ${i}`);
  }
  assert.ok(sprinted > 10, 'the player sprinted');
});

test('wiring: single player passes the same eye/ladder flags to the exhaustion and the stats, and riding; the server rider is flagged', () => {
  const main = readFileSync(new URL('./main.js', import.meta.url), 'utf8');
  assert.match(main, /finishPlayerMovement\(movement, \{ inWater, inLavaNow, oldPosition, \.\.\.moveFlags, riding: !!rider\.vehicle \}/);
  assert.match(main, /statsLive\.tick\(\{ oldPosition, position, vehicle: rider\.vehicle, inWater, \.\.\.moveFlags, grounded \}\)/);
  const vehicles = readFileSync(new URL('./multiplayer/server-vehicles.js', import.meta.url), 'utf8');
  assert.match(vehicles, /sit\(p\) \{ return \{[^}]*riding: true/);
  const env = readFileSync(new URL('./player-environment.js', import.meta.url), 'utf8');
  assert.ok(!/motion\.sprinting \? 0\.1 : 0\.01/.test(env), 'the raw-distance charge is gone');
});
