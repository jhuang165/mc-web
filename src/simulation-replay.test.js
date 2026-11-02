import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIRE, LAVA, WATER, SAND } from './world.js';
import { JavaRandom } from './java-random.js';
import { Weather } from './weather.js';
import { Farming } from './farming.js';
import { Fluids } from './fluids.js';
import { Fire } from './fire.js';
import { FallingBlocks } from './falling.js';
import { tickWeatherSimulation } from './weather-simulation.js';
import { tickBlockSystems } from './world-tick.js';
import { movePlayer } from './player-physics.js';
import { tickPlayerEnvironment, finishPlayerMovement } from './player-environment.js';
import { Survival } from './survival.js';
import { playerFixture, playerInputs } from './player-physics-fixture.js';

const copy = value => JSON.parse(JSON.stringify(value));

// This test checkpoint is deliberately not the browser's save format: it also
// contains transient player motion, which browser saves do not yet retain.
function checkpoint(s) {
  const coords = ({ x, y, z }) => ({ x, y, z });
  const { hurtTicks, hurtAmount, hurtCount, hurtTime, hurtSounds, protection, ticks, lastDamage, died, drowned } = s.survival;
  return copy({ player: { position: coords(s.position), previous: coords(s.previous), velocity: coords(s.velocity),
    grounded: s.grounded, collidedH: s.collidedH, flying: s.flying, fallDistance: s.fallDistance,
    landedFall: s.landedFall, motion: { ...s.motion }, survival: s.survival.serialize(),
    transient: { hurtTicks, hurtAmount, hurtCount, hurtTime, hurtSounds, protection, ticks, lastDamage, died, drowned } },
  edits: [...s.world.edits], weather: s.weather.save(), random: s.weather.saveSimulation(),
  farms: s.farming.serialize(), fluids: s.fluids.save(), fire: s.fire.save(),
  falling: s.falling.serialize(), fallingTicks: s.falling.save() });
}

function create(saved) {
  const s = playerFixture('land');
  s.survival = new Survival(saved?.player.survival);
  if (saved) {
    s.world.restore(saved.edits);
    for (const key of ['position', 'previous', 'velocity']) Object.assign(s[key], saved.player[key]);
    for (const key of ['grounded', 'collidedH', 'flying', 'fallDistance', 'landedFall']) s[key] = saved.player[key];
    Object.assign(s.motion, saved.player.motion);
    Object.assign(s.survival, saved.player.transient);
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
  s.fallingEvents = [];
  s.falling = new FallingBlocks(s.world, {
    apply: changes => s.fallingEvents.push(['blocks', copy(changes)]),
    drop: (...args) => s.fallingEvents.push(['drop', copy(args)]),
  }, saved?.falling).watch();
  if (saved) { s.fluids.load(saved.fluids); s.fire.load(saved.fire); s.falling.load(saved.fallingTicks); }
  return s;
}

test('recorded movement, survival, falling blocks and world ticks replay through headless checkpoints', () => {
  const inputs = copy([...playerInputs('land'), ...playerInputs('land')]);
  const first = create();
  let resumed = create(), fluidChanges = 0, collisionSeen = false, jumpSeen = false, hurtSeen = false,
    fallingSeen = false, pendingCheckpoint = false, entityCheckpoint = false;
  const step = (s, input, tick) => {
    if (tick === 0) {
      s.world.set(70, 12, 65, WATER);
      s.world.set(71, 10, 67, 4);
      s.world.set(71, 11, 67, FIRE);
      s.world.set(69, 17, 64, SAND);
    }
    if (tick === 5) s.world.set(Math.floor(s.position.x), Math.floor(s.position.y), Math.floor(s.position.z), LAVA);
    if (tick === 15) s.world.set(Math.floor(s.position.x), Math.floor(s.position.y), Math.floor(s.position.z), WATER);
    const messages = [];
    const movement = movePlayer(s, input, message => messages.push(message));
    tickPlayerEnvironment(s, movement, {
      tickWeather: () => tickWeatherSimulation({ ...s, mobs: null }, s.position, 0.6, 1.8),
      afterSurvival: () => { if (s.survival.drowned) { messages.push('drowned'); s.survival.drowned = false; } },
      fizz: () => messages.push('fizz'),
    });
    s.fallingEvents = [];
    s.falling.tick();
    finishPlayerMovement(s, movement);
    const events = [];
    tickBlockSystems(s, { time: s.survival.time, daylight: 1, x: s.position.x, z: s.position.z },
      Object.fromEntries(['farming', 'fluids', 'fire'].map(name => [name, changes => events.push([name, copy(changes)])])));
    return { movement, messages, falling: s.fallingEvents, events };
  };
  for (let tick = 0; tick < inputs.length; tick++) {
    if ([1, 4, 10, 31, 67, 109, 155].includes(tick)) {
      pendingCheckpoint ||= resumed.falling.pending.size > 0;
      entityCheckpoint ||= resumed.falling.entities.length > 0;
      resumed = create(checkpoint(resumed));
    }
    const expected = step(first, inputs[tick], tick), actual = step(resumed, inputs[tick], tick);
    assert.deepEqual(actual, expected, `outputs at tick ${tick}`);
    assert.deepEqual(checkpoint(resumed), checkpoint(first), `state at tick ${tick}`);
    fluidChanges += actual.events[1][1].length;
    collisionSeen ||= resumed.collidedH;
    jumpSeen ||= resumed.survival.exhaustion > 0;
    hurtSeen ||= resumed.survival.health < 20;
    fallingSeen ||= resumed.falling.entities.length > 0;
  }
  assert.ok(fluidChanges > 0, 'scheduled fluid changes were exercised');
  assert.ok(collisionSeen, 'player collision was exercised');
  assert.ok(jumpSeen, 'player jump was exercised');
  assert.ok(hurtSeen, 'real survival damage was exercised');
  assert.ok(fallingSeen, 'falling sand existed across ticks');
  assert.ok(pendingCheckpoint && entityCheckpoint, 'checkpoints include queued and airborne falling sand');
  assert.deepEqual(resumed.world.snapshot(), first.world.snapshot());
});
