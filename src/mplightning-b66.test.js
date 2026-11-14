// Batch 66 mplightning: lightning on the dedicated server (server-lightning.js, client-lightning.js).
// Bytecode-read facts (javap over the 1.7.10 jar): only Entity (sa), EntityPig (wo) and EntityCreeper (xz) override onStruckByLightning(xh), so a villager makes no witch and a mooshroom no change;
// WorldServer.addWeatherEffect (mt.c) sends the spawn with sendToAllNear(x, y, z, 512, dimension).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, FIRE } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { RemoteLightning } from './multiplayer/client-lightning.js';
import { LightningBolt, Weather } from './weather.js';
import { JavaRandom } from './java-random.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture(gameMode = 'survival', options = {}) {
  const world = new World('mp-lightning-b66');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode, mobs: true, ...options });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
}
const join = (s, id, n, x, z, y = 10) => { const p = s.addPlayer(id, id + 'x', key(n)); p.position.copy({ x, y, z }); p.previous.copy(p.position); s.input(id, input()); return p; };
const bare = s => { s.tick(); for (const p of s.players.values()) p.survival.protection = 0; return s; }; // the join's 60 ticks of spawn protection would refuse the damage
const mob = (s, type, x, z) => { const m = s.mobs.mobs.create(type, x, 10, z); s.mobs.mobs.entities.push(m); return m; };
const bolt = (s, x, z) => { const b = new LightningBolt(x, 10, z, new JavaRandom(7), s.fire.strikes); s.weather.bolts.push(b); return b; };
const out = p => { const o = p.dispOut ?? []; p.dispOut = null; return JSON.parse(JSON.stringify(o)); };

test('a thunderstorm roll makes one bolt and announces it once to a player within 512 blocks, not for one beyond 512 blocks', () => {
  const s = fixture(), near = join(s, 'a', 1, 64.5, 64.5), far = join(s, 'b', 2, 64.5, 64.5);
  Object.assign(s.weather, { raining: true, thundering: true, rain: 1, thunder: 1, prevRain: 1, prevThunder: 1, rainTime: 99999, thunderTime: 99999 });
  const r = s.weather.random, next = r.nextInt.bind(r); let fired = 0;
  r.nextInt = n => (n === 100000 && !fired++ ? 0 : next(n));
  s.tick();
  assert.equal(s.weather.bolts.length, 1);
  const msgs = out(near).filter(m => m.type === 'boltSpawn');
  assert.equal(msgs.length, 1);
  assert.ok(Number.isFinite(msgs[0].x) && msgs[0].y >= 9);
  out(far);
  out(near);
  s.lightning.spawn({ x: 64.5 + 600, y: 10, z: 64.5 }); // beyond sendToAllNear's 512
  assert.equal(out(far).filter(m => m.type === 'boltSpawn').length, 0);
  s.lightning.spawn({ x: 64.5 + 500, y: 10, z: 64.5 });
  out(near);
  assert.equal(out(far).filter(m => m.type === 'boltSpawn').length, 1);
  s.tick(); s.tick();
  assert.equal(out(near).filter(m => m.type === 'boltSpawn').length, 0, 'announced only when the bolt is new');
});

test('no thunder, no roll: a clear sky never strikes', () => {
  const s = fixture(); join(s, 'a', 1, 64.5, 64.5);
  const r = s.weather.random, next = r.nextInt.bind(r);
  r.nextInt = n => (n === 100000 ? 0 : next(n));
  for (let i = 0; i < 5; i++) s.tick();
  assert.equal(s.weather.bolts.length, 0);
});

