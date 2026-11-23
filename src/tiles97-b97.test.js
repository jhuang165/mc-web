// Batch 97 tiles97: item stacks keep every tag key the port does not model (ItemStack.readFromNBT keeps the whole `tag` compound) through the Java import and export of
// containers and the jukebox, container moves and the browser save; skull ExtraType offline; the null-item entity facts. Replays public/research/tiles97-reference.json
// (tools/probes/Tiles97Probe.java on the unchanged 1.7.10 classes). Notes: .shared-memory/notes/tiles97-b97-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NBT } from "./nbt.js";
import { populationBlockMapperReady } from "./population-world.js";
import { readContainerTile, jukeboxStackFromNbt, itemStackFromNbt } from "./region-import.js";
import { stackNbt } from "./region-export.js";
import { readJukeboxStack, writeJukeboxTile } from "./jukebox.js";
import { copyStack, makeStack, sameStackItem } from "./inventory.js";
import { readItemTags, hasItemTags } from "./item-tags.js";
import { profileOfSkullTile, skullOwnerEntry } from "./skull-profile.js";
import { stackTagCompound } from "./item-component.js";

await populationBlockMapperReady;
const ref = JSON.parse(readFileSync(new URL("../public/research/tiles97-reference.json", import.meta.url), "utf8"));
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
// a tag as plain comparable JSON (compound keys sorted)
const plain = (t) => {
  if (t.type === 10) return { t: 10, v: Object.fromEntries([...t.value].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, plain(v)])) };
  if (t.type === 9) return { t: 9, v: t.value.items.map((i) => plain({ type: t.value.elementType, value: i })) };
  return { t: t.type, v: String(t.value) };
};
const rec = (label) => ref.records.find((r) => r.label === label);
const input = (r) => parse(r.in).value;
const report = { unmappedItems: 0 };
const nativeItems = (r) => r.nbt.v.Items.v;
const portItems = (id, r) => {
  const { record } = readContainerTile(id, input(r));
  return record.items.flatMap((s, slot) => (s ? [[slot, stackNbt(s, slot, report)]] : []));
};

test("reference covers the unknown-key rows, the entity facts and the skull rows", () => {
  for (const l of ["jukebox extra", "chest extra", "hopper extra", "dispenser extra", "dropper extra", "furnace extra", "brewing extra", "jukebox empty tag", "skull ExtraType 3 cache miss"]) assert.ok(rec(l), l);
  assert.ok(ref.steps.length >= 8);
});

test("every container tile keeps unknown tag keys through import and export (executed rows)", () => {
  for (const [label, id] of [["chest extra", "Chest"], ["hopper extra", "Hopper"], ["dispenser extra", "Trap"], ["dropper extra", "Dropper"], ["furnace extra", "Furnace"], ["brewing extra", "Cauldron"]]) {
    const r = rec(label), native = nativeItems(r), port = portItems(id, r);
    assert.equal(port.length, native.length, label);
    for (const [slot, entry] of port) {
      const n = native.find((x) => x.v.Slot.v === `${slot}b`);
      assert.deepEqual(plain({ type: 10, value: entry.get("tag").value }), plain(parse({ t: 10, v: n.v.tag.v })), `${label} slot ${slot}`);
    }
  }
});

test("the jukebox keeps unknown tag keys, nested compounds, a long and display extras next to the modelled ones", () => {
  const r = rec("jukebox extra"), { record } = readJukeboxStack(input(r), jukeboxStackFromNbt);
  const out = writeJukeboxTile({ record }, 1, 2, 3, undefined, (s) => stackNbt(s, undefined, report));
  const tag = out.get("RecordItem").value.get("tag"), nat = r.nbt.v.RecordItem.v.tag;
  assert.deepEqual(plain(tag), plain(parse(nat)));
  assert.equal(tag.value.get("Extra").value, 7);
  assert.equal(tag.value.get("display").value.get("Name").value, "N"); // modelled keys still read
  assert.equal(record.displayName, "N");
  assert.equal(record.enchantments[0].lvl, 2);
});

test("a registered item the port cannot draw keeps its tag and Damage in a jukebox", () => {
  const item = new Map([["id", { type: NBT.SHORT, value: 119 }], ["Count", { type: NBT.BYTE, value: 2 }], ["Damage", { type: NBT.SHORT, value: 3 }],
    ["tag", { type: NBT.COMPOUND, value: new Map([["Extra", { type: NBT.INT, value: 7 }]]) }]]);
  const { record } = readJukeboxStack(new Map([["RecordItem", { type: NBT.COMPOUND, value: item }]]), jukeboxStackFromNbt);
  assert.equal(record?.rawId, 119);
  const out = writeJukeboxTile(JSON.parse(JSON.stringify({ record })), 1, 2, 3).get("RecordItem").value;
  assert.equal(out.get("Damage").value, 3);
  assert.equal(out.get("tag").value.get("Extra").value, 7);
});

