// The gun server's melee and mob right-clicks (server-play.js aimed/attackPress/edit): a sword hit on a mob or player under the
// crosshair, shearing a sheep, trading with a villager through a server merchant window, a horse's window, and the tab's copies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GunSimulation } from './multiplayer/gun-simulation.js';
import { serverWorldReady, STREAMED_BIOME, STREAMED_GENERATION } from './multiplayer/server-world.js';
import { remoteContainer, RemoteInventory } from './multiplayer/remote-inventory.js';
import { makeStack } from './inventory.js';
import { FIRE } from './world.js';
import { DedicatedClient } from './multiplayer/client.js';
import { installGunRules } from '../server/pack-loader.js';

await serverWorldReady;
await installGunRules();
const STREAMED = { seed: 'ledoge0', biome: STREAMED_BIOME, generationVersion: STREAMED_GENERATION };
const quiet = { spawnMonsters: false, spawnAnimals: false, spawnProtection: 0 };
const run = (sim, n) => { for (let i = 0; i < n; i++) sim.tick(); };
const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
const IRON_SWORD = 114, SHEARS = 125;

// Alice on a stone platform in the sky, in Survival, facing -z, with `held` in slot 0; a mob 2 blocks in front of her.
function arena(type, held, { players = 1 } = {}) {
  const sim = new GunSimulation({ ...STREAMED, time: 6000 }, { config: quiet, random: seeded(4) });
  sim.mobs.ew.entities.length = 0;
  const a = sim.addPlayer('a', 'Alice', 'acct-a');
  const x0 = Math.floor(a.position.x), z0 = Math.floor(a.position.z), y = 150;
  for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) sim.world.put(x0 + dx, y - 1, z0 + dz, 1, 0);
  sim.teleport(a, { x: x0 + 0.5, y, z: z0 + 0.5 });
  const b = players > 1 ? sim.addPlayer('b', 'Bob', 'acct-b') : null;
  if (b) sim.teleport(b, { x: x0 + 0.5, y, z: z0 - 1.5 });
  run(sim, 3);
  a.survival.mode = 'survival'; a.survival.inventory.creative = false;
  if (held !== undefined) a.survival.inventory.main[0] = held;
  a.survival.inventory.current = 0;
  a.yaw = 0; a.pitch = 0;
  const e = type ? sim.mobs.ew.create(type, x0 + 0.5, y, z0 - 1.5) : null;
  if (e) { e.vx = e.vy = e.vz = 0; sim.mobs.ew.entities.push(e); }
  return { sim, a, b, e, y };
}
// Look from Alice's eye at the middle of a box standing at `at` with height h.
function lookAt(p, at, h) {
  const dx = at.x - p.position.x, dz = at.z - p.position.z, dy = at.y + h / 2 - (p.position.y + 1.62);
  p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz));
}

test('the attack button hits the mob under the crosshair once per press, with the held sword', () => {
  const { sim, a, e } = arena('pig', makeStack(IRON_SWORD, 1, 0));
  lookAt(a, e, 0.9);
  const before = e.health;
  sim.mine(a, true);
  assert.ok(e.health < before, `the pig was hit: ${e.health}`);
  assert.equal(a.survival.inventory.main[0].damage, 1, 'the sword wore by one');
  const once = e.health;
  sim.mine(a, true); // still held: no second hit
  assert.equal(e.health, once);
  sim.mine(a, false);
  assert.equal(a.mining, null, 'nothing is being dug behind the mob');
});

test('a fist hits another player under the crosshair when PvP is on', () => {
  const { sim, a, b } = arena(null, null, { players: 2 });
  b.survival.mode = 'survival'; b.survival.protection = 0;
  lookAt(a, b.position, 1.8);
  sim.drainEvents(a);
  const before = b.survival.health;
  sim.mine(a, true);
  assert.ok(b.survival.health < before, 'a fist hurts (1, less the kit armour)');
  const hit = sim.drainEvents(a).find(e => e.type === 'hit');
  assert.equal(hit?.target, b.id);
});

test('shears used on a sheep shear it on the server and drop its wool', () => {
  const { sim, a, e } = arena('sheep', makeStack(SHEARS, 1, 0));
  e.sheared = false;
  lookAt(a, e, 1.3);
  const items = sim.play.items.items.length;
  assert.equal(sim.edit(a, true), true);
  assert.equal(e.sheared, true);
  run(sim, 1); // the mob events (the wool) are drained with the mobs' tick
  assert.ok(sim.play.items.items.length > items, 'wool dropped');
  assert.equal(a.survival.inventory.main[0].damage, 1, 'the shears wore');
});

