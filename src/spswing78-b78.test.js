// b78 spswing78: the swing of a right click on a block, the multiplayer prediction's block list and the piston-moving click.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, CAULDRON, FENCE, WOODEN_BUTTON, COMPARATOR, COMPARATOR_POWERED, FLOWER_POT, PISTON_MOVING, BLOCKS } from './world.js';
import { NETHER_FENCE } from './nether-blocks.js';
import { Survival, ITEMS } from './survival.js';
import { Farming } from './farming.js';
import { Trees } from './trees.js';
import { JavaRandom } from './java-random.js';
import { makeStack } from './inventory.js';
import { applyPlayerEdit, STATIONS } from './player-edit-simulation.js';
import { swallowsItemUse } from './block-activation.js';
import { activatesOnClick, useKind, predictsPlacement } from './client-prediction.js';
import { bookOpensOnUse } from './multiplayer/client-books.js';

const POS = [42, 12, 42], SWORD = Object.keys(ITEMS).map(Number).find((i) => ITEMS[i]?.kind === 'sword'), BREAD = 297, STONE = 1, CHEST = 41, ITEM_BOOK = 2110, JUKEBOX = 178;
function fixture({ tool = 0, block = 0, sneaking = false, place = true, mode = 'survival' } = {}) {
  const world = new World('spswing78');
  world.set(...POS, block, false, 0);
  world.set(POS[0], POS[1] + 1, POS[2], 0, false, 0);
  const survival = new Survival({ food: 10, slots: tool ? [makeStack(tool, 1)] : [] }, mode);
  const state = {
    screen: 'playing', heldTool: tool, world, survival, position: { x: 100.5, y: 60, z: 100.5 }, velocity: { x: 0, y: 0, z: 0 },
    motion: { sneaking, sprinting: false }, mobs: {}, farming: new Farming(world), trees: new Trees(world, { random: new JavaRandom(18) }), fire: {},
    grounded: true, fallDistance: 0, wasInWater: false, yaw: 0, eating: null, mining: null, mineCooldown: 0, mineHeld: true,
    flowers: {}, boneRandom: new JavaRandom(21), itemRand: new JavaRandom(22),
  };
  return { state, request: { place, target: { block: [...POS], adjacent: [POS[0], POS[1] + 1, POS[2]] }, aimedEntity: null } };
}
function click(opts, extra = {}) {
  const f = fixture(opts), swings = [];
  const result = applyPlayerEdit(f.state, f.request, { swing: () => swings.push(1), updateBlock() {}, renderHotbar() {}, markUnsaved() {}, sound() {}, playSound() {}, ...extra });
  return { result, swings: swings.length, f };
}

test('a declined block click with an item that cannot be placed does not swing', () => {
  for (const tool of [SWORD, BREAD]) {
    const r = click({ tool, block: 3 });
    assert.equal(r.swings, 0, `item ${tool}`);
  }
  assert.equal(click({ tool: SWORD, block: 0 }).swings, 0, 'sword on air');
});

test('placing a block, an activated block and a left click still swing', () => {
  const p = click({ tool: STONE, block: 3 });
  assert.equal(p.result.branch, 'place-block');
  assert.equal(p.swings, 1, 'placed');
  assert.equal(click({ tool: SWORD, block: CHEST }).swings, 1, 'chest answers true on the client');
  assert.equal(click({ tool: SWORD, block: CAULDRON }).swings, 1, 'cauldron answers true even when nothing follows');
  assert.equal(click({ tool: BREAD, block: FENCE }).swings, 1, 'fence answers true on the client');
  assert.equal(click({ tool: SWORD, block: 3, place: false }).swings, 1, 'left click');
});

test('sneaking with a sword skips the chest, so the click is declined and silent', () => {
  assert.equal(click({ tool: SWORD, block: CHEST, sneaking: true }).swings, 0);
});

