// Batch 63 mpend: the End on the dedicated server (server-end.js). One End is built per simulation (about a second), so the checks share a fixture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { restoreReplica } from './multiplayer/client.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { END_OFFSET } from './multiplayer/client-dimensions.js';
import { buildExitPortal } from './multiplayer/server-end.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const FRAME = 104, EYE = 1960, END_PORTAL = 149, OBSIDIAN = 22;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture(mode = 'survival') {
  const world = new World('mp-end-b63');
  for (let x = 40; x <= 100; x++) for (let z = 50; z <= 80; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return { s: new DedicatedSimulation({}, { world, gameMode: mode, mobs: false }), world };
}
// twelve frames round a 3 x 3 interior at x 62..64, z 62..64 (y 10), each facing inward
const ring = world => {
  for (let i = 0; i < 3; i++) {
    world.set(62 + i, 10, 61, FRAME, true, 0); world.set(62 + i, 10, 65, FRAME, true, 2);
    world.set(61, 10, 62 + i, FRAME, true, 3); world.set(65, 10, 62 + i, FRAME, true, 1);
  }
};

test('eyes on a ring of frames light the end portal; the last eye is the one that does it', { timeout: 120000 }, () => {
  const { s, world } = fixture();
  ring(world);
  const p = s.addPlayer('a', 'Alice', key(1));
  p.survival.inventory.main[0] = { id: EYE, count: 12, damage: 0 };
  const cells = [];
  for (let i = 0; i < 3; i++) cells.push([62 + i, 61], [62 + i, 65]);
  for (let i = 0; i < 3; i++) cells.push([61, 62 + i], [65, 62 + i]);
  cells.forEach(([x, z], i) => {
    assert.equal(world.get(62, 10, 62), 0, 'no portal before the last eye');
    assert.equal(s.dimensions.useItem(p, { block: [x, 10, z] }, EYE), true);
    assert.ok(world.getMeta(x, 10, z) & 4, 'eye bit');
    if (i < 11) assert.notEqual(world.get(63, 10, 63), END_PORTAL);
  });
  assert.equal(world.get(63, 10, 63), END_PORTAL);
  assert.equal(p.survival.inventory.main[0], null, 'twelve eyes taken');
});

test('an eye on a frame outside Creative is taken; Creative keeps it; a block that is not a frame is not handled', () => {
  const { s, world } = fixture('creative');
  const p = s.addPlayer('a', 'Alice', key(1));
  world.set(70, 10, 70, FRAME, true, 0);
  assert.equal(s.dimensions.useItem(p, { block: [70, 10, 70], adjacent: [70, 11, 70] }, EYE), true);
  assert.ok(world.getMeta(70, 10, 70) & 4);
  assert.equal(s.dimensions.useItem(p, { block: [71, 10, 70], adjacent: [71, 11, 70] }, EYE), false);
});