test('a bolt hurts the player in its box by 5 and sets the fire counter; a Creative player and a far one are untouched', () => {
  const s = fixture(), a = join(s, 'a', 1, 64.5, 64.5), far = join(s, 'b', 2, 100.5, 100.5), hp = a.survival.health;
  bare(s); bolt(s, 64.5, 64.5);
  s.tick();
  assert.ok(a.survival.health <= hp - 5 + 0.001 && a.survival.health < hp, `health ${hp} -> ${a.survival.health}`);
  assert.equal(far.survival.health, 20);
  const c = fixture('creative'), p = join(c, 'a', 1, 64.5, 64.5);
  bare(c); bolt(c, 64.5, 64.5); c.tick();
  assert.equal(p.survival.health, 20);
});

test('mobs: a pig becomes a pigman, a creeper is charged, a zombie takes the 5 and burns, a mob outside the box is spared; no witch from a villager', () => {
  const s = fixture(); join(s, 'a', 1, 90.5, 90.5);
  const pig = mob(s, 'pig', 64.5, 64.5), creeper = mob(s, 'creeper', 65.5, 64.5), zombie = mob(s, 'zombie', 63.5, 65.5), spared = mob(s, 'cow', 80.5, 64.5);
  const health = zombie.health, cow = spared.health;
  bolt(s, 64.5, 64.5); s.tick();
  const list = s.mobs.mobs.entities;
  assert.ok(!list.includes(pig) && list.some(e => e.type === 'pigman' && Math.abs(e.x - 64.5) < 0.5));
  assert.equal(creeper.powered, true);
  assert.ok(zombie.health < health || zombie.health <= 0);
  assert.ok(zombie.fire > 0 || zombie.health <= 0);
  assert.equal(spared.health, cow);
  assert.ok(!list.some(e => e.type === 'witch'));
});

test('items and experience orbs in the box are destroyed (health 5, 5 fire damage)', () => {
  const s = fixture(); join(s, 'a', 1, 90.5, 90.5);
  s.items.spawn({ id: 1, count: 1, damage: 0 }, 64.5, 10.2, 64.5);
  s.items.spawn({ id: 1, count: 1, damage: 0 }, 90.5, 10.2, 80.5);
  s.serverItems.xp.spawn(3, { x: 65, y: 10, z: 65 });
  bolt(s, 64.5, 64.5); s.tick();
  assert.equal(s.items.items.filter(e => !e.dead).length, 1);
  assert.ok(s.serverItems.xp.orbs.every(o => o.dead) || s.serverItems.xp.orbs.length === 0);
});

test('fire from the bolt follows the server difficulty (Normal and Hard place it, Easy does not)', () => {
  const placed = d => { const s = fixture('creative', { difficulty: d }); join(s, 'a', 1, 90.5, 90.5); bolt(s, 64.5, 64.5); let n = 0; for (let dx = -1; dx <= 1; dx++) for (let y = 9; y <= 11; y++) for (let dz = -1; dz <= 1; dz++) if (s.world.get(64 + dx, y, 64 + dz) === FIRE) n++; return n; };
  assert.equal(placed(1), 0);
  assert.ok(placed(2) >= 1);
  assert.ok(placed(3) >= 1);
});

test('the client makes its own bolt from boltSpawn: sky flash, thunder (10000) and explosion sounds, and it ends', () => {
  const w = new Weather(), heard = [], c = new RemoteLightning(() => w, e => heard.push(e));
  c.apply({ type: 'boltSpawn', i: 1, x: 10, y: 20, z: 30 });
  c.apply({ type: 'boltSpawn', i: 2, x: NaN, y: 0, z: 0 });
  assert.equal(w.bolts.length, 1);
  c.tick();
  assert.equal(w.lastLightning, 2);
  assert.deepEqual(heard.map(e => e.sound), ['ambient.weather.thunder', 'random.explode']);
  assert.equal(heard[0].volume, 10000);
  assert.equal(heard[1].volume, 2);
  for (let i = 0; i < 200 && w.bolts.length; i++) c.tick();
  assert.equal(w.bolts.length, 0);
  for (let i = 0; i < 3; i++) c.tick();
  assert.equal(w.lastLightning, 0);
});
