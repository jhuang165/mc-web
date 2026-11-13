// Batch 63 lead: joins between tracks that no single track could test.
// - mpnether3 gave the Nether its own orbs, pickup list and vehicles; mpend builds the End with the same Nether code (n.dim = 1). The End now has its own orbs, pickups and
//   vehicles too, and an End player's orbs are not the Overworld's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { ExperienceOrbs } from './experience.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const END_PORTAL = 149;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });

test('the End has its own orbs, pickup list and vehicles; End orbs reach End players only', { timeout: 120000 }, () => {
  const world = new World('b63-lead-end');
  for (let x = 40; x <= 100; x++) for (let z = 50; z <= 80; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: false });
  world.set(64, 10, 64, END_PORTAL, true, 0);
  const a = s.addPlayer('a', 'Alice', key(1)), b = s.addPlayer('b', 'Bob', key(2));
  b.position.copy({ x: 90.5, y: 10, z: 70.5 });
  a.position.copy({ x: 64.5, y: 10, z: 64.5 }); a.previous.copy(a.position);
  s.input('a', input()); s.input('b', input());
  s.tick();
  assert.equal(a.dimension, 1);
  const n = s.dimensions.end.n;
  assert.ok(n.xp instanceof ExperienceOrbs, 'real End orbs');
  assert.ok(Array.isArray(n.taken));
  assert.notEqual(n.xp, s.serverItems.xp, 'not the Overworld orbs');
  assert.equal(n.vehicles?.dim, 1, 'End vehicles');
  assert.deepEqual([...n.vehicles.host.players.values()].map(p => p.id), ['a'], 'End vehicles see End players only');
  const before = a.experience.total ?? a.experience.totalExperience ?? 0;
  s.dimensions.within(a, () => s.serverItems.xp.spawn(7, { x: a.position.x, y: a.position.y + 0.2, z: a.position.z }));
  assert.equal(n.xp.orbs.length, 1, 'spawned in the End');
  assert.equal(s.serverItems.xp.orbs.length, 0, 'not in the Overworld');
  for (let i = 0; i < 40; i++) { s.input('a', input()); s.input('b', input()); s.tick(); }
  assert.equal(n.xp.orbs.length, 0, 'collected');
  const after = a.experience.total ?? a.experience.totalExperience ?? 0;
  assert.ok(after > before || a.experience.level > 0 || a.experience.progress > 0, 'Alice collected the End orb');
  const saved = s.dimensions.end.saveField();
  assert.ok(Array.isArray(saved.xpOrbs), 'End orbs saved');
});