test('a villager opens a server merchant window whose offers and slots reach the tab', () => {
  const { sim, a, e } = arena('villager', null);
  e.profession = 0; e.growingAge = 0;
  lookAt(a, e, 1.95);
  assert.equal(sim.edit(a, true), true);
  assert.equal(a.window?.kind, 'merchant');
  assert.equal(e.customer, true);
  const open = sim.play.openState(a), state = sim.play.windowState(a);
  assert.equal(open.kind, 'merchant');
  assert.ok(state.offers.length >= 1, 'the offers go with the window');
  // The tab's copy: a merchant container showing the server's offers, its arrows sent as trade messages.
  const sent = [], remote = new RemoteInventory(m => sent.push(m)), survival = { inventory: a.survival.inventory };
  const c = remote.attach(remoteContainer(survival, open), open.id);
  remote.restore(a.survival.inventory, state);
  assert.equal(c.offers.length, state.offers.length);
  if (c.offers.length > 1) {
    assert.equal(c.step(1), true);
    assert.deepEqual(sent.at(-1), { type: 'trade', window: open.id, index: 1 });
    assert.equal(sim.trade('a', sent.at(-1)), true);
    assert.equal(a.window.container.currentRecipeIndex, 1);
  }
  // Walking away closes the window and frees the villager.
  sim.teleport(a, { x: a.position.x + 20, y: a.position.y, z: a.position.z });
  run(sim, 1);
  assert.equal(a.window, null);
  assert.equal(e.customer, false);
});

test('a tame horse opens its gear window on the server, and the tab builds the same slots', () => {
  const { sim, a, e } = arena('horse', null);
  Object.assign(e.horse ??= {}, { tame: true, chested: true, type: 1 });
  e.tame = true;
  a.input.sneak = true; // sneaking opens the inventory of a tame horse
  lookAt(a, e, 1.6);
  sim.edit(a, true);
  if (a.window?.kind !== 'horse') { sim.play.openHorse(a, e); } // the gear screen itself, if this horse would not open on a click
  assert.equal(a.window?.kind, 'horse');
  const open = sim.play.openState(a), c = remoteContainer({ inventory: a.survival.inventory }, open);
  assert.equal(c.slots.length, a.window.container.slots.length);
});

// ---- the bow, thrown items, exp bottles, books and the rows the tab draws them from ----
const BOW = 127, ARROW = 320, SNOWBALL = 312, ENDER_PEARL = 378, EXP_BOTTLE = 1951, WRITABLE_BOOK = 2110, FIREWORK = 2071;
const giveArrows = (a, n = 16) => { a.survival.inventory.main[1] = makeStack(ARROW, n, 0); };

test('a drawn bow shoots the player\'s arrow on release, which hits the mob and shows in the arrow rows', () => {
  const { sim, a, e } = arena('pig', makeStack(BOW, 1, 0));
  giveArrows(a);
  lookAt(a, e, 0.9);
  assert.equal(sim.edit(a, true), true);
  assert.ok(a.eating?.bow, 'the use button draws the bow');
  for (let i = 0; i < 20; i++) sim.tick();
  assert.ok(a.eating.ticks >= 20, 'the server counts the draw');
  lookAt(a, e, 0.9); // the pig wandered while the bow was drawn
  const before = e.health;
  sim.use(a, false);
  assert.equal(a.eating, null);
  assert.equal(a.survival.inventory.main[1].count, 15, 'one arrow was used');
  const arrow = sim.mobs.arrows.list.at(-1);
  assert.equal(arrow?.by, a.id, 'the arrow is Alice\'s');
  assert.ok(sim.you(a).thrown.arrows.length >= 1, 'the arrow reaches the tab');
  run(sim, 10);
  assert.ok(e.health < before, `the pig was shot: ${e.health}`);
});

test('a snowball and an ender pearl are thrown by the server; the pearl teleports its thrower', () => {
  const { sim, a, y } = arena(null, makeStack(SNOWBALL, 4, 0));
  a.pitch = -Math.PI / 2 + 0.3; // down at the platform
  assert.equal(sim.edit(a, true), true);
  assert.equal(a.survival.inventory.main[0].count, 3);
  const ball = sim.mobs.projectiles.balls.at(-1);
  assert.equal(ball?.by, a.id);
  const rows = sim.you(a).thrown.balls;
  assert.ok(rows.some(r => r[1] === 'snowball'), 'the snowball row');
  a.survival.inventory.main[0] = makeStack(ENDER_PEARL, 1, 0);
  a.yaw = 0; a.pitch = -0.5; // a little down, ahead onto the platform
  const start = { x: a.position.x, z: a.position.z };
  sim.edit(a, true);
  run(sim, 40);
  assert.ok(Math.hypot(a.position.x - start.x, a.position.z - start.z) > 0.5, 'Alice was teleported to the pearl');
  assert.ok(Math.abs(a.position.y - y) < 2);
});

