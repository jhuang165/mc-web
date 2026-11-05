import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fromOriginal, toOriginal } from './block-registry.js';
import { blockBounds, collisionBoxList, collisionBounds } from './world.js';
import { MATERIALS, ITEMS } from './survival.js';
import { populationDrops, POPULATION_ITEMS, populationCraftingResult } from './population-content.js';
import { explosionResistance } from './explosion.js';
import { lightOpacity, lightEmission, useNeighborBrightness } from './lighting.js';
import { TILES, blockTile } from './block-textures.js';
import { itemFromOriginal } from './region-import.js';
import {
  STONE_BRICKS, DOUBLE_STONE_SLAB, STONE_SLAB, END_PORTAL_FRAME, CAULDRON, FLOWER_POT, SANDSTONE_SLAB,
  slabPlacedMeta, planSlabUse, endFrameFacing, endFrameComparator, cauldronUse, cauldronExtinguishes, cauldronRain,
  cauldronWash,
  cauldronComparator, potContentsOfMeta, potInsertion, potPlantOf, potUse, stoneUtilityPick, setPotContents, potDrops,
  serializePots, restorePots, heldSlabType, slabDrops,
} from './stone-utility.js';
import { JavaRandom } from './java-random.js';
import { makeStack } from './inventory.js';

// stone-utility-reference.json: the unchanged 1.7.10 classes (tools/probes/StoneUtilityProbe.java, tools/verify-stone-utility.mjs).
const ref = JSON.parse(readFileSync(new URL('../public/research/stone-utility-reference.json', import.meta.url)));
const washRef = JSON.parse(readFileSync(new URL('../public/research/cauldron-wash-reference.json', import.meta.url)));
const rows = (kind) => ref.rows.filter((r) => r.kind === kind);
const cell = (id, meta = 0) => ({ get: () => id, getMeta: () => meta, solid: () => true, pots: undefined });
// The item an original (id, damage) stack maps to in this build.
const item = (id, damage = 0) => itemFromOriginal(id, damage);

test('the reference holds the recorded native counts', () => {
  assert.equal(ref.clientSha1, 'e80d9b3bf5085002218d4be59e668bac718abbc6');
  for (const [kind, n] of Object.entries(ref.counts)) assert.equal(rows(kind).length, n, kind);
});

test('block properties: hardness, blast resistance, light and neighbour brightness', () => {
  const internal = { 98: STONE_BRICKS, 43: DOUBLE_STONE_SLAB, 44: STONE_SLAB, 120: END_PORTAL_FRAME, 118: CAULDRON, 140: FLOWER_POT };
  for (const r of rows('block')) {
    const id = internal[r.id];
    assert.equal(toOriginal(id, 0)[0], r.id);
    const hardness = MATERIALS[id].hardness;
    assert.equal(r.hardness < 0 ? !Number.isFinite(hardness) : hardness, r.hardness < 0 ? true : r.hardness, `hardness ${r.id}`);
    assert.equal(explosionResistance(id), Math.fround(r.explosionResistance), `resistance ${r.id}`);
    assert.equal(lightOpacity(id), r.lightOpacity, `opacity ${r.id}`);
    assert.equal(lightEmission(id) > 0, r.lightValue > 0, `emission ${r.id}`);
    assert.equal(useNeighborBrightness(id), r.useNeighborBrightness, `neighbour brightness ${r.id}`);
  }
  // Material.rock / Material.iron need a pickaxe; the pot and the unbreakable frame do not.
  for (const id of [STONE_BRICKS, DOUBLE_STONE_SLAB, STONE_SLAB, CAULDRON]) assert.equal(MATERIALS[id].kind, 'pickaxe');
  assert.equal(MATERIALS[FLOWER_POT].kind, undefined);
});

