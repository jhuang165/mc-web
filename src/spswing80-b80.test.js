// b80 spswing80: the right-click swing for the minecart item, slabs, snow layers, the spawn egg over water, the empty hand and Adventure mode, and the
// multiplayer swing prediction from the same table (right-click-swing.js). Evidence: bytecode-read adj, aeg, aec, aee, bje, bao, yz (see the track note).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, SNOW_LAYER, WATER, RAIL, collides } from './world.js';
import { Survival, ITEMS } from './survival.js';
import { Farming } from './farming.js';
import { Trees } from './trees.js';
import { JavaRandom } from './java-random.js';
import { makeStack } from './inventory.js';
import { applyPlayerEdit } from './player-edit-simulation.js';
import { placeHeldBlock } from './block-placement-simulation.js';
import { placeHeldMinecart } from './vehicle-simulation.js';
import { Minecarts } from './minecarts.js';
import { ITEM_SPAWN_EGG } from './spawn-eggs.js';
import { STONE_SLAB, DOUBLE_STONE_SLAB, ITEM_STONE_SLAB } from './stone-utility.js';
import { clientUseResult } from './spswing79-rules.js';
import { rightClickSwings, clientItemUse } from './right-click-swing.js';
import { boneMealCanFertilize } from './bone-meal.js';
import { FISHING_ROD } from './fishing-content.js';

const POS = [42, 12, 42], STONE = 3, MINECART = 366;
const SIDES = { 0: [0, -1, 0], 1: [0, 1, 0], 2: [0, 0, -1], 3: [0, 0, 1], 4: [-1, 0, 0], 5: [1, 0, 0] };
const targetOf = (block, side = 1) => { const d = SIDES[side]; return { block: [...block], adjacent: [block[0] + d[0], block[1] + d[1], block[2] + d[2]], hit: [block[0] + 0.5, block[1] + (side === 1 ? 1 : 0.5), block[2] + 0.5] }; };
function setup({ tool, count = 1, damage, block = STONE, meta = 0, mode = 'survival', position = { x: 100.5, y: 60, z: 100.5 } }) {
  const world = new World('spswing80');
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -3; dy <= 3; dy++) world.set(POS[0] + dx, POS[1] + dy, POS[2] + dz, 0, false, 0);
  world.set(...POS, block, false, meta);
  const stack = tool ? makeStack(tool, Math.max(1, count)) : null;
  if (stack) { stack.count = count; if (damage !== undefined) stack.damage = damage; }
  const survival = new Survival({ food: 10, slots: [stack] }, mode);
  const state = {
    screen: 'playing', heldTool: tool || 0, world, survival, position, velocity: { x: 0, y: 0, z: 0 },
    motion: { sneaking: false, sprinting: false }, mobs: {}, farming: new Farming(world), trees: new Trees(world, { random: new JavaRandom(18) }), fire: { ignite() {}, drain() { return []; } },
    grounded: true, fallDistance: 0, wasInWater: false, yaw: 0, eating: null, mining: null, mineCooldown: 0, mineHeld: true, flowers: {}, boneRandom: new JavaRandom(21), itemRand: new JavaRandom(22),
  };
  return state;
}
function click(state, req, extra = {}) {
  let swings = 0;
  const result = applyPlayerEdit(state, { place: true, aimedEntity: null, ...req }, { swing: () => swings++, updateBlock() {}, renderHotbar() {}, markUnsaved() {}, sound() {}, playSound() {}, ...extra });
  return { swings, result };
}
const mpSwing = (state, target, extra = {}) => rightClickSwings({ world: state.world, target, held: state.survival.held, survival: state.survival, position: state.position, yaw: 0, flowers: {}, ...extra });

test('minecart item: client onItemUse true on every rail block at any stack size, false elsewhere', () => {
  for (const rail of [RAIL, 135, 136, 137]) for (const count of [1, 0, -1]) {
    const s = setup({ tool: MINECART, count, block: rail });
    assert.equal(clientUseResult(s, targetOf(POS), MINECART, s.survival.held), true, `${rail} ${count}`);
  }
  const s = setup({ tool: MINECART, block: STONE });
  assert.equal(clientUseResult(s, targetOf(POS), MINECART, s.survival.held), false);
  assert.equal(click(s, { target: targetOf(POS) }).swings, 0, 'a minecart on stone does not swing');
});

