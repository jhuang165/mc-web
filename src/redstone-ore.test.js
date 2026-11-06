import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JavaRandom } from './java-random.js';
import { REDSTONE_ORE, LIT_REDSTONE_ORE, World, ticksRandomly, opaqueCube } from './world.js';
import { fromOriginal, toOriginal } from './block-registry.js';
import { lightEmission, lightOpacity } from './lighting.js';
import { MATERIALS } from './survival.js';
import { itemFromOriginal } from './region-import.js';
import { harvestBlock, enchantedBreakDrops } from './enchantment-effects.js';
import { populationDrops, populationXp } from './population-content.js';
import { PopulationBlocks } from './population-blocks.js';
import { mobStepEvents } from './mob-steps.js';
import { applyPlayerEdit } from './player-edit-simulation.js';
import { Survival } from './survival.js';
import { Farming } from './farming.js';
import { Trees } from './trees.js';
import { makeStack } from './inventory.js';
import { touchRedstoneOre, randomTickRedstoneOre, isRedstoneOre, TICK_RATE, LIT_LIGHT_VALUE, ON_BLOCK_ACTIVATED_RESULT } from './redstone-ore.js';

const reference = JSON.parse(await readFile(new URL('../public/research/redstone-ore-reference.json', import.meta.url)));
const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');
const INTERNAL = { 73: REDSTONE_ORE, 74: LIT_REDSTONE_ORE };
const X = 10, Y = 70, Z = 10;

class Cells {
  constructor() { this.cells = new Map(); this.changes = []; }
  get(x, y, z) { return this.cells.get(`${x},${y},${z}`)?.[0] ?? 0; }
  getMeta(x, y, z) { return this.cells.get(`${x},${y},${z}`)?.[1] ?? 0; }
  set(x, y, z, id, tracked = true, meta = 0) { this.cells.set(`${x},${y},${z}`, [id, meta]); this.changes.push([x, y, z, id, meta]); return true; }
  put(x, y, z, id, meta = 0) { this.cells.set(`${x},${y},${z}`, [id, meta]); }
}
const FACES = [[0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0]];

test('the reference covers the unchanged-class records', () => {
  assert.equal(reference.facts.length, 2);
  assert.equal(reference.touch.length, 480);
  assert.equal(reference.tick.length, 2);
  assert.equal(reference.harvest.length, 400);
  assert.deepEqual(Object.keys(reference.classes), ['amz', 'aji', 'sa', 'ahb']);
});

test('static facts: tick rate, light, opacity, random ticking and the item are the native values', () => {
  const [unlit, lit] = reference.facts;
  assert.equal(unlit.tickRate, TICK_RATE);
  assert.equal(lit.tickRate, TICK_RATE);
  assert.equal(unlit.light, lightEmission(REDSTONE_ORE));
  assert.equal(lit.light, lightEmission(LIT_REDSTONE_ORE));
  assert.equal(lit.light, LIT_LIGHT_VALUE);
  assert.equal(lit.light, 9);
  assert.equal(unlit.opacity, 255);
  assert.equal(lightOpacity(REDSTONE_ORE), 255);
  assert.equal(lightOpacity(LIT_REDSTONE_ORE), 255);
  assert.equal(ticksRandomly(REDSTONE_ORE), unlit.tickRandomly);
  assert.equal(ticksRandomly(LIT_REDSTONE_ORE), lit.tickRandomly);
  assert.equal(opaqueCube(REDSTONE_ORE), unlit.opaque);
  assert.equal(opaqueCube(LIT_REDSTONE_ORE), lit.opaque);
  // Both drop dust and Silk Touch gives the unlit ore (createStackedBlock); the lit ore has no ItemBlock of its own.
  assert.deepEqual([unlit.item, lit.item, unlit.stacked, lit.stacked], [331, 331, [73, 1, 0], [73, 1, 0]]);
  assert.equal(lit.itemOfBlock, 0);
  assert.deepEqual(unlit.quantity, lit.quantity);
  assert.deepEqual(toOriginal(REDSTONE_ORE), [73, 0]);
  assert.deepEqual(toOriginal(LIT_REDSTONE_ORE), [74, 0]);
  assert.ok(isRedstoneOre(REDSTONE_ORE) && isRedstoneOre(LIT_REDSTONE_ORE) && !isRedstoneOre(1));
});