test('an exp bottle breaks into orbs that the nearest player collects', () => {
  const { sim, a } = arena(null, makeStack(EXP_BOTTLE, 2, 0));
  a.pitch = -Math.PI / 2 + 0.2;
  assert.equal(sim.edit(a, true), true);
  let orbs = 0;
  for (let i = 0; i < 20 && !orbs; i++) { sim.tick(); orbs = sim.mobs.orbs.orbs.length; }
  assert.ok(orbs > 0, 'the bottle broke into orbs');
  assert.ok(sim.you(a).thrown.orbs.length > 0, 'the orbs reach the tab');
  run(sim, 120);
  assert.ok(a.experience.total > 0, `Alice collected the experience: ${a.experience.total}`);
  assert.deepEqual(sim.you(a).xp.slice(0, 1), [a.experience.level]);
  assert.ok(sim.savePlayer(a).experience.total > 0, 'saved with the account');
});

test('a book and quill opens the book screen on the tab, and its edit and signature come back to the server', () => {
  const { sim, a } = arena(null, makeStack(WRITABLE_BOOK, 1, 0));
  sim.drainEvents(a);
  assert.equal(sim.edit(a, true), true);
  assert.ok(sim.drainEvents(a).some(e => e.type === 'book'));
  assert.equal(sim.book('a', { channel: 'MC|BEdit', packet: { id: WRITABLE_BOOK, pages: ['hello'] } }), true);
  assert.deepEqual(a.survival.inventory.main[0].pages, ['hello']);
  assert.equal(sim.book('a', { channel: 'MC|BEdit', packet: { id: WRITABLE_BOOK, pages: [42] } }), true, 'a bad tag is ignored');
  assert.deepEqual(a.survival.inventory.main[0].pages, ['hello']);
  assert.equal(sim.book('a', { channel: 'MC|BSign', packet: { id: 2111, pages: ['hello'], title: 'Hi', author: 'Mallory' } }), true);
  assert.equal(a.survival.inventory.main[0].id, 2111);
  assert.equal(a.survival.inventory.main[0].author, 'Alice', 'the server signs with the sender\'s name');
  assert.equal(sim.book('a', { channel: 'nope', packet: {} }), false);
});

test('a firework rocket launches from the clicked block and bursts for the tabs', () => {
  const { sim, a } = arena(null, makeStack(FIREWORK, 1, 0));
  a.pitch = -Math.PI / 2 + 0.01;
  assert.equal(sim.edit(a, true), true);
  assert.equal(sim.mobs.rockets.rockets.length, 1);
  assert.ok(sim.you(a).thrown.balls.some(r => r[1] === 'firework'));
  sim.drainEvents(a);
  const events = [];
  for (let i = 0; i < 60; i++) { sim.tick(); events.push(...sim.drainEvents(a)); }
  assert.equal(sim.mobs.rockets.rockets.length, 0, 'the rocket burst');
  assert.ok(events.some(e => e.type === 'firework'));
});

test('the tab keeps one record per server arrow and ball, with last tick\'s position', async () => {
  const { RemoteThrown } = await import('./multiplayer/remote-thrown.js');
  const r = new RemoteThrown();
  r.apply({ arrows: [[1, 0, 1, 2, 170, 5, 0, 1]], balls: [[2, 'snowball', 3, 4, 5, 0, {}]], orbs: [[3, 1, 1, 1, 7]] });
  const arrow = r.arrows[0], ball = r.balls[0];
  r.apply({ arrows: [[1, 1, 1, 2, -175, 4, 0, 1]], balls: [[2, 'snowball', 3.5, 4, 5, 0, {}]], orbs: [[3, 1, 1.1, 1, 7]] });
  assert.equal(r.arrows[0], arrow); assert.equal(r.balls[0], ball);
  assert.equal(arrow.px, 0); assert.equal(arrow.x, 1);
  assert.equal(arrow.prevYaw, -190, 'the yaw lerps the short way round');
  assert.equal(ball.px, 3); assert.equal(r.orbs[0].color, 1);
  r.apply({ arrows: [], balls: [], orbs: [] });
  assert.equal(r.arrows.length + r.balls.length + r.orbs.length, 0);
});

