// Batch 81 collide81: Haste and Mining Fatigue inside EntityPlayer.getBreakSpeed (executed: tools/probes/MiningEffectsProbe.java,
// public/research/mining-effects-reference.json), item collision with fences, walls, panes and gates, and the placement entity checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MATERIALS, Survival } from './survival.js';
import { fromOriginal } from './block-registry.js';
import { itemFromOriginal } from './region-import.js';
import { playerMiningState } from './enchantment-effects.js';
import { breakTicks } from './mining.js';
import { createServerDig } from './server-dig.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/mining-effects-reference.json', import.meta.url), 'utf8'));
const f = Math.fround;
const num = (v) => (typeof v === 'string' ? Number(v) : f(v));
const same = (a, b) => (Number.isNaN(a) ? Number.isNaN(b) : Object.is(a, b) || a === b);

test('Haste and Mining Fatigue scale the break speed before the hardness division, as the original', () => {
  let checked = 0;
  const helmet = itemFromOriginal(306, 0).id;
  for (const [block, tool, eff, haste, fatigue, env, speed, progress] of ref.rows) {
    const b = fromOriginal(block, 0), t = tool ? itemFromOriginal(tool, 0) : null;
    if (!b || (tool && !t)) continue;
    const underwater = env === 1 || env === 2 || env === 4, onGround = env < 3;
    const slots = t ? [{ id: t.id, count: 1, ...(eff ? { enchantments: [{ id: 32, lvl: eff }] } : {}) }] : [];
    const armor = env === 2 ? [null, null, null, { id: helmet, count: 1, enchantments: [{ id: 6, lvl: 1 }] }] : [];
    const effects = [...(haste >= 0 ? [{ id: 3, duration: 600, amplifier: haste }] : []), ...(fatigue >= 0 ? [{ id: 4, duration: 600, amplifier: fatigue }] : [])];
    const s = new Survival({ slots, armor, effects });
    const state = playerMiningState(s, b.id, t ? t.id : 0, underwater, onGround);
    const label = `block ${block} tool ${tool} eff ${eff} haste ${haste} fatigue ${fatigue} env ${env}`;
    assert.ok(same(state.progress, num(progress)), `${label}: progress ${state.progress} vs ${progress}`);
    if (Number.isFinite(MATERIALS[b.id].hardness ?? 1) && (MATERIALS[b.id].hardness ?? 1) >= 0) assert.ok(same(state.speed, num(speed)), `${label}: speed ${state.speed} vs ${speed}`);
    checked++;
  }
  assert.ok(checked > 8000, `${checked} rows mapped`);
});

test('Mining Fatigue V and up never break a block, not even an instant one', () => {
  const torch = fromOriginal(50, 0).id, stone = fromOriginal(1, 0).id;
  const tired = (amplifier) => new Survival({ effects: [{ id: 4, duration: 600, amplifier }] });
  assert.ok(Number.isNaN(playerMiningState(tired(4), torch, 0).progress));
  assert.equal(playerMiningState(tired(5), torch, 0).progress, -Infinity);
  assert.ok(!(playerMiningState(tired(4), torch, 0).progress >= 1));
  assert.equal(breakTicks(playerMiningState(tired(4), stone, 0)), Infinity);
  assert.equal(breakTicks(playerMiningState(tired(6), stone, 0)), Infinity);
  // The server crack stage is a Java (int) cast: NaN gives 0, -Infinity the int minimum.
  const cracks = [];
  const dig = createServerDig({ crack: (cell, v) => cracks.push(v) });
  dig.start([0, 0, 0], NaN);
  dig.tick(() => -Infinity);
  assert.deepEqual(cracks, [0, -2147483648]);
});

