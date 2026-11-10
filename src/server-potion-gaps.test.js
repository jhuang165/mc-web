// The gun server's potion follow-ups: a player's splash potion reaches every player in reach (witch-potions.js players, server-mobs.js),
// any potion value splashes (witch.js potionEffects), the tabs draw its break (an fx 'splash' event); another player's eating and
// drinking are heard and its crumbs seen (gun-simulation.js heardFrom); a mob looks past an invisible player (server-mobs.js watcher).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GunSimulation, STEAK } from './multiplayer/gun-simulation.js';
import { serverWorldReady, STREAMED_BIOME, STREAMED_GENERATION } from './multiplayer/server-world.js';
import { makeStack } from './inventory.js';
import { potionEffects } from './witch.js';
import { getPotionEffects } from './potions.js';
import { installGunRules } from '../server/pack-loader.js';

await serverWorldReady;
await installGunRules();
const STREAMED = { seed: 'ledoge0', biome: STREAMED_BIOME, generationVersion: STREAMED_GENERATION };
const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
const SPEED = 1, INVISIBILITY = 14;

// Alice and Bob in Survival one block apart on a stone floor in the sky; `sent` records every event but the ticks.
function pair(config = {}) {
  const sim = new GunSimulation({ ...STREAMED, time: 6000 }, { config: { spawnMonsters: false, spawnAnimals: false, spawnProtection: 0, ...config }, random: seeded(7) });
  sim.mobs.ew.entities.length = 0;
  const a = sim.addPlayer('a', 'Alice', 'acct-a'), b = sim.addPlayer('b', 'Bob', 'acct-b');
  const x0 = Math.floor(a.position.x), z0 = Math.floor(a.position.z), y = 150;
  for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) sim.world.put(x0 + dx, y - 1, z0 + dz, 1, 0);
  sim.teleport(a, { x: x0 + 0.5, y, z: z0 + 0.5 });
  sim.teleport(b, { x: x0 + 1.5, y, z: z0 + 0.5 });
  const sent = [], send = sim.send.bind(sim);
  sim.send = (p, e) => { if (e?.type !== 'tick') sent.push({ to: p.id, ...e }); return send(p, e); };
  for (let i = 0; i < 3; i++) sim.tick();
  for (const p of [a, b]) p.survival.protection = 0; // past JOIN_PROTECTION, so splashes can hurt
  for (const p of [a, b]) { p.survival.mode = 'survival'; p.survival.inventory.creative = false; }
  sent.length = 0;
  return { sim, a, b, sent };
}
const throwDown = (sim, p, damage) => {
  const inv = p.survival.inventory;
  inv.main[0] = makeStack(385, 1, damage); inv.current = 0; p.pitch = 1.5;
  assert.equal(sim.edit(p, true), true);
  for (let i = 0; i < 30; i++) sim.tick();
};

test('every potion value splashes as PotionHelper reads it, and the eight witch potions are unchanged', () => {
  assert.deepEqual(potionEffects(16386), getPotionEffects(16386).map(e => [e.id, e.amplifier, e.duration]));
  assert.deepEqual(potionEffects(32698), [[2, 0, 1351]]);
  assert.deepEqual(potionEffects(0), [], 'a water bottle has none');
});

test('a player\'s splash potion reaches the thrower and the player beside it, and every tab draws the break', () => {
  const { sim, a, b, sent } = pair();
  throwDown(sim, b, 16386); // Splash Potion of Swiftness at Bob's feet
  assert.equal(a.survival.effects.get(SPEED)?.amplifier, 0, 'Alice, a block away');
  assert.equal(b.survival.effects.get(SPEED)?.amplifier, 0, 'Bob, who threw it');
  assert.ok(a.survival.effects.get(SPEED).duration < b.survival.effects.get(SPEED).duration, 'the farther one gets less');
  for (const id of ['a', 'b']) {
    const fx = sent.find(e => e.to === id && e.type === 'fx' && e.kind === 'splash');
    assert.ok(fx && Number.isInteger(fx.x) && fx.damage === 16386, `${id} draws the break`);
  }
});

test('with PvP off another player\'s splash of Harming leaves Bob\'s health but hurts the thrower; its effects still land', () => {
  const { sim, a, b } = pair({ pvp: false });
  throwDown(sim, a, 16396); // Splash Potion of Harming
  assert.ok(a.survival.health < 20, `Alice: ${a.survival.health}`);
  assert.equal(b.survival.health, 20);
  const slow = pair({ pvp: false });
  throwDown(slow.sim, slow.a, 16394); // Splash Potion of Slowness
  assert.ok(slow.b.survival.effects.has(2), 'Slowness on Bob');
});

test('the others hear a player eat and drink and see its crumbs; its own tab gets none of them (it predicted them)', () => {
  const { sim, a, sent } = pair();
  const inv = a.survival.inventory;
  a.survival.food = 10;
  inv.main[0] = makeStack(STEAK, 4, 0); inv.current = 0;
  sim.use(a, true);
  for (let i = 0; i < 34; i++) sim.tick();
  assert.equal(inv.main[0].count, 3, 'one steak eaten');
  const bob = sent.filter(e => e.to === 'b');
  assert.ok(bob.filter(e => e.type === 'sound' && e.sound === 'random.eat').length >= 6, 'the chewing');
  assert.ok(bob.some(e => e.type === 'sound' && e.sound === 'random.burp'));
  const crumbs = bob.filter(e => e.type === 'crumbs' && e.by === 'a' && e.id === STEAK);
  assert.ok(crumbs.some(e => e.n === 5) && crumbs.some(e => e.n === 16), 'chewing crumbs and the last bite');
  assert.equal(sent.some(e => e.to === 'a' && (e.type === 'crumbs' || /random\.(eat|burp)/.test(e.sound ?? ''))), false);
  sent.length = 0;
  inv.main[0] = makeStack(385, 1, 8226); a.pitch = -1.4;
  assert.equal(sim.edit(a, true), true);
  for (let i = 0; i < 33; i++) sim.tick();
  assert.ok(sent.filter(e => e.to === 'b' && e.sound === 'random.drink').length >= 7, 'the gulps');
  assert.equal(sent.some(e => e.to === 'a' && e.sound === 'random.drink'), false);
});

test('a mob looks past an invisible player beside it to a visible one, but not past 32 blocks', () => {
  const { sim, a, b } = pair();
  const zombie = { x: a.position.x - 1, y: a.position.y, z: a.position.z };
  sim.teleport(b, { x: a.position.x + 6, y: a.position.y, z: a.position.z });
  assert.equal(sim.mobs.watcher([a, b], zombie), a, 'the nearer one while both are seen');
  a.survival.effects.add({ id: INVISIBILITY, duration: 600, amplifier: 0 });
  assert.equal(sim.mobs.watcher([a, b], zombie), a, 'the arena kit\'s iron armour still shows (getArmorVisibility 1: range x 0.7)');
  a.survival.inventory.armor.fill(null);
  assert.equal(sim.mobs.watcher([a, b], zombie), b, 'without armour, Bob, the visible one');
  sim.teleport(b, { x: a.position.x + 40, y: a.position.y, z: a.position.z });
  assert.equal(sim.mobs.watcher([a, b], zombie), a, 'beyond 32 blocks the nearest stays (despawning reads it)');
});
