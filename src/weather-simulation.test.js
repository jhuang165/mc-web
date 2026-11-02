import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, PHYSICS } from './world.js';
import { JavaRandom } from './java-random.js';
import { Weather, LightningBolt } from './weather.js';
import { tickWeatherSimulation } from './weather-simulation.js';

function fixture(creative = false) {
  const world = new World('weather-simulation');
  const weather = new Weather({ random: new JavaRandom(73), lcg: 10 });
  weather.rainTime = weather.thunderTime = 500;
  weather.bolts.push(new LightningBolt(32, 20, 32, new JavaRandom(21)));
  const calls = [];
  const entities = [
    { type: 'creeper', x: 32, y: 20, z: 32, health: 20, fire: -1 },
    { type: 'cow', x: 35.45, y: 20, z: 32, health: 20, fire: 0 },
    { type: 'cow', x: 32, y: 20, z: 32, health: 0, fire: 0 },
    { type: 'missing', x: 32, y: 20, z: 32, health: 20, fire: 0 },
  ];
  const mobs = { entities, hazard(e, damage, source) { calls.push(['mob', e.type, damage, source]); e.health -= damage; } };
  const survival = { creative, health: 20, fire: -1,
    damage(amount, source, bypass) { calls.push(['player', amount, source, bypass]); this.health -= amount; } };
  return { world, weather, mobs, survival, calls, player: { x: 32, y: 20, z: 32 } };
}

test('weather step applies real lightning flashes in order and leaves client events for the caller', () => {
  const f = fixture();
  tickWeatherSimulation(f, f.player, PHYSICS.width, PHYSICS.height);
  assert.deepEqual(f.calls, [['mob', 'creeper', 5, 'inFire'], ['player', 5, 'lightning', true]]);
  assert.equal(f.mobs.entities[0].powered, true);
  assert.equal(f.mobs.entities[0].fire, 160);
  assert.equal(f.survival.fire, 160);
  assert.equal(f.mobs.entities[1].health, 20, 'touching only the edge does not overlap');
  assert.equal(f.mobs.entities[2].fire, 0, 'dead mobs are skipped');
  assert.equal(f.mobs.entities[3].fire, 0, 'unknown entity types are skipped');
  assert.deepEqual(f.weather.events.map(e => e.sound), ['ambient.weather.thunder', 'random.explode']);
  tickWeatherSimulation(f, f.player, PHYSICS.width, PHYSICS.height);
  assert.equal(f.mobs.entities[0].health, 10);
  assert.equal(f.mobs.entities[0].fire, 161);
  assert.equal(f.survival.health, 10);
  assert.equal(f.survival.fire, 161);
  assert.equal(f.weather.events.length, 2, 'sound events remain undrained');
});

test('creative and dead players are excluded without suppressing mob lightning', () => {
  for (const creative of [true, false]) {
    const f = fixture(creative);
    if (!creative) f.survival.health = 0;
    tickWeatherSimulation(f, f.player, PHYSICS.width, PHYSICS.height);
    assert.deepEqual(f.calls, [['mob', 'creeper', 5, 'inFire']]);
    assert.equal(f.survival.fire, -1);
    assert.equal(f.mobs.entities[0].powered, true);
  }
});