// Entity.moveEntity meets BlockFence.addCollisionBoxesToList's arms (akz, bytecode-read), not their union: an item over the empty corner of an
// L-shaped fence falls past it.
import { ItemEntities } from './item-entities.js';
import { FENCE, collisionBoxList } from './world.js';
import { COBBLE_WALL, FENCE_GATE } from './shaped-blocks.js';
test('items fall through the open corner of a fence corner and land on its arms', () => {
  const cells = new Map([[`0,10,0`, FENCE], [`0,10,-1`, FENCE], [`1,10,0`, FENCE]]);
  const world = { get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? (y < 10 && y >= 0 ? 1 : 0), getMeta: () => 0, solid(x, y, z) { return this.get(x, y, z) !== 0; } };
  assert.deepEqual(collisionBoxList(world, 0, 10, 0), [[0.375, 0, 0, 0.625, 1.5, 0.625], [0.375, 0, 0.375, 1, 1.5, 0.625]]);
  const items = new ItemEntities(() => 0.5);
  const corner = items.spawn({ id: 2, count: 1, damage: 0 }, 0.8, 12, 0.15, { motion: [0, 0, 0] });
  const arm = items.spawn({ id: 3, count: 1, damage: 0 }, 0.5, 12, 0.5, { motion: [0, 0, 0] });
  for (let i = 0; i < 60; i++) items.tick(world);
  assert.equal(corner.y, 10, 'past the union, onto the floor');
  assert.equal(arm.y, 11.5, 'on the 1.5-high arm');
  // Walls and fence gates override only getCollisionBoundingBoxFromPool: one box each (a closed gate 1.5 high, an open gate none).
  const one = (id, meta = 0) => collisionBoxList({ get: (x, y, z) => (x === 0 && y === 0 && z === 0 ? id : 0), getMeta: () => meta, solid() { return true; } }, 0, 0, 0);
  assert.equal(one(COBBLE_WALL).length, 1);
  assert.equal(one(COBBLE_WALL)[0][4], 1.5);
  assert.deepEqual(one(FENCE_GATE).map((b) => b[4]), [1.5]);
});

// World.checkNoEntityCollision for placement (ahb.a(azt, sa), bytecode-read) sees every preventEntitySpawning entity, and ItemSlab's
// func_150946_a always reads the cell offset by the clicked side (aeg, bytecode-read).
import { World, SNOW_LAYER, VINE } from './world.js';
import { ITEMS as ALL_ITEMS } from './survival.js';
import { placeHeldBlock } from './block-placement-simulation.js';
import { placementEntityBlocker } from './placement-entities.js';
import { STONE_SLAB, DOUBLE_STONE_SLAB, ITEM_STONE_SLAB } from './stone-utility.js';
import { makeStack } from './inventory.js';

const P = [40, 12, 40];
const SIDE = { 1: [0, 1, 0], 2: [0, 0, -1], 3: [0, 0, 1], 4: [-1, 0, 0], 5: [1, 0, 0] };
const tgt = (block, side = 1) => { const d = SIDE[side]; return { block: [...block], adjacent: [block[0] + d[0], block[1] + d[1], block[2] + d[2]], hit: [block[0] + 0.5, block[1] + (side === 1 ? 1 : 0.5), block[2] + 0.5] }; };
function place({ block = 1, meta = 0, tool, damage = 0, count = 4, side = 1, mobs = [], carts = [], cells = [] }) {
  const world = new World('collide81');
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -2; dy <= 3; dy++) world.set(P[0] + dx, P[1] + dy, P[2] + dz, 0, false, 0);
  world.set(P[0], P[1] - 1, P[2], 1, false, 0);
  world.set(...P, block, false, meta);
  for (const [x, y, z, id, m = 0] of cells) world.set(x, y, z, id, false, m);
  const stack = makeStack(tool, count); stack.damage = damage;
  const survival = new Survival({ slots: [stack] });
  const entities = placementEntityBlocker({ mobs: { entities: mobs, size: (o) => o.size }, vehicles: [carts] });
  const out = placeHeldBlock({ world, survival, position: { x: 100.5, y: 60, z: 100.5 }, flowers: {}, yaw: 0, farming: { observe() {} } },
    { id: tool, item: ALL_ITEMS[tool], target: tgt(P, side) }, { entities });
  return { world, survival, out };
}
const pigAt = (x, y, z) => ({ type: 'pig', x, y, z, health: 10, size: [0.9, 0.9] });

