// Replays public/research/item-tags2-reference.json (tools/probes/ItemTags2Probe.java via tools/verify-item-tags2.mjs, executed on the unchanged 1.7.10 jar):
// SkullOwner / TileEntitySkull Owner GameProfile NBT, the BlockSkull drop, ItemMap.addInformation and the splash potion dispenser. Also the raw Lore round trips.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NBT } from "./nbt.js";
import { itemStackFromNbt } from "./region-import.js";
import { stackNbtText } from "./item-component.js";
import { stackName } from "./item-names.js";
import { tooltipLines } from "./gui.js";
import { Survival } from "./survival.js";
import { makeStack, copyStack, sameStackItem } from "./inventory.js";
import { readItemTags, hasItemTags, stackPotionEffects } from "./item-tags.js";
import { profileFromNbt, profileToNbt, profileOfSkullTile, skullOwnerEntry, uuidText } from "./skull-profile.js";
import { Skulls, ITEM_SKULL, SKULL, SKULLS, skullDrops, placeSkull } from "./skull.js";
import { describeTiles, applyTiles } from "./tile-sync.js";
import { mapStore, createMapData, ITEM_FILLED_MAP, mapTooltipLines } from "./maps.js";
import { Dispensing } from "./dispense.js";
import { JavaRandom } from "./java-random.js";
import { World } from "./world.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs } from "./experience.js";
import { Farming } from "./farming.js";
import { Trees } from "./trees.js";
import { breakPlayerBlock } from "./block-break-simulation.js";

const read = (f) => JSON.parse(readFileSync(new URL(`../public/research/${f}`, import.meta.url), "utf8"));
const ref = read("item-tags2-reference.json"), b57 = read("item-tags-reference.json");
const tag = (type, value) => ({ type, value });
const TYPE = { b: NBT.BYTE, h: NBT.SHORT, i: NBT.INT, s: NBT.STRING };
function build([k, v]) {
  if (k === "c") return tag(NBT.COMPOUND, new Map(Object.entries(v).map(([n, d]) => [n, build(d)])));
  if (k === "l") { const items = v.map(build); return tag(NBT.LIST, { elementType: items.length ? items[0].type : NBT.END, items: items.map((t) => t.value) }); }
  return tag(TYPE[k], v);
}
const itemOf = (id, damage, t) => itemStackFromNbt(new Map([["id", tag(NBT.SHORT, id)], ["Count", tag(NBT.BYTE, 1)], ["Damage", tag(NBT.SHORT, damage)], ...(t ? [["tag", build(t)]] : [])]));
const skullStack = (owner, more = {}) => itemOf(397, 3, ["c", { SkullOwner: owner, ...more }]);
// the port's profile in the probe's JSON shape
// the native PropertyMap is a hash multimap and holds no empty keys, so keys are compared sorted
const byKey = (a, b) => (a[0] < b[0] ? -1 : 1);
const flat = (p) => p && { name: p.name, id: p.id, properties: p.properties.filter(([, v]) => v.length).map(([k, v]) => [k, v.map((x) => [x.value, x.signature ?? null])]).sort(byKey) };
const want = (p) => p && { ...p, properties: p.properties.filter(([, v]) => v.length).sort(byKey) };
const ownerTagOf = (profile) => tag(NBT.COMPOUND, profileToNbt(profile));
const full = ref.profiles.find((r) => r.name === "full");

test("SkullOwner compounds keep every field and title like the executed NBTUtil and ItemSkull", () => {
  assert.ok(ref.profiles.length >= 20);
  for (const row of ref.profiles) {
    const stack = skullStack(row.owner);
    assert.ok(stack, row.name);
    if (row.stackNbt) assert.equal(stackNbtText(stack), row.stackNbt, `${row.name}: the whole tag survives the import`);
    const profile = profileFromNbt(build(row.owner).value);
    assert.deepEqual(flat(profile) ?? null, want(row.profile) ?? null, `${row.name} profile`);
    if (profile) assert.ok(row.written, row.name);
    const title = stackName(stack, { [stack.id]: { id: stack.id, name: "Head" } });
    assert.equal(title, row.title ?? "Head", `${row.name} title`); // a profile that does not exist: native NPE, the port shows the plain head name
  }
});

test("java UUID text of the Id field", () => {
  assert.equal(uuidText("069A79F4-44E9-4726-A5BE-FCA90E38AAF5"), "069a79f4-44e9-4726-a5be-fca90e38aaf5");
  assert.equal(uuidText("not-a-uuid"), null);
});