test('the live world sees lit ore as a light source, and the swap relights the neighbourhood', () => {
  const w = new World('redstone-ore-light');
  assert.equal(lightEmission(REDSTONE_ORE), 0);
  assert.equal(lightEmission(LIT_REDSTONE_ORE), 9);
  w.set(40, 20, 40, REDSTONE_ORE, false, 0);
  const seen = [];
  assert.equal(touchRedstoneOre(w, 40, 20, 40, { changed: (c) => seen.push(...c) }), true);
  assert.equal(w.get(40, 20, 40), LIT_REDSTONE_ORE);
  assert.deepEqual(seen, [[40, 20, 40, REDSTONE_ORE, LIT_REDSTONE_ORE]]);
  // scene.updateBlocks relights when the emission differs between the old and the new block.
  assert.notEqual(lightEmission(seen[0][3]), lightEmission(seen[0][4]));
});

test('onBlockClicked, onEntityWalking and onBlockActivated sparkle, then light only the unlit ore (480 native cases)', () => {
  const filler = { 0: 0, 20: fromOriginal(20, 0).id, 50: fromOriginal(50, 0).id };
  let checked = 0;
  for (const t of reference.touch) {
    const w = new Cells();
    w.put(X, Y, Z, INTERNAL[t.block]);
    FACES.forEach(([dx, dy, dz], i) => w.put(X + dx, Y + dy, Z + dz, (t.mask >> i) & 1 ? 1 : filler[t.filler]));
    w.changes.length = 0;
    const rand = new JavaRandom(t.seed), got = [];
    const swapped = touchRedstoneOre(w, X, Y, Z, { rand, spawn: (...a) => got.push(a) });
    const where = `block ${t.block} event ${t.event} filler ${t.filler} mask ${t.mask}`;
    assert.deepEqual(got, t.particles, where);
    // World.setBlock(lit ore) with metadata 0 for the unlit ore; the lit ore is left alone.
    assert.deepEqual(w.changes.map(([x, y, z, id, meta]) => [x, y, z, toOriginal(id)[0], meta]), t.sets, where);
    assert.equal(swapped, t.block === 73, where);
    assert.equal(w.get(X, Y, Z), LIT_REDSTONE_ORE, where);
    assert.equal(rand.nextInt(), t.next, where);
    if (t.event === 2) assert.equal(t.return, ON_BLOCK_ACTIVATED_RESULT, where);
    checked++;
  }
  assert.equal(checked, 480);
});

test('particles over a fully enclosed ore are nothing, an open ore sparkles on five faces (the lower test is y < 0)', () => {
  const open = reference.touch.find((t) => t.block === 73 && t.mask === 0 && t.filler === 0 && t.event === 0);
  assert.equal(open.particles.length, 5);
  assert.ok(open.particles.every((p) => p[0] === 'reddust' && p[4] === 0 && p[5] === 0 && p[6] === 0));
  const closed = reference.touch.find((t) => t.block === 73 && t.mask === 63 && t.filler === 0 && t.event === 0);
  assert.equal(closed.particles.length, 0);
});

test('updateTick turns the lit ore back and leaves the unlit ore alone, without particles', () => {
  for (const t of reference.tick) {
    const w = new Cells();
    w.put(X, Y, Z, INTERNAL[t.block]);
    const changed = randomTickRedstoneOre(w, X, Y, Z);
    assert.equal(changed, t.block === 74);
    assert.deepEqual(w.changes.map(([x, y, z, id, meta]) => [x, y, z, toOriginal(id)[0], meta]), t.sets);
    assert.deepEqual(t.particles, []);
    assert.equal(w.get(X, Y, Z), REDSTONE_ORE);
  }
  // The live random-tick table: the lit ore ticks (and is routed to PopulationBlocks), the unlit does not.
  const w = new Cells(), applied = [], p = new PopulationBlocks(w, { apply: (c) => applied.push(...c) });
  w.put(1, 1, 1, LIT_REDSTONE_ORE);
  assert.equal(p.randomTick(1, 1, 1, LIT_REDSTONE_ORE), true);
  assert.equal(w.get(1, 1, 1), REDSTONE_ORE);
  assert.deepEqual(applied, [[1, 1, 1, LIT_REDSTONE_ORE, REDSTONE_ORE]]);
  assert.equal(p.randomTick(1, 1, 1, REDSTONE_ORE), false);
});

