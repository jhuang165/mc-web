import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, WOODEN_DOOR } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { SUPPORTED, mobState } from './multiplayer/server-mobs.js';
import { RemoteMobs } from './multiplayer/remote-mobs.js';
import { generatedVillagers } from './multiplayer/server-villagers.js';
import { makeStack } from './inventory.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { WEAKNESS, GOLDEN_APPLE } from './zombie-villager.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture(saved = {}, gameMode = 'survival') {
  const world = new World('mp-village-b66');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation(saved, { world, gameMode, mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
}
const join = (s, id = 'a', n = 1, name = id + 'x') => { const p = s.addPlayer(id, name, key(n)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); s.input(id, input()); return p; };
const mob = (s, type, x = 66.5, z = 64.5) => { const m = s.mobs.mobs.create(type, x, 10, z); s.mobs.mobs.entities.push(m); return m; };
const wire = m => Number(m.id.slice(4));
const packets = p => { const out = p.mobPackets ?? []; p.mobPackets = null; return JSON.parse(JSON.stringify(out)); };
const door = (s, x, z) => { // a door in a wall with a roof on its west side (sky only to the east): the native door scan counts sky on each side
  s.world.put(x, 10, z, WOODEN_DOOR, 0, false); s.world.put(x, 11, z, WOODEN_DOOR, 8, false);
  for (let a = x - 6; a < x; a++) for (let b = z - 4; b <= z + 4; b++) s.world.put(a, 13, b, 1, 0, false);
};

test('villager and the village golem are kinds the server keeps; the profession and age ride in the mob state', () => {
  assert.ok(SUPPORTED.has('villager') && SUPPORTED.has('iron_golem'));
  const s = fixture(), v = mob(s, 'villager'); v.profession = 3;
  assert.equal(mobState(v).prof, 3);
  v.growingAge = -24000;
  assert.equal(mobState(v).baby, 1);
});

test('the spawn packet carries the profession and the client copy shows it', () => {
  const s = fixture(), p = join(s), v = mob(s, 'villager'); v.profession = 4;
  s.tick(); s.tick();
  const pk = packets(p), spawn = pk.find(m => m.type === 'spawn' && m.mob === 'villager');
  assert.ok(spawn, 'villager spawn sent');
  assert.equal(spawn.prof, 4);
  const copies = new RemoteMobs(s.world);
  copies.apply([spawn]);
  assert.equal(copies.list()[0].profession, 4);
});

test('villagers survive a save and a reload with the collection and its reputation by name', () => {
  const s = fixture(), p = join(s, 'a', 1, 'Alex'), v = mob(s, 'villager'); v.profession = 2;
  door(s, 70, 64);
  for (let i = 0; i < 40; i++) s.tick();
  const col = s.mobs.mobs.villages;
  assert.equal(col.villages.length, 1, 'door of a villager\'s registered position forms a village');
  col.villages[0].changeReputation('Alex', -4);
  const saved = JSON.parse(JSON.stringify(s.save()));
  assert.ok(saved.villages.villages.length === 1);
  assert.ok(saved.mobs.some(m => m.type === 'villager' && m.profession === 2));
  const t = new DedicatedSimulation(saved, { world: fixture().world, gameMode: 'survival', mobs: true });
  assert.equal(t.mobs.mobs.villages.villages[0].playerReputation('Alex'), -4);
  assert.ok(t.mobs.mobs.entities.some(m => m.type === 'villager' && m.profession === 2));
});

test('a player hit on a village villager costs that player\'s name reputation', () => {
  const s = fixture(), p = join(s, 'a', 1, 'Alex'), v = mob(s, 'villager', 65.5);
  door(s, 70, 64);
  for (let i = 0; i < 10; i++) s.tick();
  const village = s.mobs.mobs.villages.villages[0];
  assert.ok(village);
  s.mobs.mobs.ai.brain(v).village = village;
  assert.ok(s.mobs.attack(p, wire(v)));
  assert.equal(village.playerReputation('Alex'), -1);
  assert.equal(village.playerReputation('Player'), 0);
});

test('the golem-target lookup finds the connected player by name', () => {
  const s = fixture(), p = join(s, 'a', 1, 'Alex');
  s.tick();
  const host = s.mobs.mobs.villages.host;
  assert.ok(host.playerEntity('Alex'));
  assert.equal(host.playerEntity('Player'), null);
  assert.equal(host.playerEntity('Nobody'), null);
});

test('a golden apple on a weakened zombie villager starts the cure; other clicks are left alone', () => {
  const s = fixture(), p = join(s), z = mob(s, 'zombie'); z.villager = true;
  z.effects = [{ id: WEAKNESS, duration: 600, amplifier: 0 }];
  p.survival.inventory.main[0] = makeStack(GOLDEN_APPLE, 2, 0); p.survival.inventory.current = 0;
  s.tick();
  s.queueAnimUse(p.id, wire(z), false); s.tick();
  assert.ok(Number.isInteger(z.conversionTime), 'conversion started');
  assert.equal(p.survival.inventory.main[0].count, 1);
  assert.equal(mobState(z).villager, 1);
});

test('a zombie kill converts a villager on Hard and the copy gets the zombie villager flag', () => {
  const s = fixture(), p = join(s), v = mob(s, 'villager'), z = mob(s, 'zombie', 67.5);
  s.mobs.mobs.difficulty = 3; s.difficulty = 3;
  s.mobs.mobs.zombieKilledVillager(z, v);
  const made = s.mobs.mobs.entities.find(e => e.type === 'zombie' && e.villager && e !== z);
  assert.ok(made);
  assert.ok(!s.mobs.mobs.entities.includes(v));
});

test('villages of generated structures give a fresh world its villagers, once', () => {
  const world = { generationVersion: 14, generatedStructures: { animals: [{ type: 'Villager', x: 5, y: 10, z: 5, profession: 3 }, { name: 'Pig' }] } };
  assert.equal(generatedVillagers(world, {}).length, 1);
  assert.equal(generatedVillagers(world, { mobs: [] }).length, 0);
  assert.equal(generatedVillagers({ ...world, generationVersion: 9 }, {}).length, 0);
});

test('the villager click hook is a stub the merchant track fills', () => {
  const s = fixture(), p = join(s), v = mob(s, 'villager');
  s.tick();
  assert.equal(s.mobs.villagerUse, null);
  let seen = null;
  s.mobs.villagerUse = (q, m) => { seen = [q, m]; return true; };
  s.queueAnimUse(p.id, wire(v), false); s.tick();
  assert.equal(seen?.[1], v);
});
