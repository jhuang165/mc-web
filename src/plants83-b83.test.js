// Batch 83 plants83: the dandelion and tall grass keep their metadata in the world (rawDamage stacks place, drop and pick it), double plant metadata
// through placement, drops, pick, icons and bone meal, and /setblock data tags for flower pots, signs, note blocks, jukeboxes and comparators.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, YELLOW_FLOWER, RED_FLOWER, DOUBLE_PLANT, DEAD_SHRUB, TALL_GRASS, FERN, FLOWER_POT } from "./world.js";
import { toOriginal, fromOriginal } from "./block-registry.js";
import { plantDropDamage, doublePlantDamage, tallGrassShearStack, rawDamageCell, plantPick } from "./plant-damage.js";
import { placeHeldBlock } from "./block-placement-simulation.js";
import { Survival, ITEMS } from "./survival.js";
import { populationDrops } from "./population-content.js";
import { explosionOutcome } from "./explosion.js";
import { JavaRandom } from "./java-random.js";
import { useBoneMeal } from "./bone-meal.js";
import { blockTile } from "./block-textures.js";
import { stackName } from "./item-names.js";
import { createCommandHost } from "./command-host.js";
import { createCommandRunner } from "./commands.js";
import { parseJsonNbt } from "./json-nbt.js";
import { applySetblockTag } from "./setblock-tags.js";
import { Signs } from "./signs.js";
import { potContents } from "./stone-utility.js";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";

const src = (f) => readFileSync(new URL(`./${f}`, import.meta.url), "utf8");
const tagOf = (snbt) => parseJsonNbt(snbt).value;

test("the registry keeps dandelion and tallgrass:0/3-15 metadata; old saves and the other tallgrass subtypes read back unchanged", () => {
  for (const m of [0, 1, 5, 15]) {
    assert.deepEqual(toOriginal(YELLOW_FLOWER, m), [37, m]);
    assert.deepEqual(fromOriginal(37, m), { id: YELLOW_FLOWER, meta: m, exact: true });
  }
  assert.deepEqual(fromOriginal(31, 0), { id: DEAD_SHRUB, meta: 0, exact: true });
  assert.deepEqual(fromOriginal(31, 1), { id: TALL_GRASS, meta: 0, exact: true });
  assert.deepEqual(fromOriginal(31, 2), { id: FERN, meta: 0, exact: true });
  for (const m of [3, 7, 15]) {
    assert.deepEqual(fromOriginal(31, m), { id: DEAD_SHRUB, meta: m, exact: true }, `31:${m} used to load as tall grass 39`);
    assert.deepEqual(toOriginal(DEAD_SHRUB, m), [31, m]);
  }
  // A shrub cell can never encode tallgrass:1/2 (those are 39/84), so those metas store as the shrub.
  assert.deepEqual(toOriginal(DEAD_SHRUB, 1), [31, 0]);
  assert.deepEqual([toOriginal(TALL_GRASS, 0), toOriginal(FERN, 0)], [[31, 1], [31, 2]]);
  const w = new World("plants83", "meadow", 1);
  w.set(4, 20, 4, DEAD_SHRUB, false, 9); w.set(5, 20, 4, YELLOW_FLOWER, false, 6);
  assert.deepEqual([w.get(4, 20, 4), w.getMeta(4, 20, 4), w.get(5, 20, 4), w.getMeta(5, 20, 4)], [DEAD_SHRUB, 9, YELLOW_FLOWER, 6]);
});

