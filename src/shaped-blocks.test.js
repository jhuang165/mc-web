// Wood slabs, fence gates, trapdoors and cobblestone walls replayed against public/research/shaped-blocks-reference.json
// (tools/verify-shaped-blocks.mjs over the unchanged 1.7.10 BlockWoodSlab, BlockFenceGate, BlockTrapDoor, BlockWall).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BLOCKS, wallSolid, collisionBoxes, blockBounds, selectionBounds, opaqueCube } from './world.js';
import { toOriginal, fromOriginal } from './block-registry.js';
import { blockProperties } from './redstone.js';
import { fenceConnectsTo } from './fences.js';
import { blockTile, TILES } from './block-textures.js';
import { ITEMS } from './survival.js';
import { populationCraftingResult, populationDrops } from './population-content.js';
import * as S from './shaped-blocks.js';

const ref = JSON.parse(await readFile(new URL('../public/research/shaped-blocks-reference.json', import.meta.url)));
const rows = (kind) => ref.rows.filter((r) => r.kind === kind);
const f = Math.fround;
const same = (a, b, msg) => assert.deepEqual(a.map((v) => +v.toFixed(6)), b.map((v) => +v.toFixed(6)), msg);
const toInternal = { 125: 166, 126: 165, 107: 167, 96: 168, 139: 169 };
// A cell map with World's get/getMeta/solid, enough for the shape functions.
const grid = (cells = {}) => ({
  get: (x, y, z) => cells[`${x},${y},${z}`]?.[0] ?? 0,
  getMeta: (x, y, z) => cells[`${x},${y},${z}`]?.[1] ?? 0,
  solid: () => true,
});

test('the native reference carries the expected rows and original names', () => {
  assert.equal(ref.clientSha1, 'e80d9b3bf5085002218d4be59e668bac718abbc6');
  assert.equal(ref.rows.length, 4316);
  assert.equal(ref.names['tile.fenceGate.name'], 'Fence Gate');
  assert.deepEqual(S.WOOD_SLAB_NAMES, ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'big_oak'].map((k) => ref.names[`tile.woodSlab.${k}.name`]));
  assert.deepEqual(S.WALL_NAMES, [ref.names['tile.cobbleWall.normal.name'], ref.names['tile.cobbleWall.mossy.name']]);
  assert.equal(ref.names['tile.trapdoor.name'], 'Trapdoor');
});

test('internal ids 165-169 map to the original ids; items are the block numbers + 1000', () => {
  for (const [orig, id] of Object.entries(toInternal))
    for (let meta = 0; meta < 16; meta++) {
      assert.deepEqual(toOriginal(id, meta), [+orig, meta]);
      assert.deepEqual(fromOriginal(+orig, meta), { id, meta, exact: true });
    }
  for (const [a, b] of rows('items')[0].blockItems) assert.equal(a, b);
  assert.equal(S.itemOfBlock(S.WOOD_SLAB), 1165);
  assert.equal(S.blockOfItem(1169), S.COBBLE_WALL);
  assert.deepEqual(BLOCKS.map((b, i) => (b.reserved ? i : -1)).filter((i) => i >= 0), Array.from({ length: 25 }, (_, i) => 140 + i));
  assert.equal(ITEMS[1165].variants.length, 6);
  assert.equal(ITEMS[1169].variants[1], 'Mossy Cobblestone Wall');
});

test('slab metadata rows: bounds, drops and icons', () => {
  for (const r of rows('meta')) {
    if (r.id !== 125 && r.id !== 126) continue;
    const id = toInternal[r.id];
    same(S.woodSlabBounds(id, r.meta), r.bounds, `${r.id}:${r.meta}`);
    const d = S.woodSlabDrops(id, r.meta)[0];
    assert.equal(d.count, r.quantity, `${r.id}:${r.meta}`);
    assert.equal(d.damage, r.damageDropped, `${r.id}:${r.meta}`);
    if ((r.meta & 7) < 6) assert.equal(blockTile(id, 2, false, r.meta), TILES.indexOf(r.icons[1]), `${r.id}:${r.meta} icon`);
  }
});