test('minecart item at stack size 0 places a cart on a rail, swings and leaves -1 (attributes2 minecartOnRail, executed)', () => {
  const s = setup({ tool: MINECART, count: 0, block: RAIL });
  s.minecarts = new Minecarts();
  let swings = 0;
  const r = placeHeldMinecart(s, { target: targetOf(POS) }, { swing: () => swings++ });
  assert.equal(r.branch, 'place-minecart');
  assert.equal(swings, 1);
  assert.equal(s.survival.held.count, -1);
  assert.equal(s.minecarts.carts.length, 1);
});

test('empty hand: no swing on a plain block, a swing on a client-activated one', () => {
  for (const block of [STONE, 2, RAIL]) {
    const s = setup({ tool: 0, block });
    assert.equal(click(s, { target: targetOf(POS) }).swings, 0, `block ${block}`);
    assert.equal(mpSwing(s, targetOf(POS)), false, `mp ${block}`);
  }
  const s = setup({ tool: 0, block: 85 }); // a fence: BlockFence.onBlockActivated is true on the client (b78)
  assert.equal(mpSwing(s, targetOf(POS)), true);
});

test('slab: a merge into the clicked bottom half swings even when the player stands in the way', () => {
  const s = setup({ tool: ITEM_STONE_SLAB, damage: 0, block: STONE_SLAB, meta: 0, position: { x: POS[0] + 0.5, y: POS[1] + 0.5, z: POS[2] + 0.5 } });
  assert.equal(clientUseResult(s, targetOf(POS, 1), ITEM_STONE_SLAB, s.survival.held), true);
  const { swings, result } = click(s, { target: targetOf(POS, 1) });
  assert.equal(result.branch, 'placement-player-collision');
  assert.equal(s.world.get(...POS), STONE_SLAB, 'the double slab is refused');
  assert.equal(swings, 1, 'ItemSlab.onItemUse still answered true');
  // Out of the way the merge happens and swings.
  const t = setup({ tool: ITEM_STONE_SLAB, damage: 0, block: STONE_SLAB, meta: 0 });
  assert.equal(click(t, { target: targetOf(POS, 1) }).swings, 1);
  assert.equal(t.world.get(...POS), DOUBLE_STONE_SLAB);
});

test('slab: the same-type slab in the cell on the clicked side merges; another type or a size-0 stack does not use the merge row', () => {
  const s = setup({ tool: ITEM_STONE_SLAB, damage: 0, block: STONE });
  s.world.set(POS[0], POS[1] + 1, POS[2], STONE_SLAB, false, 8); // a top half above: func_150946_a ignores the half
  assert.equal(clientUseResult(s, targetOf(POS, 1), ITEM_STONE_SLAB, s.survival.held), true);
  const other = setup({ tool: ITEM_STONE_SLAB, damage: 3, block: STONE_SLAB, meta: 0 }); // cobblestone slab on a stone slab
  assert.equal(clientUseResult(other, targetOf(POS, 1), ITEM_STONE_SLAB, other.survival.held), null);
  const top = setup({ tool: ITEM_STONE_SLAB, damage: 0, block: STONE_SLAB, meta: 8 }); // side 1 of a top half: no clicked merge
  assert.equal(clientUseResult(top, targetOf(POS, 1), ITEM_STONE_SLAB, top.survival.held), null);
  const empty = setup({ tool: ITEM_STONE_SLAB, count: 0, damage: 0, block: STONE_SLAB, meta: 0 });
  assert.equal(clientUseResult(empty, targetOf(POS, 1), ITEM_STONE_SLAB, empty.survival.held), false);
});

test('snow: the stacking test uses the current layer box, so a player standing on the snow does not stop it', () => {
  const s = setup({ tool: SNOW_LAYER, count: 2, block: SNOW_LAYER, meta: 1, position: { x: POS[0] + 0.5, y: POS[1] + 0.125, z: POS[2] + 0.5 } });
  assert.equal(collides(s.world, s.position.x, s.position.y, s.position.z), false);
  const { swings, result } = click(s, { target: targetOf(POS, 1) });
  assert.equal(result.placement.reason, 'stacked-snow');
  assert.equal(s.world.getMeta(...POS), 2);
  assert.equal(swings, 1);
});

test('snow: a player inside the layer box sends the item on to ItemBlock.onItemUse (the cell on the clicked side)', () => {
  const s = setup({ tool: SNOW_LAYER, count: 2, block: SNOW_LAYER, meta: 5, position: { x: POS[0] + 0.5, y: POS[1], z: POS[2] + 0.5 } });
  const out = placeHeldBlock(s, { id: SNOW_LAYER, item: ITEMS[SNOW_LAYER], target: targetOf(POS, 1) });
  assert.notEqual(out.reason, 'stacked-snow');
  assert.equal(s.world.getMeta(...POS), 5);
  assert.deepEqual(out.position, [POS[0], POS[1] + 1, POS[2]]);
});