test('Silk Touch and Fortune drops and experience match Block.harvestBlock for both blocks (400 cases)', () => {
  const SETS = [{}, { silk: true }, { fortune: 1 }, { fortune: 2 }, { fortune: 3 }];
  for (const h of reference.harvest) {
    const rand = new JavaRandom(h.seed);
    const r = harvestBlock(h.block, 0, { ...SETS[h.set], rand });
    const where = `block ${h.block} set ${h.set} seed ${h.seed}`;
    assert.deepEqual(r.drops.flatMap((d) => Array.from({ length: d.count }, () => [d.id, 1, d.damage])), h.drops, where);
    assert.equal(r.xp, h.xp.reduce((a, b) => a + b, 0), where);
    assert.equal(rand.nextInt(), h.next, where);
  }
});

test('the live break gives dust (4 or 5, plus Fortune), 1-5 experience, and Silk Touch the unlit ore, for lit and unlit ore', () => {
  const dust = itemFromOriginal(331, 0), unlitItem = itemFromOriginal(73, 0);
  const silk = { enchantments: [{ id: 33, lvl: 1 }] }, fortune = (lvl) => ({ enchantments: [{ id: 35, lvl }] });
  for (const block of [REDSTONE_ORE, LIT_REDSTONE_ORE]) {
    for (let seed = 0; seed < 40; seed++) {
      const s = enchantedBreakDrops(block, 0, silk, new JavaRandom(seed));
      assert.equal(s.silk, true);
      assert.deepEqual(s.drops.map((d) => d.id), [unlitItem.id]);
      assert.equal(s.xp, 0);
      for (let lvl = 1; lvl <= 3; lvl++) {
        const r = enchantedBreakDrops(block, 0, fortune(lvl), new JavaRandom(seed));
        const n = r.drops.reduce((a, d) => a + d.count, 0);
        assert.ok(r.drops.every((d) => d.id === dust.id));
        assert.ok(n >= 4 && n <= 5 + lvl, `${n} dust`);
        assert.ok(r.xp >= 1 && r.xp <= 5);
      }
    }
    // Without an enchantment the ordinary path drops 4-5 dust and 1-5 experience (population-content.js).
    for (let i = 0; i < 10; i++) {
      const drops = populationDrops(block, 0, { random: () => i / 10 });
      assert.equal(drops.length, 1);
      assert.equal(drops[0].id, dust.id);
      assert.ok(drops[0].count === 4 || drops[0].count === 5);
      const xp = populationXp(block, () => i / 10);
      assert.ok(xp >= 1 && xp <= 5);
    }
    assert.equal(MATERIALS[block].drop, dust.id);
    assert.equal(MATERIALS[block].hardness, 3);
  }
});

// ---- the live hooks ---------------------------------------------------------

const POS = [42, 12, 42];
function fixture({ mode = 'survival', tool = 0, block, target, place = false, sneaking = false }) {
  const world = new World('redstone-ore-edit');
  world.set(...POS, block, false, 0);
  world.set(POS[0], POS[1] + 1, POS[2], 0, false, 0);
  const survival = new Survival({ food: 10, slots: tool ? [makeStack(tool, 1)] : [] }, mode);
  const state = { screen: 'playing', heldTool: tool, world, survival, position: { x: 10.5, y: 10, z: 10.5 }, velocity: { x: 0, y: 0, z: 0 },
    motion: { sneaking, sprinting: false }, mobs: {}, farming: new Farming(world), trees: new Trees(world, { random: new JavaRandom(18) }), fire: {}, grounded: true,
    fallDistance: 0, wasInWater: false, yaw: 0, eating: null, mining: null, mineCooldown: 0, mineHeld: true, flowers: {}, boneRandom: new JavaRandom(21), itemRand: new JavaRandom(22) };
  return { state, request: { place, target, aimedEntity: null } };
}
const hooks = (calls) => ({ touchRedstoneOre: (...p) => calls.push(['touch', ...p]), clientEyeInWater: () => false, breakBlock: () => calls.push('break'), collides: () => false,
  updateBlock: () => {}, renderHotbar: () => {}, markUnsaved: () => {}, sound: () => {}, playSound: () => {} });

