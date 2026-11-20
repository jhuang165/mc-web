// Batch 86 awaystore86: the away run's tile stores. doTileDrops gates the skull break and the other dropBlockAsItem paths; sign, beacon, flower pot and note block
// tiles go into the run and come back; a sign whose support goes pops; a beacon rechecks its pyramid every 80 total ticks while the gate is open.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";
import { SKULL, ITEM_SKULL } from "./skull.js";
import { SIGN_POST, ITEM_SIGN } from "./signs.js";
import { BEACON } from "./pyramid.js";
import { FLOWER_POT } from "./stone-utility.js";
import { YELLOW_FLOWER, ENCHANTING_TABLE } from "./world.js";
import { gameRule, setGameRuleSource } from "./game-rules.js";

await populationBlockMapperReady;
const src = (f) => readFileSync(new URL(`./${f}`, import.meta.url), "utf8");
const STONE = 3, COMMAND_BLOCK = 139, IRON_BLOCK = 26;
const floorChunks = (cols) => cols.map(([x, z]) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  return { x, z, blocks, meta };
});
const setBlock = (chunks, x, y, z, b, m = 0) => {
  const c = chunks.find((k) => k.x === x >> 4 && k.z === z >> 4), i = ((x & 15) * 16 + (z & 15)) * 256 + y;
  c.blocks[i] = b; c.meta[i] = m;
};
// One command block per command at (3 + 2i, 11, 3), each fired by a pending tick at time i + 1 (so they run in order).
const root = (commands, extra = {}) => ({ seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], player: { time: 6000 },
  redstone: { version: 1, clock: 0, time: 0, pending: commands.map((_, i) => [3 + 2 * i, 11, 3, 137, i + 1, 0, i + 1]), events: [] },
  commandBlocks: commands.map((command, i) => ({ x: 3 + 2 * i, y: 11, z: 3, command, successCount: 0, customName: "@", trackOutput: true, lastOutput: null })), ...extra });
const run = (r, ticks = 20, edit = () => {}, planExtra = {}) => {
  const cols = stateColumns(r), plan = { ...awayPlan(r, cols, ticks, 2), chunks: floorChunks(cols), records: [], ...planExtra };
  r.commandBlocks.forEach((c) => setBlock(plan.chunks, c.x, c.y, c.z, COMMAND_BLOCK));
  edit(plan.chunks);
  return runAway(plan);
};
const dropped = (r, id) => (r.entities?.drops ?? r.drops).map((d) => d.stack ?? d).filter((s) => s.id === id);

test("doTileDrops: the away skull break honours the saved rule and a /gamerule the run fires", async () => {
  const skulls = [{ x: 5, y: 11, z: 9, type: 1, rot: 0, owner: "" }];
  const place = (ch) => setBlock(ch, 5, 11, 9, SKULL, 1);
  const on = await run(root(["setblock 5 11 9 minecraft:stone"], { skulls }), 20, place);
  assert.equal(dropped(on, ITEM_SKULL).length, 1, "the default rule drops the skull (pickup85)");
  const saved = await run(root(["setblock 5 11 9 minecraft:stone"], { skulls, gameRules: { doTileDrops: "false" } }), 20, place);
  assert.equal(dropped(saved, ITEM_SKULL).length, 0, "Block.dropBlockAsItem returns at once without doTileDrops");
  assert.deepEqual(saved.skulls, [], "the tile goes either way (BlockContainer.breakBlock)");
  const fired = await run(root(["gamerule doTileDrops false", "setblock 5 11 9 minecraft:stone"], { skulls }), 20, place);
  assert.equal(dropped(fired, ITEM_SKULL).length, 0, "the run's own /gamerule applies on the next read");
  assert.equal(fired.world.gameRules.doTileDrops, "false");
});