test('spawn egg: with a block target the client onItemUse swings and the water trace never runs', () => {
  const egg = 90; // pig
  const s = setup({ tool: ITEM_SPAWN_EGG, damage: egg, block: STONE });
  s.world.set(POS[0], POS[1] + 1, POS[2], WATER, false, 0);
  const spawned = [];
  s.mobs = { entities: [], spawnNatural: (type, x, y, z) => { const e = { type, x, y, z }; spawned.push(e); return e; } };
  const bucket = { liquid: true, ray: { origin: [POS[0] + 0.5, POS[1] + 3.5, POS[2] + 0.5], dir: [0, -1, 0] }, hit: null };
  assert.equal(mpSwing(s, targetOf(POS, 1)), true);
  const a = click(s, { target: targetOf(POS, 1), bucket });
  assert.notEqual(a.result.branch, 'use-spawn-egg-water');
  assert.equal(a.swings, 1);
  assert.deepEqual(spawned.map((e) => Math.floor(e.y)), [POS[1] + 1], 'the pig is spawned on the clicked face, from onItemUse');
  // No block under the cursor: ItemMonsterPlacer.onItemRightClick spawns in the water and does not swing.
  const t = setup({ tool: ITEM_SPAWN_EGG, damage: egg, block: STONE });
  t.world.set(POS[0], POS[1] + 1, POS[2], WATER, false, 0);
  t.mobs = s.mobs;
  const b = click(t, { target: null, bucket });
  assert.equal(b.result.branch, 'use-spawn-egg-water');
  assert.equal(b.swings, 0);
  assert.equal(mpSwing(t, null), false);
});

test('Adventure mode swings exactly as Survival for right clicks (canPlayerEdit is true with any held item in 1.7.10)', () => {
  const kind = (k) => Object.keys(ITEMS).map(Number).find((i) => ITEMS[i]?.kind === k);
  for (const [tool, block, side] of [[kind('hoe'), 2, 1], [STONE, STONE, 1], [ITEM_STONE_SLAB, STONE_SLAB, 1], [kind('sword'), STONE, 1], [0, STONE, 1]]) {
    const out = ['survival', 'adventure'].map((mode) => click(setup({ tool, block, mode }), { target: targetOf(POS, side) }).swings);
    assert.equal(out[0], out[1], `tool ${tool}`);
  }
});

test('multiplayer prediction follows the single-player table', () => {
  const kind = (k) => Object.keys(ITEMS).map(Number).find((i) => ITEMS[i]?.kind === k);
  const cases = [[STONE, STONE, 1], [STONE, STONE, 0], [kind('hoe'), 2, 1], [kind('hoe'), STONE, 1], [kind('sword'), STONE, 1], [MINECART, STONE, 1], [ITEM_STONE_SLAB, STONE_SLAB, 1], [351, STONE, 1], [ITEM_SPAWN_EGG, STONE, 2]];
  for (const [tool, block, side] of cases) {
    const sp = click(setup({ tool, block }), { target: targetOf(POS, side) }).swings > 0;
    assert.equal(mpSwing(setup({ tool, block }), targetOf(POS, side)), sp, `tool ${tool} on ${block} side ${side}`);
  }
  // No target, an entity: only the fishing rod (ItemFishingRod.onItemRightClick calls swingItem).
  const s = setup({ tool: STONE });
  assert.equal(mpSwing(s, null), false);
  assert.equal(mpSwing(s, targetOf(POS), { aimed: true }), false);
  const flint = setup({ tool: kind('flint_and_steel') });
  assert.equal(mpSwing(flint, null, { aimed: true, aimedType: 'creeper' }), true, 'EntityCreeper.interact swings');
  assert.equal(mpSwing(flint, null, { aimed: true, aimedType: 'pig' }), false);
  const rod = setup({ tool: FISHING_ROD });
  assert.equal(mpSwing(rod, null), true);
  // Sneaking with an item skips the fence's activation; the stone item then places beside it.
  const fence = setup({ tool: STONE, block: 85 });
  assert.equal(mpSwing(fence, targetOf(POS, 2), { sneaking: true }), true);
});

test('bone meal: the client answer is canFertilize', () => {
  const s = setup({ tool: 351, damage: 15, block: 1 });
  assert.equal(boneMealCanFertilize(s.world, ...POS), true, 'grass');
  s.world.set(...POS, STONE, false, 0);
  assert.equal(boneMealCanFertilize(s.world, ...POS), false, 'stone');
  assert.equal(clientItemUse(s, targetOf(POS), 351, s.survival.held), false);
});
