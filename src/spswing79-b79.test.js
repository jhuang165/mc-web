// b79 spswing79: the swing of item uses by the client-world onItemUse answer (bytecode-read, see spswing79-rules.js) and the diamondsToYou mob pickup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, DYE, FENCE } from './world.js';
import { Survival, ITEMS } from './survival.js';
import { Farming } from './farming.js';
import { Trees } from './trees.js';
import { JavaRandom } from './java-random.js';
import { makeStack } from './inventory.js';
import { applyPlayerEdit } from './player-edit-simulation.js';
import { ITEM_SPAWN_EGG, ITEM_FIRE_CHARGE } from './spawn-eggs.js';
import { ITEM_BED } from './bed.js';
import { ITEM_CAKE } from './stems-cake.js';
import { ITEM_SKULL } from './skull.js';
import { REEDS_ITEM } from './plants.js';
import { ITEM_REDSTONE } from './redstone-blocks.js';
import { clientUseResult, clickedSide } from './spswing79-rules.js';
import { pickUpLoot } from './mob-equipment-live.js';

const POS = [42, 12, 42], kindId = (k) => Object.keys(ITEMS).map(Number).find((i) => ITEMS[i]?.kind === k);
const HOE = kindId('hoe'), FLINT = kindId('flint_and_steel'), SWORD = kindId('sword'), STONE = 3;
const SIDES = { 0: [0, -1, 0], 1: [0, 1, 0], 2: [0, 0, -1], 3: [0, 0, 1], 4: [-1, 0, 0], 5: [1, 0, 0] };
function click({ tool, block = 2, meta = 0, side = 1, count = 1, damage, above = 0, sneaking = false, extra = {} }) {
  const world = new World('spswing79');
  world.set(...POS, block, false, meta);
  world.set(POS[0], POS[1] + 1, POS[2], above, false, 0);
  const d = SIDES[side], adj = [POS[0] + d[0], POS[1] + d[1], POS[2] + d[2]];
  const stack = makeStack(tool, count); if (damage !== undefined) stack.damage = damage;
  const survival = new Survival({ food: 10, slots: [stack] }, 'survival');
  const state = {
    screen: 'playing', heldTool: tool, world, survival, position: { x: 100.5, y: 60, z: 100.5 }, velocity: { x: 0, y: 0, z: 0 },
    motion: { sneaking, sprinting: false }, mobs: {}, farming: new Farming(world), trees: new Trees(world, { random: new JavaRandom(18) }), fire: { ignite() {}, drain() { return []; } },
    grounded: true, fallDistance: 0, wasInWater: false, yaw: 0, eating: null, mining: null, mineCooldown: 0, mineHeld: true, flowers: {}, boneRandom: new JavaRandom(21), itemRand: new JavaRandom(22),
  };
  let swings = 0;
  applyPlayerEdit(state, { place: true, target: { block: [...POS], adjacent: adj }, aimedEntity: null }, { swing: () => swings++, updateBlock() {}, renderHotbar() {}, markUnsaved() {}, sound() {}, playSound() {}, ...extra });
  return swings;
}

test('clickedSide reads the face from the ray target', () => {
  for (const [s, d] of Object.entries(SIDES)) assert.equal(clickedSide({ block: [5, 5, 5], adjacent: [5 + d[0], 5 + d[1], 5 + d[2]] }), +s);
});

test('hoe: swings only for a top or side face of grass or dirt with air above', () => {
  assert.equal(click({ tool: HOE, block: 1 }), 1, 'grass');
  assert.equal(click({ tool: HOE, block: 2, side: 2 }), 1, 'dirt side');
  assert.equal(click({ tool: HOE, block: STONE }), 0, 'stone');
  assert.equal(click({ tool: HOE, block: 1, side: 0 }), 0, 'bottom face');
  assert.equal(click({ tool: HOE, block: 1, above: STONE }), 0, 'block above');
});

test('flint and steel, fire charge, spawn egg and bed swing on any block', () => {
  for (const t of [FLINT, ITEM_FIRE_CHARGE, ITEM_SPAWN_EGG, ITEM_BED]) assert.equal(click({ tool: t, block: STONE, side: 2 }), 1, `item ${t}`);
});

test('reed-type items swing for a refused placement but not for an empty stack', () => {
  for (const t of [REEDS_ITEM, ITEM_CAKE]) {
    assert.equal(clientUseResult({ world: new World('x') }, { block: POS, adjacent: [POS[0], POS[1] + 1, POS[2]] }, t, { count: 1 }), true);
    assert.equal(clientUseResult({ world: new World('x') }, { block: POS, adjacent: [POS[0], POS[1] + 1, POS[2]] }, t, { count: 0 }), false);
  }
});

test('redstone swings for a snow layer or an air cell, not for an occupied cell', () => {
  assert.equal(click({ tool: ITEM_REDSTONE, block: STONE, side: 1 }), 1, 'air above');
  const w = new World('rs'); w.set(...POS, STONE, false, 0); w.set(POS[0], POS[1] + 1, POS[2], STONE, false, 0);
  assert.equal(clientUseResult({ world: w }, { block: POS, adjacent: [POS[0], POS[1] + 1, POS[2]] }, ITEM_REDSTONE, { count: 1 }), false);
});

test('skull: no swing on the bottom face, a swing on top', () => {
  assert.equal(click({ tool: ITEM_SKULL, block: STONE, side: 0 }), 0);
  assert.equal(click({ tool: ITEM_SKULL, block: STONE, side: 1 }), 1);
});

test('cocoa beans swing on a jungle log side, other dye does not', () => {
  assert.equal(click({ tool: DYE, damage: 3, block: 4, meta: 3, side: 2 }), 1);
  assert.equal(click({ tool: DYE, damage: 3, block: 4, meta: 0, side: 2 }), 0, 'oak');
  assert.equal(click({ tool: DYE, damage: 1, block: STONE, side: 2 }), 0, 'red dye');
});

test('bone meal on stone does not swing', () => {
  assert.equal(click({ tool: DYE, damage: 15, block: STONE }), 0);
});

test('piston moving: a held block swings through its dry placement, a sword does not', () => {
  const hook = { pistonMovingTile: () => false };
  const run = (tool) => click({ tool, block: 130, extra: hook });
  assert.equal(run(SWORD), 0);
  assert.equal(run(STONE), 1);
});

test('a mob picking up a thrown diamond reports it through onPickup', () => {
  const got = [];
  const mob = { canPickUpLoot: true, equipment: [null, null, null, null, null], dropChances: Array(5).fill(0.085) };
  const item = { stack: { id: 303, count: 1 }, thrower: 'Steve', x: 0, y: 0, z: 0 };
  pickUpLoot(mob, [item], [-0.3, 0, -0.3, 0.3, 1.8, 0.3], () => [-0.125, 0, -0.125, 0.125, 0.25, 0.125], () => 0.5, (i) => got.push(i.thrower));
  assert.deepEqual(got, ['Steve']);
});
