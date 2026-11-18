// Batch 80 mpfx80: the client's own S27 block pass, server S27 bursts for ghast fireballs, wither skulls, crystals and TNT carts, and the client copy's fireball smoke.
// Facts: .shared-memory/notes/mpfx80-b80-track.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { World, FIRE, WATER } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { s27Decode, s27Encode } from './multiplayer/server-explosion-packet.js';
import { RemoteDispense } from './multiplayer/client-dispense.js';
import { S27ClientBlocks, clientDropDraws, nativeBlockId, clientBallFx, ballWet } from './multiplayer/client-explosion.js';
import { ExplosionParticles } from './explosion-particles.js';
import { JavaRandom } from './lighting.js';
import { fromOriginal } from './block-registry.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
function fixture({ water = false } = {}) {
  const world = new World('mpfx80');
  for (let x = 0; x <= 130; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : water && x >= 80 && x <= 100 && y <= 20 ? WATER : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: false });
  const a = s.addPlayer('a', 'ax', key(1));
  a.position.copy({ x: 64.5, y: 10, z: 64.5 }); a.previous.copy(a.position);
  s.tick(); s.tick(); a.dispOut = null;
  return { s, a, world };
}
const fx = p => (p.dispOut ?? []).filter(m => m.type === 'dispFx').flatMap(m => m.events).filter(e => e.k === 'explode');
const ents = p => (p.dispOut ?? []).filter(m => m.type === 'dispEnts');
const port = mc => fromOriginal(mc, 0).id;

test('server ghast fireball: S27 with cells, and the blast is flaming (zg.a: newExplosion(null, .., true, mobGriefing))', () => {
  const { s, a, world } = fixture();
  s.mobs.mobs.fireballs.launch({ large: true, owner: null, x: 70.5, y: 14, z: 64.5, exact: [0, -1, 0], power: 3 }); // ExplosionPower 3: enough cells that the one-in-three fire roll (explode's own Random) never misses them all
  let events = [];
  for (let i = 0; i < 40 && !events.length; i++) { s.tick(); events = fx(a); a.dispOut = null; }
  assert.equal(events.length, 1);
  assert.ok(s27Decode(events[0].x, events[0].y, events[0].z, events[0].bl).length > 10);
  let fires = 0;
  for (let x = 60; x < 80; x++) for (let z = 55; z < 75; z++) for (let y = 8; y < 15; y++) if (world.get(x, y, z) === FIRE) fires++;
  assert.ok(fires > 0, 'fire on the floor (the server hook used to drop `flaming`)');
});

test('server wither skull and crystal blasts send S27 in the tick they happen', () => {
  const { s, a } = fixture();
  s.mobs.mobs.skulls.launch({ owner: null, x: 70.5, y: 13, z: 64.5, exact: [0, -1, 0] });
  let events = [];
  for (let i = 0; i < 40 && !events.length; i++) { s.tick(); events = fx(a); a.dispOut = null; }
  assert.equal(events.length, 1, 'skull blast');
  assert.equal(events[0].size, 1);
  const mobs = s.mobs.mobs, crystal = mobs.create('ender_crystal', 66.5, 10, 64.5);
  mobs.entities.push(crystal);
  s.tick(); a.dispOut = null;
  assert.equal(s.mobs.attack(a, Number(String(crystal.id).replace(/^mob-/, ''))), true);
  s.tick();
  const [c] = fx(a);
  assert.ok(c && c.size === 6, 'crystal S27 (power 6)');
  assert.ok(c.mx !== undefined, 'the attacker within reach is pushed');
});

test('server TNT minecart blast sends S27 (xv: createExplosion(this, .., true)); it sent none before', () => {
  const { s, a } = fixture();
  s.vehicles.cartHost.explode(null, 70.5, 10, 64.5, 4);
  s.tick();
  const [e] = fx(a);
  assert.ok(e && e.size === 4 && e.bl.length > 50);
});

test('client S27 block pass: uncovered cells cleared, cells the server changed this tick left alone but seen as they were', () => {
  const world = new World('mpfx80c');
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) world.put(x, 5, z, 0, 0, false);
  const stone = port(1), coal = port(16);
  world.put(4, 5, 4, stone, 0, false); world.put(5, 5, 4, coal, 0, false); world.put(6, 5, 4, FIRE, 0, false);
  const b = new S27ClientBlocks();
  b.newTick();
  b.note(6, 5, 4, coal, 0); // the server's tick changed (6, 5, 4) from coal ore to fire before this S27 arrived
  const r = new JavaRandom(7), ref = new JavaRandom(7);
  const out = b.apply(world, [[4, 5, 4], [5, 5, 4], [6, 5, 4], [7, 5, 4]], r);
  assert.deepEqual(out, [[4, 5, 4, stone, 0], [5, 5, 4, coal, 0]]);
  assert.equal(world.get(4, 5, 4), 0); assert.equal(world.get(5, 5, 4), 0);
  assert.equal(world.get(6, 5, 4), FIRE, 'the server\'s newer cell is not undone');
  ref.nextInt(3); ref.nextInt(3); // coal ore twice: (5,5,4) and the covered (6,5,4), which held coal at S27 time
  assert.equal(r.nextInt(1 << 30), ref.nextInt(1 << 30));
  b.newTick();
  assert.equal(b.covered.size, 0);
});