test("drop/pick damage: the dandelion and shrub keep rawDamage, the double plant its type (6/7 as rawDamage)", () => {
  assert.deepEqual(plantDropDamage(YELLOW_FLOWER, 0), { damage: 0 });
  assert.deepEqual(plantDropDamage(YELLOW_FLOWER, 6), { damage: 0, tags: { rawDamage: 6 } });
  assert.deepEqual(plantDropDamage(DEAD_SHRUB, 4), { damage: 0, tags: { rawDamage: 4 } });
  assert.deepEqual([doublePlantDamage(5), doublePlantDamage(7), doublePlantDamage(14)], [{ damage: 5 }, { damage: 0, tags: { rawDamage: 7 } }, { damage: 0, tags: { rawDamage: 6 } }]);
  assert.deepEqual(rawDamageCell(DEAD_SHRUB, 1), { id: TALL_GRASS, meta: 0 });
  assert.deepEqual(rawDamageCell(DEAD_SHRUB, 2), { id: FERN, meta: 0 });
  assert.deepEqual(rawDamageCell(DEAD_SHRUB, 19), { id: DEAD_SHRUB, meta: 3 });
  const w = new World("plants83-pick", "meadow", 1);
  w.set(4, 20, 4, DOUBLE_PLANT, false, 3); w.set(4, 21, 4, DOUBLE_PLANT, false, 9);
  w.set(5, 20, 4, RED_FLOWER, false, 12); w.set(6, 20, 4, YELLOW_FLOWER, false, 2);
  assert.deepEqual(plantPick(w, 4, 21, 4), { id: DOUBLE_PLANT, damage: 3, rawDamage: undefined }, "BlockDoublePlant.k: the top reads the lower half's type");
  assert.deepEqual(plantPick(w, 5, 20, 4), { id: RED_FLOWER, damage: 0, rawDamage: 12 });
  assert.deepEqual(plantPick(w, 6, 20, 4), { id: YELLOW_FLOWER, damage: 0, rawDamage: 2 });
  assert.equal(plantPick(w, 7, 20, 4), null);
  assert.match(src("main.js"), /\?\? plantPick\(world, \.\.\.target\.block\)\)/);
});

const place = (id, held, { yaw = 0, below = 1 } = {}) => {
  const world = new World("plants83-place", "meadow", 1), survival = new Survival();
  const here = [10, 20, 10], p = [10, 21, 10];
  world.set(...here, below); world.set(...p, 0); world.set(10, 22, 10, 0);
  survival.inventory.setStack(0, { id, count: 4, damage: 0, ...held });
  const out = placeHeldBlock({ world, survival, position: { x: 30.5, y: 20, z: 30.5 }, flowers: { yellow: YELLOW_FLOWER, red: RED_FLOWER }, yaw, farming: { observe() {} } },
    { id, item: ITEMS[id], target: { block: here, adjacent: p } }, { collides: () => false, updateBlock() {}, renderHotbar() {}, sound() {}, markUnsaved() {} });
  return { out, world, cell: [world.get(...p), world.getMeta(...p)], top: [world.get(10, 22, 10), world.getMeta(10, 22, 10)] };
};

test("ItemMultiTexture/ItemColored getMetadata: dandelion and tallgrass rawDamage stacks place that metadata", () => {
  assert.deepEqual(place(YELLOW_FLOWER, { rawDamage: 5 }).cell, [YELLOW_FLOWER, 5]);
  assert.deepEqual(place(YELLOW_FLOWER, {}).cell, [YELLOW_FLOWER, 0]);
  assert.deepEqual(place(DEAD_SHRUB, { rawDamage: 9 }).cell, [DEAD_SHRUB, 9]);
  assert.deepEqual(place(DEAD_SHRUB, { rawDamage: 1 }).cell, [TALL_GRASS, 0]);
  assert.deepEqual(place(DEAD_SHRUB, { rawDamage: 2 }).cell, [FERN, 0]);
  const r = place(DEAD_SHRUB, { rawDamage: 9 });
  assert.equal(r.out.block, DEAD_SHRUB);
  // BlockBush.canPlaceBlockAt: grass, dirt or farmland below.
  for (const id of [TALL_GRASS, DEAD_SHRUB, FERN]) assert.equal(place(id, {}, { below: 3 }).out.reason, "plant-support", `${id}`);
});

test("ItemDoublePlant places the rawDamage type and BlockDoublePlant.onBlockPlacedBy gives the top its facing bits", () => {
  assert.deepEqual(place(DOUBLE_PLANT, { rawDamage: 7 }).cell, [DOUBLE_PLANT, 7]);
  // Camera yaw 0 is Minecraft yaw 180: floor(180 * 4 / 360 + 0.5) & 3 = 2, (2 + 2) % 4 = 0.
  assert.deepEqual(place(DOUBLE_PLANT, { damage: 4 }).top, [DOUBLE_PLANT, 8]);
  // Minecraft yaw 90 (camera pi / 2): floor(1.5) = 1, (1 + 2) % 4 = 3.
  assert.deepEqual(place(DOUBLE_PLANT, { damage: 4 }, { yaw: Math.PI / 2 }).top, [DOUBLE_PLANT, 11]);
  assert.deepEqual(place(DOUBLE_PLANT, { damage: 4 }, { yaw: Math.PI / 2 }).cell, [DOUBLE_PLANT, 4]);
});

