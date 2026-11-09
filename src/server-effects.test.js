// Potion effects on the gun server (gun-simulation.js you().effects and presence, status-effects.js effectRows/applyEffectRows): a
// player's own tab gets its effects when they start, change or end and once a second, and counts them down in between; the other
// tabs get the swirl colour, the beacon-only flag and invisibility; the server's movement already reads the effects (player-physics.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GunSimulation } from './multiplayer/gun-simulation.js';
import { serverWorldReady, STREAMED_BIOME, STREAMED_GENERATION } from './multiplayer/server-world.js';
import { Effects, applyEffectRows } from './status-effects.js';
import { potionColor } from './fx.js';
import { makeStack } from './inventory.js';
import { installGunRules } from '../server/pack-loader.js';

await serverWorldReady;
await installGunRules();
const STREAMED = { seed: 'ledoge0', biome: STREAMED_BIOME, generationVersion: STREAMED_GENERATION };
const quiet = { spawnMonsters: false, spawnAnimals: false, spawnProtection: 0 };
const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
const SPEED = 1, INVISIBILITY = 14, NIGHT_VISION = 16;

// Alice in Survival on a long stone strip in the sky (so a walk meets nothing).
function arena() {
  const sim = new GunSimulation({ ...STREAMED, time: 6000 }, { config: quiet, random: seeded(7) });
  sim.mobs.ew.entities.length = 0;
  const a = sim.addPlayer('a', 'Alice', 'acct-a');
  const x0 = Math.floor(a.position.x), z0 = Math.floor(a.position.z), y = 150;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -40; dz <= 2; dz++) sim.world.put(x0 + dx, y - 1, z0 + dz, 1, 0);
  sim.teleport(a, { x: x0 + 0.5, y, z: z0 + 0.5 });
  for (let i = 0; i < 3; i++) sim.tick();
  a.survival.mode = 'survival'; a.survival.inventory.creative = false;
  return { sim, a };
}

test('a player\'s effects reach its own tab when they change and once a second, and the tab counts down between', () => {
  const { sim, a } = arena();
  assert.deepEqual(sim.you(a).effects, [], 'the first state says there are none');
  assert.equal(sim.you(a).effects, undefined, 'and then nothing until one starts');
  a.survival.effects.add({ id: NIGHT_VISION, duration: 400, amplifier: 0 });
  a.survival.effects.add({ id: SPEED, duration: 200, amplifier: 1 });
  const rows = sim.you(a).effects;
  assert.deepEqual(rows, [[SPEED, 1, 200, 0], [NIGHT_VISION, 0, 400, 0]]);
  const tab = new Effects();
  applyEffectRows(tab, rows);
  assert.equal(tab.get(SPEED).amplifier, 1);
  assert.ok(Math.abs(tab.moveSpeedMultiplier() - a.survival.effects.moveSpeedMultiplier()) < 1e-9, 'the tab\'s FOV uses the server\'s Speed');
  let resent = 0;
  for (let i = 0; i < 40; i++) {
    sim.tick();
    const you = sim.you(a);
    if (you.effects) { resent++; applyEffectRows(tab, you.effects); } else applyEffectRows(tab, undefined);
    assert.ok(Math.abs(tab.get(SPEED).duration - a.survival.effects.get(SPEED).duration) <= 1, `in step at ${i}`);
  }
  assert.equal(resent, 2, 'the remaining time once a second');
  // A stronger level is sent at once; an ended effect is gone from the tab at once.
  a.survival.effects.add({ id: SPEED, duration: 100, amplifier: 2 });
  assert.equal(sim.you(a).effects?.find(r => r[0] === SPEED)?.[1], 2);
  a.survival.effects.remove(NIGHT_VISION);
  applyEffectRows(tab, sim.you(a).effects);
  assert.equal(tab.has(NIGHT_VISION), false);
  // Death clears them (respawn makes a new Effects), and the tab hears it.
  a.survival.damage(1000, 'void'); sim.tick(); sim.respawn('a');
  assert.deepEqual(sim.you(a).effects, []);
});

test('other tabs see the swirl colour, the beacon-only flag and invisibility', () => {
  const { sim, a } = arena();
  const entry = () => sim.presence().find(e => e.id === 'a');
  assert.equal(entry().fx, undefined);
  a.survival.effects.add({ id: SPEED, duration: 180, amplifier: 0, ambient: true }); // a beacon's
  assert.equal(entry().fx, potionColor(a.survival.effects.active.values()));
  assert.ok(entry().fx > 0);
  assert.equal(entry().ambient, true);
  assert.deepEqual(sim.you(a).effects, [[SPEED, 0, 180, 1]]);
  a.survival.effects.add({ id: INVISIBILITY, duration: 3600, amplifier: 0 }); // a drunk potion: no longer all ambient
  assert.equal(entry().ambient, undefined);
  assert.equal(entry().invisible, true);
});

test('Speed II makes the server walk faster than no effect', () => {
  const walk = effect => {
    const { sim, a } = arena();
    if (effect) a.survival.effects.add(effect);
    const z0 = a.position.z;
    a.yaw = 0; a.pitch = 0;
    for (let i = 0; i < 40; i++) { a.input = { forward: 1, strafe: 0, jump: false, sneak: false, sprint: false }; a.lastInput = sim.ticks; sim.tick(); }
    return Math.abs(a.position.z - z0);
  };
  const plain = walk(null), fast = walk({ id: SPEED, duration: 600, amplifier: 1 });
  assert.ok(plain > 3, `walked ${plain}`);
  assert.ok(fast / plain > 1.3 && fast / plain < 1.5, `Speed II: ${fast} against ${plain}`);
});

test('drinking a potion on the server gives its effects and a glass bottle; milk takes them away', () => {
  const { sim, a } = arena();
  const inv = a.survival.inventory;
  inv.main[0] = makeStack(385, 1, 8226); inv.current = 0; a.pitch = -1.4; // Potion of Swiftness II, looking at the sky
  assert.equal(sim.edit(a, true), true);
  assert.equal(a.eating?.drink, true);
  for (let i = 0; i < 33; i++) sim.tick();
  assert.equal(a.eating, null);
  assert.equal(a.survival.effects.get(SPEED)?.amplifier, 1, 'Speed II');
  assert.equal(inv.main[0]?.id, 384, 'the glass bottle is left');
  assert.deepEqual(sim.you(a).effects?.map(r => r.slice(0, 2)), [[SPEED, 1]]);
  inv.main[0] = makeStack(343, 1, 0); // a milk bucket (MILK_BUCKET)
  assert.equal(sim.edit(a, true), true);
  for (let i = 0; i < 33; i++) sim.tick();
  assert.equal(a.survival.effects.has(SPEED), false, 'milk clears it');
  assert.equal(inv.main[0]?.id, 340, 'the empty bucket');
  assert.deepEqual(sim.you(a).effects, []);
});