test('an end portal sends the player to the End platform (theEnd); the exit portal sends them back (theEnd2)', { timeout: 120000 }, () => {
  const { s, world } = fixture();
  world.set(64, 10, 64, END_PORTAL, true, 0);
  const a = s.addPlayer('a', 'Alice', key(1)), b = s.addPlayer('b', 'Bob', key(2));
  b.position.copy({ x: 90.5, y: 10, z: 70.5 });
  a.position.copy({ x: 64.5, y: 10, z: 64.5 }); a.previous.copy(a.position);
  s.input('a', input()); s.input('b', input());
  s.tick();
  assert.equal(a.dimension, 1);
  assert.equal(a.world, s.dimensions.end.n.world);
  assert.ok(a.world.isEnd && a.world.hasNoSky && !a.world.isHell);
  const r = a.dimOut.find(m => m.type === 'dimRespawn');
  assert.ok(r && r.dimension === 1 && r.world.dimension === 1 && r.world.columns.length === 64);
  const rep = restoreReplica(r.world);
  assert.equal(rep.dimension, 1);
  assert.equal(a.position.x, 100 + END_OFFSET.x); assert.equal(a.position.z, END_OFFSET.z);
  const w = a.world;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    assert.equal(w.get(a.position.x + dx, 48, a.position.z + dz), OBSIDIAN, 'obsidian platform');
    assert.equal(w.get(a.position.x + dx, 49, a.position.z + dz), 0);
  }
  assert.ok(s.events.some(e => e.type === 'award' && e.id === 'a' && e.achievement === 'theEnd'));
  assert.ok(!s.events.some(e => e.achievement === 'portal'), 'no nether portal award');
  assert.equal(b.dimension | 0, 0, 'Bob stays');
  assert.deepEqual(s.dimensions.alt[1].players.map(x => x.id), ['a'], 'only End players in the End message');
  assert.ok(!s.presence(0).some(x => x.id === 'a'));
  // b64: the exit portal is the dying dragon's now; build its structure by hand (the dragon's death is tested in mpdragon-b64.test.js)
  const [ex, ez] = [END_OFFSET.x, END_OFFSET.z];
  buildExitPortal(w);
  assert.equal(w.get(ex + 2, 64, ez), END_PORTAL);
  a.dimOut = null;
  a.position.copy({ x: ex + 2.5, y: 64, z: ez + 0.5 }); a.previous.copy(a.position);
  s.input('a', input());
  s.tick();
  assert.equal(a.dimension, 1, 'b64: the player waits in the End while the credits roll');
  assert.ok(a.dimOut.some(m => m.type === 'dragonCredits' && m.reason === 4));
  assert.ok(s.events.some(e => e.achievement === 'theEnd2'));
  a.dimOut = null;
  s.serverSurvival.respawn(a); // C16 after the credits
  assert.equal(a.dimension | 0, 0);
  assert.equal(a.world, world);
  assert.ok(a.dimOut.some(m => m.type === 'dimRespawn' && !m.world.dimension));
});

test('the End has terrain and spawns only enderman-type mobs; it is saved and restored', { timeout: 120000 }, () => {
  const { s } = fixture();
  const a = s.addPlayer('a', 'Alice', key(1));
  s.dimensions.arrive(a, 1);
  const w = a.world;
  let stone = 0;
  for (let x = 0; x < 128; x += 2) for (let z = 0; z < 128; z += 2) for (let y = 0; y < 128; y++) if (w.get(x, y, z) === 152) stone++;
  assert.ok(stone > 2000, 'end stone island, ' + stone);
  w.set(10, 100, 10, 1, true, 0);
  s.input('a', input());
  for (let i = 0; i < 40; i++) s.tick();
  for (const e of s.dimensions.end.n.mobs.mobs.entities) assert.ok(['enderman', 'ender_dragon', 'ender_crystal'].includes(e.type), e.type); // b64: + the dragon and its crystals
  const saved = s.save?.() ?? s.snapshotSave?.();
  assert.ok(saved?.dimensions?.end?.edits?.length, 'end edits saved');
  assert.equal(s.dimensions.savedFields(a).dimension, 1);
});

test('a player saved in the End rejoins it, with the End\'s edits', { timeout: 120000 }, () => {
  const { s } = fixture();
  const a = s.addPlayer('a', 'Alice', key(1));
  s.dimensions.arrive(a, 1);
  a.world.set(10, 100, 10, 1, true, 0);
  const saved = JSON.parse(JSON.stringify(s.save()));
  assert.equal(saved.players.find(([k]) => k === key(1))[1].dimension, 1);
  const w2 = new World('mp-end-b63'); w2.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const again = new DedicatedSimulation(saved, { world: w2, gameMode: 'survival', mobs: false });
  const back = again.addPlayer('a2', 'Alice', key(1));
  assert.equal(back.dimension, 1);
  assert.equal(back.world.get(10, 100, 10), 1, 'the edited End cell was restored');
  const welcome = again.snapshot('a2');
  assert.equal(welcome.dimension, 1);
  assert.deepEqual(welcome.players.map(x => x.id), ['a2']);
});