test("shears: the shrub and fern drop themselves, double grass two tall grass, a large fern two ferns; no seeds from double grass", () => {
  const always = () => 0;
  assert.deepEqual(populationDrops(DEAD_SHRUB, 0, { shears: true, random: always }), [{ id: DEAD_SHRUB, count: 1, damage: 0 }]);
  assert.deepEqual(populationDrops(DEAD_SHRUB, 5, { shears: true, random: always }), [{ id: DEAD_SHRUB, count: 1, damage: 0, tags: { rawDamage: 5 } }]);
  assert.deepEqual(populationDrops(FERN, 0, { shears: true, random: always }), [{ id: FERN, count: 1 }]);
  assert.deepEqual(populationDrops(DOUBLE_PLANT, 2, { shears: true, random: always }), [{ id: TALL_GRASS, count: 2 }]);
  assert.deepEqual(populationDrops(DOUBLE_PLANT, 3, { shears: true, random: always }), [{ id: FERN, count: 2 }]);
  assert.deepEqual(populationDrops(DOUBLE_PLANT, 2, { random: always }), [], "ako.getItemDropped is null for types 2/3");
  assert.deepEqual(populationDrops(DOUBLE_PLANT, 7, { random: always }), [{ id: DOUBLE_PLANT, count: 1, damage: 0, tags: { rawDamage: 7 } }]);
  assert.deepEqual(populationDrops(DOUBLE_PLANT, 9, { random: always }), []);
  assert.deepEqual(tallGrassShearStack(TALL_GRASS, 0), { id: TALL_GRASS, count: 1 });
});

test("explosions: dandelion and double plant drop their damage (rawDamage past the variants), the top and grass types nothing, the shrub only seeds", () => {
  const cleared = () => { const w = new World("plants83-blast", "meadow", 1); for (let x = 4; x < 10; x++) for (let z = 4; z < 10; z++) for (let y = 9; y < 14; y++) w.put(x, y, z, y === 9 ? 3 : 0, 0, false); return w; };
  const blast = (id, meta) => { const w = cleared(); w.set(6, 10, 6, id, false, meta); return explosionOutcome(w, [[6, 10, 6]], 1, new JavaRandom(3n), { own: new JavaRandom(1n) }).drops.map((d) => [d.id, d.damage, d.tags?.rawDamage]); };
  assert.deepEqual(blast(YELLOW_FLOWER, 6), [[YELLOW_FLOWER, 0, 6]]);
  assert.deepEqual(blast(DOUBLE_PLANT, 7), [[DOUBLE_PLANT, 0, 7]]);
  assert.deepEqual(blast(DOUBLE_PLANT, 4), [[DOUBLE_PLANT, 4, undefined]]);
  assert.deepEqual(blast(DOUBLE_PLANT, 2), []);
  assert.deepEqual(blast(DOUBLE_PLANT, 8), []);
  for (let s = 0n; s < 20n; s++) {
    const w = cleared(); w.set(6, 10, 6, DEAD_SHRUB, false, 0);
    for (const d of explosionOutcome(w, [[6, 10, 6]], 1, new JavaRandom(s), { own: new JavaRandom(1n) }).drops) assert.equal(d.id, 309, "a shrub drops seeds or nothing");
  }
});

test("bone meal on a type 7 double plant drops it with rawDamage; a shrub meta 3+ (tallgrass:3) grows into double grass", () => {
  const w = new World("plants83-bone", "meadow", 1), spawned = [];
  for (let y = 21; y < 24; y++) w.set(6, y, 6, 0);
  w.set(6, 20, 6, 1); w.set(6, 21, 6, DOUBLE_PLANT, false, 7); w.set(6, 22, 6, DOUBLE_PLANT, false, 8);
  const out = useBoneMeal({ world: w, items: { spawn: (s) => spawned.push(s) }, rand: new JavaRandom(1n) }, 6, 21, 6);
  assert.equal(out.used, true);
  assert.deepEqual(spawned.map((s) => [s.id, s.damage, s.rawDamage]), [[DOUBLE_PLANT, 0, 7]]);
  const g = new World("plants83-bone2", "meadow", 1);
  for (let y = 21; y < 24; y++) g.set(6, y, 6, 0);
  g.set(6, 20, 6, 1); g.set(6, 21, 6, DEAD_SHRUB, false, 5);
  assert.equal(useBoneMeal({ world: g, items: { spawn() {} }, rand: new JavaRandom(1n) }, 6, 21, 6).used, true);
  assert.deepEqual([g.get(6, 21, 6), g.getMeta(6, 21, 6), g.get(6, 22, 6)], [DOUBLE_PLANT, 2, DOUBLE_PLANT]);
});

