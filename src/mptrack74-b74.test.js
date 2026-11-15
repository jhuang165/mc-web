// Batch 74 mptrack74: remote player positions follow the EntityTrackerEntry cadence (frequency 2, 4/32 threshold, 60th-tick move, 400-tick teleport), the client copy
// interpolates over 3 increments (setPositionAndRotation2), and the dimRespawn snapshot is cut by the player tracker. Facts: .shared-memory/notes/mptrack74-b74-track.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { newInterp, stepInterp, PLAYER_INCREMENTS } from './multiplayer/client-ptrack.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const fixture = () => {
  const world = new World('mptrack74-b74');
  world.spawn = () => ({ x: 8.5, y: 100, z: 8.5 });
  return new DedicatedSimulation({}, { world, gameMode: 'creative', mobs: false, rules: { viewDistance: 8, chunkStream: false } });
};
const place = (p, x, z) => { p.position.copy({ x, y: 100, z }); p.previous.copy(p.position); p.flying = true; };
const rowOf = (s, pid, tid, m) => s.playerTracker.messageFor(pid, m, 0, m).players.find(r => r.id === tid);

test('a walking player appears in the viewer rows only on the 2-tick beat and in 4/32 steps', () => {
  const s = fixture(), a = s.addPlayer('a', 'ax', key(1)), b = s.addPlayer('b', 'bx', key(2));
  place(a, 8.5, 8.5); place(b, 12.5, 8.5); s.snapshot('a'); s.snapshot('b');
  rowOf(s, 'a', 'b', s.tick());
  const seen = [];
  for (let i = 0; i < 12; i++) {
    b.position.copy({ x: b.position.x + 0.05, y: 100, z: 8.5 }); // 0.05 per tick: 1.6/32
    const r = rowOf(s, 'a', 'b', s.tick());
    assert.equal(r.far, undefined);
    seen.push(r.x);
  }
  const changes = seen.filter((x, i) => i && x !== seen[i - 1]).length;
  assert.ok(changes > 0 && changes <= 6, `held between packets: ${seen.join(' ')}`);
  for (let i = 1; i < seen.length; i++) assert.ok(Math.abs(seen[i] - seen[i - 1]) === 0 || Math.abs(seen[i] - seen[i - 1]) >= 4 / 32 - 1e-9, 'only 4/32 or larger moves');
  assert.ok(b.position.x - seen[seen.length - 1] < 0.25, 'the held position trails by less than a move step');
});

test('the viewer sees his own row live; a standing player never moves in the rows', () => {
  const s = fixture(), a = s.addPlayer('a', 'ax', key(1)), b = s.addPlayer('b', 'bx', key(2));
  place(a, 8.5, 8.5); place(b, 12.5, 8.5); s.snapshot('a'); s.snapshot('b');
  a.position.copy({ x: 8.51, y: 100, z: 8.5 });
  const m = s.tick();
  assert.equal(rowOf(s, 'a', 'a', m).x, 8.51);
  assert.equal(rowOf(s, 'a', 'b', m).x, 12.5);
});

test('a riding player keeps his live row', () => {
  const s = fixture(), a = s.addPlayer('a', 'ax', key(1)), b = s.addPlayer('b', 'bx', key(2));
  place(a, 8.5, 8.5); place(b, 12.5, 8.5); s.snapshot('a'); s.snapshot('b');
  const m = { type: 'tick', players: [{ id: 'a', name: 'ax', x: 8.5, y: 100, z: 8.5 }, { id: 'b', name: 'bx', x: 12.37, y: 100, z: 8.5, riding: 'c1' }] };
  s.tick();
  assert.equal(s.playerTracker.rowsFor('a', m.players, new Set(['b']), 0).find(r => r.id === 'b').x, 12.37);
});

test('the client copy interpolates a packet over 3 ticks (setPositionAndRotation2)', () => {
  const ip = newInterp({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  const row = { x: 0.9, y: 0, z: 0, yaw: 0, pitch: 0 };
  const xs = [stepInterp(ip, row).x, stepInterp(ip, row).x, stepInterp(ip, row).x, stepInterp(ip, row).x];
  assert.equal(PLAYER_INCREMENTS, 3);
  assert.ok(Math.abs(xs[0] - 0.3) < 1e-12 && Math.abs(xs[1] - 0.6) < 1e-12 && Math.abs(xs[2] - 0.9) < 1e-12 && xs[3] === xs[2]);
});

test('the client yaw turns the short way across the seam; a rider snaps', () => {
  const ip = newInterp({ x: 0, y: 0, z: 0, yaw: 3.0, pitch: 0 });
  const r = stepInterp(ip, { x: 0, y: 0, z: 0, yaw: -3.0, pitch: 0 });
  assert.ok(r.yaw > 3.0 && r.yaw < 3.1, 'moves up through pi, not down through 0');
  const snapped = stepInterp(ip, { x: 5, y: 1, z: 2, yaw: 1, pitch: 0 }, true);
  assert.equal(snapped.x, 5); assert.equal(snapped.inc, 0);
});

test('the dimRespawn snapshot is cut: a player of the destination outside the tracked set is a list entry', () => {
  const s = fixture(), a = s.addPlayer('a', 'ax', key(1)), b = s.addPlayer('b', 'bx', key(2));
  place(a, 8.5, 8.5); place(b, 8.5, 8.5); s.snapshot('a'); s.snapshot('b');
  s.dimensions.arrive(b, -1, { at: { x: 64.5, y: 64, z: 64.5 } });
  s.tick();
  s.dimensions.arrive(a, -1, { at: { x: 64.5, y: 64, z: 64.5 } });
  const out = a.dimOut.find(m => m.type === 'dimRespawn');
  const rb = out.world.players.find(r => r.id === 'b');
  assert.ok(rb);
  assert.equal(rb.far, true, 'no column sent yet: not tracked by the arriving player');
  assert.equal(out.world.players.find(r => r.id === 'a').far, undefined);
});
