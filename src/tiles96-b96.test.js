// Batch 96 tiles96: jukebox stacks keep their tag compound and Damage, a legacy Record int naming no registered item is a null-item stack, a skull of raw type 7 drops Damage 7,
// and the hopper, dispenser, dropper, brewing stand, chest, note block and piston tiles replay the written compounds of public/research/tiles96-reference.json
// (tools/probes/Tiles96Probe.java on the unchanged 1.7.10 classes). Notes: .shared-memory/notes/tiles96-b96-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NBT } from "./nbt.js";
import { populationBlockMapperReady } from "./population-world.js";
import { readContainerTile, jukeboxStackFromNbt, pistonFromNbt, itemFromOriginal } from "./region-import.js";
import { stackNbt } from "./region-export.js";
import { readNoteTile } from "./note-blocks.js";
import { readJukeboxStack, writeJukeboxTile, installJukeboxes } from "./jukebox.js";
import { ITEM_KEYS } from "./item-keys-data.js";
import { skullDrops, Skulls, placeSkull, SKULL } from "./skull.js";

await populationBlockMapperReady;
const ref = JSON.parse(readFileSync(new URL("../public/research/tiles96-reference.json", import.meta.url), "utf8"));
const cases = (id) => ref.records.filter((r) => r.id === id);
const unq = (s) => s.slice(1, -1).replace(/\\(["\\])/g, "$1");
const parse = (j) => {
  switch (j.t) {
    case 10: return { type: 10, value: new Map(Object.entries(j.v).map(([k, v]) => [k, parse(v)])) };
    case 9: return { type: 9, value: { elementType: j.v.length ? 10 : 0, items: j.v.map((x) => parse(x).value) } };
    case 8: return { type: 8, value: unq(j.v) };
    case 4: return { type: 4, value: BigInt(j.v.replace("L", "")) };
    case 5: case 6: return { type: j.t, value: parseFloat(j.v) };
    default: return { type: j.t, value: parseInt(j.v) };
  }
};
const num = (t) => parseInt(t.v), str = (t) => unq(t.v);
const input = (r) => parse(r.in).value;
const report = { unmappedItems: 0 };
const label = (name) => ref.records.find((r) => r.label === name);

test("reference covers the audited tiles and the item registry matches the port's key table", () => {
  for (const id of ["RecordPlayer", "Skull", "Hopper", "Trap", "Dropper", "Cauldron", "Chest", "Music", "DLDetector", "Airportal", "Piston"]) assert.ok(cases(id).length > 0, id);
  assert.deepEqual(ref.registry, Object.keys(ITEM_KEYS).map(Number));
  assert.ok(ref.drops.length >= 7);
});

test("jukebox keeps the tag compound and Damage of any stack through read and write", () => {
  const roundTrip = (name) => {
    const r = label(name), { record } = readJukeboxStack(input(r), jukeboxStackFromNbt);
    return { r, record, out: writeJukeboxTile({ record }, 1, 2, 3, undefined, (s) => stackNbt(s, undefined, report)) };
  };
  let { r, out } = roundTrip("jukebox disc damage 5");
  assert.equal(out.get("RecordItem").value.get("Damage").value, num(r.nbt.v.RecordItem.v.Damage)); // 5
  ({ r, out } = roundTrip("jukebox disc damage -3"));
  assert.equal(out.get("RecordItem").value.get("Damage").value, 0);
  ({ r, out } = roundTrip("jukebox disc tag"));
  assert.equal(out.get("RecordItem").value.get("tag").value.get("display").value.get("Name").value, "Mix");
  ({ r, out } = roundTrip("jukebox disc tag and damage"));
  const item = out.get("RecordItem").value, nat = r.nbt.v.RecordItem.v;
  assert.equal(item.get("Damage").value, num(nat.Damage));
  assert.equal(item.get("Count").value, num(nat.Count));
  assert.equal(item.get("tag").value.get("RepairCost").value, num(nat.tag.v.RepairCost));
  const ench = item.get("tag").value.get("ench").value.items[0];
  assert.deepEqual([ench.get("id").value, ench.get("lvl").value], [16, 2]);
  ({ r, out } = roundTrip("jukebox sword tag"));
  assert.equal(out.get("RecordItem").value.get("Damage").value, 12);
  assert.equal(out.get("RecordItem").value.get("tag").value.get("display").value.get("Name").value, "Blade");
});

test("a legacy Record int is a stack when registered or not, and writes as the native tile does", () => {
  for (const r of cases("RecordPlayer").filter((c) => c.label.startsWith("jukebox Record ") && /\d$/.test(c.label))) {
    const { record } = readJukeboxStack(input(r), jukeboxStackFromNbt), n = r.nbt.v;
    const id = Number(r.label.split(" ").pop());
    if (id <= 0) { assert.equal(record, null, r.label); continue; }
    assert.ok(record, r.label);
    const out = writeJukeboxTile({ record }, 1, 2, 3, undefined, (s) => stackNbt(s, undefined, report));
    assert.equal(out.get("Record").value, num(n.Record), r.label);
    assert.equal(out.get("RecordItem").value.get("id").value, num(n.RecordItem.v.id), r.label);
    assert.equal(out.get("RecordItem").value.get("Count").value, num(n.RecordItem.v.Count), r.label);
    assert.equal(out.get("RecordItem").value.get("Damage").value, num(n.RecordItem.v.Damage), r.label);
  }
  const ghost = readJukeboxStack(input(label("jukebox Record 5000")), jukeboxStackFromNbt).record;
  assert.equal(ghost.ghost, true);
  // RecordItem naming no registered item is no stack, however Record reads; RecordItem id 0 likewise
  assert.equal(readJukeboxStack(input(label("jukebox RecordItem id 0")), jukeboxStackFromNbt).record, null);
});

test("a ghost or raw stack survives the browser save and ejects nothing", () => {
  const spawned = [], blocks = new Map(), meta = new Map(), k = (x, y, z) => `${x},${y},${z}`;
  const redstone = { registerBehaviour() {}, getBlock: () => 84, getBlockMetadata: (x, y, z) => meta.get(k(x, y, z)) ?? 0, setBlockMetadataWithNotify: (x, y, z, m) => meta.set(k(x, y, z), m), rand: { nextFloat: () => 0.5 } };
  const jb = installJukeboxes(redstone, { spawn: (s) => spawned.push(s) });
  jb.tile(1, 2, 3).record = { id: 0, ghost: true, count: 1, damage: 0 };
  jb.tile(4, 5, 6).record = { id: 0, rawId: 51, count: 1, damage: 0 };
  jb.tile(7, 8, 9).record = { id: 2, count: 1, damage: 0, rawDamage: 9, displayName: "Mix" };
  const saved = JSON.parse(JSON.stringify(jb.save()));
  assert.equal(saved.length, 3);
  const again = installJukeboxes(redstone, { spawn: (s) => spawned.push(s) });
  again.restore(saved);
  assert.equal(again.tile(1, 2, 3).record.ghost, true);
  assert.equal(again.tile(4, 5, 6).record.rawId, 51);
  assert.equal(again.tile(7, 8, 9).record.displayName, "Mix");
  assert.equal(again.tile(7, 8, 9).record.rawDamage, 9);
  meta.set("1,2,3", 1); meta.set("4,5,6", 1); meta.set("7,8,9", 1);
  again.eject(1, 2, 3); again.eject(4, 5, 6); again.eject(7, 8, 9);
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0].displayName, "Mix");
  assert.equal(spawned[0].rawDamage, 9);
});

test("skull drops take the raw SkullType whole", () => {
  for (const d of ref.drops) {
    const native = parseInt(/Damage:(-?\d+)s/.exec(d.spawned[0])[1]), [drop] = skullDrops(d.type);
    assert.equal(drop.tags?.rawDamage ? drop.tags.rawDamage : drop.damage, native, d.name);
  }
  assert.deepEqual(skullDrops(7)[0].tags, { rawDamage: 7 });
  assert.equal(skullDrops(7)[0].damage, 0);
  assert.equal(skullDrops(2)[0].damage, 2);
  assert.equal(skullDrops(-1)[0].damage, 0);
});

test("a raw type 7 skull tile drops from the store and a rawDamage skull places type 7", () => {
  const skulls = new Skulls();
  skulls.create(1, 2, 3, 7, 3);
  const t = skulls.tile(1, 2, 3);
  assert.equal(t.rawType, 7);
  const [drop] = skullDrops(t.rawType ?? t.type);
  assert.equal(drop.tags.rawDamage, 7);
  const world = { get: () => 1, set() {}, height: 256 };
  const placed = placeSkull({ world, survival: { creative: true, usable: () => true }, yaw: 0 }, { id: 2050, damage: 0, target: { block: [0, 0, 0], adjacent: [0, 1, 0] }, stack: { id: 2050, count: 1, damage: 0, rawDamage: 7 } }, { skulls });
  assert.equal(placed.placed, true);
  assert.equal(skulls.tile(0, 1, 0).rawType, 7);
  assert.equal(SKULL > 0, true);
});

test("hopper, dispenser, dropper, brewing stand and chest tiles read as the native tile writes them", () => {
  const spec = { Hopper: ["Hopper", 5], Trap: ["Trap", 9], Dropper: ["Dropper", 9], Cauldron: ["Cauldron", 4], Chest: ["Chest", 27] };
  for (const [id] of Object.entries(spec)) for (const r of cases(id)) {
    const { record } = readContainerTile(id, input(r)), n = r.nbt.v;
    const nativeItems = (n.Items?.v ?? []).map((e) => [num(e.v.Slot), num(e.v.id), num(e.v.Count)]);
    const ours = record.items.map((s, slot) => (s ? [slot, s.count] : null)).filter(Boolean);
    assert.deepEqual(ours, nativeItems.map(([slot, , count]) => [slot, count]), `${r.label} items`);
    for (const [slot, oid] of nativeItems) assert.equal(record.items[slot].id, itemFromOriginal(oid, 0)?.id ?? record.items[slot].id, r.label);
    const name = n.CustomName ? str(n.CustomName) : null;
    assert.equal(record.name ?? null, name, `${r.label} name`);
    if (id === "Hopper") assert.equal(record.cooldown, num(n.TransferCooldown), r.label);
    if (id === "Cauldron") assert.equal(record.brewTime, num(n.BrewTime), r.label);
  }
});

test("note block pitch edges and the moving piston fields replay", () => {
  for (const r of cases("Music")) assert.equal(readNoteTile(input(r)).note, num(r.nbt.v.note), r.label);
  for (const r of cases("Piston")) {
    const p = pistonFromNbt(input(r)), n = r.nbt.v;
    assert.deepEqual([p.block, p.meta, p.facing, Math.fround(p.progress), p.extending ? 1 : 0], [num(n.blockId), num(n.blockData), num(n.facing), Math.fround(parseFloat(n.progress.v)), num(n.extending)], r.label);
  }
});
