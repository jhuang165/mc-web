import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { RemoteMobs, isMobSound } from './multiplayer/remote-mobs.js';
import { unionChunkOrder } from './multiplayer/server-mobs.js';
import { eligibleChunkOrder } from './spawner-animals.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture(gameMode = 'creative', options = {}) {
  const world = new World('mp-mobs-b60');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({}, { world, gameMode, mobs: true, ...options });
}
const join = (s, id, n, x = 64.5, z = 64.5) => { const p = s.addPlayer(id, id + 'x', key(n)); p.position.copy({ x, y: 10, z }); p.previous.copy(p.position); s.input(id, input()); return p; };
const mob = (s, type, x, z) => { const m = s.mobs.mobs.create(type, x, 10, z); s.mobs.mobs.entities.push(m); return m; };
const quiet = s => { s.mobs.spawning = false; s.mobs.mobs.entities.length = 0; return s; };
const packets = p => { const out = p.mobPackets ?? []; p.mobPackets = null; return JSON.parse(JSON.stringify(out)); };
const wire = m => Number(m.id.slice(4));
const spies = () => { const log = { sounds: [], particles: [] }; return { log, fx: { sound: (...a) => log.sounds.push(a), particle: (...a) => log.particles.push(a) } }; };

test('unionChunkOrder: one player is the single-player order, two players share one map', () => {
  const one = unionChunkOrder([[4, 4]], 0, 0, 16);
  assert.equal(one.capacity, 512);
  assert.deepEqual(one.order, eligibleChunkOrder(4, 4).map(([dx, dz, e]) => [4 + dx, 4 + dz, e]));
  const two = unionChunkOrder([[4, 4], [6, 4]], 0, 0, 16);
  assert.equal(two.size, 19 * 17); // the windows overlap over 15 columns
  assert.equal(two.capacity, 512);
  assert.equal(unionChunkOrder([[4, 4], [40, 4]], 0, 0, 16).capacity, 1024); // 578 entries pass the 384 threshold of 512
  const edge = (u, x, z) => u.order.find(c => c[0] === x && c[1] === z)[2];
  assert.equal(edge(two, 12, 4), false); // the edge of the first window is inside the second: put as false
  assert.equal(edge(two, -4 + 0, 4), true);
  assert.equal(unionChunkOrder([[4, 4]], 0, 0, 1024).capacity, 1024); // the table never shrinks
});

test('two players: the spawn pass runs once per tick over the union and the cap uses its size', () => {
  const s = fixture('creative'), a = join(s, 'a', 1, 60.5, 64.5), b = join(s, 'b', 2, 70.5, 64.5);
  let passes = 0; const run = s.mobs.spawnPass.bind(s.mobs); s.mobs.spawnPass = () => { passes++; return run(); };
  s.tick(); s.tick(); s.tick();
  assert.equal(passes, 3);
  assert.equal(s.mobs.pass.ctx.capChunks, s.mobs.eligibleChunks());
  assert.ok(s.mobs.eligibleChunks() > 289 && s.mobs.eligibleChunks() < 578);
  assert.ok(a && b);
});

test('a hit plays the server sounds for players in range and the status sounds on the copies', () => {
  const s = quiet(fixture('creative')), a = join(s, 'a', 1), far = join(s, 'f', 2, 100.5, 100.5), pig = mob(s, 'pig', 66.5, 64.5);
  const { log, fx } = spies(), remote = new RemoteMobs(s.world, fx);
  for (let i = 0; i < 3; i++) { s.tick(); remote.apply(packets(a)); }
  s.mobs.attack(a, wire(pig));
  s.tick();
  const sound = a.soundsOut?.find(x => x.name === 'mob.pig.say');
  assert.ok(sound, 'S29 hurt sound');
  assert.ok(Math.abs(sound.x - pig.x) < 1 && Number.isFinite(sound.pitch));
  assert.equal(far.soundsOut?.length ?? 0, 0, 'out of range');
  const got = packets(a);
  assert.ok(got.some(p => p.type === 'mobStatus' && p.status === 2));
  remote.apply(got);
  assert.equal(log.sounds.length, 1);
  assert.equal(log.sounds[0][0], 'mob.pig.say');
  assert.ok(remote.copies.get(wire(pig)).mob.hurt > 0);
  assert.ok(isMobSound('mob.zombie.step') && isMobSound('random.explode') && !isMobSound('gui.button.press') && !isMobSound('../x'));
});

