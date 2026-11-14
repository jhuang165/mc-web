// Batch 73 streamfix73: remote players are tracked per viewer (EntityTracker range 512 / frequency 2, clamped by the view distance, needs the sent column),
// and the client drops tile entities (signs, skulls, beacons, spawners, chests, pistons) with an unloaded column. Facts: .shared-memory/notes/streamfix73-b73-track.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { ServerPlayerTracker, PLAYER_RANGE, PLAYER_FREQUENCY } from './multiplayer/server-player-tracker.js';
import { applyChunkMessage } from './multiplayer/client-chunks.js';
import { dropTilesIn } from './multiplayer/client-tiles.js';
import { applyTiles } from './tile-sync.js';
import { Signs, SIGN_POST } from './signs.js';
import { RemotePlayers } from './multiplayer/presence.js';
import { MobSpawners } from './mob-spawner.js';
import { Beacons } from './pyramid.js';
import { Skulls } from './skull.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const fixture = (viewDistance, extra = {}) => {
  const world = new World('streamfix73-b73');
  world.spawn = () => ({ x: 8.5, y: 100, z: 8.5 });
  return new DedicatedSimulation({}, { world, gameMode: 'creative', mobs: false, rules: { viewDistance, ...extra } });
};
const place = (p, x, z) => { p.position.copy({ x, y: 100, z }); p.previous.copy(p.position); p.flying = true; };
const rowsOf = (s, pid, m) => s.playerTracker.messageFor(pid, m, 0, m).players;

test('constants are the bytecode ones (addEntityToTracker(player, 512, 2))', () => {
  assert.equal(PLAYER_RANGE, 512); assert.equal(PLAYER_FREQUENCY, 2);
});

test('range is clamped by the view-distance limit: a player beyond view*16-16 is a list entry only', () => {
  const s = fixture(3, { chunkStream: false }), a = s.addPlayer('a', 'ax', key(1)), b = s.addPlayer('b', 'bx', key(2)), c = s.addPlayer('c', 'cx', key(3));
  place(a, 8.5, 8.5); place(b, 30.5, 8.5); place(c, 100.5, 8.5);
  for (const id of ['a', 'b', 'c']) s.snapshot(id);
  assert.equal(s.rules.trackerLimit, 32);
  const m = s.tick(), rows = rowsOf(s, 'a', m);
  assert.equal(rows.length, 3);
  assert.equal(rows.find(r => r.id === 'a').far, undefined);
  assert.equal(rows.find(r => r.id === 'b').far, undefined, 'inside the square');
  assert.deepEqual(Object.keys(rows.find(r => r.id === 'c')).sort(), ['far', 'id', 'name']);
  assert.equal(rows.find(r => r.id === 'b').x, 30.5, 'the full row keeps its presence fields');
});

test('enter and leave: spawn on entering the square, destroy on leaving (the row turns far)', () => {
  const s = fixture(3, { chunkStream: false }), a = s.addPlayer('a', 'ax', key(1)), b = s.addPlayer('b', 'bx', key(2));
  place(a, 8.5, 8.5); place(b, 100.5, 8.5); s.snapshot('a'); s.snapshot('b');
  assert.equal(rowsOf(s, 'a', s.tick()).find(r => r.id === 'b').far, true);
  place(b, 40.5, 8.5); // still 32 away + 0.5: outside
  s.tick(); assert.equal(rowsOf(s, 'a', s.tick()).find(r => r.id === 'b').far, true);
  place(b, 20.5, 8.5);
  let tracked = false; for (let i = 0; i < 4; i++) tracked = rowsOf(s, 'a', s.tick()).find(r => r.id === 'b').far === undefined;
  assert.equal(tracked, true);
  place(b, 100.5, 8.5);
  let far = false; for (let i = 0; i < 4; i++) far = rowsOf(s, 'a', s.tick()).find(r => r.id === 'b').far === true;
  assert.equal(far, true);
});

test('tracking needs the sent column (isPlayerWatchingChunk): a streaming join sees nobody until the other column is out', () => {
  const s = fixture(3), a = s.addPlayer('a', 'ax', key(1)), b = s.addPlayer('b', 'bx', key(2));
  place(a, 8.5, 8.5); place(b, 20.5, 8.5); s.snapshot('a'); s.snapshot('b');
  assert.equal(s.chunkViews.sees('a', 2, 0), false, 'nothing sent yet');
  for (let i = 0; i < 8; i++) {
    const row = rowsOf(s, 'a', s.tick()).find(r => r.id === 'b'); // b stands in column (1, 0)
    assert.equal(s.chunkViews.sees('a', 1, 0) ? row.far === undefined : row.far === true, true, 'tracked exactly when the column is held');
  }
  assert.ok(s.chunkViews.sees('a', 1, 0));
  assert.equal(rowsOf(s, 'a', s.tick()).find(r => r.id === 'b').far, undefined);
  // an unloaded column untracks (the client copy is dropped with the column)
  s.chunkViews.watches.get('a').sent.delete('1,0'); s.chunkViews.watches.get('a').fresh.add('players');
  assert.equal(rowsOf(s, 'a', s.tick()).find(r => r.id === 'b').far, true);
});