test('a mob or a cart in the placed cell refuses an ItemBlock and a slab; an item entity never counts', () => {
  const above = [P[0], P[1] + 1, P[2]];
  const stone = place({ tool: 1, mobs: [pigAt(above[0] + 0.5, above[1], above[2] + 0.5)] });
  assert.equal(stone.out.reason, 'entity-collision');
  assert.equal(stone.world.get(...above), 0);
  assert.equal(stone.survival.count(1), 4);
  const slab = place({ tool: ITEM_STONE_SLAB, mobs: [pigAt(above[0] + 0.5, above[1] + 0.2, above[2] + 0.5)] });
  assert.equal(slab.out.reason, 'entity-collision');
  // A merge into the clicked bottom half: the double slab's full cube meets a cart resting on the slab top (y + 0.5).
  const merge = place({ block: STONE_SLAB, tool: ITEM_STONE_SLAB, carts: [{ bb: [P[0] + 0.1, P[1] + 0.5, P[2] + 0.1, P[0] + 0.9, P[1] + 1.2, P[2] + 0.9] }] });
  assert.equal(merge.out.reason, 'entity-collision');
  assert.equal(merge.world.get(...P), STONE_SLAB);
  // Dead or dying-out entities and boxes that only touch do not count.
  assert.equal(place({ tool: 1, mobs: [{ ...pigAt(above[0] + 0.5, above[1], above[2] + 0.5), health: 0, death: 20 }] }).out.placed, true);
  assert.equal(place({ tool: 1, mobs: [pigAt(above[0] + 0.5, above[1] + 1, above[2] + 0.5)] }).out.placed, true);
  // A dying mob (deathTime below 20) still blocks, so does a bat.
  assert.equal(place({ tool: 1, mobs: [{ ...pigAt(above[0] + 0.5, above[1], above[2] + 0.5), health: 0, death: 5 }] }).out.reason, 'entity-collision');
  assert.equal(place({ tool: 1, mobs: [{ type: 'bat', x: above[0] + 0.5, y: above[1], z: above[2] + 0.5, health: 6, size: [0.5, 0.9] }] }).out.reason, 'entity-collision');
});

test('snow stacking tests the current layer box against every entity, then falls to ItemBlock', () => {
  // Layer meta 3 is 0.5 high: a pig inside it stops the stack; one standing on its top does not.
  const inside = place({ block: SNOW_LAYER, meta: 3, tool: SNOW_LAYER, mobs: [pigAt(P[0] + 0.5, P[1] + 0.25, P[2] + 0.5)] });
  assert.notEqual(inside.out.reason, 'stacked-snow');
  assert.equal(inside.world.getMeta(...P), 3);
  const onTop = place({ block: SNOW_LAYER, meta: 3, tool: SNOW_LAYER, mobs: [pigAt(P[0] + 0.5, P[1] + 0.5, P[2] + 0.5)] });
  assert.equal(onTop.out.reason, 'stacked-snow');
  assert.equal(onTop.world.getMeta(...P), 4);
});

test('a slab clicked on the side of a one-layer snow or a vine merges into the same-type slab in the offset cell', () => {
  const east = [P[0] + 1, P[1], P[2]];
  for (const [block, meta] of [[SNOW_LAYER, 0], [VINE, 1]]) {
    const r = place({ block, meta, tool: ITEM_STONE_SLAB, side: 5, cells: [[east[0], east[1] - 1, east[2], 1], [...east, STONE_SLAB, 0]] });
    assert.equal(r.out.reason, 'slab-merge', `block ${block}`);
    assert.equal(r.world.get(...east), DOUBLE_STONE_SLAB, `block ${block}: the offset cell merges`);
    assert.equal(r.world.get(...P), block, `block ${block}: the clicked cell is kept`);
  }
  // Without a slab there the fall-through replaces the clicked snow or vine (ItemBlock.onItemUse).
  const plain = place({ block: SNOW_LAYER, meta: 0, tool: ITEM_STONE_SLAB, side: 5 });
  assert.equal(plain.out.reason, 'slab');
  assert.equal(plain.world.get(...P), STONE_SLAB);
});
