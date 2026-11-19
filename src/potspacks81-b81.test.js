// Batch 81 potspacks81: pot drops and picks of the stored ItemStack(Item, 1, Data), undrawn pot items kept through import/save/export, the pot's
// Data in its S35 description, and removing stored resource packs that no longer load.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, FLOWER_POT } from "./world.js";
import {
  potFromNbt, potNbtOf, potStack, potDropEntry, potDrops, potPick, potUse, potContents, setPotContents, serializePots, restorePots,
  validPotRecord, nativeItemRegistered, potItemStack, potPlantOf,
} from "./stone-utility.js";
import { itemFromOriginal } from "./region-import.js";
import { describeCell, applyTiles, applyPotTile } from "./tile-sync.js";
import { makeStack, sameStackItem } from "./inventory.js";
import { memoryStore, unlistedPackNames, deleteUnlistedPacks } from "./resource-packs.js";

const read = (f) => JSON.parse(readFileSync(new URL(`../public/research/${f}`, import.meta.url)));
const src = (f) => readFileSync(new URL(`./${f}`, import.meta.url), "utf8");
const potRows = read("pot-sweep-reference.json").rows;
const cell = () => ({ pots: new Map(), getMeta: () => 0 });

test("the registered item set is the executed smallchecks sweep (315 ids)", () => {
  const ids = read("smallchecks-reference.json").sweep.map((r) => r.id);
  assert.equal(ids.length, 315);
  for (const id of ids) assert.ok(nativeItemRegistered(id), `${id}`);
  let n = 0;
  for (let id = -5; id <= 2300; id++) if (nativeItemRegistered(id)) n++;
  assert.equal(n, 315);
  assert.equal(potRows.find((r) => r.kind === "potSweep").items, 315);
});

test("every executed potNbt row imports with the native Item/Data and exports it unchanged", () => {
  for (const r of potRows.filter((x) => x.kind === "potNbt")) {
    const [item, data] = r.in, c = potFromNbt({ Item: item, Data: data }, itemFromOriginal);
    if (r.item === -1) { assert.equal(c, null, `${item}: Item.getItemById is null, an empty pot`); assert.deepEqual(r.out, [0, 0]); continue; }
    assert.ok(c, `${item}:${data} is kept`);
    assert.deepEqual(potNbtOf(c), { Item: r.out[0], Data: r.out[1] }, `${item}:${data}`);
    const w = cell();
    restorePots(w, JSON.parse(JSON.stringify(serializePots({ pots: new Map([["1,2,3", c]]) }))));
    assert.deepEqual(potNbtOf(potContents(w, 1, 2, 3)), { Item: r.out[0], Data: r.out[1] }, `save ${item}:${data}`);
  }
});

test("a pot holding an item the client does not draw is full, draws nothing, and breaks or picks into that item", () => {
  const w = cell();
  for (const [item, data] of [[1, 0], [338, 0], [295, 0], [175, 2], [2256, 1], [276, 7]]) {
    const c = potFromNbt({ Item: item, Data: data }, itemFromOriginal);
    assert.equal(c.id, 0);
    assert.equal(potPlantOf(c.id, c.damage), null, "chunk-mesher draws only the pot");
    setPotContents(w, 0, 0, 0, c);
    const exact = itemFromOriginal(item, data), base = itemFromOriginal(item, 0);
    const want = exact ? { id: exact.id, damage: exact.damage } : { id: base.id, damage: base.damage, rawDamage: data };
    assert.deepEqual(potStack(potContents(w, 0, 0, 0)), want, `${item}:${data}`);
    assert.deepEqual(potDrops(w, 0, 0, 0)[0], { ...want, count: 1 });
    assert.deepEqual(potPick(w, 0, 0, 0), want); // b82 pots82: rawDamage included (was { id, damage } only)
    assert.equal(potUse(w, 0, 0, 0, 43, 0), null, "a full pot takes no plant");
  }
  // Natively registered items the port has no item for (carrots block 141, end portal 119...): kept for export, nothing to drop or pick.
  const carrots = potFromNbt({ Item: 141, Data: 3 }, itemFromOriginal);
  assert.deepEqual(carrots, { id: 0, damage: 0, item: 141, data: 3 });
  setPotContents(w, 0, 0, 0, carrots);
  assert.deepEqual(potDrops(w, 0, 0, 0), [{ id: 1106, count: 1, damage: 0 }]);
  assert.deepEqual(potPick(w, 0, 0, 0), { id: 0, damage: 0 });
  assert.deepEqual(potNbtOf(potContents(w, 0, 0, 0)), { Item: 141, Data: 3 });
});

