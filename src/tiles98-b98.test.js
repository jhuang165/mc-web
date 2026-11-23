// Batch 98 tiles98: raw unknown tag keys (extraRaw, displayExtraRaw) survive hand-built stack copies (mob equipment, cart items, item text); the command block
// and sign save/load/export round trip against public/research/tiles95-reference.json (executed on the real classes); the inert EntityItem of a null-item jukebox stack.
// Notes: .shared-memory/notes/tiles98-b98-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NBT } from "./nbt.js";
import { populationBlockMapperReady } from "./population-world.js";
import { readSignTile } from "./region-import.js";
import { readCommandBlock, writeCommandBlock, installCommandBlocks } from "./command-block.js";
import { Signs } from "./signs.js";
import { skullFields, saveGear, readGear, emptyGear, cloneStack } from "./mob-equipment.js";
import { Minecarts } from "./minecarts.js";
import { stackTagCompound, stackNbtText } from "./item-component.js";
import { InertDrops, inertDropNbt, INERT_DESPAWN_AGE } from "./inert-drops.js";
import { installJukeboxes, readJukeboxStack } from "./jukebox.js";

await populationBlockMapperReady;
const ref = JSON.parse(readFileSync(new URL("../public/research/tiles95-reference.json", import.meta.url), "utf8"));
const unq = (s) => s.slice(1, -1).replace(/\\(["\\])/g, "$1");
const parse = (j) => {
  switch (j.t) {
    case 10: return { type: 10, value: new Map(Object.entries(j.v).map(([k, v]) => [k, parse(v)])) };
    case 9: return { type: 9, value: { elementType: 0, items: [] } };
    case 8: return { type: 8, value: unq(j.v) };
    case 4: return { type: 4, value: BigInt(j.v.replace("L", "")) };
    default: return { type: j.t, value: parseInt(j.v) };
  }
};
const RAW = { Extra: { t: 3, v: 7 }, Deep: { t: 10, v: [["a", { t: 1, v: 1 }]] } };
const DISP = { Foo: { t: 8, v: "bar" } };
const SWORD = { id: 267, count: 1, damage: 0, extraRaw: RAW, displayExtraRaw: DISP };

test("skullFields and mob gear keep the raw unknown tag keys (deep copies)", () => {
  const f = skullFields(SWORD);
  assert.deepEqual(f.extraRaw, RAW); assert.deepEqual(f.displayExtraRaw, DISP);
  assert.notEqual(f.extraRaw, RAW);
  const gear = emptyGear(); gear.equipment[0] = { ...SWORD };
  const back = readGear(JSON.parse(JSON.stringify(saveGear(gear))));
  assert.deepEqual(back.equipment[0].extraRaw, RAW); assert.deepEqual(back.equipment[0].displayExtraRaw, DISP);
  assert.deepEqual(skullFields({ id: 1 }), {});
});

test("a cart item keeps extraRaw and displayExtraRaw through put and toNBT, an empty tag compound stays", () => {
  const carts = new Minecarts();
  const cart = carts.spawnCart(1, { x: 0, y: 64, z: 0, items: [] }, { seed: 1 });
  carts.put(cart, 0, { ...SWORD });
  carts.put(cart, 1, { id: 267, count: 1, damage: 0, extraRaw: {} });
  carts.put(cart, 2, { id: 267, count: 1, damage: 0 });
  const items = carts.toNBT(cart).Items[2];
  const tag = items[0].tag[1];
  assert.deepEqual(tag.Extra, [3, 7]);
  assert.deepEqual(tag.Deep, [10, { a: [1, 1] }]);
  assert.deepEqual(tag.display[1].Foo, [8, "bar"]);
  assert.deepEqual(items[1].tag, [10, {}]);
  assert.equal(items[2].tag, undefined);
});

test("item text (show_item) carries the raw tag keys, display ones inside display", () => {
  const t = stackTagCompound(SWORD);
  assert.equal(t.value.get("Extra").value, 7);
  assert.equal(t.value.get("display").value.get("Foo").value, "bar");
  assert.match(stackNbtText(SWORD), /Extra:7/);
  assert.match(stackNbtText(SWORD), /Foo:"bar"/);
  assert.equal(stackTagCompound({ id: 267, count: 1, damage: 0, extraRaw: {} }).value.size, 0);
});

const redstone = { registerBehaviour() {}, loaded: () => true, getBlock: () => 137 };
test("command block LastOutput, SuccessCount, TrackOutput survive read, browser save (JSON), restore and write (executed records)", () => {
  const rows = ref.records.filter((r) => r.id === "Control" && r.loaded);
  assert.ok(rows.length >= 13);
  for (const r of rows) {
    const cb = installCommandBlocks(redstone, { host: () => ({}) });
    Object.assign(cb.tile(1, 2, 3), readCommandBlock(parse(r.in).value));
    cb.restore(JSON.parse(JSON.stringify(cb.save())));
    const out = writeCommandBlock(cb.get(1, 2, 3), 1, 2, 3), w = r.nbt.v;
    for (const k of ["Command", "CustomName", "SuccessCount", "TrackOutput", "LastOutput"]) {
      const want = w[k] ? (w[k].t === 8 ? unq(w[k].v) : parseInt(w[k].v)) : undefined;
      assert.equal(out.get(k)?.value, want, `${r.label} ${k}`);
    }
  }
});

test("sign text survives read, browser save and restore (cut to 15, lone surrogate kept)", () => {
  for (const r of ref.records.filter((r) => r.id === "Sign" && r.loaded)) {
    const text = readSignTile(parse(r.in).value), s = new Signs();
    s.tiles.set("1,2,3", { x: 1, y: 2, z: 3, text, editable: false });
    const back = Signs.fromJSON(JSON.parse(JSON.stringify(s.toJSON()))).tile(1, 2, 3);
    assert.deepEqual(back.text, text, r.label); assert.equal(back.editable, false);
  }
});

test("a null-item jukebox stack ejects an inert drop that ages out at 6000 and saves as Item id 0", () => {
  const ghost = readJukeboxStack(new Map([["Record", { type: NBT.INT, value: 5000 }]]), () => null).record;
  assert.equal(ghost.ghost, true);
  const inert = new InertDrops(), spawned = [];
  const rs = { registerBehaviour() {}, loaded: () => true, getBlock: () => 84, getBlockMetadata: () => 1, setBlockMetadataWithNotify() {}, rand: { nextFloat: () => 0.5 } };
  const j = installJukeboxes(rs, { spawn: (s) => spawned.push(s), spawnInert: (x, y, z, n) => inert.spawn(x, y, z, n) });
  j.restore([{ x: 1, y: 2, z: 3, record: ghost }]);
  assert.equal(j.eject(1, 2, 3), true);
  assert.equal(spawned.length, 0); assert.equal(inert.list.length, 1);
  const d = inert.list[0], nbt = inertDropNbt(d);
  assert.equal(d.pickupDelay, 10);
  assert.equal(nbt.get("Item").value.get("id").value, 0); assert.equal(nbt.get("Item").value.get("Count").value, 1);
  const copy = new InertDrops(); copy.restore(JSON.parse(JSON.stringify(inert.save())));
  assert.deepEqual(copy.list, inert.list);
  for (let i = 0; i < INERT_DESPAWN_AGE - 1; i++) inert.tick();
  assert.equal(inert.list.length, 1); assert.equal(inert.list[0].pickupDelay, 0);
  inert.tick();
  assert.equal(inert.list.length, 0);
});
