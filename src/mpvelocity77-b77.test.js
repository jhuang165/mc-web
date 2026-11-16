// Batch 77 mpvelocity77: S12 to the player himself, remote riders that follow their mount, the cape bit as a watched value.
// Facts: .shared-memory/notes/mpvelocity77-b77-track.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { velocityPacket, ownVelocity, markVelocityChanged } from './multiplayer/server-velocity.js';
import { ServerPlayerTracker, watcherSig } from './multiplayer/server-player-tracker.js';
import { mountSeat } from './multiplayer/client-ride-seat.js';
import { RemoteVehicles } from './multiplayer/remote-vehicles.js';
import { vehicleSeat } from './vehicle-seat.js';
import { RemotePlayers } from './multiplayer/presence.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
function fixture() {
  const world = new World('mpvelocity77');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: false });
  const a = s.addPlayer('a', 'ax', key(1)), b = s.addPlayer('b', 'bx', key(2));
  a.position.copy({ x: 64.5, y: 10, z: 64.5 }); b.position.copy({ x: 66.5, y: 10, z: 64.5 });
  a.previous.copy(a.position); b.previous.copy(b.position);
  s.tick(); s.tick();
  a.survival.protection = b.survival.protection = 0;
  return { s, a, b };
}
const rowOf = (s, msg, viewer, id) => s.playerTracker.messageFor(viewer, msg).players.find(r => r.id === id);

test('S12 packet values: clamp to +-3.9, (int)(d * 8000) truncation, client reads x / 8000', () => {
  assert.deepEqual(velocityPacket({ x: 9, y: -9, z: 0.40000001 }), { x: 3.9, y: -3.9, z: Math.trunc(0.40000001 * 8000) / 8000 });
  assert.equal(ownVelocity({ vel: { x: 0.1, y: 0.2, z: NaN } }), null);
  assert.deepEqual(ownVelocity({ vel: { x: 0.1, y: 0.2, z: 0.3 } }), { x: 0.1, y: 0.2, z: 0.3 });
  assert.equal(ownVelocity({}), null);
  assert.equal(markVelocityChanged({ survival: { lastDamage: 'drowning' } }, 5), false);
});

test('a mob hit sends S12 to the victim only: his row carries vel (away from the attacker), the other viewer\'s row of him does not', () => {
  const { s, a, b } = fixture();
  a.survival.damage(4, 'a zombie', true, 'mob', { x: 64.5, y: 10, z: 60.5, isPlayer: false }); // attacker at -z
  const msg = s.tick();
  const own = rowOf(s, msg, 'a', 'a'), seen = rowOf(s, msg, 'b', 'a');
  assert.ok(own.vel, 'the owner gets S12');
  assert.ok(own.vel.z > 0.05, `pushed to +z: ${own.vel.z}`);
  assert.ok(own.vel.y > 0, 'and up');
  assert.equal(own.vel.z, Math.trunc(own.vel.z * 8000) / 8000);
  assert.equal(seen?.vel, undefined, 'viewers do not need it');
  assert.equal(rowOf(s, msg, 'a', 'b')?.vel, undefined, 'the other player was not hit');
  const next = rowOf(s, s.tick(), 'a', 'a');
  assert.equal(next.vel, undefined, 'one packet per hit (velocityChanged is cleared)');
});

test('fall damage sends S12 too, drowning does not (setBeenAttacked is skipped for drown)', () => {
  const { s, a } = fixture();
  a.survival.damage(2, 'fall', true, 'fall');
  assert.ok(rowOf(s, s.tick(), 'a', 'a').vel, 'fall');
  a.survival.hurtTicks = 0; a.survival.protection = 0;
  a.survival.damage(2, 'drowning', true, 'drowning');
  assert.equal(rowOf(s, s.tick(), 'a', 'a').vel, undefined, 'drowning');
});

test('a PvP hit and the death throw: the owner gets the throw motion by S12', () => {
  const { s, a, b } = fixture();
  a.survival.damage(40, 'a zombie', true, 'mob', { x: 64.5, y: 10, z: 60.5, isPlayer: false });
  const msg = s.tick();
  assert.equal(a.dead, true);
  const v = rowOf(s, msg, 'a', 'a').vel;
  assert.ok(v && v.z > 0, 'the thrown body motion reaches the owner');
});