test("icons, tint and names past the variants", () => {
  assert.ok(blockTile(DOUBLE_PLANT, 0, false, 7) >= 0, "types 6/7 draw the sunflower instead of a missing tile");
  assert.equal(blockTile(DOUBLE_PLANT, 0, false, 6), blockTile(DOUBLE_PLANT, 0, false, 0));
  assert.match(src("chunk-mesher.js"), /b === DEAD_SHRUB && \(raw & 15\) !== 0/);
  assert.equal(stackName({ id: DEAD_SHRUB, count: 1, damage: 0, rawDamage: 5 }, ITEMS), "Grass");
  assert.equal(stackName({ id: DEAD_SHRUB, count: 1, damage: 0 }, ITEMS), "Shrub");
});

// /setblock data tags (CommandSetBlock: readFromNBT on the fresh tile).
const game = () => {
  const world = new World("plants83-cmd", "meadow", 1), survival = new Survival({}, "creative"), lines = [], dropped = [];
  for (let x = 4; x < 10; x++) for (let z = 4; z < 10; z++) { world.set(x, 59, z, 3); world.set(x, 60, z, 0); }
  const signs = new Signs(), notes = new Map(), juke = new Map(), comparators = new Map();
  const music = { noteBlocks: { tile: (x, y, z) => notes.get(`${x},${y},${z}`) ?? (notes.set(`${x},${y},${z}`, { note: 0 }), notes.get(`${x},${y},${z}`)) },
    jukeboxes: { tile: (x, y, z) => juke.get(`${x},${y},${z}`) ?? (juke.set(`${x},${y},${z}`, { record: null }), juke.get(`${x},${y},${z}`)) } };
  const env = { world: () => world, survival: () => survival, active: () => ({ mode: "creative", allowCommands: true }), position: () => ({ x: 5.5, y: 60, z: 5.5 }),
    changed() {}, refreshInventory() {}, updateBlock() {}, destroyBlock(x, y, z) { world.set(x, y, z, 0); }, stackName: () => "s",
    signs: () => signs, music: () => music, comparators: () => comparators, dropStacks: (stacks) => dropped.push(...stacks) };
  const host = createCommandHost(env); host.print = (t) => lines.push(t);
  const runner = createCommandRunner(host);
  return { world, signs, notes, juke, comparators, dropped, run(s) { lines.length = 0; runner.run(s); return [...lines]; } };
};

test("/setblock flower_pot reads Item and Data into the pot (a fresh tile: missing keys read 0)", () => {
  const g = game();
  g.run("/setblock 5 60 5 flower_pot 0 replace {Item:38,Data:12}");
  assert.equal(g.world.get(5, 60, 5), FLOWER_POT);
  assert.deepEqual(potContents(g.world, 5, 60, 5), { id: RED_FLOWER, damage: 0, data: 12 });
  assert.match(g.run("/setblock 5 60 5 flower_pot 0 replace {Item:6}").join("\n"), /^§c/m, "same block and meta: World.setBlock is false, noChange before the tag");
  g.run("/setblock 5 60 5 flower_pot 2 replace {Item:6}");
  assert.deepEqual(g.dropped.map((s) => [s.id, s.rawDamage]), [[RED_FLOWER, 12]], "the replaced pot dropped its plant");
  assert.deepEqual(potContents(g.world, 5, 60, 5), { id: 48, damage: 0 }, "Data missing reads 0: an oak sapling");
  g.run("/setblock 6 60 5 flower_pot 0 replace {Item:0,Data:3}");
  // b84 cmdfix84 (updated: this used to assert no record): the tag read leaves an explicitly empty tile, so the metadata's plant (meta 0 here has none anyway) is not shown.
  assert.equal(potContents(g.world, 6, 60, 5), null, "Item 0 names no item: an empty pot");
  const out = g.run("/setblock 7 60 5 flower_pot 0 replace {Item:37,Foo:1,x:99}");
  assert.deepEqual(potContents(g.world, 7, 60, 5), { id: YELLOW_FLOWER, damage: 0 });
  assert.match(out.join("\n"), /Not kept in this build: Foo$/m);
});

