// Batch 61 mpnether: dimension travel on the dedicated server (server-dimensions.js, client-dimensions.js). One Nether is built per simulation (about a second),
// so the checks share a fixture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { restoreDimensionReplica, FiniteDimensionWorld } from './multiplayer/client-dimensions.js';
import { restoreReplica } from './multiplayer/client.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const PORTAL = 164, OBSIDIAN = 22, FIRE = 45, FLINT = 126, NETHERRACK = 87;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture(mode = 'creative') {
  const world = new World('mp-nether-b61');
  for (let x = 40; x <= 100; x++) for (let z = 50; z <= 80; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: mode, mobs: false });
  // a 4 x 5 obsidian frame in the x axis plane z = 64, interior x 61..62, y 11..13
  for (let x = 60; x <= 63; x++) for (let y = 10; y <= 14; y++) if (x === 60 || x === 63 || y === 10 || y === 14) world.set(x, y, 64, OBSIDIAN, true, 0);
  return { s, world };
}
const frames = (s, n = 1) => { for (let i = 0; i < n; i++) s.tick(); };
const portalCells = w => { const out = []; for (let x = 0; x < 128; x++) for (let z = 0; z < 128; z++) for (let y = 0; y < 128; y++) if (w.get(x, y, z) === PORTAL) out.push([x, y, z]); return out; };

test('a fire block in a complete frame lights the portal on the server (Overworld)', () => {
  const { s, world } = fixture();
  assert.equal(world.set(61, 11, 64, FIRE, true, 0), true);
  assert.equal(world.get(61, 11, 64), PORTAL);
  assert.equal(world.get(62, 13, 64), PORTAL);
});

test('flint and steel: fire on the clicked face, the sound, and wear in Survival', () => {
  const { s, world } = fixture('survival');
  const p = s.addPlayer('a', 'Alice', key(1));
  p.position.copy({ x: 64.5, y: 10, z: 66.5 });
  p.survival.inventory.main[0] = { id: FLINT, count: 1, damage: 0 };
  assert.equal(s.dimensions.useItem(p, { block: [61, 10, 64], adjacent: [61, 11, 64] }, FLINT), true);
  assert.equal(world.get(61, 11, 64), PORTAL, 'the fire lit the frame');
  assert.ok(s.soundsOut.some(x => x.name === 'fire.ignite' && x.except === null), 'the ignite sound is the server\'s');
  assert.equal(s.dimensions.useItem(p, { block: [0, 0, 0], adjacent: [5, 5, 5] }, 1), false, 'another item is not handled');
});

test('standing in a portal moves the player to the Nether, and back', { timeout: 120000 }, () => {
  const { s, world } = fixture();
  world.set(61, 11, 64, FIRE, true, 0);
  const a = s.addPlayer('a', 'Alice', key(1)), b = s.addPlayer('b', 'Bob', key(2));
  b.position.copy({ x: 90.5, y: 10, z: 70.5 });
  a.position.copy({ x: 61.5, y: 11, z: 64.5 }); a.previous.copy(a.position);
  s.input('a', input()); s.input('b', input());
  const base = s.tick();
  assert.equal(a.dimension, -1, 'Creative: the timer is one tick');
  assert.equal(a.world, s.dimensions.nether.world);
  assert.equal(a.world.dimension, -1);
  assert.ok(a.world.hasNoSky && a.world.isHell);
  // S07 Respawn: the world swap carries the Nether's columns and the player's state
  const respawn = a.dimOut.find(m => m.type === 'dimRespawn');
  assert.ok(respawn && respawn.dimension === -1 && respawn.world.dimension === -1 && respawn.world.columns.length === 64);
  assert.equal(respawn.self.position.x, a.position.x);
  // portal 1:8 about the middle of the finite worlds: x 61.5 -> 64 + (61.5 - 64) / 8, kept 24 inside the edge
  assert.ok(Math.abs(a.position.x - 63.7) < 12 && a.position.x >= 24 && a.position.x <= 104, `x ${a.position.x}`);
  assert.ok(portalCells(a.world).length >= 6, 'the Teleporter made or found a portal in the Nether');
  assert.ok(portalCells(a.world).some(([x, y, z]) => Math.abs(x - a.position.x) < 3 && Math.abs(z - a.position.z) < 3));
  assert.ok(s.events.some(e => e.type === 'award' && e.id === 'a' && e.achievement === 'portal'));
  // Each dimension's message holds only its own players
  assert.deepEqual(base.players.map(x => x.id).sort(), ['a', 'b'], 'the Overworld message of the trip tick was built before the trip; the traveller is sent the Nether one');
  assert.deepEqual(s.dimensions.alt[-1].players.map(x => x.id), ['a']);
  assert.deepEqual(s.tick().players.map(x => x.id), ['b'], 'from the next tick the Overworld lists only its own players');
  // the replica the client builds from that message is a finite Nether world with the server's cells
  const replica = restoreDimensionReplica(respawn.world);
  assert.equal(replica.dimension, -1); assert.equal(replica.actualHeight, 128);
  assert.equal(replica.get(...portalCells(a.world)[0]), PORTAL);
  assert.equal(restoreReplica(respawn.world).dimension, -1, 'the client\'s restoreReplica delegates a Nether snapshot');
  // leave the portal for a while, then walk back in: the Overworld
  const cell = portalCells(a.world)[0];
  a.position.copy({ x: cell[0] + 6.5, y: cell[1], z: cell[2] + 6.5 }); a.previous.copy(a.position);
  frames(s, 15);
  assert.equal(a.dimension, -1);
  a.position.copy({ x: cell[0] + 0.5, y: cell[1], z: cell[2] + 0.5 }); a.previous.copy(a.position);
  frames(s, 1);
  assert.equal(a.dimension, 0);
  assert.equal(a.world, world);
  assert.ok(a.dimOut.filter(m => m.type === 'dimRespawn').length === 2);
  assert.ok(Math.abs(a.position.x - 61.5) < 3 && Math.abs(a.position.z - 64.5) < 3, 'the existing Overworld portal is reused');
});

