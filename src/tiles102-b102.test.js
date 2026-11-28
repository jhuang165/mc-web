// b102 tiles102: edge tags of the tiles not yet audited (mob spawner, beacon, brewing stand, flower pot, skull, comparator, hopper, furnace, enchanting table)
// replay the written compounds of public/research/tiles102-reference.json (tools/probes/Tiles102Probe.java on the unchanged 1.7.10 classes) through the
// port's import and export. Notes: .shared-memory/notes/tiles102-b102-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NBT } from "./nbt.js";
import { nbtGet } from "./nbt-get.js";
import { populationBlockMapperReady } from "./population-world.js";
import { readSpawnerTile, readContainerTile, itemFromOriginal } from "./region-import.js";
import { spawnerTileNbt, beaconTileNbt, skullTileNbt, writeContainerTile } from "./region-export.js";
import { potFromNbt, potNbtOf, emptyPot, setPotContents, potContents, serializePots, restorePots } from "./stone-utility.js";
import { applyPotTile } from "./tile-sync.js";
import { skullBytes } from "./skull-profile.js";
import { intOf } from "./tile-ticks.js";

await populationBlockMapperReady;
const ref = JSON.parse(readFileSync(new URL("../public/research/tiles102-reference.json", import.meta.url), "utf8"));
const unq = (s) => s.slice(1, -1).replace(/\\(["\\])/g, "$1");
const parse = (j) => {
  switch (j.t) {
    case 10: return { type: 10, value: new Map(Object.entries(j.v).map(([k, v]) => [k, parse(v)])) };
    case 9: return { type: 9, value: { elementType: j.v.length ? (j.v[0].t ?? 10) : 0, items: j.v.map((x) => parse(x).value) } };
    case 8: return { type: 8, value: unq(j.v) };
    case 4: return { type: 4, value: BigInt(j.v.replace("L", "")) };
    case 5: case 6: return { type: j.t, value: parseFloat(j.v) };
    default: return { type: j.t, value: parseInt(j.v) };
  }
};
const plain = (t) => {
  if (t.type === 10) return { t: 10, v: Object.fromEntries([...t.value].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, plain(v)])) };
  if (t.type === 9) return { t: 9, v: t.value.items.map((i) => plain({ type: t.value.elementType, value: i })) };
  return { t: t.type, v: String(t.value) };
};
const loaded = (id) => ref.records.filter((r) => r.id === id && r.loaded);
const tagOf = (n, type, v) => ({ type, value: v });
const potTile = (c) => { const n = potNbtOf(c); return new Map([["id", tagOf(0, 8, "FlowerPot")], ["x", tagOf(0, 3, 1)], ["y", tagOf(0, 3, 2)], ["z", tagOf(0, 3, 3)], ["Item", tagOf(0, 3, n.Item)], ["Data", tagOf(0, 3, n.Data)]]); };
const ported = (r) => {
  const t = parse(r.in).value, id = r.id, int = (k) => nbtGet(t, k, NBT.INT, 0);
  if (id === "MobSpawner") return spawnerTileNbt(readSpawnerTile(t), 1, 2, 3);
  if (id === "Beacon") return beaconTileNbt({ primary: int("Primary"), secondary: int("Secondary"), levels: int("Levels") }, 1, 2, 3);
  if (id === "Skull") return skullTileNbt(skullBytes(Number(nbtGet(t, "SkullType", NBT.BYTE, 0)) | 0, Number(nbtGet(t, "Rot", NBT.BYTE, 0)) | 0), 1, 2, 3);
  if (id === "FlowerPot") return potTile(potFromNbt({ Item: int("Item"), Data: int("Data") }, itemFromOriginal) ?? emptyPot(int("Data")));
  const { record } = readContainerTile(id, t);
  return writeContainerTile({ Cauldron: "brewing", Hopper: "hoppers", Furnace: "furnaces" }[id], record, 1, 2, 3);
};

test("reference has every audited tile", () => {
  for (const id of ["MobSpawner", "Beacon", "Cauldron", "FlowerPot", "Skull", "Comparator", "EnchantTable", "Furnace", "Hopper"]) assert.ok(loaded(id).length >= 4, id);
  assert.ok(ref.records.length >= 190);
});

for (const id of ["MobSpawner", "Beacon", "Cauldron", "FlowerPot", "Skull", "Hopper", "Furnace"]) {
  test(`${id} edge tags write back as the native tile writes them`, () => {
    for (const r of loaded(id)) assert.deepEqual(plain({ type: 10, value: ported(r) }), plain(parse(r.nbt)), r.label);
  });
}

test("comparator OutputSignal and enchanting table CustomName read as the native tiles", () => {
  for (const r of loaded("Comparator")) assert.equal(intOf(parse(r.in).value.get("OutputSignal")), parseInt(r.nbt.v.OutputSignal.v), r.label);
  for (const r of loaded("EnchantTable")) {
    const name = nbtGet(parse(r.in).value, "CustomName", NBT.STRING, "");
    assert.equal(name.length > 0 ? name : undefined, r.nbt.v.CustomName ? unq(r.nbt.v.CustomName.v) : undefined, r.label);
  }
});

test("a spawner potential's long Weight is read as getInteger", () => {
  const r = ref.records.find((x) => x.label === "potentials weight long");
  assert.equal(parseInt(r.nbt.v.SpawnPotentials.v[0].v.Weight.v), 4);
  assert.equal(spawnerTileNbt(readSpawnerTile(parse(r.in).value), 1, 2, 3).get("SpawnPotentials").value.items[0].get("Weight").value, 4);
});

test("an empty flower pot tile keeps its Data through save, sync and /setblock", () => {
  const world = { pots: undefined };
  setPotContents(world, 1, 2, 3, emptyPot(7));
  assert.equal(potContents({ pots: world.pots, getMeta: () => 1 }, 1, 2, 3), null); // not the metadata's plant
  assert.deepEqual(potNbtOf(world.pots.get("1,2,3")), { Item: 0, Data: 7 });
  const again = { pots: undefined };
  restorePots(again, JSON.parse(JSON.stringify(serializePots(world))));
  assert.deepEqual(potNbtOf(again.pots.get("1,2,3")), { Item: 0, Data: 7 });
  const client = { pots: undefined };
  applyPotTile(client, { x: 1, y: 2, z: 3, empty: true, data: 7, id: 0, damage: 0 });
  assert.deepEqual(potNbtOf(client.pots.get("1,2,3")), { Item: 0, Data: 7 });
});
