// Batch 26 negstacks: Count -1/0 reads in every container tile and the player inventory, and item use at stackSize 0 or below leaving -1, -2...
// Replays public/research/neg-stacks-reference.json (tools/probes/NegStacksProbe.java, run natively on the unchanged 1.7.10 classes by
// tools/verify-neg-stacks.mjs) and public/research/attributes2-reference.json (the stackSize 0 use and rightClick records).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { NBT } from "./nbt.js";
import { Survival, ITEMS } from "./survival.js";
import { makeStack, PlayerInventory } from "./inventory.js";
import { readContainerTile, itemStackFromNbt, itemFromOriginal } from "./region-import.js";
import { placeHeldBlock } from "./block-placement-simulation.js";

const ref = JSON.parse(await readFile(new URL("../public/research/neg-stacks-reference.json", import.meta.url)));
const zero = JSON.parse(await readFile(new URL("../public/research/attributes2-reference.json", import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);
const DIAMOND = 264;
const itemTag = (id, count, slot) => new Map([["id", { type: NBT.SHORT, value: id }], ["Count", { type: NBT.BYTE, value: count }], ["Damage", { type: NBT.SHORT, value: 0 }], ["Slot", { type: NBT.BYTE, value: slot }]]);
const tileOf = (id, count, slot) => new Map([["id", { type: NBT.STRING, value: id }], ["Items", { type: NBT.LIST, value: { elementType: NBT.COMPOUND, items: [itemTag(DIAMOND, count, slot)] } }]]);

test("native: record counts and class digests", () => {
  assert.deepEqual(ref.counts, { tileRead: 16, playerRead: 6, use: 52, rightClick: 14 });
  assert.equal(ref.target, "Minecraft Java 1.7.10");
  for (const c of ["add", "abh", "aow", "apb", "apg", "aov", "yx"]) assert.match(ref.classes[c].sha256, /^[0-9a-f]{64}$/);
});

test("native and port: chests, dispensers, furnaces and brewing stands keep Count -1 and 0 on read", () => {
  const ids = { chest: ["Chest", 3, "chests"], dispenser: ["Trap", 4, "dispensers"], furnace: ["Furnace", 1, "furnaces"], brewing: ["Cauldron", 2, "brewing"] };
  for (const r of by("tileRead")) {
    assert.deepEqual([r.stack[1], r.writtenCount], [r.count, r.count], `native ${r.tile} ${r.count}`);
    const [id, slot, name] = ids[r.tile], read = readContainerTile(id, tileOf(id, r.count, slot));
    assert.equal(read.name, name);
    assert.equal(read.record.items[slot]?.count, r.count, `port ${r.tile} ${r.count}`);
  }
  assert.equal(readContainerTile("Hopper", tileOf("Hopper", -1, 2)).record.items[2].count, -1);
});

test("native and port: the main inventory keeps Count -1; plain itemStackFromNbt still refuses a non-positive count unless allowEmpty", () => {
  for (const r of by("playerRead").filter((r) => r.slot === "main")) {
    assert.equal(r.main[1], r.count);
    const port = itemFromOriginal(DIAMOND).id, inv = new PlayerInventory(ITEMS, [null, null, null, makeStack(port, r.count)]);
    assert.equal(inv.main[3]?.count, r.count, `count ${r.count}`);
    assert.equal(inv.read({ id: port, count: r.count }, true)?.count, r.count);
  }
  const tag = itemTag(DIAMOND, -1, 0);
  assert.equal(itemStackFromNbt(tag), null);
  assert.equal(itemStackFromNbt(tag, { allowEmpty: true }).count, -1);
});

// ---- use ----
const heldSurvival = (id, count) => {
  const s = new Survival({}, "survival");
  s.inventory.main[0] = makeStack(id, count);
  s.inventory.current = 0;
  return s;
};

test("native and port: every item that acts at stackSize 0 or below leaves count - 1, and only an exact 0 clears the slot", () => {
  const uses = [...by("use"), ...zero.records.filter((r) => r.case === "use" && r.count === 0)].filter((r) => r.used && !r.creative && r.after === r.count - 1);
  assert.ok(uses.length >= 20);
  for (const r of uses) {
    const s = heldSurvival(DIAMOND, r.count);
    assert.equal(s.usable(DIAMOND), true);
    assert.equal(s.take(DIAMOND), true);
    assert.equal(s.held?.count, r.after, `${r.name} ${r.count}`);
  }
  const one = heldSurvival(DIAMOND, 1);
  one.take(DIAMOND);
  assert.equal(one.held, null, "1 -> 0 clears");
  // A size-0 held stack shrinks itself, not another stack of the same item.
  const s = heldSurvival(DIAMOND, 0);
  s.inventory.main[5] = makeStack(DIAMOND, 7);
  s.take(DIAMOND);
  assert.deepEqual([s.held.count, s.inventory.main[5].count], [-1, 7]);
  assert.equal(s.count(DIAMOND), 7, "negative and empty stacks hold nothing");
});

test("native and port: food eaten at stackSize 0 leaves -1 and the next bite goes to -2", () => {
  for (const r of [...by("rightClick"), ...zero.records.filter((r) => r.case === "rightClick" && r.count === 0)].filter((r) => r.name === "apple" || r.name === "bread")) {
    const id = r.name === "apple" ? itemFromOriginal(260).id : itemFromOriginal(297).id;
    const s = heldSurvival(id, r.count);
    s.food = 10;
    assert.equal(s.eat(id, () => 0.5), true, `${r.name} ${r.count}`);
    assert.equal(s.held?.count, r.after, `${r.name} ${r.count}`);
  }
});

test("native and port: placeHeldBlock refuses stackSize 0 (ItemBlock) but places at -1", () => {
  const stop = new Error("reached the world");
  const worldStub = { get: () => { throw stop; }, getMeta: () => { throw stop; }, height: 256, inside: () => true };
  const target = { block: [0, 63, 0], adjacent: [0, 64, 0], hit: [0.5, 64, 0.5] };
  const mapped = itemFromOriginal(1, 0);
  const place = (count) => {
    const survival = heldSurvival(mapped.id, count);
    try { return placeHeldBlock({ world: worldStub, survival, position: { x: 5, y: 64, z: 5 }, flowers: [], yaw: 0, farming: { observe() {} } }, { id: mapped.id, item: null, target }); }
    catch (err) { if (err === stop) return { reason: "world" }; throw err; }
  };
  for (const r of by("use").filter((r) => r.name === "stone" && !r.creative)) assert.equal(r.used, true);
  assert.equal(place(0).reason, "empty-stack");
  assert.equal(place(-1).reason, "world");
});
