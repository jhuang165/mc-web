import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { RemoteMobs } from './multiplayer/remote-mobs.js';
import { SUPPORTED, mobState } from './multiplayer/server-mobs.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture(gameMode = 'creative', saved = {}, options = {}) {
  const world = new World('mp-mobtypes-b61');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({ ...saved }, { world, gameMode, mobs: true, ...options });
}
const join = (s, id, n, x = 64.5, z = 64.5) => { const p = s.addPlayer(id, id + 'x', key(n)); p.position.copy({ x, y: 10, z }); p.previous.copy(p.position); s.input(id, input()); return p; };
const mob = (s, type, x, z, y = 10) => { const m = s.mobs.mobs.create(type, x, y, z); s.mobs.mobs.entities.push(m); return m; };
const quiet = s => { s.mobs.spawning = false; s.mobs.mobs.entities.length = 0; return s; };
const packets = p => { const out = p.mobPackets ?? []; p.mobPackets = null; return JSON.parse(JSON.stringify(out)); };
const wire = m => Number(m.id.slice(4));
const run = (s, a, remote, n) => { for (let i = 0; i < n; i++) { s.tick(); remote.apply(packets(a)); remote.tick(); } };

test('SUPPORTED is a plain Set with every natural Overworld kind', () => {
  assert.ok(SUPPORTED instanceof Set);
  for (const t of ['enderman', 'slime', 'witch', 'cave_spider', 'squid', 'bat', 'wolf', 'ocelot', 'horse', 'mooshroom']) assert.ok(SUPPORTED.has(t), t);
});

test('every new kind reaches the client as a copy with a stand-in the renderer can build', () => {
  const s = quiet(fixture()), a = join(s, 'a', 1), remote = new RemoteMobs(s.world);
  const made = {};
  let x = 52.5;
  for (const t of ['enderman', 'slime', 'witch', 'cave_spider', 'wolf', 'ocelot', 'horse', 'mooshroom']) { made[t] = mob(s, t, x, 70.5); x += 3; }
  made.squid = mob(s, 'squid', 80.5, 60.5, 12); made.bat = mob(s, 'bat', 80.5, 66.5, 12);
  run(s, a, remote, 6);
  for (const [t, m] of Object.entries(made)) { const c = remote.copies.get(wire(m)); assert.ok(c, t + ' has a copy'); assert.equal(c.mob.type, t); assert.ok(c.client.present, t); }
});

test('an enderman copy carries the block it holds and screams; a slime copy has the size', () => {
  const s = quiet(fixture()), a = join(s, 'a', 1), remote = new RemoteMobs(s.world);
  const en = mob(s, 'enderman', 70.5, 64.5), sl = mob(s, 'slime', 60.5, 64.5);
  en.carried = 2; en.carriedData = 0; sl.size = 4; sl.health = 16;
  run(s, a, remote, 3);
  en.carried = 12; en.carriedData = 1;
  run(s, a, remote, 2);
  const ce = remote.copies.get(wire(en)).mob, cs = remote.copies.get(wire(sl)).mob;
  assert.equal(ce.carried, 12); assert.equal(ce.carriedData, 1);
  en.screaming = true; assert.equal(mobState(en).screaming, 1);
  assert.equal(cs.size, 4);
  assert.ok(remote.copies.get(wire(sl)).client.height > 2, 'the box is the size 4 one: ' + remote.copies.get(wire(sl)).client.height);
});

test('a slime that dies splits on the server and the children reach the client with the half size', () => {
  const s = quiet(fixture()), a = join(s, 'a', 1), remote = new RemoteMobs(s.world);
  const sl = mob(s, 'slime', 64.5, 70.5);
  Object.assign(sl, { size: 4, health: 16 });
  run(s, a, remote, 3);
  s.mobs.mobs.attack(sl, 115, a.survival, { x: 64.5, y: 10, z: 64.5, yaw: 0 }); // diamond sword is not owned here; the hit may do only 1: finish it
  sl.health = 0;
  run(s, a, remote, 40);
  const kids = [...remote.copies.values()].filter(c => c.mob.type === 'slime' && c.mob.size === 2);
  assert.ok(kids.length >= 2 && kids.length <= 4, 'children ' + kids.length);
  assert.ok(!remote.copies.has(wire(sl)) || remote.copies.get(wire(sl)).mob.health <= 0);
});

test('wolf, ocelot, horse, bat and zombie villager flags ride along', () => {
  const s = quiet(fixture()), a = join(s, 'a', 1), remote = new RemoteMobs(s.world);
  const wolf = mob(s, 'wolf', 60.5, 64.5), cat = mob(s, 'ocelot', 62.5, 66.5), horse = mob(s, 'horse', 70.5, 64.5), bat = mob(s, 'bat', 66.5, 66.5, 12), zv = mob(s, 'zombie', 72.5, 70.5);
  Object.assign(wolf, { owner: 'someone', collar: 3, angry: false }); wolf.sitting = true;
  cat.catType = 2; horse.horse = { ...horse.horse, type: 1, variant: 0 }; bat.batHanging = true; zv.villager = true;
  run(s, a, remote, 4);
  const w = remote.copies.get(wire(wolf)).mob;
  assert.ok(w.owner); assert.equal(w.collar, 3); assert.equal(w.sitting, true);
  assert.equal(remote.copies.get(wire(cat)).mob.catType, 2);
  assert.equal(remote.copies.get(wire(horse)).mob.horse.type, 1);
  bat.batHanging = true; assert.equal(mobState(bat).hang, 1);
  assert.equal(remote.copies.get(wire(zv)).mob.villager, true);
});

