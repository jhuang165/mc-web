// Replays public/research/colored-blocks-reference.json (tools/verify-colored-blocks.mjs): the unchanged 1.7.10
// stained glass and pane, carpet, hay bale, coal/lapis/emerald blocks, sponge and jack o'lantern.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BLOCKS} from './world.js';
import {
  COLORED_ORIGINAL, COLORED_ITEM_OFFSET, CARPET, HAY_BALE, JACK_O_LANTERN, isColoredBlock, coloredDrops, coloredPlacedMeta,
  pumpkinFacingMeta, carpetCanStay, carpetNeighbourChange, carpetBounds, coloredCraftingResult, COLORED_FUELS, coloredItemBlock, stainedGlassFaceHidden,
} from './colored-blocks.js';
import {fromOriginal, toOriginal} from './block-registry.js';
import {ITEMS, MATERIALS} from './survival.js';
import {encouragement, flammability} from './fire.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/colored-blocks-reference.json', import.meta.url), 'utf8'));
const rows = (kind) => ref.rows.filter((r) => r.kind === kind);
const internal = (mc) => COLORED_ORIGINAL[mc];
// Original item id -> this build's item id for the ingredients of the probed recipes.
const INGREDIENT = {20: 9, 351: 351, 35: 19, 296: 305, 263: 301, 388: 367, 86: 67, 50: 20};
const itemOf = (mc) => (COLORED_ORIGINAL[mc] ? COLORED_ORIGINAL[mc] + COLORED_ITEM_OFFSET : INGREDIENT[mc] ?? mc);

test('the reference is the pinned 1.7.10 client with the expected row counts', () => {
  assert.equal(ref.clientSha1, 'e80d9b3bf5085002218d4be59e668bac718abbc6');
  for (const [kind, n] of Object.entries(ref.counts)) assert.equal(rows(kind).length, n, kind);
});

test('block properties: hardness, light and the original id mapping', () => {
  for (const b of rows('block')) {
    const id = internal(b.id);
    if (!id) continue;
    assert.ok(BLOCKS[id], `block ${id} exists`);
    assert.ok(isColoredBlock(id));
    assert.equal(Math.fround(MATERIALS[id].hardness), Math.fround(b.hardness), `hardness ${b.id}`);
    assert.equal(id === JACK_O_LANTERN, b.lightValue === 15, `light ${b.id}`);
    assert.equal(toOriginal(id, 0)[0], b.id);
    assert.equal(fromOriginal(b.id, 0).id, id);
  }
});

test('carpet is a 1/16-high box that needs a block below and drops when it is lost', () => {
  assert.deepEqual(carpetBounds(), [0, 0, 0, 1, 1 / 16, 1]);
  for (const s of rows('supportPlaced').filter((r) => r.id === 171)) assert.equal(s.canPlace, s.below !== 0);
  for (const n of rows('carpetNeighbor')) {
    const cells = new Map([['0,63,0', n.below], ['0,64,0', CARPET]]);
    const world = {get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? 0, getMeta: () => 5, set: (x, y, z, b) => cells.set(`${x},${y},${z}`, b)};
    assert.equal(carpetCanStay(world, 0, 64, 0), n.stays);
    const drop = carpetNeighbourChange(world, 0, 64, 0);
    assert.equal(!!drop, !n.stays);
    if (drop) assert.deepEqual(drop, {id: CARPET + COLORED_ITEM_OFFSET, count: 1, damage: 5});
  }
});

test('drops: stained glass and panes nothing, the rest themselves with the original damage', () => {
  for (const d of rows('drops')) {
    const id = internal(d.id);
    if (!id) continue;
    const mine = coloredDrops(id, d.meta).map((s) => `[${d.id},${s.count},${s.damage}]`);
    assert.deepEqual(mine, d.drops, `${d.id}:${d.meta}`);
  }
});

test('placement metadata: colour damage, hay axis from the face, jack o lantern facing from yaw', () => {
  for (const p of rows('placed')) {
    const id = internal(p.id);
    if (!id || !p.result[0] || p.id === 91 || p.id === 170) continue;
    const meta = Number(p.result[2].at(-1).split(',').at(-1));
    assert.equal(coloredPlacedMeta(id, p.damage, p.side, 0) & 15, meta, `${p.id}:${p.damage} side ${p.side}`);
  }
  for (const o of rows('onPlaced').filter((r) => r.id === 170)) assert.equal(coloredPlacedMeta(HAY_BALE, o.meta, o.side, 0), (o.meta & 3) | o.result, `hay ${o.meta} side ${o.side}`);
  for (const y of rows('yawPlaced')) assert.equal(pumpkinFacingMeta(y.yaw), y.meta, `${y.id} yaw ${y.yaw}`);
});

test('crafting grids and the fuel and fire tables', () => {
  for (const c of rows('craft')) {
    const cells = c.grid.map((g) => { if (!g) return null; const [id, dmg] = g.split(':').map(Number); return {id: itemOf(id), damage: dmg, count: 1}; });
    const r = coloredCraftingResult(cells, c.grid.length === 9 ? 3 : 2);
    const [id, count, damage] = c.result ?? [0];
    if (!id) { assert.equal(r, null, c.label); continue; }
    assert.deepEqual(r && [r.id, r.count, r.damage], [itemOf(id), count, damage], c.label);
  }
  for (const f of rows('fuel').filter((r) => internal(r.id))) assert.equal(COLORED_FUELS[internal(f.id) + COLORED_ITEM_OFFSET] ?? 0, f.burn);
  assert.equal(COLORED_FUELS[1144], 16000);
  for (const f of rows('fire').filter((r) => internal(r.id))) {
    assert.equal(encouragement(internal(f.id)), f.encourage, `encourage ${f.id}`);
    assert.equal(flammability(internal(f.id)), f.flammability, `flammability ${f.id}`);
  }
});

test('items: ids 1140-1148, colour names and face culling by colour', () => {
  assert.equal(coloredItemBlock(1140), 140);
  assert.equal(ITEMS[1140].variants.length, 16);
  assert.equal(ITEMS[1142].variants[8], 'Light Gray Carpet');
  assert.ok(stainedGlassFaceHidden(140, 140, 3, 3));
  assert.ok(!stainedGlassFaceHidden(140, 140, 3, 4));
});