test('a kill sends status 3 and the death sound, spawns experience orbs, and the copy poofs 20 particles', () => {
  const s = quiet(fixture('creative')), a = join(s, 'a', 1), pig = mob(s, 'pig', 66.5, 64.5), { log, fx } = spies(), remote = new RemoteMobs(s.world, fx);
  for (let i = 0; i < 3; i++) { s.tick(); remote.apply(packets(a)); remote.tick(); }
  pig.health = 1; pig.recentlyHit = 100;
  let orbs = 0; const spawn = s.serverItems.xp.spawn.bind(s.serverItems.xp); s.serverItems.xp.spawn = (v, p) => { orbs += v; spawn(v, p); };
  s.mobs.attack(a, wire(pig));
  const seen = [];
  for (let i = 0; i < 30; i++) { s.tick(); const got = packets(a); seen.push(...got); remote.apply(got); remote.tick(); }
  assert.ok(seen.some(p => p.type === 'mobStatus' && p.status === 3));
  assert.ok(log.sounds.some(x => x[0] === 'mob.pig.death'));
  assert.ok(orbs >= 1 && orbs <= 3, `xp ${orbs}`); // a pig's 1 to 3 points, as orbs of server-items.js
  assert.equal(log.particles.filter(p => p[0] === 'explode').length, 20);
});

test('a mob hit knocks the server player: the queued knockback moves the position', () => {
  const s = quiet(fixture('survival')), a = join(s, 'a', 1);
  a.survival.protection = 0;
  const x0 = a.position.x;
  assert.ok(s.damagePlayer(a, 3, { name: 'zombie', from: { x: x0 - 2, y: 10, z: 64.5 } }));
  assert.equal(a.survival.knockQueue.length, 1);
  s.tick(); s.tick();
  assert.equal(a.survival.knockQueue.length, 0);
  assert.ok(a.position.x > x0 + 0.1, `moved to ${a.position.x}`);
});

test('every watcher gets a mob\'s knockback velocity packet, not only the first player', () => {
  const s = quiet(fixture('creative')), a = join(s, 'a', 1), b = join(s, 'b', 2, 70.5, 64.5), cow = mob(s, 'cow', 66.5, 64.5);
  for (let i = 0; i < 4; i++) { s.tick(); packets(a); packets(b); }
  Object.assign(cow, { vx: 0.3, vy: 0.4, vz: 0 }); cow.velocityChanged = true;
  s.mobs.mobs.entities; s.tick();
  for (const p of [a, b]) assert.ok(packets(p).some(x => x.type === 'velocity'), `${p.id} got S12`);
  assert.equal(cow.velocityChanged, false);
});

test('feeding sends status 18 (hearts) to the watchers and the copy draws 7 heart particles', () => {
  const s = quiet(fixture('creative')), a = join(s, 'a', 1), pig = mob(s, 'pig', 66.5, 64.5), { log, fx } = spies(), remote = new RemoteMobs(s.world, fx);
  for (let i = 0; i < 3; i++) { s.tick(); remote.apply(packets(a)); }
  assert.ok(s.mobs.mobs.feed(pig, 322, { creative: true, inventory: { held: { id: 322 } }, count: () => 1 }));
  s.tick(); const got = packets(a);
  assert.ok(got.some(p => p.type === 'mobStatus' && p.status === 18));
  remote.apply(got);
  assert.equal(log.particles.filter(p => p[0] === 'heart').length, 7);
});