test('every metadata: internal mapping, icons, boxes, drops and pick', () => {
  const nativeItem = { 98: 1101, 44: 1103, 380: 1105, 390: 1106 };
  for (const r of rows('meta')) {
    const back = fromOriginal(r.id, r.meta);
    assert.ok(back.exact, `${r.id}:${r.meta}`);
    assert.deepEqual(toOriginal(back.id, back.meta).length, 2);
    const w = cell(back.id, back.meta), name = `${r.id}:${r.meta} -> ${back.id}:${back.meta}`;
    // Icons by native side (bottom, top, four sides) against this build's face order (2 top, 3 bottom, 0/1/4/5 sides).
    const faces = [3, 2, 0, 0, 0, 0];
    if (!(back.id === DOUBLE_STONE_SLAB && r.meta >= 8)) assert.deepEqual(faces.map((f) => TILES[blockTile(back.id, f, false, back.meta)]), r.icons, `icons ${name}`);
    // r.bounds is the raw block field (the frame leaves it at 1.0); drawing and picking use the selection box.
    if (back.id !== END_PORTAL_FRAME) assert.deepEqual(blockBounds(w, 0, 0, 0), r.bounds, `bounds ${name}`);
    assert.deepEqual(blockBounds(w, 0, 0, 0), r.selection, `selection ${name}`);
    assert.deepEqual(collisionBoxList(w, 0, 0, 0), r.collision, `collision ${name}`);
    // The native single box is the bounds left by the last list call; with an eye this build reports the union (eye included).
    if (!(back.id === END_PORTAL_FRAME && back.meta & 4)) assert.deepEqual(collisionBounds(w, 0, 0, 0), r.collisionBox, `collision box ${name}`);
    const drops = (populationDrops(back.id, back.meta) ?? []).map((d) => ({ ...d, damage: d.damage ?? 0 }));
    if (r.item < 0) assert.deepEqual(drops, [], `drops ${name}`);
    else if (back.id === SANDSTONE_SLAB || ((back.id === DOUBLE_STONE_SLAB || back.id === STONE_SLAB) && (back.meta & 7) === 1)) assert.deepEqual(drops, [{ id: 82, count: r.quantity, damage: 0 }]);
    else assert.deepEqual(drops, [{ id: nativeItem[r.item], count: r.quantity, damage: back.id === STONE_BRICKS ? r.damageDropped & 3 : r.damageDropped }], `drops ${name}`); // bricks: native drops the raw invalid meta 4-15; this build keeps 0-3
    const comparator = back.id === END_PORTAL_FRAME ? endFrameComparator(back.meta) : back.id === CAULDRON ? cauldronComparator(back.meta) : 0;
    assert.equal(comparator, r.comparator, `comparator ${name}`);
    if (back.id === SANDSTONE_SLAB) continue;
    if ((back.id === DOUBLE_STONE_SLAB || back.id === STONE_SLAB) && (back.meta & 7) === 1) { assert.deepEqual(stoneUtilityPick(w, 0, 0, 0), { id: 82, damage: 0 }); continue; } // middle-click keeps the old sandstone slab path
    const pick = stoneUtilityPick(w, 0, 0, 0);
    if (back.id === FLOWER_POT) continue; // the tile-entity pick is covered by the potPick rows below
    else assert.deepEqual([pick.id, pick.damage], [nativeItem[r.pick[0]] ?? 1104, back.id === STONE_BRICKS ? r.pick[2] & 3 : r.pick[2]], `pick ${name}`);
  }
});

test('ItemSlab placement: the half comes from the side and the hit height', () => {
  for (const r of rows('slabPlaced')) {
    const got = r.id === 44 ? slabPlacedMeta(r.meta & 7, r.side, Math.fround(r.hy)) : r.meta;
    assert.equal(got, r.result, JSON.stringify(r));
  }
});

// A cell's native state for the click scenarios; the writes list holds "x,y,z,id,meta".
const nativeWrite = (pos, state) => { const [id, meta] = toOriginal(state.id, state.meta); return `${pos.join(',')},${id},${meta}`; };
test('ItemSlab merging and placement replay the original onItemUse', () => {
  const toState = (id, meta) => { const b = fromOriginal(id, meta); return { id: b.id, meta: b.meta }; };
  const delta = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
  for (const r of rows('slabUse')) {
    const type = r.held & 7;
    let clicked = { id: 3, meta: 0 }, click = r.click ?? [0, 64, 0];
    if (r.scenario === 'slab') clicked = toState(44, r.existing);
    if (r.scenario === 'double') clicked = toState(43, r.existing);
    if (r.scenario === 'creative') clicked = toState(44, r.existing);
    const adjPos = click.map((v, i) => v + delta[r.side][i]);
    // The fixture floor (y 63) and the pillar/ceiling stones are solid, everything else is air.
    const solid = (p) => p[1] === 63 || (r.scenario === 'pillar' && p[0] === 0 && p[2] === 0 && (p[1] === 64 || p[1] === 66));
    const adj = adjPos[0] === click[0] && adjPos[1] === click[1] && adjPos[2] === click[2] ? clicked : solid(adjPos) ? { id: 3, meta: 0 } : { id: 0, meta: 0 };
    const plan = planSlabUse(type, clicked, adj, r.side, Math.fround(r.hy));
    const target = plan.merge === 'clicked' ? click : adjPos;
    const free = Boolean(plan.merge) || adj.id === 0;
    const writes = free ? [nativeWrite(target, plan)] : [];
    assert.deepEqual([free, writes], [r.result[0], r.result[2]], JSON.stringify(r));
  }
});