test('a Nether player edits the Nether, not the Overworld; save and join restore the dimension and edits', { timeout: 120000 }, () => {
  const { s, world } = fixture();
  world.set(61, 11, 64, FIRE, true, 0);
  const a = s.addPlayer('a', 'Alice', key(1));
  a.position.copy({ x: 61.5, y: 11, z: 64.5 }); a.previous.copy(a.position);
  s.input('a', input()); frames(s);
  assert.equal(a.dimension, -1);
  const nether = a.world;
  // stand clear of the portal on a netherrack slab and dig straight down
  const at = [Math.floor(a.position.x) + 8, 70, Math.floor(a.position.z) + 8];
  for (let y = 66; y <= 74; y++) nether.put(at[0], y, at[2], y === 69 ? NETHERRACK : 0, 0, false);
  a.position.copy({ x: at[0] + 0.5, y: 70, z: at[2] + 0.5 }); a.previous.copy(a.position);
  a.pitch = -Math.PI / 2; a.moved = true;
  const above = world.get(at[0], 69, at[2]);
  s.input('a', { ...input(), pitch: -Math.PI / 2 });
  a.pitch = -Math.PI / 2;
  s.dimensions.within(a, () => s.edit(a, false));
  assert.equal(nether.get(at[0], 69, at[2]), 0, 'the Nether cell broke');
  assert.equal(world.get(at[0], 69, at[2]), above, 'the Overworld cell is untouched');
  const saved = JSON.parse(JSON.stringify(s.save()));
  assert.ok(saved.dimensions.nether.edits.length > 0);
  assert.equal(saved.players.find(([k]) => k === key(1))[1].dimension, -1, 'the player\'s dimension is saved');
  const again = new DedicatedSimulation(saved, { world: (() => { const w2 = new World('mp-nether-b61'); w2.spawn = () => ({ x: 64.5, y: 10, z: 64.5 }); return w2; })(), gameMode: 'creative', mobs: false });
  const back = again.addPlayer('a2', 'Alice', key(1));
  assert.equal(back.dimension, -1);
  assert.equal(again.dimensions.nether.world.get(at[0], 69, at[2]), 0, 'the edited Nether cell was restored');
  assert.ok(portalCells(again.dimensions.nether.world).length >= 6, 'the Teleporter\'s portal was saved');
  const welcome = again.snapshot('a2');
  assert.equal(welcome.dimension, -1);
  assert.deepEqual(welcome.players.map(x => x.id), ['a2']);
  // flint and steel in the Nether lights a frame there (NetherLive on the Nether's world)
  for (let x = 30; x <= 33; x++) for (let y = 80; y <= 84; y++) nether.put(x, y, 30, x === 30 || x === 33 || y === 80 || y === 84 ? OBSIDIAN : 0, 0, false);
  assert.equal(s.dimensions.within(a, () => s.dimensions.useItem(a, { block: [31, 80, 30], adjacent: [31, 81, 30] }, FLINT)), true);
  assert.equal(nether.get(31, 81, 30), PORTAL);
  assert.equal(world.get(31, 81, 30), 0, 'the Overworld at those coordinates is untouched');
  // a Nether player who dies respawns in the Overworld, at its spawn
  a.dead = true;
  assert.equal(s.serverSurvival.respawn(a), true);
  assert.equal(a.dimension, 0); assert.equal(a.world, world);
  assert.deepEqual([a.position.x, a.position.y, a.position.z], [64.5, 10, 64.5]);
  assert.equal(a.dimOut.at(-1).dimension, 0);
});