test("an empty tag compound is kept and does not stack with a plain item (executed)", () => {
  const r = rec("jukebox empty tag"), { record } = readJukeboxStack(input(r), jukeboxStackFromNbt);
  const out = writeJukeboxTile({ record }, 1, 2, 3, undefined, (s) => stackNbt(s, undefined, report)).get("RecordItem").value;
  assert.equal(out.get("tag").type, NBT.COMPOUND);
  assert.equal(out.get("tag").value.size, 0);
  const chest = portItems("Chest", rec("chest empty tag"))[0][1];
  assert.equal(chest.get("tag").value.size, 0);
  const plainStack = makeStack(4, 1, 0), emptyTag = itemStackFromNbt(new Map([["id", { type: 2, value: 4 }], ["Count", { type: 1, value: 1 }], ["tag", { type: 10, value: new Map() }]]));
  assert.equal(sameStackItem(plainStack, emptyTag), false);
  assert.equal(sameStackItem(copyStack(emptyTag), emptyTag), true);
  assert.ok(stackTagCompound(emptyTag));
});

test("raw tags survive copies, container splits, equality and the JSON browser save", () => {
  const stack = portStack();
  const copy = copyStack(stack);
  assert.deepEqual(copy.extraRaw, stack.extraRaw);
  assert.notEqual(copy.extraRaw, stack.extraRaw); // deep copy
  assert.ok(sameStackItem(stack, copy));
  const other = copyStack(stack);
  other.extraRaw = { ...other.extraRaw, Extra: { t: 3, v: 8 } };
  assert.equal(sameStackItem(stack, other), false); // differing unknown tags do not merge (areItemStackTagsEqual)
  const saved = JSON.parse(JSON.stringify(stack));
  assert.deepEqual(readItemTags(saved).extraRaw, stack.extraRaw);
  assert.deepEqual(readItemTags(saved).displayExtraRaw, stack.displayExtraRaw);
  assert.ok(hasItemTags(stack));
  assert.deepEqual(plain({ type: 10, value: stackNbt(copyStack(saved), 0, report).get("tag").value }), plain(parse(rec("chest extra").in).value.get("Items").value.items[0].get("tag")));
});
function portStack() {
  const r = rec("chest extra"), { record } = readContainerTile("Chest", input(r));
  return record.items[0];
}

test("skull ExtraType offline: a player head keeps GameProfile(null, name) and writes Owner with Name only (executed, stub server cache miss)", () => {
  const t = (type, value) => ({ type, value });
  const read = (type, extra) => profileOfSkullTile(new Map([["SkullType", t(NBT.BYTE, type)], ["ExtraType", t(extra === 5 ? NBT.INT : NBT.STRING, extra)]]));
  const owner = (type, extra) => { const p = read(type, extra); const e = skullOwnerEntry({ profile: p }); return e ? plain(e) : null; };
  const nativeOwner = (label) => { const r = rec(label); return r?.nbt.v.Owner ? plain(parse(r.nbt.v.Owner)) : null; };
  assert.deepEqual(owner(3, "Notch"), nativeOwner("skull ExtraType 3 cache miss"));
  assert.deepEqual(owner(1, "Notch"), nativeOwner("skull ExtraType 1 cache miss"));
  assert.deepEqual(owner(3, ""), nativeOwner("skull ExtraType 3 empty"));
  assert.deepEqual(owner(3, 5), nativeOwner("skull ExtraType int"));
  // Owner beats ExtraType
  const both = profileOfSkullTile(new Map([["SkullType", t(NBT.BYTE, 3)], ["Owner", t(NBT.COMPOUND, new Map([["Name", t(NBT.STRING, "Alex")]]))], ["ExtraType", t(NBT.STRING, "Notch")]]));
  assert.deepEqual(plain(skullOwnerEntry({ profile: both })), nativeOwner("skull Owner and ExtraType"));
  // a cache hit would add Id and textures: only the server lookup can, so the port keeps the name
  assert.equal(parse(rec("skull ExtraType 3 cache hit textures").nbt.v.Owner).value.get("Name").value, "Notch");
});

test("null-item ItemStack entity (executed): it spawns, never merges, writes id 0 Count 1; a player cannot pick it up", () => {
  const step = (l) => ref.steps.find((s) => s.label === l);
  assert.match(step("entity new").result, /item=null size=1/);
  assert.match(step("spawn").result, /ret true spawned=1/);
  assert.match(step("merge a(xk)").result, /ret false sizes 1\/1 dead false/);
  assert.deepEqual(plain(parse(JSON.parse(step("write item compound").result))), { t: 10, v: { Count: { t: 1, v: "1" }, Damage: { t: 2, v: "0" }, id: { t: 2, v: "0" } } });
  // the port ejects nothing for it (the entity is invisible and inert natively)
  const ghost = { id: 0, ghost: true, count: 1, damage: 0 };
  assert.equal(writeJukeboxTile({ record: ghost }, 1, 2, 3).get("RecordItem").value.get("id").value, 0);
});