test("/setblock sign, note block, jukebox and comparator tags", () => {
  const g = game();
  g.run('/setblock 5 60 5 standing_sign 4 replace {Text1:"hello",Text2:"a very long line of text"}');
  assert.deepEqual(g.signs.tile(5, 60, 5).text, ["hello", "a very long lin", "", ""]);
  assert.equal(g.signs.tile(5, 60, 5).editable, false);
  g.run('/setblock 5 60 5 standing_sign 5 replace {Text3:"x"}');
  assert.deepEqual(g.signs.tile(5, 60, 5).text, ["", "", "x", ""], "a fresh read: the old lines do not survive");
  g.run("/setblock 6 60 5 noteblock 0 replace {note:30b}");
  assert.equal(g.notes.get("6,60,5").note, 24);
  g.run("/setblock 7 60 5 jukebox 1 replace {RecordItem:{id:2256s,Count:1b,Damage:0s}}");
  assert.ok(g.juke.get("7,60,5").record, "a disc is kept");
  const lost = g.run("/setblock 8 60 5 jukebox 1 replace {RecordItem:{id:1s,Count:1b,Damage:0s}}");
  assert.equal(g.juke.get("8,60,5").record, null);
  assert.match(lost.join("\n"), /Not kept in this build: RecordItem/);
  g.run("/setblock 5 60 6 unpowered_comparator 0 replace {OutputSignal:9}");
  assert.equal(g.comparators.get("5,60,6").signal, 9);
  assert.equal(applySetblockTag(1, 0, 0, 0, tagOf("{a:1}"), {}), null, "stone has no tile entity here");
  assert.equal(applySetblockTag(140, 0, 0, 0, tagOf("{Item:38}"), {}), null, "a host without the store leaves the tag unread");
});

test("the server and away hosts give /setblock the tile stores and the drop hook", () => {
  const server = src("multiplayer/server-worldcmds.js"), away = src("away-commands.js"), main = src("main.js");
  assert.match(server, /signs: \(\) => sim\.tileEntities\.signs, music: \(\) => \(sim\.redstone \? musicOf\(sim\.redstone\) : null\), comparators:/);
  assert.match(away, /dropStacks, \/\/ b83 plants83/);
  assert.match(main, /signs: \(\) => signs, music: \(\) => redstoneRuntime\?\.music \?\? null/);
});

await populationBlockMapperReady;
test("away world: a command block's /setblock over a pot drops the pot's plant", async () => {
  const root = { seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], player: { time: 6000 },
    redstone: { version: 1, clock: 0, time: 0, pending: [[3, 11, 3, 137, 1, 0, 1]], events: [] },
    commandBlocks: [{ x: 3, y: 11, z: 3, command: "setblock 5 11 5 minecraft:stone", successCount: 0, customName: "@", trackOutput: true, lastOutput: "" }] };
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, 20, 2), records: [] };
  plan.chunks = cols.map(([x, z]) => {
    const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = 3;
    return { x, z, blocks, meta };
  });
  const put = (x, y, z, b, m = 0) => { const c = plan.chunks.find((k) => k.x === x >> 4 && k.z === z >> 4), i = ((x & 15) * 16 + (z & 15)) * 256 + y; c.blocks[i] = b; c.meta[i] = m; };
  put(3, 11, 3, 139); put(5, 11, 5, FLOWER_POT, 1); // meta 1: BlockFlowerPot.createNewTileEntity's poppy
  const r = await runAway(plan);
  const drops = r.entities?.drops ?? r.drops; // the entity run (on here) moves the item; without it the drop is a plain record
  assert.deepEqual(drops.map((d) => [d.stack.id, d.stack.count]), [[RED_FLOWER, 1]]);
  assert.ok(Math.abs(drops[0].x - 5.5) < 2 && Math.abs(drops[0].z - 5.5) < 3, "near the pot");
});

