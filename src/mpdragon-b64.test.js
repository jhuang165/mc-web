// Batch 64 mpdragon: the Ender Dragon, the End crystals, the exit portal and the credits on the dedicated server. One End is built per simulation (about a second).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { RemoteMobs } from './multiplayer/remote-mobs.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { END_WINDOWS } from './multiplayer/client-dimensions.js';
const END_OFFSET = END_WINDOWS.full; // b65 mpendwindow: a new End is the 256 window

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const END_PORTAL = 149, EGG = 171;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const wire = e => Number(String(e.id).replace(/^mob-/, ''));
function fixture() {
  const world = new World('mp-dragon-b64');
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'creative', mobs: false });
  const a = s.addPlayer('a', 'Alice', key(1));
  s.dimensions.arrive(a, 1);
  const end = s.dimensions.end.n, mobs = end.mobs.mobs;
  return { s, a, end, mobs, world, dragon: () => mobs.entities.find(e => e.type === 'ender_dragon') };
}
const tick = (s, n = 1) => { for (let i = 0; i < n; i++) { s.input('a', input()); s.tick(); } };

test('a new End has the dragon at the middle of the End and the crystals of the spikes inside the window', { timeout: 120000 }, () => {
  const { s, mobs, dragon, a } = fixture();
  const d = dragon();
  assert.ok(d);
  assert.deepEqual([d.x, d.y, d.z], [END_OFFSET.x, 128, END_OFFSET.z]);
  const crystals = mobs.entities.filter(e => e.type === 'ender_crystal');
  assert.ok(crystals.length >= 3, // b65 mpendwindow: the 256 window holds every spike of the island (b64's 128 window kept 3 to 10)
     'crystals ' + crystals.length);
  for (const c of crystals) assert.ok(c.x > 0 && c.x < 256 && c.z > 0 && c.z < 256);
  a.position.copy({ x: END_OFFSET.x + 100.5, y: 49, z: END_OFFSET.z + 0.5 });
  tick(s, 3);
  assert.ok(dragon().dragon.parts.length === 7);
  assert.equal(s.dimensions.end.saveField().dragon, 'alive');
  // the dragon sees the player of its world, not the Overworld's
  assert.equal(mobs.dragonViews().length, 1);
  assert.deepEqual(mobs.dragonCenter, { x: END_OFFSET.x, z: END_OFFSET.z });
});

test('every End player is a target and in the wing sweep; the Overworld is not', { timeout: 120000 }, () => {
  const { s, a, mobs } = fixture();
  const b = s.addPlayer('b', 'Bob', key(2)), c = s.addPlayer('c', 'Cy', key(3));
  s.dimensions.arrive(b, 1);
  assert.equal(c.dimension | 0, 0);
  const views = mobs.dragonViews();
  assert.equal(views.length, 2);
  assert.deepEqual(views.map(v => Math.round(v.x)).sort(), [Math.round(a.position.x), Math.round(b.position.x)].sort());
  // the push moves the server player's own velocity
  const before = a.velocity.x;
  views.find(v => Math.round(v.x) === Math.round(a.position.x)).push(1, 0, 0);
  assert.equal(a.velocity.x, before + 1);
});

test('a C02 attack hits a dragon part (reach by parts), a crystal explodes at any hit', { timeout: 120000 }, () => {
  const { s, a, mobs, dragon, end } = fixture();
  tick(s, 2);
  const d = dragon(), head = d.dragon.parts[0].box;
  a.position.copy({ x: (head[0] + head[3]) / 2 + 2, y: head[1] - 1.6, z: (head[2] + head[5]) / 2 }); a.previous.copy(a.position);
  const hp = d.health;
  assert.equal(end.mobs.attack(a, wire(d)), true);
  assert.ok(d.health < hp, 'part damage');
  // out of reach: refused
  a.position.copy({ x: head[0] - 60, y: head[1], z: head[2] }); a.previous.copy(a.position);
  assert.equal(end.mobs.attack(a, wire(d)), false);
  const crystal = mobs.entities.find(e => e.type === 'ender_crystal');
  a.position.copy({ x: crystal.x + 2, y: crystal.y, z: crystal.z }); a.previous.copy(a.position);
  assert.equal(end.mobs.attack(a, wire(crystal)), true);
  tick(s, 2);
  assert.ok(!mobs.entities.includes(crystal), 'the crystal is gone');
});

