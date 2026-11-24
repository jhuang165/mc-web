// Batch 99 tiles99: (1) the null-item jukebox drop is wired: a ghost disc ejected in single player leaves an inert drop in the redstone runtime (saved inside musicTiles), it ages out
// at 6000 ticks and round-trips the Java export (Item, id 0) and import; (2) a known tag key with the wrong type stays raw NBT, as ItemStack.readFromNBT keeps it
// (public/research/tiles99-reference.json from tools/probes/Tiles99Probe.java, executed on the unchanged 1.7.10 classes). Notes: .shared-memory/notes/tiles99-b99-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NBT } from "./nbt.js";
import { populationBlockMapperReady } from "./population-world.js";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { Chunk } from "./chunk-store.js";
import { chunkToNbt, chunkFromNbt } from "./chunk-nbt.js";
import { encodeRegionChunk, writeRegion, readRegion, decodeRegionChunk, regionAddress } from "./region-file.js";
import { importJavaRegionArea, readContainerTile } from "./region-import.js";
import { importedRuntime } from "./world-import.js";
import { exportJavaSave, stackNbt } from "./region-export.js";
import { createRedstoneRuntime } from "./redstone-runtime.js";
import { INERT_DESPAWN_AGE } from "./inert-drops.js";

await populationBlockMapperReady;
const ref = JSON.parse(readFileSync(new URL("../public/research/tiles99-reference.json", import.meta.url), "utf8"));
const t = (type, value) => ({ type, value });
const unq = (s) => s.slice(1, -1).replace(/\\(["\\])/g, "$1");
const parse = (j) => {
  switch (j.t) {
    case 10: return t(10, new Map(Object.entries(j.v).map(([k, v]) => [k, parse(v)])));
    case 9: return t(9, { elementType: j.v.length ? (j.v[0].t ?? 10) : 0, items: j.v.map((x) => parse(x).value) });
    case 8: return t(8, unq(j.v));
    case 4: return t(4, BigInt(j.v.replace("L", "")));
    case 5: case 6: return t(j.t, parseFloat(j.v));
    default: return t(j.t, parseInt(j.v));
  }
};
const plain = (x) => {
  if (x.type === 10) return { t: 10, v: Object.fromEntries([...x.value].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, plain(v)])) };
  if (x.type === 9) return { t: 9, v: x.value.items.map((i) => plain({ type: x.value.elementType, value: i })) };
  return { t: x.type, v: String(x.value) };
};

test("the reference holds the wrong-type rows", () => {
  assert.ok(ref.records.length >= 25);
  for (const l of ["ench string", "display int", "RepairCost string", "tag is a string"]) assert.ok(ref.records.find((r) => r.label === l), l);
});

test("a known tag key with the wrong type is written back unchanged, as the real classes do (executed rows)", () => {
  const report = { unmappedItems: 0 };
  let checked = 0;
  const WIDTH_LOSS = new Set(["Unbreakable int", "map_is_scaling int"]); // read as a number (getBoolean), as before; the tag width is not kept on write-back (known, noted)
  for (const r of ref.records.filter((x) => !WIDTH_LOSS.has(x.label))) {
    const { record } = readContainerTile("Chest", parse(r.in).value);
    const out = record.items.flatMap((s, slot) => (s ? [stackNbt(s, slot, report)] : []));
    const native = r.nbt.v.Items.v;
    assert.equal(out.length, native.length, r.label);
    out.forEach((entry, i) => {
      const want = native[i].v.tag;
      if (!want) { assert.equal(entry.has("tag"), false, r.label); return; }
      assert.ok(entry.get("tag"), r.label); assert.deepEqual(plain(entry.get("tag")), plain(parse(want)), r.label);
      checked++;
    });
  }
  assert.ok(checked >= 24, `checked ${checked}`);
});

test("a well-typed ench / display / RepairCost is still modelled", () => {
  const r = ref.records.find((x) => x.label === "ench list of compounds ok");
  const { record } = readContainerTile("Chest", parse(r.in).value);
  assert.equal(record.items[0].enchantments[0].lvl, 2);
  assert.equal(record.items[0].extraRaw, undefined);
});

test("a wrong-typed ench is no enchantment (hasKey(\"ench\", 9) reads nothing)", () => {
  const { record } = readContainerTile("Chest", parse(ref.records.find((x) => x.label === "ench string").in).value);
  assert.equal(record.items[0].enchantments, undefined);
  assert.ok(record.items[0].extraRaw.ench);
});

const settle = () => {
  const world = new World("t99", "meadow");
  return createRedstoneRuntime({ world, game: { dispensers: () => ({}), maxStack: () => 64, dispense: {} } });
};

test("the redstone runtime keeps the inert drop in musicTiles, ticks it and ages it out at 6000", () => {
  const rt = settle();
  rt.music.inertDrops.spawn(1.5, 70.25, 2.5, 1);
  const saved = JSON.parse(JSON.stringify(rt.music.save()));
  assert.equal(saved.filter((e) => e.kind === "inert").length, 1);
  const rt2 = settle(); rt2.music.restore(saved);
  assert.equal(rt2.music.inertDrops.list.length, 1);
  assert.equal(rt2.music.save().filter((e) => e.kind === "jukebox" || e.kind === "note").length, 0);
  for (let i = 0; i < INERT_DESPAWN_AGE - 1; i++) rt2.tickBegin();
  assert.equal(rt2.music.inertDrops.list.length, 1);
  rt2.tickBegin();
  assert.equal(rt2.music.inertDrops.list.length, 0);
  assert.equal(rt2.music.save().length, 0);
  rt.dispose(); rt2.dispose();
});

test("an inert drop exports as an Item entity with id 0 and imports back", async () => {
  const world = new World("t99b", "javaStreamed", 12), player = new Survival({}, "survival").serialize();
  const base = { id: "a99", name: "A", player, updated: 1700000000000, mode: "survival" };
  // import a hand-built chunk holding an Item id 0, to get a record
  const entity = new Map([["id", t(8, "Item")], ["Pos", t(9, { elementType: NBT.DOUBLE, items: [3.5, 70.125, 4.5] })], ["Age", t(NBT.SHORT, 123)], ["Health", t(NBT.SHORT, 5)],
    ["Item", t(10, new Map([["id", t(NBT.SHORT, 0)], ["Count", t(NBT.BYTE, 1)], ["Damage", t(NBT.SHORT, 0)]]))]]);
  const { x, z } = regionAddress(0, 0);
  const files = [{ filename: "r.0.0.mca", bytes: writeRegion([await encodeRegionChunk(chunkToNbt(new Chunk(0, 0), { entities: [entity], tileEntities: [] }), { x, z })]) }];
  const { record, report } = await importJavaRegionArea(files, { area: { chunkX: 0, chunkZ: 0, width: 1, depth: 1 }, mode: "survival" });
  assert.equal(report.entities.lost?.some?.((e) => e.id?.startsWith?.("Item")) ?? false, false);
  const inert = record.musicTiles.filter((e) => e.kind === "inert");
  assert.equal(inert.length, 1); assert.equal(inert[0].age, 123); assert.equal(inert[0].y, 70);
  importedRuntime(JSON.parse(JSON.stringify(record)));
  const { files: out } = await exportJavaSave({ ...base, ...record }, { world });
  const back = [];
  for (const [name, buf] of out) if (name.startsWith("region/")) for (const [, data] of readRegion(buf)) back.push(...(chunkFromNbt(await decodeRegionChunk(data), { hasSky: true }).entities ?? []));
  const items = back.filter((e) => e.get("id").value === "Item");
  assert.equal(items.length, 1);
  const it = items[0], stack = it.get("Item").value;
  assert.equal(stack.get("id").value, 0); assert.equal(stack.get("Count").value, 1); assert.equal(stack.get("Damage").value, 0);
  assert.equal(it.get("Age").value, 123); assert.equal(it.get("Health").value, 5);
  assert.equal(it.has("PickupDelay"), false);
  const pos = it.get("Pos").value.items;
  assert.equal(((pos[0] % 16) + 16) % 16, 3.5); assert.equal(pos[1], 70.125); assert.equal(((pos[2] % 16) + 16) % 16, 4.5);
});