test("TileEntitySkull reads Owner then ExtraType and writes Owner only (executed)", () => {
  for (const row of ref.tiles) {
    const entries = new Map([["SkullType", tag(NBT.BYTE, row.type)], [row.extra ? "ExtraType" : "Owner", build(row.source)]]);
    const profile = profileOfSkullTile(entries);
    assert.deepEqual(flat(profile), want(row.profile), row.name);
    const owner = skullOwnerEntry(new Skulls().create(0, 0, 0, row.type, 4, "", profile));
    assert.equal(Boolean(owner), /Owner:/.test(row.written), `${row.name} writes Owner`);
    assert.ok(!/ExtraType/.test(row.written), row.name);
  }
});

test("BlockSkull drops a player head's profile as SkullOwner, nothing for other types (executed)", () => {
  for (const row of ref.drops) {
    const profile = row.owner ? profileOfSkullTile(new Map([["SkullType", tag(NBT.BYTE, row.type)], ["Owner", build(row.owner)]])) : null;
    const [d] = skullDrops(row.type, profile);
    assert.equal(stackNbtText(makeStack(d.id, d.count, d.damage, undefined, d.tags)), row.spawned[0], row.name);
  }
});

test("a placed player head takes the item's profile; save, sync and breaking keep it", () => {
  const world = new World("skullprofile");
  world.set(5, 40, 5, 1, false, 0);
  const held = skullStack(full.owner);
  const survival = new Survival({ slots: [held] }, "creative");
  const skulls = new Skulls();
  const put = (stack, damage, x) => placeSkull({ world, survival, yaw: 0 }, { id: ITEM_SKULL, damage, stack, target: { block: [5, 40, 5], adjacent: [x, 41, 5] } }, { skulls });
  assert.equal(put(held, 3, 5).placed, true);
  const tile = skulls.tile(5, 41, 5);
  assert.deepEqual(flat(tile.profile).properties, flat(profileFromNbt(build(full.owner).value)).properties);
  assert.equal(tile.owner, "Notch");
  // a string SkullOwner is GameProfile(null, name); a head of another damage has no profile
  const named = makeStack(ITEM_SKULL, 1, 3, undefined, { skullOwner: "jeb_" });
  world.set(6, 40, 5, 1, false, 0);
  placeSkull({ world, survival, yaw: 0 }, { id: ITEM_SKULL, damage: 3, stack: named, target: { block: [6, 40, 5], adjacent: [6, 41, 5] } }, { skulls });
  assert.equal(skulls.tile(6, 41, 5).profile.name, "jeb_");
  assert.equal(skulls.tile(6, 41, 5).profile.id, null);
  world.set(4, 40, 5, 1, false, 0);
  placeSkull({ world, survival, yaw: 0 }, { id: ITEM_SKULL, damage: 1, stack: held, target: { block: [4, 40, 5], adjacent: [4, 41, 5] } }, { skulls });
  assert.equal(skulls.tile(4, 41, 5).profile, undefined);
  // saved and synced with the profile
  assert.deepEqual(Skulls.fromJSON(JSON.parse(JSON.stringify(skulls.toJSON()))).tile(5, 41, 5), tile);
  const list = JSON.parse(JSON.stringify(describeTiles({ world, skulls }, 0, 0, 0xffff))).filter((t) => t.kind === "skull");
  const replica = new Skulls();
  applyTiles(list, { world, skulls: replica });
  assert.deepEqual(replica.tile(5, 41, 5).profile, tile.profile);
});

test("breaking a placed player head in Survival drops the head with the profile", () => {
  const POS = [44, 12, 47];
  const world = new World("skullbreak");
  world.set(...POS, SKULL, false, 1);
  SKULLS.create(...POS, 3, 0, "", profileOfSkullTile(new Map([["SkullType", tag(NBT.BYTE, 3)], ["Owner", build(full.owner)]])));
  const survival = new Survival({ slots: [] }, "survival");
  const items = new ItemEntities(() => 0.5), jr = new JavaRandom(3);
  breakPlayerBlock({ world, survival, items, xpOrbs: new ExperienceOrbs([], () => 0.5), farming: new Farming(world), trees: new Trees(world, { random: new JavaRandom(3) }), heldTool: 0 }, POS, { random: () => jr.nextDouble(), dropRandom: jr, leafRandom: new JavaRandom(3) });
  SKULLS.remove(...POS);
  assert.equal(items.items.length, 1);
  assert.equal(stackNbtText(items.items[0].stack), ref.drops.find((d) => d.name === "type3_full").spawned[0]);
});

