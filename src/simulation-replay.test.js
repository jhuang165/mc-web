import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIRE, WATER } from './world.js';
import { JavaRandom } from './java-random.js';
import { Weather } from './weather.js';
import { Farming } from './farming.js';
import { Fluids } from './fluids.js';
import { Fire } from './fire.js';
import { tickWeatherSimulation } from './weather-simulation.js';
import { tickBlockSystems } from './world-tick.js';
import { movePlayer } from './player-physics.js';
import { playerFixture, playerInputs } from './player-physics-fixture.js';

const copy = value => JSON.parse(JSON.stringify(value));

// This test checkpoint is deliberately not the browser's save format: it also
// contains transient player motion, which browser saves do not yet retain.
function checkpoint(s) {
  const coords = ({ x, y, z }) => ({ x, y, z });
  return copy({ player: { position: coords(s.position), previous: coords(s.previous), velocity: coords(s.velocity),
    grounded: s.grounded, collidedH: s.collidedH, flying: s.flying, fallDistance: s.fallDistance,
    landedFall: s.landedFall, motion: { ...s.motion }, exhaustion: s.survival.exhaustion },
  edits: [...s.world.edits], weather: s.weather.save(), random: s.weather.saveSimulation(),
  farms: s.farming.serialize(), fluids: s.fluids.save(), fire: s.fire.save() });
}

function create(saved) {
  const s = playerFixture('land');
  if (saved) {
    s.world.restore(saved.edits);
    for (const key of ['position', 'previous', 'velocity']) Object.assign(s[key], saved.player[key]);
    for (const key of ['grounded', 'collidedH', 'flying', 'fallDistance', 'landedFall']) s[key] = saved.player[key];
    Object.assign(s.motion, saved.player.motion);
    s.survival.exhaustion = saved.player.exhaustion;
  }
  s.weather = new Weather({ random: new JavaRandom(51), lcg: 777 });
  if (saved) s.weather.restore(saved.weather).restoreSimulation(saved.random);
  else s.weather.rainTime = s.weather.thunderTime = 1000;
  s.farming = new Farming(s.world, saved?.farms);
  s.fluids = new Fluids(s.world, { random: s.weather.random });
  s.fire = new Fire(s.world, { weather: () => s.weather });
  s.fire.watch();
  s.fire.sharedRandomTicks = true;
  s.weather.blockTick = (x, y, z, block) => s.fire.randomTick(x, y, z, block);
  if (saved) { s.fluids.load(saved.fluids); s.fire.load(saved.fire); }
  s.survival.health = 20;
  return s;
}

test('recorded player motion and world ticks replay through headless checkpoints', () => {
  const inputs = copy([...playerInputs('land'), ...playerInputs('land')]);
  const first = create();
  let resumed = create(), fluidChanges = 0, collisionSeen = false, jumpSeen = false;
  const step = (s, input, tick) => {
    if (tick === 0) {
      s.world.set(70, 12, 65, WATER);
      s.world.set(71, 10, 67, 4);
      s.world.set(71, 11, 67, FIRE);
    }
    const messages = [];
    const movement = movePlayer(s, input, message => messages.push(message));
    tickWeatherSimulation({ ...s, mobs: null }, s.position, 0.6, 1.8);
    const events = [];
    tickBlockSystems(s, { time: tick + 1, daylight: 1, x: s.position.x, z: s.position.z },
      Object.fromEntries(['farming', 'fluids', 'fire'].map(name => [name, changes => events.push([name, copy(changes)])])));
    return { movement, messages, events };
  };
  for (let tick = 0; tick < inputs.length; tick++) {
    if ([10, 31, 67, 109, 155].includes(tick)) resumed = create(checkpoint(resumed));
    const expected = step(first, inputs[tick], tick), actual = step(resumed, inputs[tick], tick);
    assert.deepEqual(actual, expected, `outputs at tick ${tick}`);
    assert.deepEqual(checkpoint(resumed), checkpoint(first), `state at tick ${tick}`);
    fluidChanges += actual.events[1][1].length;
    collisionSeen ||= resumed.collidedH;
    jumpSeen ||= resumed.survival.exhaustion > 0;
  }
  assert.ok(fluidChanges > 0, 'scheduled fluid changes were exercised');
  assert.ok(collisionSeen, 'player collision was exercised');
  assert.ok(jumpSeen, 'player jump was exercised');
  assert.deepEqual(resumed.world.snapshot(), first.world.snapshot());
});