test('wood slab placement metadata and ItemSlab merging match the original', () => {
  for (const r of rows('slabPlaced')) if (r.id === 126) assert.equal(S.woodSlabPlacedMeta(r.meta, r.side, r.hy), r.result, JSON.stringify(r));
  const OFF = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
  let checked = 0;
  for (const r of rows('slabUse')) {
    const click = r.click ?? [0, 64, 0];
    const cellAt = (x, y, z) => {
      if (x !== 0 || z !== 0) return y <= 63 ? { id: 1, meta: 0 } : { id: 0, meta: 0 };
      if (y <= 63) return { id: 1, meta: 0 };
      if (r.scenario === 'pillar') return y === 64 || y === 66 ? { id: 1, meta: 0 } : { id: 0, meta: 0 };
      if (y === 64 && r.scenario === 'adjacent') return { id: 1, meta: 0 };
      if (y === 65 && r.scenario === 'adjacent') return { id: r.existing[0] === 126 ? 165 : 103, meta: r.existing[1] };
      if (y === 64 && r.scenario === 'double') return { id: 166, meta: r.existing };
      if (y === 64) return { id: 165, meta: r.existing };
      return { id: 0, meta: 0 };
    };
    const o = OFF[r.side], target = [click[0] + o[0], click[1] + o[1], click[2] + o[2]];
    const plan = S.planWoodSlabUse(r.held & 7, cellAt(...click), cellAt(...target), r.side, r.hy);
    const cell = plan.merge === 'clicked' ? click : target;
    const ok = !!plan.merge || cellAt(...target).id === 0;
    assert.equal(ok, r.result[0], JSON.stringify(r));
    if (ok) {
      const [x, y, z, id, meta] = r.result[2][0].split(',').map(Number);
      assert.deepEqual([x, y, z], cell, JSON.stringify(r));
      assert.equal(toInternal[id], plan.id, JSON.stringify(r));
      assert.equal(meta, plan.meta, JSON.stringify(r));
      checked++;
    }
  }
  assert.ok(checked > 300, `replayed ${checked} placements`);
});

test('wall and fence connections: native connect rows through the registry', () => {
  let n = 0;
  for (const r of rows('connect')) {
    const back = fromOriginal(r.id, r.meta);
    if (!back || !back.exact) continue;
    assert.equal(S.wallConnectsTo(back.id, wallSolid), r.wall, `wall ${r.id}:${r.meta}`);
    assert.equal(fenceConnectsTo(back.id), r.fence, `fence ${r.id}:${r.meta}`);
    n++;
  }
  assert.ok(n > 100);
  for (const r of rows('connectGate')) {
    assert.equal(S.wallConnectsTo(S.FENCE_GATE, wallSolid), r.wall);
    assert.equal(fenceConnectsTo(S.FENCE_GATE), r.fence);
  }
});

test('wall shapes by neighbour mask: bounds, collision 1.5 high, render boxes, masks from the world', () => {
  for (const r of rows('wallShape')) {
    if (r.mask < 0) continue;
    same(S.wallBounds(r.mask), r.bounds, `mask ${r.mask}`);
    same(S.wallCollisionBox(r.mask), r.collisionBox, `mask ${r.mask}`);
  }
  for (const r of rows('wallShape').filter((x) => x.mask < 0)) {
    const nb = fromOriginal(r.neighbour[0], r.neighbour[1]);
    const cells = { '0,0,0': [S.COBBLE_WALL, r.meta] };
    cells[r.dir === 0 ? '1,0,0' : '0,0,-1'] = [nb.id, nb.meta];
    same(S.wallBounds(S.wallMask(grid(cells), 0, 0, 0, wallSolid)), r.bounds, JSON.stringify(r));
  }
  const w = grid({ '1,0,0': [S.COBBLE_WALL, 0], '0,0,1': [S.FENCE_GATE, 0], '-1,0,0': [3, 0], '0,0,-1': [S.WOOD_SLAB, 0] });
  assert.equal(S.wallMask(w, 0, 0, 0, wallSolid), 2 | 4 | 8);
  assert.deepEqual(S.wallRenderBoxes(0, true), [[0.25, 0, 0.25, 0.75, 1, 0.75]]);
  assert.equal(S.wallRenderBoxes(1 | 2, true).length, 1);
  assert.equal(S.wallRenderBoxes(1 | 2, false).length, 3);
});