test('every row of the old list that differs from the b77 table', () => {
  const diff = [];
  for (let b = 1; b < BLOCKS.length; b++) {
    const old = STATIONS.has(b) || b === 178 || b === CAULDRON || b === FLOWER_POT || [64, 71].includes(b) || b === CHEST;
    const now = activatesOnClick(b);
    if (swallowsItemUse(b, STATIONS, false) !== now) assert.fail(`block ${b} differs from swallowsItemUse`);
    if (old !== now) diff.push(b);
  }
  for (const b of [FENCE, NETHER_FENCE, WOODEN_BUTTON, COMPARATOR, COMPARATOR_POWERED]) assert.equal(activatesOnClick(b), true, `block ${b} swallows now`);
  assert.ok(diff.includes(JUKEBOX) && diff.includes(FLOWER_POT));
});

test('prediction: a fence takes the click, an unloaded jukebox and an empty pot do not', () => {
  const w = new World('spswing78-pred');
  for (const [i, b] of [FENCE, JUKEBOX, FLOWER_POT, STONE].entries()) { w.set(8 + i, 33, 8, b, false, 0); w.set(8 + i, 34, 8, 0, false, 0); }
  const t = (i) => ({ block: [8 + i, 33, 8], adjacent: [8 + i, 34, 8] });
  assert.equal(predictsPlacement({ world: w, target: t(0), heldId: STONE }), false, 'fence');
  assert.equal(predictsPlacement({ world: w, target: t(1), heldId: STONE }), true, 'empty jukebox');
  w.set(9, 33, 8, JUKEBOX, false, 1);
  assert.equal(predictsPlacement({ world: w, target: t(1), heldId: STONE }), false, 'loaded jukebox');
  assert.equal(predictsPlacement({ world: w, target: t(2), heldId: STONE }), true, 'pot declines a block');
  assert.equal(useKind({ world: w, target: t(0), heldId: STONE, sneaking: true, aimed: false }), 'place', 'sneaking skips activation');
  assert.equal(activatesOnClick(JUKEBOX, w, [9, 33, 8]), true);
  assert.equal(activatesOnClick(JUKEBOX, w, [9, 33, 8].map((v, i) => (i === 0 ? 20 : v))), false);
});

test('book screen: loaded jukebox and fence swallow, empty jukebox does not', () => {
  const held = { id: ITEM_BOOK };
  assert.equal(bookOpensOnUse({ held, targetBlock: JUKEBOX, jukeboxLoaded: true }), false);
  assert.equal(bookOpensOnUse({ held, targetBlock: JUKEBOX }), true);
  assert.equal(bookOpensOnUse({ held, targetBlock: FENCE }), false);
  assert.equal(bookOpensOnUse({ held, targetBlock: 177 }), false, 'note block');
});

test('piston-moving click: no tile removes the block and refuses the item, a live tile declines', () => {
  const gone = click({ tool: SWORD, block: PISTON_MOVING }, { pistonMovingTile: () => false });
  assert.equal(gone.result.branch, 'remove-piston-moving');
  assert.equal(gone.f.state.world.get(...POS), 0);
  assert.equal(gone.swings, 0, 'the client world never activates it');
  const placed = click({ tool: STONE, block: PISTON_MOVING }, { pistonMovingTile: () => false });
  assert.equal(placed.result.branch, 'remove-piston-moving');
  assert.equal(placed.f.state.world.get(POS[0], POS[1] + 1, POS[2]), 0, 'the server activation refuses the item use');
  assert.equal(placed.swings, 1, 'a held block still places on the client');
  const live = click({ tool: SWORD, block: PISTON_MOVING }, { pistonMovingTile: () => true });
  assert.notEqual(live.result.branch, 'remove-piston-moving');
  assert.equal(live.f.state.world.get(...POS), PISTON_MOVING);
  const sneaky = click({ tool: SWORD, block: PISTON_MOVING, sneaking: true }, { pistonMovingTile: () => false });
  assert.notEqual(sneaky.result.branch, 'remove-piston-moving');
});