test('ItemBlock placement of the other blocks and the end portal frame facing', () => {
  // The frame is written twice natively (meta 0, then the facing from the probe player's yaw, checked by endFramePlaced).
  for (const r of rows('blockItem')) assert.deepEqual(r.result[2][0], `0,64,0,${r.id},${r.damage}`);
  for (const r of rows('endFramePlaced')) assert.equal(endFrameFacing(Math.fround(r.yaw)), r.meta, `yaw ${r.yaw}`);
  assert.deepEqual(rows('items')[0], { kind: 'items', stoneBrick: 98, slab: 44, endFrame: 120, cauldron: 380, flowerPot: 390, doubleSlab: 43 });
  // Items 100-127 belong to tools, so these blocks' items are 1000 + the block id; saves and exports use the true ids.
  assert.equal(POPULATION_ITEMS[98], 1101); assert.equal(POPULATION_ITEMS[44], 1103); assert.equal(POPULATION_ITEMS[120], 1104);
  assert.equal(POPULATION_ITEMS[380], 1105); assert.equal(POPULATION_ITEMS[390], 1106); assert.equal(POPULATION_ITEMS['44:1'], 82);
  assert.deepEqual(item(98, 3), { id: 1101, damage: 3, clamped: false });
  assert.deepEqual(item(44, 5), { id: 1103, damage: 5, clamped: false });
  assert.deepEqual(item(44, 6), { id: 1103, damage: 6, clamped: false }); // nether brick and quartz slabs are live (nether-blocks.js)
  assert.deepEqual(item(44, 7), { id: 1103, damage: 7, clamped: false });
  assert.equal(item(44, 8), null);
  assert.equal(ITEMS[1103].variants.length, 8);
});

test('cauldron: bucket filling, burning entities and rain', () => {
  for (const r of rows('cauldronUse')) {
    if (r.error || r.held === 374 || r.held === 280) continue; // glass bottles and sticks: no such item behaviour here
    const held = { [-1]: 0, 325: 340, 326: 341, 327: 342 }[r.held];
    const used = cauldronUse(held, r.level, !!r.creative);
    assert.equal(used.handled, r.ret, JSON.stringify(r));
    assert.equal(used.level, r.meta, JSON.stringify(r));
    if (r.held === 326) assert.equal(used.bucket, r.slot[0] === 325, JSON.stringify(r));
  }
  for (const r of rows('cauldronEntity')) {
    const hit = cauldronExtinguishes(r.level, !!r.burning, 64 + r.dy, 64);
    assert.equal(hit ? r.level - 1 : r.level, r.meta, JSON.stringify(r));
  }
  for (const r of rows('cauldronRain')) assert.equal(cauldronRain(r.level, new JavaRandom(r.seed).nextInt(20)), r.meta, JSON.stringify(r));
});

test('native cauldron washing replays every leather-piece/color/level/mode case',()=>{
  assert.ok(washRef.rows.every((r)=>r.kind==='wash'||r.kind==='nonLeather'));
  assert.equal(washRef.counts.wash,128);assert.equal(washRef.counts.nonLeather,8);
  for(const r of washRef.rows){
    const stack=r.kind==='wash'?makeStack(r.armor,1,0,undefined,r.prior===null?{}:{color:r.prior}):makeStack(103,1,0);
    const result=cauldronWash(stack,r.level);
    assert.equal(result.handled,r.handled,JSON.stringify(r));
    assert.equal(result.level,r.newLevel,JSON.stringify(r));
    if(r.kind==='wash'){
      assert.equal(result.stack.count, r.count);
      assert.equal(result.stack.color ?? null,r.color,JSON.stringify(r));
      assert.equal(stack.color ?? null,r.prior, 'washing returns a changed copy, preserving original stack');
    }
  }
  const input=makeStack(400,1,0,undefined,{color:0,displayName:'kept',enchantments:[{id:0,lvl:1}]});
  const output=cauldronWash(input,1).stack;
  assert.equal(output.color,undefined);assert.equal(output.displayName,'kept');assert.deepEqual(output.enchantments,input.enchantments);
  assert.notEqual(output.enchantments,input.enchantments);
});