test("the run's rule source is put back afterwards", async () => {
  const mine = (name) => name === "doTileDrops" ? false : true, was = setGameRuleSource(mine);
  try {
    await run(root(["gamerule doTileDrops true"]));
    assert.equal(gameRule("doTileDrops"), false);
  } finally { setGameRuleSource(was); }
});

test("signs: a replaced sign loses its tile, the others keep their text and come back", async () => {
  const signs = [{ x: 5, y: 11, z: 9, text: ["a", "", "", ""] }, { x: 7, y: 11, z: 9, text: ["keep", "me", "", ""] }];
  const r = await run(root(["setblock 5 11 9 minecraft:stone"], { signs }), 20, (ch) => { setBlock(ch, 5, 11, 9, SIGN_POST); setBlock(ch, 7, 11, 9, SIGN_POST); });
  assert.deepEqual(r.signs, [{ x: 7, y: 11, z: 9, text: ["keep", "me", "", ""] }]);
  assert.equal(dropped(r, ITEM_SIGN).length, 0, "BlockSign has no breakBlock drop: /setblock replaces it without an item");
});

test("signs: /setblock writes the run's store; a sign set over a sign with other metadata starts empty", async () => {
  const signs = [{ x: 5, y: 11, z: 9, text: ["old", "", "", ""] }];
  const r = await run(root(['setblock 7 11 9 minecraft:standing_sign 0 replace {Text1:"hi"}', "setblock 5 11 9 minecraft:standing_sign 4"], { signs }), 20, (ch) => setBlock(ch, 5, 11, 9, SIGN_POST));
  const at = (x) => r.signs.find((t) => t.x === x);
  assert.equal(at(7)?.text[0], "hi", "the data tag lands in the run's store (it went to no store before)");
  assert.deepEqual(at(5)?.text, ["", "", "", ""], "Chunk.func_150807_a: breakBlock on a metadata change, then a fresh TileEntitySign");
});

test("signs: a sign whose support goes pops with its item, under doTileDrops", async () => {
  const signs = [{ x: 5, y: 12, z: 9, text: ["up", "", "", ""] }];
  const edit = (ch) => { setBlock(ch, 5, 11, 9, STONE); setBlock(ch, 5, 12, 9, SIGN_POST); };
  const r = await run(root(["setblock 5 11 9 minecraft:air"], { signs }), 20, edit);
  assert.equal(dropped(r, ITEM_SIGN).length, 1, "BlockSign.onNeighborBlockChange: dropBlockAsItem, then air");
  assert.deepEqual(r.signs, []);
  assert.ok(r.columns.length, "the popped cell is an edit");
  const off = await run(root(["setblock 5 11 9 minecraft:air"], { signs, gameRules: { doTileDrops: "false" } }), 20, edit);
  assert.equal(dropped(off, ITEM_SIGN).length, 0);
  assert.deepEqual(off.signs, []);
});

// A level-1 pyramid: 3 x 3 iron under the beacon at (5, 11, 9), open sky above.
const pyramid = (ch) => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) setBlock(ch, 5 + dx, 10, 9 + dz, IRON_BLOCK); setBlock(ch, 5, 11, 9, BEACON); };
test("beacons: the 80-tick pyramid check runs on the total time while the gate is open, and the tile comes back", async () => {
  const beacons = [{ x: 5, y: 11, z: 9, primary: 1, secondary: 0, levels: -1 }];
  // total time at tick n is totalTime - (ticks - n - 1): 901 + n, so tick 59 sees 960, a multiple of 80.
  const r = await run(root(["say hi"], { beacons }), 100, pyramid, { totalTime: 1000 });
  assert.deepEqual(r.beacons, [{ x: 5, y: 11, z: 9, primary: 1, secondary: 0, levels: 1 }]);
  const none = await run(root(["say hi"], { beacons }), 30, pyramid, { totalTime: 1000 }); // 971 .. 1000: no multiple of 80
  assert.equal(none.beacons[0].levels, -1);
});