test("copies, merges and saves keep the raw SkullOwner and Lore", () => {
  const a = skullStack(full.owner, { display: ["c", { Lore: ["l", [["i", 1], ["i", 2]]] }] });
  assert.ok(a.skullRaw && a.loreRaw);
  assert.equal(a.lore, undefined);
  const b = copyStack(a);
  assert.deepEqual(b, a);
  assert.notEqual(b.skullRaw, a.skullRaw);
  assert.equal(sameStackItem(a, b), true);
  b.loreRaw = { ...b.loreRaw, v: { ...b.loreRaw.v, v: [1, 3] } };
  assert.equal(sameStackItem(a, b), false);
  assert.equal(hasItemTags(a), true);
  const saved = readItemTags(JSON.parse(JSON.stringify(a)));
  assert.deepEqual(saved.skullRaw, a.skullRaw);
  assert.deepEqual(saved.loreRaw, a.loreRaw);
  assert.equal(stackNbtText({ ...a, ...saved }), stackNbtText(a));
});

test("a Lore that is not a list of strings shows nothing and round-trips (executed rows)", () => {
  for (const name of ["loreInts", "loreString"]) {
    const row = b57.tags.find((t) => t.name === name);
    const stack = itemOf(row.id, row.damage, row.tag);
    assert.ok(stack.loreRaw, name);
    assert.equal(stack.lore, undefined, name);
    assert.equal(stackNbtText(stack), row.nbt, name);
    assert.equal(tooltipLines({ id: stack.id, name: "x" }, stack, false).length, 1, `${name} adds no Lore line`);
  }
  const strings = itemOf(276, 0, ["c", { display: ["c", { Lore: ["l", [["s", "a"]]] }] }]);
  assert.deepEqual(strings.lore, ["a"]);
  assert.equal(strings.loreRaw, undefined);
});

test("ItemMap.addInformation: scale lines with F3+H only, Unknown map without data (executed)", () => {
  for (const row of ref.maps) {
    mapStore.maps.clear();
    if (row.scale >= 0) mapStore.set(createMapData(row.damage, { scale: row.scale }));
    assert.deepEqual(mapTooltipLines(mapStore.get(row.damage), row.advanced), row.lines, `${row.damage} ${row.advanced}`);
    const stack = makeStack(ITEM_FILLED_MAP, 1, row.damage, undefined, row.named ? { displayName: row.named } : undefined);
    const lines = tooltipLines({ id: ITEM_FILLED_MAP, name: "Map" }, stack, row.advanced);
    assert.deepEqual(lines.slice(1).map((l) => l.text), row.lines, `${row.damage} ${row.advanced} tooltip`);
    if (!row.advanced && !row.named) assert.equal(lines[0].text, row.tooltip[0], "an unnamed map shows its id");
  }
  mapStore.maps.clear();
});

test("a dispenser splash potion carries the stack's CustomPotionEffects as a copy (executed)", () => {
  assert.equal(ref.dispense.length, 4);
  for (const row of ref.dispense) {
    const stack = { ...itemOf(373, row.damage, row.name.startsWith("custom") ? ["c", { CustomPotionEffects: ["l", customList(row.name)] }] : undefined), count: 1 };
    const got = [];
    const engine = new Dispensing({ thrown: (kind, e) => got.push({ kind, e }) });
    engine.entityRandom = () => new JavaRandom(4);
    engine.behaviourFor(stack).stack.call(engine, {}, 0, 0, 0, 5, stack);
    assert.equal(got[0].kind, "potion", row.name);
    const thrown = { id: 373, damage: got[0].e.damage, ...(got[0].e.custom ? { customPotionEffects: got[0].e.custom } : {}) };
    const have = (stackPotionEffects(thrown) ?? []).map((e) => [e.id, e.amplifier, e.duration, e.ambient ? 1 : 0]);
    assert.deepEqual(have, row.effects, row.name);
    if (stack.customPotionEffects?.length) assert.notEqual(got[0].e.custom[0], stack.customPotionEffects[0]);
  }
});
// the CustomPotionEffects each dispense row of the probe uses (read from its executed stack text)
function customList(name) {
  const text = ref.dispense.find((r) => r.name === name).stack;
  const rows = [...text.matchAll(/\{Ambient:(\d)b,Duration:(\d+),Id:(\d+)b,Amplifier:(\d+)b,\}/g)];
  return rows.map((m) => ["c", { Ambient: ["b", +m[1]], Duration: ["i", +m[2]], Id: ["b", +m[3]], Amplifier: ["b", +m[4]] }]);
}
