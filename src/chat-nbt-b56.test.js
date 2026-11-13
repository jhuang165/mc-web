// Replays the b56 rows of public/research/chat-rarity-reference.json (tools/probes/ChatRarityProbe.java): the executed NBTTagCompound / NBTTagList
// toString and ItemStack.func_151000_E hover text for stacks with every tag the port carries, and the raw tag-type and HashMap-order compounds.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ORIGINAL_ITEMS } from "./original-items.js";
import { itemComponent, stackNbtText, nbtText, hashMapKeys } from "./item-component.js";
import { NBT } from "./nbt.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/chat-rarity-reference.json", import.meta.url)));
const liveFor = (id, damage) => ORIGINAL_ITEMS[`${id}:${damage}`] ?? ORIGINAL_ITEMS[id];
const ex = (type, colors, fade, flicker, trail) => ({ type, colors, fade, flicker, trail });
const E = (id, lvl) => ({ id, lvl });
const SPECS = {
  nbtSwordRepair: [276, 12, 1, { enchantments: [E(16, 1)], repairCost: 5, unbreakable: true }, "Sting"],
  nbtLeatherColor: [298, 0, 1, { color: 10511680 }, "Cap"],
  nbtWrittenBook: [387, 0, 1, { pages: ["a b", 'second "x"'], author: "Alex", title: "Log" }],
  nbtWritableEmpty: [386, 0, 1, { pages: [] }],
  nbtStar: [402, 0, 1, { explosion: ex(2, [16711680, 255], [65280], true, false) }],
  nbtStarEmpty: [402, 0, 1, { explosion: ex(0, [], [], false, true) }, "Spark"],
  nbtRocket: [401, 0, 64, { fireworks: { flight: 2, explosions: [ex(4, [1], [], true, true), ex(1, [2, 3], [4], false, false)] } }],
  nbtRocketEmpty: [401, 0, 3, { fireworks: { flight: 1, explosions: [] } }],
  nbtBookStored: [403, 0, 1, { storedEnchantments: [E(34, 3)], repairCost: 7, displayName: "Tome" }],
  nbtAllKeys: [276, 0, 1, { enchantments: [E(0, 4)], repairCost: 31, unbreakable: false, displayName: "All", color: 1, pages: ["p"], author: "A", title: "T", explosion: ex(3, [7], [8], true, true) }],
};
const stackOf = ([id, damage, count, extra, name]) => {
  const live = liveFor(id, damage);
  return { id: live, count, damage, ...(name ? { displayName: name } : {}), ...extra };
};

test("stack NBT text and the show_item hover equal the executed toString for every tag the port carries", () => {
  let n = 0;
  for (const [name, json, formatted, unformatted, rarity, nbt] of ref.nbt) {
    if (!name.startsWith("nbt")) continue;
    const spec = SPECS[name];
    assert.ok(spec, name);
    const stack = stackOf(spec);
    assert.equal(stackNbtText(stack), nbt, name);
    const c = itemComponent(stack, spec[4] ?? "x");
    assert.equal(c.style.hover.value.unformatted(), JSON.parse(json).hoverEvent.value, name);
    assert.equal(c.style.hover.action, "show_item");
    n++;
  }
  assert.equal(n, Object.keys(SPECS).length);
});

const T = (type, value) => ({ type, value });
const lcEntry = new Map([["lvl", T(NBT.SHORT, 2)], ["id", T(NBT.SHORT, 1)]]);
test("every tag type and the HashMap iteration order past a resize match the executed compounds", () => {
  const raw = Object.fromEntries(ref.nbt.filter((r) => r[0].startsWith("raw")));
  const m = new Map([
    ["b", T(NBT.BYTE, -3)], ["s", T(NBT.SHORT, -300)], ["i", T(NBT.INT, -70000)], ["l", T(NBT.LONG, 1n << 40n)], ["f", T(NBT.FLOAT, 1.5)], ["d", T(NBT.DOUBLE, 0.1)],
    ["str", T(NBT.STRING, 'hi "q"')], ["ba", T(NBT.BYTE_ARRAY, new Uint8Array([1, 2, 3]))], ["ia", T(NBT.INT_ARRAY, [4, -5])], ["ea", T(NBT.INT_ARRAY, [])],
    ["lf", T(NBT.LIST, { elementType: NBT.FLOAT, items: [1, 1e10] })], ["ls", T(NBT.LIST, { elementType: NBT.STRING, items: ["x", "y"] })],
    ["lc", T(NBT.LIST, { elementType: NBT.LIST, items: [{ elementType: NBT.COMPOUND, items: [lcEntry] }] })],
    ["fs", T(NBT.FLOAT, 0.001)], ["fbig", T(NBT.FLOAT, 1e7)], ["fsmall", T(NBT.FLOAT, 1e-4)], ["dbig", T(NBT.DOUBLE, 12345678.9)], ["dneg", T(NBT.DOUBLE, -2.5)],
  ]);
  assert.equal(nbtText(T(NBT.COMPOUND, m)), raw.rawTypes);
  const many = (n, p, type) => nbtText(T(NBT.COMPOUND, new Map(Array.from({ length: n }, (_, i) => [p + i, T(type, i)]))));
  assert.equal(many(13, "k", NBT.INT), raw.rawMany13);
  assert.equal(many(25, "key", NBT.SHORT), raw.rawMany25);
  assert.deepEqual(hashMapKeys(["id", "Count", "tag", "Damage"]), ["id", "Count", "tag", "Damage"]);
});