test('a left click on ore in Survival calls onBlockClicked once; Creative breaks it without touching', () => {
  for (const block of [REDSTONE_ORE, LIT_REDSTONE_ORE]) {
    const calls = [], f = fixture({ block, target: { block: [...POS] } });
    applyPlayerEdit(f.state, f.request, hooks(calls));
    assert.deepEqual(calls.filter((c) => c[0] === 'touch'), [['touch', ...POS]]);
    const creative = [], g = fixture({ mode: 'creative', block, target: { block: [...POS] } });
    applyPlayerEdit(g.state, g.request, hooks(creative));
    assert.deepEqual(creative.filter((c) => c[0] === 'touch'), []);
  }
  const other = [], f = fixture({ block: 1, target: { block: [...POS] } });
  applyPlayerEdit(f.state, f.request, hooks(other));
  assert.deepEqual(other.filter((c) => c[0] === 'touch'), []);
});

test('a right click activates the ore and the held block is still placed (onBlockActivated returns false)', () => {
  for (const block of [REDSTONE_ORE, LIT_REDSTONE_ORE]) {
    const calls = [], target = { block: [...POS], adjacent: [POS[0], POS[1] + 1, POS[2]] }, f = fixture({ block, tool: 3, target, place: true });
    const result = applyPlayerEdit(f.state, f.request, hooks(calls));
    assert.deepEqual(calls.filter((c) => c[0] === 'touch'), [['touch', ...POS]]);
    assert.equal(result.branch, 'place-block');
    assert.equal(f.state.world.get(...target.adjacent), 3);
    // Sneaking with an item skips Block.onBlockActivated entirely.
    const sneak = [], g = fixture({ block, tool: 3, target, place: true, sneaking: true });
    applyPlayerEdit(g.state, g.request, hooks(sneak));
    assert.deepEqual(sneak.filter((c) => c[0] === 'touch'), []);
    // With an empty hand the ore still sparkles and lights.
    const bare = [], h = fixture({ block, target, place: true });
    applyPlayerEdit(h.state, h.request, hooks(bare));
    assert.deepEqual(bare.filter((c) => c[0] === 'touch'), [['touch', ...POS]]);
  }
});

test('mobs trigger onEntityWalking on the step cell, with the step sound', () => {
  const world = { get: (x, y, z) => (y <= 0 ? REDSTONE_ORE : 0) }, e = { type: 'zombie', x: 0.5, y: 1, z: 0.5, vx: 0, vy: 0, vz: 0 }, walked = [];
  for (let i = 0; i < 40; i++) {
    const from = { x: e.x, y: e.y, z: e.z };
    e.x += 0.1;
    mobStepEvents(world, e, from, { onWalk: (x, y, z) => walked.push([x, y, z]) });
  }
  assert.ok(walked.length >= 2 && walked.length <= 3, `${walked.length} steps over 4 blocks`);
  assert.ok(walked.every(([, y, z]) => y === 0 && z === 0));
  // A silverfish cannot trigger walking, and nothing happens over air.
  const fish = { type: 'silverfish', x: 0.5, y: 1, z: 0.5, vx: 0, vy: 0, vz: 0 }, none = [];
  for (let i = 0; i < 40; i++) { const from = { x: fish.x, y: fish.y, z: fish.z }; fish.x += 0.1; mobStepEvents(world, fish, from, { onWalk: () => none.push(1) }); }
  assert.deepEqual(none, []);
});

test('the touches are wired into the live game (main.js, entities.js) and the old per-tick and per-click touches are gone', async () => {
  const main = await read('./main.js'), entities = await read('./entities.js'), edit = await read('./player-edit-simulation.js');
  assert.match(main, /mobs\.onEntityWalking = \(x, y, z\) => touchRedstoneOre\(x, y, z\)/);
  assert.match(main, /function touchRedstoneOre\(x, y, z\)[\s\S]{0,260}populationBlocks\?\.touch\(x, y, z, \{ rand: scene\.explosionParticles\.worldRandom/);
  assert.match(main, /\n    touchRedstoneOre,\n/);
  assert.match(main, /touchRedstoneOre\(Math\.floor\(position\.x\), Math\.floor\(position\.y - 0\.2\), Math\.floor\(position\.z\)\)/);
  assert.doesNotMatch(main, /populationBlocks\?\.touch\(Math\.floor\(position\.x\),Math\.floor\(position\.y-\.01\)/);
  assert.doesNotMatch(main, /if\(target\?\.block\)world\.populationBlocks\?\.touch/);
  assert.match(entities, /onWalk: \(x, y, z\) => this\.onEntityWalking\?\.\(x, y, z, e\)/);
  assert.match(edit, /hook\('touchRedstoneOre', \.\.\.target\.block\)/);
  assert.match(edit, /hook\('touchRedstoneOre', x, y, z\)/);
});