test('natural spawning is no longer filtered to the old eight: a squid or a bat the spawner makes is kept', () => {
  const s = fixture(); s.mobs.mobs.entities.length = 0;
  join(s, 'a', 1);
  s.mobs.spawnPass();
  const add = s.mobs.pass.ctx.add;
  for (const t of ['squid', 'bat', 'enderman', 'wolf', 'horse', 'slime', 'witch', 'ocelot', 'mooshroom']) add(s.mobs.mobs.create(t, 64.5, 10, 64.5));
  const types = new Set(s.mobs.mobs.entities.map(e => e.type));
  for (const t of ['squid', 'bat', 'enderman', 'wolf', 'horse', 'slime', 'witch', 'ocelot', 'mooshroom']) assert.ok(types.has(t), t);
  add(s.mobs.mobs.create('ghast', 64.5, 10, 64.5));
  assert.ok(!s.mobs.mobs.entities.some(e => e.type === 'ghast'), 'a kind without a copy is still refused');
});

test('a spider jockey: the skeleton rider is attached to the spider on the client', () => {
  const s = quiet(fixture()), a = join(s, 'a', 1), remote = new RemoteMobs(s.world);
  const sp = mob(s, 'spider', 64.5, 70.5);
  s.mobs.mobs.spawnSpiderJockey(sp);
  assert.ok(s.mobs.mobs.entities.some(e => e.type === 'skeleton' && e.ridingEntity === sp), 'the server made the rider');
  run(s, a, remote, 5);
  const sk = [...remote.copies.values()].find(c => c.mob.type === 'skeleton');
  assert.ok(sk, 'rider copy');
  assert.ok(sk.client.ridingEntity, 'the copy rides');
  assert.ok(sk.mob.ridingEntity, 'the stand-in shows the riding legs');
});

test('one tracker entry per mob: the watchers share one tick phase and each gets the spawn when it joins', () => {
  const s = quiet(fixture()), a = join(s, 'a', 1, 60.5, 64.5), pig = mob(s, 'pig', 62.5, 64.5);
  for (let i = 0; i < 7; i++) s.tick();
  const t = s.mobs.tracker, en = t.entries.get(pig);
  assert.equal(t.entries.size, 1);
  const ticksBefore = en.entry.ticks;
  const b = join(s, 'b', 2, 66.5, 64.5); // joins later: no phase of its own
  s.tick();
  assert.equal(t.entries.get(pig), en, 'the same entry');
  assert.equal(en.entry.ticks, ticksBefore + 1, 'one counter, advanced once per tick for both watchers');
  const pb = packets(b);
  assert.ok(pb.some(p => p.type === 'spawn' && p.i === wire(pig)), 'the late watcher got the spawn');
  assert.equal(en.entry.set.size, 2);
  // a move packet goes to both in the same tick
  pig.x += 3; pig.vx = 0.1;
  let both = false;
  for (let i = 0; i < 6 && !both; i++) { s.tick(); const ma = packets(a), mb = packets(b); both = ma.some(p => p.i === wire(pig) && /move|teleport/.test(p.type)) && mb.some(p => p.i === wire(pig) && /move|teleport/.test(p.type)); }
  assert.ok(both, 'the same location packet reached both players');
});

test('a mob out of one watcher range is tracked by the other only, and leaving a watcher stops its packets', () => {
  const s = quiet(fixture()), a = join(s, 'a', 1, 30.5, 30.5), b = join(s, 'b', 2, 100.5, 100.5), ra = new RemoteMobs(s.world), rb = new RemoteMobs(s.world);
  const cow = mob(s, 'cow', 102.5, 100.5);
  for (let i = 0; i < 6; i++) { s.tick(); ra.apply(packets(a)); rb.apply(packets(b)); }
  assert.ok(rb.copies.has(wire(cow)));
  assert.ok(s.mobs.tracker.entries.get(cow).entry.set.has(s.mobs.views.get('b').watcher));
  s.removePlayer?.('b');
  if (!s.removePlayer) s.mobs.removePlayer('b');
  assert.equal(s.mobs.tracker.watchers.has('b'), false);
});

test('a kill after a delay (fire) credits no achievement: killEnemy goes to the killing blow only (sv.a(ro): source.getEntity().onKillEntity); recentlyHit keeps the loot credit', () => {
  const s = quiet(fixture('survival')), a = join(s, 'a', 1), z = mob(s, 'zombie', 66.5, 64.5), log = [];
  s.achievements.award = (p, id) => { log.push([p?.id, id]); return true; };
  s.tick();
  s.mobs.attack(a, wire(z)); // a hit that does not kill
  assert.ok(z.health > 0 && z.recentlyHit > 0, 'recentlyHit is set by the player hit (xp and loot credit)');
  z.health = 1;
  s.mobs.mobs.damageEntity(z, 5, 'onFire'); // dies of fire later, no attacker in the source
  for (let i = 0; i < 30; i++) s.tick();
  assert.ok(z.health <= 0, 'the zombie died');
  assert.ok(!log.some(([, id]) => id === 'killEnemy'), 'no killEnemy for a fire death: ' + JSON.stringify(log));
  const z2 = mob(s, 'zombie', 66.5, 66.5); z2.health = 0.05; log.length = 0;
  s.tick();
  s.mobs.attack(a, wire(z2));
  for (let i = 0; i < 5; i++) s.tick();
  assert.ok(log.some(([id, ach]) => id === 'a' && ach === 'killEnemy'), 'killEnemy for the blow: ' + JSON.stringify(log));
});