test('FiniteDimensionWorld answers like the Nether', () => {
  const w = new FiniteDimensionWorld('x');
  assert.equal(w.chunks.size, 64);
  assert.deepEqual([w.dimension, w.hasNoSky, w.isHell, w.actualHeight, w.biomeAt(1, 1).name], [-1, true, true, 128, 'Hell']);
});

test('the client queues messages behind a dimRespawn until the host swaps worlds', async () => {
  const { DedicatedClient } = await import('./multiplayer/client.js');
  const got = [], ticks = [];
  const c = new DedicatedClient({ onDimRespawn: m => got.push(m.dimension), onTick: m => ticks.push(m.tick), onChat: m => got.push(m.text) });
  c.ready = true; c.lastTick = 0;
  c.apply({ type: 'dimRespawn', dimension: -1 });
  assert.equal(c.ready, false);
  c.buffer({ type: 'tick', tick: 5, changes: [], players: [], weather: {}, time: 1 });
  c.buffer({ type: 'chat', name: '', text: 'hi' });
  assert.deepEqual(ticks, [], 'a tick of the new world waits');
  c.start();
  assert.deepEqual(got, [-1, 'hi']);
  assert.deepEqual(ticks, [5]);
});

test('over the wire: dimRespawn comes first, then each player gets the tick of their own dimension', { timeout: 120000 }, async t => {
  const { once } = await import('node:events');
  const { WebSocket } = await import('ws');
  const { createDedicatedServer } = await import('../server/server.js');
  const { mkdtemp, rm } = await import('node:fs/promises');
  const os = await import('node:os'), path = await import('node:path');
  const { PROTOCOL } = await import('./multiplayer/protocol.js');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mc-web-nether-')), token = 'test-only-not-a-deployed-server-key', origin = 'http://localhost:5179';
  const { s, world } = fixture(); world.set(61, 11, 64, FIRE, true, 0);
  const app = await createDedicatedServer({ port: 0, token, dataFile: path.join(dir, 'world.json'), simulation: s, tickMs: 10, saveMs: 60000 });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const connect = async name => {
    const session = (await app.accounts.register({ invite: token, name, password: 'correct horse' }, token)).session;
    const ws = new WebSocket(`ws://127.0.0.1:${app.port}/multiplayer`, { origin }), log = [];
    ws.on('message', d => log.push(JSON.parse(d)));
    await once(ws, 'open'); ws.send(JSON.stringify({ type: 'join', protocol: PROTOCOL, chunks: true, session }));
    const until = async f => { for (let i = 0; i < 4000; i++) { const m = log.find(f); if (m) return m; await new Promise(r => setTimeout(r, 5)); } throw new Error('timed out'); };
    return { ws, log, until };
  };
  const alice = await connect('Alice'), bob = await connect('Bob');
  const welcome = await alice.until(m => m.type === 'welcome'); await bob.until(m => m.type === 'welcome');
  assert.equal(welcome.world.dimension, undefined);
  const a = s.players.get(welcome.id);
  a.position.copy({ x: 61.5, y: 11, z: 64.5 }); a.previous.copy(a.position);
  const respawn = await alice.until(m => m.type === 'dimRespawn');
  assert.equal(respawn.dimension, -1);
  const at = alice.log.indexOf(respawn);
  const next = await alice.until(m => m.type === 'tick' && alice.log.indexOf(m) > at && m.players.length === 1 && m.players[0].id === welcome.id);
  assert.ok(next.players[0].y !== 11 || next.players[0].x !== 61.5, 'the Nether tick carries the Nether position');
  assert.ok(!alice.log.slice(at + 1).some(m => m.type === 'tick' && m.players.some(x => x.name === 'Bob')), 'Alice sees no Overworld players after the trip');
  const bobTick = await bob.until(m => m.type === 'tick' && m.tick > next.tick);
  assert.ok(bobTick.players.every(x => x.name === 'Bob'), 'Bob sees only the Overworld players');
  assert.ok(!bob.log.some(m => m.type === 'dimRespawn'));
  for (const c of [alice, bob]) c.ws.close();
});