test("breakBlock's ItemStack(Item, 1, Data): a Data the catalogue has no variant for rides as rawDamage, a negative one is 0", () => {
  const cases = [
    [38, 12, { id: 44, damage: 0, rawDamage: 12 }], [37, 5, { id: 43, damage: 0, rawDamage: 5 }], [6, 9, { id: 48, damage: 0, rawDamage: 9 }],
    [31, 7, { id: 83, damage: 0, rawDamage: 7 }], [30, 4, { id: 51, damage: 0, rawDamage: 4 }], [81, 15, { id: 53, damage: 0, rawDamage: 15 }],
    [6, -1, { id: 48, damage: 0 }], [38, 4, { id: 44, damage: 4 }], [31, 2, { id: 84, damage: 0 }],
    [38, -1, { id: 44, damage: 0 }], // undrawn (the client throws on icons[-1]); the ItemStack constructor makes the damage 0
  ];
  for (const [item, data, want] of cases) {
    const c = potFromNbt({ Item: item, Data: data }, itemFromOriginal);
    assert.deepEqual(potStack(c), want, `${item}:${data}`);
    const plain = itemFromOriginal(item, Math.max(0, data));
    if (plain) assert.deepEqual(want, { id: plain.id, damage: plain.damage }, `${item}:${data} is a catalogue stack`);
    else assert.deepEqual(potItemStack(item, data, itemFromOriginal), want);
  }
  // The break paths hand rawDamage to makeStack as metadata; the stack keeps apart from the plain item (ItemStack.isItemEqual compares the damage).
  const entry = potDropEntry(potFromNbt({ Item: 38, Data: 12 }));
  assert.deepEqual(entry, { id: 44, count: 1, damage: 0, tags: { rawDamage: 12 } });
  const dropped = makeStack(entry.id, entry.count, entry.damage, undefined, entry.tags);
  assert.equal(dropped.rawDamage, 12);
  assert.equal(sameStackItem(dropped, makeStack(44, 1, 0)), false);
  assert.equal(sameStackItem(dropped, makeStack(44, 3, 0, undefined, { rawDamage: 12 })), true);
  assert.match(src("block-break-simulation.js"), /potDropEntry\(potContents\(world, \.\.\.p\)\)/);
  assert.match(src("population-blocks.js"), /potDropEntry\(potContents\(w,a,b,c\)\)/);
  assert.match(src("main.js"), /makeStack\(d\.id,d\.count,d\.damage\|\|0,undefined,d\.tags\)/);
  assert.match(src("region-import.js"), /potFromNbt\(\{ Item: get\(tile, 'Item', NBT\.INT, 0\), Data: get\(tile, 'Data', NBT\.INT, 0\) \}, itemFromOriginal\)/);
});

