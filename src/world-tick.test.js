import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, WATER, FIRE } from './world.js';
import { JavaRandom } from './java-random.js';
import { Weather } from './weather.js';
import { Farming } from './farming.js';
import { Fluids } from './fluids.js';
import { Fire } from './fire.js';
import { tickBlockSystems } from './world-tick.js';

function fixture() {
  const world = new World('block-tick-boundary');
  for (let x = 28; x < 40; x++) for (let z = 28; z < 40; z++) {
    for (let y = 9; y < 18; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  }
  world.set(32, 10, 32, 29);
  world.set(32, 11, 32, 31);
  const farming = new Farming(world);
  const weather = new Weather({ random: new JavaRandom(41), lcg: 9 });
  const fluids = new Fluids(world, { random: weather.random });
  const fire = new Fire(world, { weather: () => weather });
  fire.watch();
  fire.sharedRandomTicks = true;
  world.set(35, 12, 35, WATER);
  world.set(37, 10, 37, 4);
  world.set(37, 11, 37, FIRE);
  return { world, farming, fluids, fire, weather };
}

test('block tick boundary replays the live sequence with real systems and changing inputs', () => {
  const legacy = fixture(), extracted = fixture();
  const fireInitiallyScheduled = extracted.fire.save().entries.length;
  const initialRandom = extracted.weather.saveSimulation().random;
  let fluidChanges = 0;
  for (let time = 1; time <= 70; time++) {
    const input = { time, daylight: time % 20 < 10 ? 1 : 0.3, x: 33 + time / 10, z: 34 };
    const run = (state, useBoundary) => {
      const events = [];
      const observers = Object.fromEntries(['farming', 'fluids', 'fire'].map(name => [name, changes => {
        events.push([name, structuredClone(changes), state.fluids.time, state.fire.time]);
      }]));
      if (useBoundary) tickBlockSystems(state, input, observers);
      else {
        observers.farming(state.farming.tick(input.time, input.daylight));
        observers.fluids(state.fluids.tick());
        observers.fire(state.fire.tick(input.x, input.z));
      }
      return events;
    };
    const expected = run(legacy, false), actual = run(extracted, true);
    assert.deepEqual(actual, expected, `observer sequence at tick ${time}`);
    assert.deepEqual(extracted.world.snapshot(), legacy.world.snapshot());
    assert.deepEqual(extracted.farming.serialize(), legacy.farming.serialize());
    assert.deepEqual(extracted.fluids.save(), legacy.fluids.save());
    assert.deepEqual(extracted.fire.save(), legacy.fire.save());
    assert.deepEqual(extracted.weather.saveSimulation(), legacy.weather.saveSimulation());
    fluidChanges += actual[1][1].length;
  }
  assert.ok(fluidChanges > 0, 'scheduled water updates changed blocks');
  assert.ok(fireInitiallyScheduled > 0, 'fire started with scheduled work');
  assert.notDeepEqual(extracted.weather.saveSimulation().random, initialRandom, 'fire consumed shared random draws');
});

test('absent optional systems do not run their observers', () => {
  const calls = [];
  tickBlockSystems({ farming: { tick: (...args) => (calls.push(args), ['farm']) }, fluids: null, fire: null },
    { time: 5, daylight: 0.5, x: 1, z: 2 },
    { farming: changes => calls.push(changes) });
  assert.deepEqual(calls, [[5, 0.5], ['farm']]);
});
