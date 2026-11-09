// The gun server's station blocks (multiplayer/server-stations.js): the brewing stand brews on the server, the enchanting table and
// anvil charge the server's levels, the beacon's picks reach its effects, the ender chest is the player's own; and each window's
// copy in the tab (remote-inventory.js) shows what the server reports and sends its buttons back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GunSimulation } from './multiplayer/gun-simulation.js';
import { serverWorldReady, STREAMED_BIOME, STREAMED_GENERATION } from './multiplayer/server-world.js';
import { remoteContainer, RemoteInventory } from './multiplayer/remote-inventory.js';
import { makeStack } from './inventory.js';
import { ANVIL, ENCHANTING_TABLE } from './world.js';
import { BREWING_STAND, ITEM_NETHER_WART, BREW_TIME } from './brewing.js';
import { BEACON } from './pyramid.js';
import { Beacons } from './pyramid.js';
import { ENDER_CHEST } from './chest-blocks.js';
import { installGunRules } from '../server/pack-loader.js';

await serverWorldReady;
await installGunRules();
const STREAMED = { seed: 'ledoge0', biome: STREAMED_BIOME, generationVersion: STREAMED_GENERATION };
const quiet = { spawnMonsters: false, spawnAnimals: false, spawnProtection: 0 };
const run = (sim, n) => { for (let i = 0; i < n; i++) sim.tick(); };
const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
const POTION = 385, IRON_SWORD = 114, IRON_INGOT = 302, IRON_BLOCK = 26;

// Alice in Survival on a stone platform in the sky, looking down at the block `block` placed just in front of her feet.
function station(block) {
  const sim = new GunSimulation({ ...STREAMED, time: 6000 }, { config: quiet, random: seeded(4) });
  sim.mobs.ew.entities.length = 0;
  const a = sim.addPlayer('a', 'Alice', 'acct-a');
  const x0 = Math.floor(a.position.x), z0 = Math.floor(a.position.z), y = 150;
  for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) sim.world.put(x0 + dx, y - 1, z0 + dz, 1, 0);
  sim.teleport(a, { x: x0 + 0.5, y, z: z0 + 0.5 });
  run(sim, 3);
  a.survival.mode = 'survival'; a.survival.inventory.creative = false;
  a.survival.inventory.main.fill(null);
  a.input.sneak = false;
  const at = [x0, y, z0 - 2];
  sim.world.set(...at, block, true, 0);
  a.yaw = 0; a.pitch = Math.atan2(-(1.62 - 0.5), 1.5); // the middle of the block 2 ahead, at foot level
  return { sim, a, at };
}
// Window slot of InventoryPlayer index i for a container with `own` slots of its own (27 main, then the hotbar).
const slotOf = (own, i) => i < 9 ? own + 27 + i : own + i - 9;
let seq = 0;
const click = (sim, a, slot, button = 0, mode = 0) => assert.equal(sim.click('a', { window: a.window.id, clicks: [[slot, button, mode]], seq: ++seq }), true);
const tab = (a, env = {}) => {
  const sent = [], remote = new RemoteInventory(m => sent.push(m)), open = { ...a.sim.play.openState(a) };
  return { sent, remote, open, c: remote.attach(remoteContainer({ inventory: a.survival.inventory, creative: false }, open, env), open.id) };
};

test('a brewing stand opens a server window, brews over 400 ticks and gives the potion achievement', () => {
  const { sim, a, at } = station(BREWING_STAND);
  const inv = a.survival.inventory;
  inv.main[0] = makeStack(POTION, 1, 0); inv.main[1] = makeStack(POTION, 1, 0); inv.main[2] = makeStack(ITEM_NETHER_WART, 1, 0);
  assert.equal(sim.edit(a, true), true);
  assert.equal(a.window?.kind, 'brewing');
  for (const i of [0, 1, 2]) click(sim, a, slotOf(4, i), 0, 1); // shift-clicks: the bottles to 0-2, the wart to 3
  const c = a.window.container;
  assert.equal(c.slots[3].stack?.id, ITEM_NETHER_WART);
  run(sim, 2);
  const state = sim.play.windowState(a);
  assert.ok(state.brew > 0 && state.brew < BREW_TIME, `brewing: ${state.brew}`);
  // The tab's copy shows the server's slots and progress.
  a.sim = sim;
  const { remote, c: copy } = tab(a);
  remote.restore(inv, state);
  assert.equal(copy.stand.brewTime, state.brew);
  assert.equal(copy.slots[3].stack?.id, ITEM_NETHER_WART);
  run(sim, BREW_TIME);
  assert.equal(c.slots[0].stack?.damage, 16, 'an awkward potion');
  assert.equal(c.slots[3].stack, null, 'the wart was used');
  assert.equal(sim.world.getMeta(...at) & 3, 3, 'the bottles show on the block');
  remote.restore(inv, sim.play.windowState(a));
  assert.equal(copy.slots[0].stack?.damage, 16, 'the tab reads the potion back, not a Water Bottle');
  assert.equal(inv.read({ id: POTION, count: 1, damage: 16421 })?.damage, 16421, 'a saved splash potion keeps its effect bits');
  for (const id of ['openInventory', 'mineWood', 'buildWorkBench', 'buildPickaxe', 'buildFurnace', 'acquireIron', 'diamonds', 'portal', 'blazeRod']) a.achievements.unlocked.add(id);
  click(sim, a, 0, 0, 1); // shift-click the potion out (Container.transferStackInSlot -> onPickupFromSlot)
  assert.ok(a.achievements.has('potion'));
});