test("records: validation, copies, and the old shapes", () => {
  assert.equal(validPotRecord({ id: 44, damage: 3 }), true);
  assert.equal(validPotRecord({ id: 0, damage: 0, item: 1, data: 0 }), true);
  assert.equal(validPotRecord({ id: 0, damage: 0, item: 6000, data: 0 }), false);
  assert.equal(validPotRecord({ id: 0, damage: 0, item: 1 }), false);
  assert.equal(validPotRecord({ id: 1, damage: 0 }), false);
  const w = cell(), stack = { id: 1, damage: 0 };
  setPotContents(w, 0, 0, 0, { item: 1, data: 0, stack, junk: true });
  stack.id = 99;
  assert.deepEqual(potContents(w, 0, 0, 0), { id: 0, damage: 0, item: 1, data: 0, stack: { id: 1, damage: 0 } });
  setPotContents(w, 0, 0, 0, { item: 1, data: 0, stack: { id: 0, damage: 0 } });
  assert.deepEqual(potContents(w, 0, 0, 0), { id: 0, damage: 0, item: 1, data: 0 }, "a bad stack is dropped");
  assert.deepEqual(potFromNbt({ Item: 1, Data: 0 }), { id: 0, damage: 0, item: 1, data: 0 }, "no resolver: no stack");
});

test("S35 action 5 carries the pot's exact Data and undrawn item; the replica holds the same Item/Data", () => {
  const server = new World("pots81-server", "java", 9), client = new World("pots81-client", "java", 9);
  const pairs = [[37, 5], [38, 12], [31, 9], [1, 0], [338, 0], [141, 3], [48, 0]];
  pairs.forEach(([item, data], i) => {
    for (const w of [server, client]) w.put(3 + i, 70, 3, FLOWER_POT, 0, false);
    setPotContents(server, 3 + i, 70, 3, potFromNbt({ Item: item, Data: data }, itemFromOriginal));
  });
  const tiles = pairs.map((_, i) => describeCell({ world: server }, 3 + i, 70, 3));
  assert.ok(tiles.every((t) => t.kind === "pot" && t.action === 5));
  assert.deepEqual(tiles[0], { kind: "pot", action: 5, x: 3, y: 70, z: 3, id: 43, damage: 0, data: 5 });
  assert.equal(applyTiles(JSON.parse(JSON.stringify(tiles)), { world: client }), pairs.length);
  pairs.forEach(([item, data], i) => {
    const want = potNbtOf(potContents(server, 3 + i, 70, 3));
    assert.deepEqual(potNbtOf(potContents(client, 3 + i, 70, 3)), want, `${item}:${data}`);
    assert.deepEqual(potStack(potContents(client, 3 + i, 70, 3)), potStack(potContents(server, 3 + i, 70, 3)), `${item}:${data} drop/pick stack`);
  });
  // A plain plant keeps the old wire shape; an empty or broken description empties the client pot.
  setPotContents(server, 3, 70, 3, { id: 44, damage: 3 });
  assert.deepEqual(describeCell({ world: server }, 3, 70, 3), { kind: "pot", action: 5, x: 3, y: 70, z: 3, id: 44, damage: 3 });
  applyPotTile(client, { x: 3, y: 70, z: 3, id: 0, damage: 0 });
  assert.equal(client.pots.has("3,70,3"), false);
  applyPotTile(client, { x: 4, y: 70, z: 3, item: 6000, data: 1 });
  assert.equal(client.pots.has("4,70,3"), false);
});

test("stored packs that no longer load can be removed together (port choice; native lists only loadable packs)", async () => {
  const store = memoryStore();
  for (const name of ["good.zip", "broken.zip", "old.zip"]) await store.putPack({ name, kind: "zip" });
  const infos = new Map([["good.zip", { listed: true }], ["broken.zip", { listed: false }], ["old.zip", { listed: false, valid: false }]]);
  const broken = unlistedPackNames(infos);
  assert.deepEqual(broken, ["broken.zip", "old.zip"]);
  assert.deepEqual(await deleteUnlistedPacks(store, broken, ["old.zip", "good.zip"]), ["good.zip"]);
  assert.deepEqual(await store.listPacks(), ["good.zip"]);
  const ui = src("resource-packs-ui.js");
  assert.match(ui, /broken = unlistedPackNames\(infos\)/);
  assert.match(ui, /e\.code === "Delete" && !hovered && broken\.length/);
  assert.match(ui, /deleteUnlistedPacks\(store, names, lists \? lists\.names : initial\)/);
});