test('rowsFor keeps vel only on the owner row', () => {
  const tr = new ServerPlayerTracker({ players: new Map(), rules: {} });
  const rows = [{ id: 'a', name: 'A', vel: { x: 1, y: 0, z: 0 } }, { id: 'b', name: 'B', vel: { x: 1, y: 0, z: 0 } }];
  const out = tr.rowsFor('a', rows, new Set(['b']));
  assert.ok(out[0].vel); assert.equal(out[1].vel, undefined);
});

test('mountSeat: a cart, a boat, a pig copy; unknown keys are null', () => {
  const rv = new RemoteVehicles(null);
  rv.apply({ set: [{ v: 'c1', x: 10, y: 5, z: 12, yaw: 0, pitch: 0, t: 0 }, { v: 'b2', x: 20, y: 6, z: 22, yaw: 90, pitch: 0 }] });
  const cart = mountSeat('c1', { vehicles: rv }), boat = mountSeat('b2', { vehicles: rv });
  assert.deepEqual(cart, vehicleSeat(rv.copies.get('c1').v, -0.5));
  assert.ok(Math.abs(cart.y - (rv.copies.get('c1').v.posY - 0.3 - 0.5)) < 1e-6);
  assert.ok(Math.abs(boat.z - (22 + 0.4)) < 1e-6 && Math.abs(boat.x - 20) < 1e-6, 'the boat seat is 0.4 along its yaw');
  const pig = { client: { x: 3, y: 4, z: 5 }, mob: { type: 'pig' } };
  const seat = mountSeat('m7', { mobs: { copies: new Map([[7, pig]]) } });
  assert.equal(seat.x, 3); assert.equal(seat.z, 5); assert.ok(seat.y > 4 && seat.y < 5.5);
  assert.equal(mountSeat('c9', { vehicles: rv }), null);
  assert.equal(mountSeat('m9', { mobs: { copies: new Map() } }), null);
  assert.equal(mountSeat(undefined, {}), null);
});

test('followMounts: a rider copy moves with its mount copy between rows', () => {
  const rv = new RemoteVehicles(null);
  rv.apply({ set: [{ v: 'c1', x: 10, y: 5, z: 12, yaw: 0, pitch: 0, t: 0 }] });
  const rp = Object.create(RemotePlayers.prototype);
  rp.seatOf = k => mountSeat(k, { vehicles: rv });
  const entry = { ride: 'c1', body: { x: 0, y: 0, z: 0 }, last: { x: 0, y: 0, z: 0 }, state: { x: 0, y: 0, z: 0 }, ip: { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, inc: 2 } };
  const walker = { ride: null, body: { x: 1 }, last: {}, state: { x: 1 } };
  rp.entries = new Map([['r', entry], ['w', walker]]);
  rp.followMounts();
  let want = mountSeat('c1', { vehicles: rv });
  assert.deepEqual([entry.body.x, entry.body.y, entry.body.z], [want.x, want.y, want.z]);
  assert.equal(entry.ip.inc, 0);
  const c = rv.copies.get('c1'); rv.carts.setPosition(c.v, 11, 5, 12.5); // the cart copy ran its own tick
  rp.followMounts();
  want = mountSeat('c1', { vehicles: rv });
  assert.deepEqual([entry.state.x, entry.state.y, entry.state.z], [want.x, want.y, want.z]);
  assert.equal(entry.body.px, 10, 'previous position kept for the tick before');
  assert.equal(walker.body.x, 1, 'a walker is untouched');
});

test('the cape-hidden bit (watcher 16 bit 1) is a watched value: a C15 showCape change forces the send', () => {
  const mk = () => ({ position: { x: 8, y: 10, z: 8 }, input: {}, motion: {}, survival: { health: 20, air: 300, effects: { has: () => false } } });
  const a = mk(), b = mk(); b.hideCape = true;
  assert.notEqual(watcherSig(a), watcherSig(b));
  b.hideCape = false; assert.equal(watcherSig(a), watcherSig(b));
});
