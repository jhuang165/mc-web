import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, WATER, WEB, CACTUS } from './world.js';
import { Weather } from './weather.js';
import { JavaRandom } from './java-random.js';
import { Survival } from './survival.js';
import { PlayerMotion } from './player-movement.js';
import { tickPlayerEnvironment, finishPlayerMovement } from './player-environment.js';

function fixture(data = {}, mode = 'survival') {
  const world = new World('player-environment');
  for (let x = 62; x <= 66; x++) for (let z = 62; z <= 66; z++)
    for (let y = 9; y < world.height; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  const weather = new Weather({ random: new JavaRandom(1), lcg: 1 });
  const position = { x: 64.5, y: 10, z: 64.5 }, survival = new Survival(data, mode);
  return { world, weather, position, survival, motion: new PlayerMotion(), flying: false };
}

test('underwater air is sampled before weather, then drowning is observed before block collisions', () => {
  const s = fixture({ air: -19 });
  s.world.put(64, 10, 64, WATER);
  s.world.put(64, 11, 64, WATER);
  const order = [];
  const result = tickPlayerEnvironment(s, { inWater: true, inLavaNow: false }, {
    tickWeather: () => { order.push('weather'); s.world.put(64, 11, 64, 0); },
    afterSurvival: () => { order.push('particles'); assert.equal(s.survival.drowned, true); assert.equal(s.survival.health, 18); s.survival.drowned = false; },
  });
  assert.deepEqual(order, ['weather', 'particles']);
  assert.equal(result.underwater, true);
  assert.equal(result.wet, true);
  assert.equal(s.survival.air, 0);
  assert.equal(s.survival.lastDamage, 'drowning');
});

test('suffocation runs before cactus contact and shares the hurt resistance window', () => {
  const s = fixture();
  s.world.put(64, 10, 64, CACTUS);
  s.world.put(64, 11, 64, 3);
  const result = tickPlayerEnvironment(s, { inWater: false, inLavaNow: false }, { tickWeather() {} });
  assert.equal(result.inWall, true);
  assert.equal(s.survival.health, 19);
  assert.equal(s.survival.lastDamage, 'suffocation');
  assert.equal(s.survival.hurtCount, 1);
});

test('rain extinguishes fire after the survival update and webs affect the next movement', () => {
  const s = fixture({ fire: 40 });
  s.weather.restore({ raining: true, thundering: false, rainTime: 100, thunderTime: 100 });
  s.world.put(64, 10, 64, WEB);
  const calls = [];
  tickPlayerEnvironment(s, { inWater: false, inLavaNow: false }, {
    tickWeather: () => calls.push('weather'),
    afterSurvival: () => { calls.push('particles'); assert.equal(s.survival.fire, 39); assert.equal(s.motion.inWeb, false); },
    fizz: () => calls.push('fizz'),
  });
  assert.deepEqual(calls, ['weather', 'particles', 'fizz']);
  assert.equal(s.survival.health, 19);
  assert.equal(s.survival.fire, -20);
  assert.equal(s.motion.inWeb, true);
  s.flying = true;
  s.motion.inWeb = false;
  tickPlayerEnvironment(s, { inWater: false, inLavaNow: false }, { tickWeather() {} });
  assert.equal(s.motion.inWeb, false, 'flying players do not enter webs');
});

test('landing handles exhaustion, trampling and dust before fall damage', () => {
  const s = fixture();
  Object.assign(s, { grounded: true, fallDistance: 4.2, landedFall: 4.2 });
  s.motion.sprinting = true;
  const calls = [];
  finishPlayerMovement(s, { inWater: false, inLavaNow: false, oldPosition: { x: 63.5, y: 14.2, z: 64.5 } }, {
    trample: (p, distance) => calls.push(['trample', distance, s.survival.health]),
    landingDust: (x, y, z, count) => calls.push(['dust', x, y, z, count, s.survival.health]),
  });
  assert.deepEqual(calls, [['trample', 4.2, 20], ['dust', 64, 9, 64, 2, 20]]);
  assert.equal(s.survival.health, 18);
  assert.equal(s.survival.lastDamage, 'a fall');
  assert.equal(s.survival.exhaustion, Math.fround(0.1));
  assert.equal(s.fallDistance, 0);
  assert.equal(s.landedFall, 0);
});

test('lava halves airborne fall distance and water or webs clear it', () => {
  const s = fixture();
  Object.assign(s, { grounded: false, fallDistance: 8, landedFall: 0 });
  const input = { inWater: false, inLavaNow: true, oldPosition: { ...s.position } };
  finishPlayerMovement(s, input);
  assert.equal(s.fallDistance, 4);
  s.motion.inWeb = true;
  finishPlayerMovement(s, input);
  assert.equal(s.fallDistance, 0);
  s.motion.inWeb = false;
  s.fallDistance = 8;
  finishPlayerMovement(s, { ...input, inWater: true });
  assert.equal(s.fallDistance, 0);
});

test('creative landing still has effects but does not damage; the void bypasses protection', () => {
  const s = fixture({}, 'creative');
  s.survival.protection = 60;
  Object.assign(s, { grounded: true, fallDistance: 8, landedFall: 8 });
  const calls = [];
  finishPlayerMovement(s, { inWater: false, inLavaNow: false, oldPosition: { ...s.position } }, {
    trample: () => calls.push('trample'), landingDust: () => calls.push('dust'),
  });
  assert.deepEqual(calls, ['trample', 'dust']);
  assert.equal(s.survival.health, 20);
  s.position.y = -65;
  tickPlayerEnvironment(s, { inWater: false, inLavaNow: false }, { tickWeather() {} });
  assert.equal(s.survival.health, 16);
  assert.equal(s.survival.lastDamage, 'void');
});

// EntityPlayer.isEntityInsideOpaqueBlock returns false while sleeping: a bed pushed against a wall never suffocates its sleeper.
test('a sleeping player beside a wall takes no suffocation damage', () => {
  for (const sleeping of [false, true]) {
    const s = fixture();
    s.world.put(65, 11, 64, 3);
    Object.assign(s.position, { x: 64.9, y: 9.5625, z: 64.5 }); // the lying spot, 0.4 towards the head of a bed at (64, 9, 64)
    s.sleeping = sleeping;
    const result = tickPlayerEnvironment(s, { inWater: false, inLavaNow: false }, { tickWeather() {} });
    assert.equal(result.inWall, !sleeping);
    assert.equal(s.survival.health, sleeping ? 20 : 19);
  }
});

// ---- Batch 25: a piston push runs the player's moveEntity tail and landing (piston-push.js pushPlayer) ----
import { pushPlayer } from './piston-push.js';
import { FIRE } from './world.js';
import { landPlayer, playerMoveTail } from './player-environment.js';
function pushed(s, over = {}) {
  const st = { onGround: false, collidedH: false, fallDistance: 0, ...over };
  return {
    position: s.position, velocity: { x: 0, y: 0, z: 0 }, motion: s.motion, width: 0.6, height: 1.8, flying: false,
    get onGround() { return st.onGround; }, set onGround(v) { st.onGround = v; }, get collidedH() { return st.collidedH; }, set collidedH(v) { st.collidedH = v; },
    get fallDistance() { return st.fallDistance; }, set fallDistance(v) { st.fallDistance = v; },
    tail: (body) => playerMoveTail({ world: s.world, weather: s.weather, survival: s.survival, flying: false, inWater: false }, body),
    land: (d) => landPlayer({ world: s.world, position: s.position, survival: s.survival, inWater: false }, d),
  };
}

test('a push that lands the player applies the fall (updateFallState on the ground: EntityLivingBase.fall)', () => {
  const s = fixture();
  s.position.y = 10.5;
  const p = pushed(s, { fallDistance: 4.5 });
  const landed = pushPlayer(s.world, p, 0, -0.5625, 0);
  assert.equal(landed, 4.5, 'the fall distance before the landing move (updateFallState adds nothing on the ground)');
  assert.equal(s.position.y, 10);
  assert.equal(p.onGround, true);
  assert.equal(p.fallDistance, 0);
  assert.equal(s.survival.health, 18, 'ceil(4.5 - 3) = 2 points');
  assert.equal(s.survival.lastDamage, 'a fall');
});

test('a push into a cactus hurts the player; one into fire burns it and catches with setFire(8) at the counter rollover', () => {
  const s = fixture();
  s.world.put(65, 10, 64, CACTUS, 0, false);
  const p = pushed(s, { onGround: true });
  pushPlayer(s.world, p, 0.5625, 0, 0);
  assert.ok(Math.abs(s.position.x - (65.0625 - Math.fround(0.6) / 2)) < 1e-6, `stopped by the cactus box: ${s.position.x}`);
  assert.equal(s.survival.lastDamage, 'a cactus');
  const f = fixture();
  f.world.put(65, 10, 64, FIRE, 0, false);
  f.survival.fire = -1;
  pushPlayer(f.world, pushed(f, { onGround: true }), 0.5625, 0, 0);
  assert.equal(f.survival.lastDamage, 'fire');
  assert.equal(f.survival.fire, 160, 'the counter reaches 0 and setFire(8) gives 160 ticks');
  const g = fixture();
  g.survival.fire = 30;
  pushPlayer(g.world, pushed(g, { onGround: true }), 0.5625, 0, 0);
  assert.equal(g.survival.fire, 30, 'outside a burning box a positive counter is left to the burn tick');
});