test("beacons: a broken pyramid reads level 0 at the next check, a replaced beacon loses its tile, /setblock makes one", async () => {
  const beacons = [{ x: 5, y: 11, z: 9, primary: 1, secondary: 0, levels: 1 }, { x: 9, y: 11, z: 9, primary: 3, secondary: 0, levels: 0 }];
  const r = await run(root(["setblock 5 10 9 minecraft:stone", "setblock 9 11 9 minecraft:stone", "setblock 11 11 9 minecraft:beacon 0 replace {Primary:5}"], { beacons }), 100,
    (ch) => { pyramid(ch); setBlock(ch, 9, 11, 9, BEACON); }, { totalTime: 1000 });
  const at = (x) => r.beacons.find((t) => t.x === x);
  assert.equal(at(5).levels, 0, "aoq.y over the broken layer");
  assert.equal(at(5).primary, 1, "Primary stays (only the MC|Beacon packet changes it)");
  assert.equal(at(9), undefined, "BlockContainer.breakBlock removed the tile");
  assert.equal(at(11)?.primary, 5, "the run's store took the data tag");
});

test("beacon columns join a run with work, and only then", () => {
  const beacons = [{ x: 40, y: 11, z: 40, primary: 0, secondary: 0, levels: 1 }];
  assert.deepEqual(stateColumns({ worldSpawn: [0, 64, 0], beacons }), []);
  const cols = stateColumns(root(["say hi"], { beacons })).map(([x, z]) => `${x},${z}`);
  assert.ok(cols.includes("2,2"), "the beacon's column");
});

test("flower pots: a pot replaced in the run drops its plant and leaves world.pots; the list comes back", async () => {
  const pots = [{ x: 5, y: 11, z: 9, id: YELLOW_FLOWER, damage: 0 }, { x: 7, y: 11, z: 9, id: YELLOW_FLOWER, damage: 0 }];
  const r = await run(root(["setblock 5 11 9 minecraft:stone"], { pots }), 20, (ch) => { setBlock(ch, 5, 11, 9, FLOWER_POT); setBlock(ch, 7, 11, 9, FLOWER_POT); });
  assert.equal(dropped(r, YELLOW_FLOWER).length, 1, "BlockFlowerPot.breakBlock drops the stored plant (the run had no pots before)");
  assert.deepEqual(r.pots.map((p) => p.x), [7]);
});

test("note blocks: the saved pitch goes into the run and comes back", async () => {
  const r = await run(root(["say hi"], { musicTiles: [{ kind: "note", x: 70, y: 11, z: 70, note: 7 }] }));
  assert.deepEqual(r.musicTiles, [{ kind: "note", x: 70, y: 11, z: 70, note: 7 }], "a tile outside the run's columns is kept as it was");
});

test("sources: the main thread writes the stores back and passes the clock", () => {
  const live = src("dimension-live.js");
  assert.match(live, /\["signs", "beacons", "pots", "musicTiles"\]/);
  assert.match(live, /totalTime: this\.clock\(root\)/);
  assert.match(src("away-world.js"), /commandHost: \(\) => cmds\.host,/);
  assert.doesNotMatch(src("away-world.js"), /second offset sound\(\) \{\}/, "b84's comment no longer swallows the game hooks");
});

test("enchanting tables: a table replaced in the run loses its CustomName; worlds without names gain no map", async () => {
  const r = await run(root(["setblock 5 11 9 minecraft:stone"], { player: { time: 6000, tableNames: { "5,11,9": "Gone", "7,11,9": "Kept" } } }), 20,
    (ch) => { setBlock(ch, 5, 11, 9, ENCHANTING_TABLE); setBlock(ch, 7, 11, 9, ENCHANTING_TABLE); });
  assert.deepEqual(r.tiles.tableNames, { "7,11,9": "Kept" });
  assert.equal((await run(root(["say hi"]))).tiles.tableNames, undefined);
});