test('world shapes: the wall collides 1.5 high, an open gate has no box, trapdoor selection is thin', () => {
  const w = grid({ '0,0,0': [S.COBBLE_WALL, 0], '5,0,0': [S.FENCE_GATE, 0], '6,0,0': [S.FENCE_GATE, 4], '7,0,0': [S.TRAPDOOR, 0] });
  assert.equal(collisionBoxes(w, 0, 0, 0)[0][4], 1.5);
  assert.equal(collisionBoxes(w, 5, 0, 0)[0][4], 1.5);
  assert.deepEqual(collisionBoxes(w, 6, 0, 0).length >= 0 ? S.gateBoxes(4) : null, []);
  same(blockBounds(w, 5, 0, 0), [0, 0, 0.375, 1, 1, 0.625]);
  same(selectionBounds(w, 7, 0, 0), [0, 0, 0, 1, 0.1875, 1]);
  assert.equal(opaqueCube(S.WOOD_SLAB), false);
  assert.equal(opaqueCube(S.DOUBLE_WOOD_SLAB), true);
});

test('fence gate: placement yaw, bounds, collision, use and support', () => {
  for (const r of rows('gatePlaced')) assert.equal(S.gatePlacedMeta(f(r.yaw)), r.meta, `yaw ${r.yaw}`);
  for (const r of rows('gateUse')) {
    assert.equal(S.gateUseMeta(r.meta, f(r.yaw)), r.after, JSON.stringify(r));
    assert.equal(r.result, true);
  }
  for (const meta of [0, 1, 2, 3]) {
    same(S.gateBounds(meta), (meta & 1) ? [0.375, 0, 0, 0.625, 1, 1] : [0, 0, 0.375, 1, 1, 0.625]);
    assert.equal(S.gateBoxes(meta)[0][4], 1.5);
    assert.deepEqual(S.gateBoxes(meta | 4), []);
    assert.ok(S.gateRenderBoxes(meta).length >= 5);
    assert.ok(S.gateRenderBoxes(meta | 4).length >= 6);
  }
  for (const r of rows('gateSupport')) assert.equal(S.gateCanPlace(![0, 8, 9, 78].includes(r.below[0])), r.canPlace, JSON.stringify(r));
});

// A stand-in for the RedstoneWorld surface the behaviours use, with the probe's explicit power set.
function fakeWorld(cells, powered) {
  const power = new Map(blockProperties().map((r) => [r[0], r[3]]));
  const key = (x, y, z) => `${x},${y},${z}`;
  const events = { writes: [], aux: [], drops: [] };
  return {
    cells, events,
    isBlockIndirectlyGettingPowered: (x, y, z) => powered.has(key(x, y, z)),
    canProvidePower: (id) => !!power.get(id),
    getBlock: (x, y, z) => cells[key(x, y, z)]?.[0] ?? 0,
    getBlockMetadata: (x, y, z) => cells[key(x, y, z)]?.[1] ?? 0,
    setBlockMetadataWithNotify: (x, y, z, m, fl) => { cells[key(x, y, z)][1] = m; events.writes.push(`${key(x, y, z)},${cells[key(x, y, z)][0]},${m},${fl}`); },
    setBlockToAir: (x, y, z) => { cells[key(x, y, z)] = [0, 0]; events.writes.push(`${key(x, y, z)},0,0,3`); },
    dropBlockAsItem: (x, y, z, id, meta) => events.drops.push([id, 1, meta]),
    playAuxSFX: (id, x, y, z) => events.aux.push(`aux ${id} ${key(x, y, z)},0`),
  };
}
const behaviours = {};
S.installShapedBlocks({ registerBehaviour: (id, b) => { behaviours[id] = b; } }, S.trapdoorSupportOriginal(blockProperties()));

test('fence gate redstone: neighbour changes replay the native power rows', () => {
  for (const r of rows('gatePower')) {
    const w = fakeWorld({ '0,64,0': [107, r.meta] }, new Set(r.powered ? ['0,64,0'] : []));
    behaviours[107].onNeighborBlockChange(w, 0, 64, 0, r.changed);
    assert.equal(w.cells['0,64,0'][1], r.after, JSON.stringify(r));
    assert.deepEqual(w.events.writes, r.events.writes, JSON.stringify(r));
    assert.deepEqual(w.events.aux, r.events.aux, JSON.stringify(r));
  }
});

