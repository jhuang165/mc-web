// b77 spcauldron77: single-player item use after a block click follows the client-world onBlockActivated answer
// (bytecode-read, see block-activation.js), and an entity click never swings (bao.am: only EntityCreeper.interact swings).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, FENCE, FLOWER_POT } from './world.js';
import { NETHER_FENCE } from './nether-blocks.js';
import { WOODEN_BUTTON, COMPARATOR } from './redstone-blocks-2.js';
import { Survival, ITEMS } from './survival.js';
import { makeStack } from './inventory.js';
import { BOW } from './bow.js';
import { LAVA_BUCKET, MILK_BUCKET } from './buckets.js';
import { ITEM_POTION, ITEM_GLASS_BOTTLE } from './potion-use.js';
import { FISHING_ROD } from './fishing-content.js';
import { CAULDRON } from './stone-utility.js';
import { REDSTONE_ORE } from './world.js';
import { applyPlayerEdit } from './player-edit-simulation.js';
import { swallowsItemUse } from './block-activation.js';
import { STATIONS } from './player-edit-simulation.js';

const FOOD = +Object.entries(ITEMS).find(([, v]) => v.food)[0];
const AT = [10, 20, 10];
const none = () => false;
function click(tool, block, { sneak = false, meta = 0, mode = 'survival' } = {}) {
  const world = new World('spcauldron77');
  world.set(...AT, block, true, meta);
  const survival = new Survival({ food: 10, slots: [makeStack(tool, 1, 0)] }, mode);
  const state = { screen: 'playing', heldTool: tool, world, survival, position: { x: 10.5, y: 22, z: 10.5 }, velocity: { x: 0, y: 0, z: 0 },
    motion: { sneaking: sneak }, mobs: {}, eating: null, mining: null, yaw: 0, pitch: 0, grounded: true, fallDistance: 0, wasInWater: false, fire: {}, farming: {} };
  const used = [];
  const hooks = { useFishingRod: () => { used.push('rod'); }, swing() {}, renderHotbar() {}, markUnsaved() {}, updateBlock() {} };
  state.projectiles = null;
  const r = applyPlayerEdit(state, { place: true, target: { block: [...AT], adjacent: [AT[0], AT[1] + 1, AT[2]] } }, hooks);
  return { state, r, used };
}

test('cauldron click at level 0 and 3 swallows food, bow, rod, potion, bottle, lava bucket', () => {
  for (const level of [0, 3]) for (const tool of [FOOD, BOW, FISHING_ROD, ITEM_POTION, LAVA_BUCKET, MILK_BUCKET]) {
    const c = click(tool, CAULDRON, { meta: level });
    assert.equal(c.state.eating, null, `tool ${tool} level ${level}`);
    assert.deepEqual(c.used, []);
  }
  assert.equal(click(ITEM_GLASS_BOTTLE, CAULDRON, { meta: 0 }).r.branch === 'use-glass-bottle', false);
});

test('sneaking with an item skips onBlockActivated, so the item acts', () => {
  assert.ok(click(FOOD, CAULDRON, { sneak: true }).state.eating);
  assert.ok(click(BOW, CAULDRON, { sneak: true, mode: 'creative' }).state.eating?.bow);
  assert.deepEqual(click(FISHING_ROD, CAULDRON, { sneak: true }).used, ['rod']);
});

test('fences, wooden buttons and comparators swallow item use; plain stone and redstone ore do not', () => {
  for (const b of [FENCE, NETHER_FENCE, WOODEN_BUTTON, COMPARATOR]) assert.equal(click(FOOD, b).state.eating, null, `block ${b}`);
  assert.ok(click(FOOD, 1).state.eating);
  assert.ok(click(FOOD, REDSTONE_ORE).state.eating);
});

test('the native table: always-true blocks swallow, jukebox only when loaded, flower pot stays conditional', () => {
  for (const b of STATIONS) if (b !== 178) assert.equal(swallowsItemUse(b, STATIONS, false), true, `station ${b}`);
  assert.equal(swallowsItemUse(178, STATIONS, false), false);
  assert.equal(swallowsItemUse(178, STATIONS, true), true);
  assert.equal(swallowsItemUse(FLOWER_POT, STATIONS, false), false);
  assert.equal(swallowsItemUse(1, STATIONS, false), false);
});

function entityScene(tool, type = 'cow', claims = {}) {
  const entity = { id: 'm1', type, health: 10 };
  const survival = new Survival({ food: 10, slots: [makeStack(tool, 1, 0)] }, 'survival');
  const mobs = { leashInteract: none, saddleUse: none, spawnEggBaby: none, cure: none, wolfInteract: none, ocelotInteract: none,
    mooshroomInteract: none, horseInteract: none, nameTagUse: none, shear: none, feed: none, dye: none, entities: [entity], potions: { throwFromPlayer() {} }, ...claims };
  const state = { screen: 'playing', heldTool: tool, world: new World('spcauldron77e'), survival, position: { x: 0, y: 64, z: 0 }, motion: { sneaking: false },
    mobs, eating: null, mining: null, yaw: 0, pitch: 0, grounded: true, fallDistance: 0, wasInWater: false };
  let swings = 0;
  const r = applyPlayerEdit(state, { place: true, target: null, aimedEntity: { entity } }, { swing: () => swings++, renderHotbar() {}, markUnsaved() {}, handleEntityEvents() {}, playSound() {} });
  return { r, swings, state };
}

test('eating, drinking and taken entity clicks do not swing; a creeper lit with flint and steel does', () => {
  assert.equal(entityScene(FOOD).swings, 0);
  assert.equal(entityScene(MILK_BUCKET).swings, 0);
  assert.equal(entityScene(ITEM_POTION).swings, 0);
  assert.equal(entityScene(FOOD, 'cow', { feed: () => true }).swings, 0);
  assert.equal(entityScene(ITEMS_STICK(), 'cow', { nameTagUse: () => true }).swings, 0);
  const flint = +Object.entries(ITEMS).find(([, v]) => v.kind === 'flint_and_steel')[0];
  const c = entityScene(flint, 'creeper');
  assert.equal(c.r.branch, 'ignite-creeper');
  assert.equal(c.swings, 1);
});
function ITEMS_STICK() { return 280; }