test('the dragon dies in 200 ticks: orbs, the exit portal with the egg, the state saved as dead, then the credits and the respawn', { timeout: 120000 }, () => {
  const { s, a, mobs, dragon, world } = fixture();
  tick(s, 2);
  const d = dragon();
  mobs.entities.forEach(e => { if (e.type === 'ender_crystal') e.health = 0, e.death = 20; });
  d.health = 0;
  for (let i = 0; i < 230 && mobs.entities.includes(d); i++) tick(s);
  assert.ok(!mobs.entities.includes(d), 'removed after the sequence');
  assert.ok(a.world.chunks.size > 0);
  const end = s.dimensions.end.n;
  let portals = 0, egg = 0;
  for (let x = 0; x < 256; x++) for (let z = 0; z < 256; z++) { if (end.world.get(x, 64, z) === END_PORTAL) portals++; if (end.world.get(x, 68, z) === EGG) egg++; }
  assert.ok(portals >= 20, 'exit portal ' + portals);
  assert.equal(egg, 1, 'the dragon egg');
  assert.ok(end.xp.orbs.length > 5, 'orbs');
  assert.equal(s.dimensions.end.saveField().dragon, 'dead');
  // the portal: credits for the player, who stays until the client answers
  let px = 0, pz = 0;
  for (let x = 0; x < 256; x++) for (let z = 0; z < 256; z++) if (end.world.get(x, 64, z) === END_PORTAL) { px = x; pz = z; }
  a.position.copy({ x: px + 0.5, y: 64, z: pz + 0.5 }); a.previous.copy(a.position); a.dimOut = null;
  tick(s);
  assert.equal(a.dimension, 1);
  assert.ok(a.dimOut.some(m => m.type === 'dragonCredits'));
  assert.ok(s.events.some(e => e.achievement === 'theEnd2'));
  a.dimOut = null;
  tick(s);
  assert.ok(!a.dimOut?.some(m => m.type === 'dragonCredits'), 'one credits message per trip');
  s.serverSurvival.respawn(a);
  assert.equal(a.dimension | 0, 0);
  assert.equal(a.world, world);
});

test('the saved End keeps the dragon alive or dead; a dead one is not made again, an old (b63) End counts as over', { timeout: 120000 }, () => {
  const { s, dragon } = fixture();
  tick(s, 2);
  const d = dragon();
  const saved = JSON.parse(JSON.stringify(s.save()));
  assert.equal(saved.dimensions.end.dragon, 'alive');
  assert.ok(saved.dimensions.end.mobs.some(m => m.type === 'ender_dragon'));
  const again = new DedicatedSimulation(saved, { world: Object.assign(new World('mp-dragon-b64'), { spawn: () => ({ x: 64.5, y: 10, z: 64.5 }) }), gameMode: 'creative', mobs: false });
  const a2 = again.addPlayer('a', 'Alice', key(1));
  again.dimensions.arrive(a2, 1);
  const list = again.dimensions.end.n.mobs.mobs.entities.filter(e => e.type === 'ender_dragon');
  assert.equal(list.length, 1, 'restored once');
  // dead: no dragon, none made
  saved.dimensions.end.dragon = 'dead'; saved.dimensions.end.mobs = saved.dimensions.end.mobs.filter(m => m.type !== 'ender_dragon');
  const dead = new DedicatedSimulation(saved, { world: Object.assign(new World('mp-dragon-b64'), { spawn: () => ({ x: 64.5, y: 10, z: 64.5 }) }), gameMode: 'creative', mobs: false });
  const a3 = dead.addPlayer('a', 'Alice', key(1));
  dead.dimensions.arrive(a3, 1);
  assert.equal(dead.dimensions.end.n.mobs.mobs.entities.filter(e => e.type === 'ender_dragon').length, 0);
  assert.equal(dead.dimensions.end.saveField().dragon, 'dead');
  assert.ok(d);
});

test('the client copy: the stand-in aliases the copy\'s dragon state, health and crystal spin', { timeout: 120000 }, () => {
  const { s, a, mobs, dragon } = fixture();
  tick(s, 3);
  const packets = a.mobPackets ?? [];
  assert.ok(packets.some(p => p.type === 'spawn' && p.mob === 'ender_dragon'), 'dragon spawn packet');
  assert.ok(packets.some(p => p.type === 'spawn' && p.mob === 'ender_crystal'), 'crystal spawn packet');
  const rep = new RemoteMobs(a.world, {});
  rep.apply(packets);
  const d = rep.list().find(m => m.type === 'ender_dragon');
  assert.ok(d?.dragon?.parts?.length === 7);
  rep.tick(); rep.tick();
  assert.ok(d.health > 0 && d.death === 0 || d.death === undefined || d.death === 0);
  const c = rep.list().find(m => m.type === 'ender_crystal');
  assert.ok(Math.abs(c.innerRotation - rep.clientOf(c).innerRotation) <= 1, 'the stand-in follows the copy\'s spin');
  assert.ok(mobs && dragon());
});