test('an enchanting table rolls on the server, charges its levels and the tab sends the button', () => {
  const { sim, a } = station(ENCHANTING_TABLE);
  a.experience.addLevels(30);
  a.survival.inventory.main[0] = makeStack(IRON_SWORD, 1, 0);
  assert.equal(sim.edit(a, true), true);
  assert.equal(a.window?.kind, 'enchanting');
  click(sim, a, slotOf(1, 0), 0, 1);
  const state = sim.play.windowState(a);
  assert.equal(state.levels.length, 3);
  assert.ok(state.levels.some(n => n > 0), `levels ${state.levels}`);
  a.sim = sim;
  const { sent, remote, c } = tab(a, { world: sim.world, experienceLevel: () => a.experience.level });
  remote.restore(a.survival.inventory, state);
  assert.deepEqual(c.levels, state.levels);
  const option = state.levels.findIndex(n => n > 0), cost = state.levels[option];
  assert.equal(c.enchant(option), true);
  assert.deepEqual(sent.at(-1), { type: 'enchant', window: a.window.id, option });
  assert.equal(c.slots[0].stack?.enchantments, undefined, 'the tab does not roll its own enchantment');
  assert.equal(sim.station('a', sent.at(-1)), true);
  assert.ok(a.window.container.item.enchantments?.length >= 1, 'enchanted on the server');
  assert.equal(a.experience.level, 30 - cost);
  assert.equal(sim.station('a', { type: 'enchant', window: a.window.id, option: 7 }), false);
});

test('an anvil renames on the server from the tab\'s typed name and takes the levels', () => {
  const { sim, a, at } = station(ANVIL);
  a.experience.addLevels(10);
  a.survival.inventory.main[0] = makeStack(IRON_SWORD, 1, 0);
  assert.equal(sim.edit(a, true), true);
  assert.equal(a.window?.kind, 'anvil');
  click(sim, a, slotOf(3, 0), 0, 1);
  a.sim = sim;
  const { sent, remote, c } = tab(a, { experienceLevel: () => a.experience.level });
  remote.restore(a.survival.inventory, sim.play.windowState(a));
  c.setName('Blade');
  assert.deepEqual(sent.at(-1), { type: 'anvil', window: a.window.id, name: 'Blade' });
  assert.equal(sim.station('a', sent.at(-1)), true);
  const state = sim.play.windowState(a);
  assert.ok(state.cost > 0, `cost ${state.cost}`);
  assert.equal(a.window.container.output?.displayName, 'Blade');
  remote.restore(a.survival.inventory, state);
  assert.equal(c.output?.displayName, 'Blade', 'the tab works out the same result');
  sim.drainEvents(a);
  click(sim, a, 2, 0, 1); // take the result
  assert.equal(a.survival.inventory.main.find(s => s?.id === IRON_SWORD)?.displayName, 'Blade');
  assert.equal(a.experience.level, 10 - state.cost);
  assert.ok(sim.drainEvents(a).some(e => e.type === 'sound' && /anvil_(use|break)/.test(e.sound)));
  assert.ok([0, ANVIL].includes(sim.world.get(...at)));
  assert.equal(sim.station('a', { type: 'anvil', window: a.window?.id ?? 1, name: 5 }), false);
});

test('a beacon on an iron pyramid takes a payment and its pick reaches the players in range', () => {
  const { sim, a, at } = station(1);
  const [x, y, z] = at;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) sim.world.set(x + dx, y, z + dz, IRON_BLOCK, true, 0);
  sim.world.set(x, y + 1, z, BEACON, true, 0);
  run(sim, 1);
  assert.ok(sim.play.stations.beacons.get(x, y + 1, z), 'the placed beacon has its tile');
  run(sim, 80);
  assert.equal(sim.play.stations.beacons.get(x, y + 1, z).levels, 1);
  a.pitch = Math.atan2(1.5 - 1.62, 1.5); // the beacon, one block up
  a.survival.inventory.main[0] = makeStack(IRON_INGOT, 1, 0);
  assert.equal(sim.edit(a, true), true);
  assert.equal(a.window?.kind, 'beacon');
  click(sim, a, slotOf(1, 0), 0, 1);
  a.sim = sim;
  const beacons = new Beacons();
  const { sent, remote, c } = tab(a, { beacons });
  remote.restore(a.survival.inventory, sim.play.windowState(a));
  assert.equal(c.tile.levels, 1);
  assert.equal(c.payment?.id, IRON_INGOT);
  assert.equal(c.confirm(1, 0), true);
  assert.deepEqual(sent.at(-1), { type: 'beacon', window: a.window.id, primary: 1, secondary: 0 });
  assert.equal(sim.station('a', sent.at(-1)), true);
  assert.equal(sim.play.stations.beacons.get(x, y + 1, z).primary, 1);
  assert.equal(sim.play.windowState(a).beacon.primary, 1);
  run(sim, 80);
  assert.ok(a.survival.effects.has?.(1) ?? a.survival.effects.list?.some?.(e => e.id === 1), 'speed from the beacon');
  assert.equal(sim.save().play.stations.beacons[0].primary, 1, 'saved with the world');
});

test('an ender chest opens the player\'s own ender inventory on the server', () => {
  const { sim, a } = station(ENDER_CHEST);
  assert.equal(sim.edit(a, true), true);
  assert.equal(a.window?.kind, 'chest');
  assert.equal(a.window.title, 'Ender Chest');
  a.survival.inventory.main[0] = makeStack(IRON_INGOT, 5, 0);
  click(sim, a, slotOf(27, 0), 0, 1);
  assert.equal(a.survival.enderItems.find(Boolean)?.id, IRON_INGOT);
});
