// Batch 61 lead: the hooks between tracks that no single track could test (mpvehicles x mpnether x mphealth2 x mpdispense).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture() {
  const world = new World('b61-lead');
  for (let x = 40; x <= 100; x++) for (let z = 50; z <= 80; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: false });
}

test('a Nether trip dismounts the rider, resends the effect burst, and hides the Overworld vehicles from the traveller', { timeout: 120000 }, () => {
  const s = fixture(), a = s.addPlayer('a', 'Alice', key(1));
  a.position.copy({ x: 64.5, y: 10, z: 70.5 }); a.previous.copy(a.position);
  s.input('a', input());
  const cart = s.vehicles.spawnVehicle('minecart', 64.5, 10, 70.5);
  s.tick(); s.tick();
  assert.ok(s.vehicles.queue('a', { v: `c${cart.id}`, hit: false }));
  s.tick();
  assert.ok(a.mount, 'mounted');
  a.survival.effects.add({ id: 1, duration: 600, amplifier: 0 });
  s.serverSurvival.outgoing(a); // the burst is sent once
  assert.deepEqual(s.serverSurvival.outgoing(a).filter(m => m.type === 'healthEffect'), []);
  assert.equal(s.dimensions.arrive(a, -1), true);
  assert.equal(a.mount ?? null, null, 'the trip dismounts');
  assert.deepEqual(s.serverSurvival.outgoing(a).filter(m => m.type === 'healthEffect').map(m => m.id), [1], 'S1D again after the transfer');
  a.vehPackets = null; s.tick();
  assert.ok(!a.vehPackets?.set, 'no Overworld vehicle is sent to a Nether player');
  assert.equal(s.queueAnimUse('a', 1, false), true);
  assert.doesNotThrow(() => s.tick(), 'an animal click from the Nether is dropped');
});