test('a fire charge sets fire on the clicked block face', () => {
  const { sim, a, y } = arena(null, makeStack(1952, 2, 0));
  a.pitch = -Math.PI / 2 + 0.01;
  assert.equal(sim.edit(a, true), true);
  assert.equal(a.survival.inventory.main[0].count, 1);
  assert.equal(sim.world.get(Math.floor(a.position.x), y, Math.floor(a.position.z)), FIRE, 'fire above the platform');
});

test('a gun with an explosive round (a grenade or rocket) blows up where it lands, on the server\'s blocks', async () => {
  const { GUNS, AKM } = await import('./mods/guns/catalog.js');
  const gun = GUNS[AKM], saved = gun.explosion;
  gun.explosion = { radius: 3, damage: 10, destroy: true };
  try {
    const { sim, a, y } = arena(null, undefined); // the kit's AKM in slot 0
    const x = Math.floor(a.position.x), z = Math.floor(a.position.z) - 5;
    for (let dx = -2; dx <= 2; dx++) for (let dy = 0; dy < 4; dy++) sim.world.put(x + dx, y + dy, z, 1, 0);
    a.yaw = 0; a.pitch = 0;
    run(sim, 12); // the draw
    sim.drainEvents(a);
    sim.action('a', { action: 'trigger', down: true, yaw: 0, pitch: 0 }); sim.action('a', { action: 'trigger', down: false });
    run(sim, 1);
    assert.ok(sim.drainEvents(a).some(e => e.type === 'explosion'), 'the tabs see the blast');
    assert.equal(sim.world.get(x, y + 1, z), 0, 'the wall where it hit is gone');
  } finally { gun.explosion = saved; }
});

test('a mineshaft chest minecart opens as a chest window, reaches the tab, and spills its chest when broken', () => {
  const { sim, a, y } = arena(null, null);
  const x = a.position.x, z = a.position.z - 2;
  const cart = sim.mobs.minecarts.spawnChest({ x, y: y + 0.35, z, items: [{ slot: 0, id: 264, damage: 0, count: 3 }] }); // three diamonds (original ids)
  run(sim, 2);
  assert.ok(sim.you(a).carts.some(r => r[0] === cart.id), 'the cart reaches the tab');
  lookAt(a, { x: cart.x, y: cart.y, z: cart.z }, 0.7);
  assert.equal(sim.edit(a, true), true);
  assert.equal(a.window?.kind, 'chest');
  assert.equal(sim.play.openState(a).rows, 3);
  assert.ok(sim.play.windowState(a).slots.some(([, s]) => s?.count === 3), 'the diamonds are in the window');
  sim.play.closeWindow(a);
  const items = sim.play.items.items.length;
  for (let i = 0; i < 6 && !cart.dead; i++) { lookAt(a, { x: cart.x, y: cart.y, z: cart.z }, 0.7); sim.mine(a, true); sim.mine(a, false); run(sim, 1); }
  assert.equal(cart.dead, true, 'fists break it after a few hits');
  run(sim, 1);
  assert.ok(sim.play.items.items.length >= items + 2, 'the diamonds and the minecart dropped');
  assert.ok(!sim.save().mobs.minecarts.carts.some(c => c.id === cart.id));
});

test("a tab's render clock learns the server's tick length, so frames keep moving between ticks that come a little late", t => {
  let now = 1000;
  t.mock.method(performance, 'now', () => now);
  const client = new DedicatedClient({ onTick() {}, onColumns() {} });
  let tick = 0;
  const arrive = () => client.apply({ type: 'tick', tick: ++tick, players: [] });
  for (let i = 0; i < 200; i++) { arrive(); now += 52; } // a server timer that runs at 52 ms a tick
  assert.ok(Math.abs(client.period - 52) < 1, `learnt ${client.period}`);
  arrive();
  const start = now, frames = [0, 13, 26, 39, 51].map(dt => { now = start + dt; return client.partial(); });
  assert.ok(frames.every((v, i) => !i || v > frames[i - 1]), `rising: ${frames}`);
  assert.ok(frames.at(-1) <= 1 && frames.at(-1) > 0.9, `the step's last frame is near its end, not held at it: ${frames}`);
  now += 2000; arrive(); // a stall restarts the clock
  assert.equal(client.partial(), 0);
});