test('client drop draws: only ores whose drop is not themselves, redstone ore and spawners draw on World.rand', () => {
  const draws = mc => { const r = new JavaRandom(3), q = new JavaRandom(3); clientDropDraws(port(mc), 0, r); return r.nextInt(1 << 30) === q.nextInt(1 << 30) ? 0 : 1; };
  for (const mc of [1, 3, 14, 15, 46, 49]) assert.equal(draws(mc), 0, 'id ' + mc);
  for (const mc of [16, 21, 56, 73, 129, 153, 52]) { const id = port(mc); if (id == null) continue; assert.equal(nativeBlockId(id, 0), mc); assert.equal(draws(mc), 1, 'id ' + mc); }
  const r = new JavaRandom(9), q = new JavaRandom(9); clientDropDraws(port(52), 0, r); q.nextInt(15); q.nextInt(15);
  assert.equal(r.nextInt(100), q.nextInt(100), 'spawner: two nextInt(15)');
});

test('ExplosionParticles.burst calls `cell` after each cell\'s two particles, on the world random', () => {
  const p = new ExplosionParticles({ random: () => 0.5 }), seen = [];
  p.burst(1.5, 2.5, 3.5, 4, [[1, 2, 3], [2, 2, 3]], { cell: (x, y, z, r) => seen.push([x, y, z, r === p.worldRandom, p.list.length]) });
  assert.deepEqual(seen.map(s => s.slice(0, 4)), [[1, 2, 3, true], [2, 2, 3, true]]);
  assert.ok(seen[1][4] > seen[0][4] && seen[0][4] >= 2);
});

test('fireball smoke and bubbles: the client copy draws what the server ball drew, tick for tick', () => {
  const { s, a, world } = fixture({ water: true });
  const server = [];
  s.mobs.mobs.fx = { spawn: (...v) => server.push(v) };
  const client = [], rd = new RemoteDispense({ ballFx: row => clientBallFx(row, { spawn: (...v) => client.push(v), wet: r => ballWet(world, r) }) });
  s.mobs.mobs.fireballs.launch({ large: false, owner: null, x: 70.5, y: 15.5, z: 64.5, exact: [1, 0, 0] });
  s.tick(); for (const m of ents(a)) rd.apply(m); a.dispOut = null; server.length = 0; client.length = 0; // the first row has no previous position
  for (let i = 0; i < 25; i++) { s.tick(); for (const m of ents(a)) rd.apply(m); a.dispOut = null; }
  const pick = l => l.filter(v => v[0] === 'smoke' || v[0] === 'bubble');
  assert.ok(pick(server).some(v => v[0] === 'bubble'), 'the ball flew into water');
  assert.equal(pick(client).length, pick(server).length);
  pick(client).forEach((v, i) => { assert.equal(v[0], pick(server)[i][0]); for (let k = 1; k < 7; k++) assert.ok(Math.abs(v[k] - pick(server)[i][k]) < 1e-9, `${i} ${k}`); });
});

test('wither skull: smoke after the move, four bubbles in water (ze.h; zp has no onUpdate of its own)', () => {
  const { s, world } = fixture({ water: true });
  const seen = [], mobs = s.mobs.mobs;
  mobs.fx = { spawn: (...v) => seen.push(v) };
  const b = mobs.skulls.launch({ owner: null, x: 90.5, y: 15.5, z: 64.5, exact: [1, 0, 0] });
  b.vx = 0.2; // already flying
  const x0 = b.x;
  mobs.skulls.tickOne(b);
  assert.equal(world.get(90, 15, 64), WATER);
  const bubbles = seen.filter(v => v[0] === 'bubble'), smoke = seen.filter(v => v[0] === 'smoke');
  assert.equal(bubbles.length, 4);
  assert.equal(smoke.length, 1);
  assert.equal(smoke[0][1], b.x, 'smoke at the new position');
  assert.ok(b.x > x0);
  assert.ok(Math.abs(bubbles[0][1] - (b.x - 0.2 * 0.25)) < 1e-12 && bubbles[0][4] === 0.2, 'bubbles: new position minus a quarter of the old motion, moving with it');
  assert.ok(seen.indexOf(smoke[0]) > seen.indexOf(bubbles[3]));
});

test('the RemoteDispense explode hook still gets the cells; ballFx only for ball rows', () => {
  const rows = [], rd = new RemoteDispense({ ballFx: r => rows.push(r.kind) });
  rd.apply({ type: 'dispEnts', ents: [{ k: 'b', i: 1, kind: 'fireball', x: 1, y: 2, z: 3 }, { k: 'r', i: 2, x: 1, y: 2, z: 3 }, { k: 'a', i: 3, x: 0, y: 0, z: 0 }] });
  assert.deepEqual(rows, ['fireball']);
  const smoke = []; clientBallFx({ kind: 'snowball', x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0 }, { spawn: (...v) => smoke.push(v) });
  assert.equal(smoke.length, 0);
  const got = []; new RemoteDispense({ explode: (x, y, z, size, cells) => got.push(cells) }).events([{ k: 'explode', x: 1.5, y: 1.5, z: 1.5, size: 2, bl: s27Encode(1.5, 1.5, 1.5, [[1, 1, 1]]) }]);
  assert.deepEqual(got, [[[1, 1, 1]]]);
});