test('trapdoor: placement metadata, shapes, hand use and redstone replay the native rows', () => {
  for (const r of rows('trapPlaced')) assert.equal(S.trapPlacedMeta(r.side, r.hy) ?? 0, r.result, JSON.stringify(r));
  for (const r of rows('trapUseBlock')) assert.equal(r.meta ^ 4, r.after);
  same(S.trapBounds(0), [0, 0, 0, 1, 0.1875, 1]);
  same(S.trapBounds(8), [0, 0.8125, 0, 1, 1, 1]);
  const open = [[0, 0, 0.8125, 1, 1, 1], [0, 0, 0, 1, 1, 0.1875], [0.8125, 0, 0, 1, 1, 1], [0, 0, 0, 0.1875, 1, 1]];
  for (const meta of [0, 1, 2, 3]) same(S.trapBounds(meta | 4), open[meta], `open ${meta}`);
  for (const r of rows('trapNeighbour')) {
    const off = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0]][r.dir];
    const cells = { '0,64,0': [96, r.meta], [`${off[0]},64,${off[2]}`]: [r.support[0], r.support[1]] };
    const w = fakeWorld(cells, new Set(r.powered ? ['0,64,0'] : []));
    behaviours[96].onNeighborBlockChange(w, 0, 64, 0, r.changed);
    assert.deepEqual(w.cells['0,64,0'], r.cells[0], JSON.stringify(r));
    assert.deepEqual(w.events.writes, r.events.writes, JSON.stringify(r));
    assert.deepEqual(w.events.aux, r.events.aux, JSON.stringify(r));
    assert.equal(w.events.drops.length, r.events.drops.length, JSON.stringify(r));
  }
});

test('breaking: native drops and materials', () => {
  for (const r of rows('break')) {
    if (r.creative) continue;
    const d = populationDrops(toInternal[r.id], r.meta);
    assert.equal(d.reduce((n, s) => n + s.count, 0), r.drops.length, JSON.stringify(r));
    for (const s of d) assert.equal(s.damage, r.drops[0][2], JSON.stringify(r));
  }
  for (const r of rows('props')) {
    const id = toInternal[r.id];
    assert.equal(S.SHAPED_MATERIALS[id].hardness, r.hardness);
    assert.equal(S.SHAPED_RESISTANCE[id], r.explosionResistance);
  }
});

test('crafting: slabs by wood type, walls by damage', () => {
  const planks = (d) => ({ id: 7, count: 1, damage: d });
  const row = (a, b, c) => [a, b, c, null, null, null, null, null, null];
  for (let d = 0; d < 6; d++) assert.deepEqual(populationCraftingResult(row(planks(d), planks(d), planks(d)), 3), { id: 1165, count: 6, damage: d });
  assert.equal(populationCraftingResult(row(planks(0), planks(1), planks(0)), 3), null);
  const c = (id) => ({ id, count: 1, damage: 0 });
  assert.deepEqual(populationCraftingResult([c(12), c(12), c(12), c(12), c(12), c(12), null, null, null], 3), { id: 1169, count: 6, damage: 0 });
  assert.deepEqual(populationCraftingResult([c(74), c(74), c(74), c(74), c(74), c(74), null, null, null], 3), { id: 1169, count: 6, damage: 1 });
  assert.deepEqual(populationCraftingResult([null, null, null, c(74), c(74), c(74), c(74), c(74), c(74)], 3), { id: 1169, count: 6, damage: 1 });
});

test('textures and hidden placeholder items', () => {
  for (let t = 0; t < 6; t++) assert.equal(blockTile(165, 2, false, t), TILES.indexOf(S.woodSlabTexture(t)));
  assert.equal(blockTile(168, 2), TILES.indexOf('trapdoor'));
  assert.equal(blockTile(169, 2, false, 1), TILES.indexOf('cobblestone_mossy'));
  assert.equal(blockTile(1169, 2, false, 0), TILES.indexOf('cobblestone'));
  for (const id of [1165, 1167, 1168, 1169]) assert.equal(ITEMS[id].block, true);
  for (let id = 140; id <= 169; id++) assert.equal(ITEMS[id].hidden, true);
});
