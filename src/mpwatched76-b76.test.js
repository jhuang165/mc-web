// Batch 76 mpwatched76: which player values force the tracker's off-beat send (score yes; sleeping and riding no), and the rider branch of the entry.
// Facts: .shared-memory/notes/mpwatched76-b76-track.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ServerPlayerTracker, watcherSig } from './multiplayer/server-player-tracker.js';

const mk = (over = {}) => ({ position: { x: 8.5, y: 100, z: 8.5 }, yaw: 0, pitch: 0, grounded: true, input: {}, motion: { sprinting: false }, experience: { score: 0 }, survival: { health: 20, air: 300, fire: 0, effects: { has: () => false } }, ...over });
const rig = () => {
  const players = new Map(); const host = { players, rules: {}, ticks: 0 }; const tr = new ServerPlayerTracker(host);
  const t = mk(); players.set('p0', t);
  const step = () => { host.ticks++; tr.advance(0, players, host.ticks); return tr.released(0, 'p0'); };
  return { tr, t, step };
};

test('the score (watcher 18) changes the signature; sleeping and riding do not', () => {
  const a = mk();
  const b = mk(); b.experience.score = 7;
  assert.notEqual(watcherSig(a), watcherSig(b));
  assert.equal(watcherSig(mk({ sleeping: true })), watcherSig(a), 'sleeping is a plain field (S0A), not a watched value');
  assert.equal(watcherSig(mk({ mount: { key: 'cart:1' } })), watcherSig(a), 'riding is S1B, not a watched value');
});

test('a score change forces the off-beat position send; sleeping does not', () => {
  const run = (change, offset) => {
    const { t, step } = rig(); step(); for (let i = 0; i < offset; i++) step();
    const before = step().x;
    t.position.x += 0.2; change(t);
    return step().x !== before;
  };
  for (const off of [0, 1]) assert.equal(run(t => { t.experience.score += 3; }, off), true, `score forces (offset ${off})`);
  const plain = [run(() => {}, 0), run(() => {}, 1)].sort();
  const sleep = [run(t => { t.sleeping = true; }, 0), run(t => { t.sleeping = true; }, 1)].sort();
  assert.deepEqual(sleep, plain, 'sleeping leaves the cadence alone');
});

test('a rider sends no move packets; after the dismount the first send is a teleport at y + 1/64', () => {
  const { t, step } = rig(); step(); step();
  t.mount = { key: 'cart:1' };
  const held = step().x; step();
  t.position.x += 3; step(); step(); step();
  assert.equal(step().x, held, 'the entry keeps its encoded position while riding (the row is live)');
  delete t.mount; step(); step();
  const r = step();
  assert.ok(Math.abs(r.x - t.position.x) < 1 / 32 + 1e-9, 'the teleport brought the viewers to the dismounted position');
  assert.ok(Math.abs(r.y - (100 + 1 / 64)) < 1 / 32 + 1e-9);
});