test('the viewer himself is never reduced; the welcome snapshot is cut by the same square', () => {
  const s = fixture(3, { chunkStream: false }), a = s.addPlayer('a', 'ax', key(1)), b = s.addPlayer('b', 'bx', key(2));
  place(a, 8.5, 8.5); place(b, 100.5, 8.5);
  const snap = s.playerTracker.snapshot('a', s.snapshot('a'));
  assert.equal(snap.players.find(r => r.id === 'a').far, undefined); assert.equal(snap.players.find(r => r.id === 'b').far, true);
  const m = { type: 'tick', players: [{ id: 'a', name: 'ax', x: 8.5 }, { id: 'b', name: 'bx', x: 100.5 }] };
  assert.equal(s.playerTracker.messageFor('nobody', m, 0, m), m);
});

test('host without chunk views tracks by range only; a player leaving the dimension forgets its entries', () => {
  const players = new Map([['a', { dimension: 0, position: { x: 0, y: 70, z: 0 }, yaw: 0, pitch: 0 }], ['b', { dimension: 0, position: { x: 100, y: 70, z: 0 }, yaw: 0, pitch: 0 }]]);
  const t = new ServerPlayerTracker({ players, rules: { trackerLimit: 144 } });
  const m = { players: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }] };
  assert.equal(t.messageFor('a', m, 0, m).players[1].far, undefined);
  players.get('b').dimension = -1;
  const m2 = { players: m.players };
  assert.equal(t.update(0, m2).get('a').size, 0);
  assert.equal(t.state(0).get('b'), undefined);
});

test('client: a remote player whose column unloads leaves; far rows create no entity', () => {
  const rp = Object.create(RemotePlayers.prototype); rp.entries = new Map(); rp.at = 0; rp.me = null;
  const disposed = []; rp.dispose = e => disposed.push(e);
  rp.entries.set('b', { last: { x: 3, z: 3 } }); rp.entries.set('c', { last: { x: 40, z: 3 } });
  rp.dropColumns(new Set(['0,0']));
  assert.deepEqual([...rp.entries.keys()], ['c']); assert.equal(disposed.length, 1);
  rp.sync([{ id: 'me', name: 'me' }, { id: 'c', far: true, name: 'c' }], 'me');
  assert.equal(rp.entries.size, 0, 'a far row is not a tracked player: the existing copy goes');
});

const stores = () => ({ world: null, signs: new Signs(), skulls: new Skulls(), beacons: new Beacons(), spawners: new MobSpawners(), chests: {}, enders: {}, pistons: { tiles: new Map() } });

test('client tiles: dropping a column removes its tile entities of every kind, other columns stay', () => {
  const st = stores();
  for (const [x, z] of [[3, 3], [40, 3]]) {
    st.signs.create(x, 70, z); st.skulls.create(x, 71, z); st.beacons.ensure(x, 72, z); st.spawners.add({ x, y: 73, z, entityId: 'Pig' });
    st.chests[`${x},74,${z}`] = { facing: 2 }; st.enders[`${x},75,${z}`] = {}; st.pistons.tiles.set(`${x},76,${z}`, { x, y: 76, z });
  }
  assert.equal(dropTilesIn(new Set(['0,0']), st), 7);
  assert.equal(st.signs.tile(3, 70, 3), null); assert.ok(st.signs.tile(40, 70, 3));
  assert.equal(st.skulls.tile(3, 71, 3), null); assert.equal(st.beacons.get(3, 72, 3), null); assert.equal(st.spawners.get(3, 73, 3), null);
  assert.deepEqual(Object.keys(st.chests), ['40,74,3']); assert.deepEqual(Object.keys(st.enders), ['40,75,3']); assert.deepEqual([...st.pistons.tiles.keys()], ['40,76,3']);
  assert.ok(st.spawners.get(40, 73, 3) && st.beacons.get(40, 72, 3) && st.skulls.tile(40, 71, 3));
  assert.equal(dropTilesIn(new Set(['9,9']), {}), 0, 'absent stores are fine');
});

test('client: chunkUnload hooks the tile drop and a re-sent column restores the sign through its description', () => {
  const world = new World('streamfix73-b73-client'), cells = new Set(['3,70,3']);
  const st = { ...stores(), world: { get: (x, y, z) => cells.has(`${x},${y},${z}`) ? SIGN_POST : 0 } }; // the replica block under the sign (a stand-in for the column content)
  applyTiles([{ kind: 'sign', x: 3, y: 70, z: 3, text: ['a', 'b', '', ''] }], st);
  assert.deepEqual(st.signs.tile(3, 70, 3).text, ['a', 'b', '', '']);
  applyChunkMessage({ type: 'chunkUnload', columns: [[0, 0]] }, { world, scene: null, entities: () => {}, dropTiles: cols => dropTilesIn(cols, st) });
  assert.equal(st.signs.tile(3, 70, 3), null, 'the tile entity went with the column');
  assert.ok(world.absentColumns.has('0,0'));
  assert.equal(applyTiles([{ kind: 'sign', x: 3, y: 70, z: 3, text: ['a', 'b', '', ''] }], st), 1, 'the re-sent column description restores it');
  assert.deepEqual(st.signs.tile(3, 70, 3).text, ['a', 'b', '', '']);
});