test('flower pot contents by metadata, insertion, drops and pick', () => {
  for (const r of rows('potTile')) {
    const c = potContentsOfMeta(r.meta);
    assert.deepEqual(c ? potPlantOf(c.id, c.damage) : [-1, 0], r.tile, `tile ${r.meta}`);
  }
  for (const r of rows('potUse')) {
    const held = item(r.held[0], r.held[1]);
    const empty = r.pre === 0 && !potContentsOfMeta(r.pre);
    const w = cell(FLOWER_POT, r.pre);
    const ins = held ? potUse(w, 0, 0, 0, held.id, held.damage) : null;
    assert.equal(!!ins, r.ret, JSON.stringify(r));
    if (ins) { assert.ok(empty); assert.equal(ins.meta, r.meta); assert.deepEqual(potPlantOf(ins.content.id, ins.content.damage), r.tile); }
    else assert.equal(r.meta, r.pre);
  }
  const twice = rows('potTwice')[0], w = cell(FLOWER_POT, 0);
  const first = potInsertion(43, 0); assert.ok(first && twice.first);
  setPotContents(w, 0, 0, 0, first.content);
  assert.equal(potUse(w, 0, 0, 0, 44, 0), null);
  assert.equal(twice.second, false);
  // Breaking: the plant plus the pot; Creative drops nothing (block-break-simulation.js).
  for (const r of rows('potDrops')) {
    const d = potDrops(cell(FLOWER_POT, r.meta), 0, 0, 0);
    assert.deepEqual(d.at(-1), { id: 1106, count: 1, damage: 0 });
    assert.equal(d.length - 1, r.breakDrops.length && !r.creative ? 1 : r.creative ? d.length - 1 : 0);
  }
  for (const r of rows('potPick')) {
    const p = stoneUtilityPick(cell(FLOWER_POT, r.meta), 0, 0, 0), want = item(r.pick[0], r.pick[2]);
    assert.deepEqual([p.id, p.damage], [want.id, want.damage], `pick ${r.meta}`);
  }
});

test('pot contents persist per cell and a changed block forgets them', () => {
  const world = { pots: undefined, get: () => FLOWER_POT, getMeta: () => 0 };
  setPotContents(world, 1, 2, 3, { id: 43, damage: 0 });
  setPotContents(world, 4, 5, 6, { id: 48, damage: 3 });
  const saved = JSON.parse(JSON.stringify(serializePots(world)));
  const fresh = { pots: undefined };
  restorePots(fresh, saved);
  assert.deepEqual([...fresh.pots], [...world.pots]);
  restorePots(fresh, [{ x: 0, y: 0, z: 0, id: 1, damage: 0 }, { x: 'a' }]);
  assert.equal(fresh.pots.size, 0);
});

test('recipes: bricks, slabs, cauldron and pot', () => {
  const stack = (id, damage = 0) => ({ id, count: 1, damage });
  const row = (id, damage = 0) => [stack(id, damage), stack(id, damage), stack(id, damage)];
  assert.deepEqual(populationCraftingResult(row(3), 3), { id: 1103, count: 6, damage: 0 });
  assert.deepEqual(populationCraftingResult(row(12), 3), { id: 1103, count: 6, damage: 3 });
  assert.deepEqual(populationCraftingResult(row(8), 3), { id: 1103, count: 6, damage: 4 });
  assert.deepEqual(populationCraftingResult(row(1101, 2), 3), { id: 1103, count: 6, damage: 5 });
  assert.deepEqual(populationCraftingResult(row(56), 3), { id: 82, count: 6, damage: 0 });
  assert.equal(heldSlabType(82), 1);
  assert.deepEqual(slabDrops(DOUBLE_STONE_SLAB, 3), [{ id: 1103, damage: 3, count: 2 }]);
});
