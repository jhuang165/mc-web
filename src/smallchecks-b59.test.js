import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { comparatorToggle, comparatorShouldBePowered } from "./comparator-toggle.js";
import { advancedTitleSuffix, SUBTYPE_ORIGINAL_IDS } from "./advanced-tooltip-id.js";
import { tooltipLines } from "./gui.js";
import { ORIGINAL_ITEMS } from "./original-items.js";
import { PlayerMotion, nextYSize } from "./player-movement.js";
import { heldLightCell } from "./held-light.js";
import { JavaHashSetOrder } from "./java-hashset-order.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/smallchecks-reference.json", import.meta.url)));
const predict = JSON.parse(readFileSync(new URL("../public/research/client-predict-reference.json", import.meta.url)));
const live = (o, d) => ORIGINAL_ITEMS[d === undefined ? `${o}` : `${o}:${d}`] ?? ORIGINAL_ITEMS[o];

test("comparator toggle replays the 12 executed records with an unpowered input", () => {
  const rows = predict.records.filter((r) => /^comparator1(49|50)-m/.test(r.name));
  assert.equal(rows.length, 12);
  for (const r of rows) {
    const [, , , block, meta] = r.setup[0];
    assert.equal(comparatorToggle(block, meta).meta, r.diff[0][4], r.name);
    assert.equal(comparatorToggle(block, meta).sound.pitch, Number(r.log[0].split(" ")[3]), r.name);
  }
});

test("comparator toggle (bytecode-read): a powered input keeps the lit bit when leaving subtract mode", () => {
  assert.equal(comparatorToggle(149, 12, { input: 10 }).meta, 8);
  assert.equal(comparatorToggle(150, 4, { input: 15 }).meta, 8);
  assert.equal(comparatorToggle(149, 12, { input: 0 }).meta, 0);
  assert.equal(comparatorToggle(149, 8, { input: 0 }).meta, 12); // entering subtract with an unchanged output stops before the lit update
  assert.equal(comparatorToggle(149, 8, { input: 0, tileOutput: 3, output: 0 }).meta, 4); // changed output runs it: unpowered clears the lit bit
  assert.equal(comparatorToggle(149, 1, { input: 9 }).meta, 5);
  assert.ok(comparatorShouldBePowered(15, 99) && !comparatorShouldBePowered(0, 0) && comparatorShouldBePowered(4, 0) && !comparatorShouldBePowered(4, 5) && comparatorShouldBePowered(5, 5));
});

test("sneak drop of the held-light cell: ySize 0.2 then 0.4 decay is 0.08 (bytecode-read EntityPlayerSP.e and Entity.d)", () => {
  const f = Math.fround;
  assert.equal(nextYSize(0, true), f(f(0.2) * f(0.4)));
  assert.ok(Math.abs(nextYSize(0, true) - 0.08) < 1e-6);
  assert.equal(nextYSize(0, false), 0);
  const m = new PlayerMotion();
  assert.equal(m.drop(1), 0);
  assert.equal(heldLightCell({ x: 0, y: 64.45, z: 0 }, 1.62, nextYSize(0, true))[1], 65);
});

test("advanced tooltip titles replay the executed ItemStack.getTooltip rows", () => {
  const byName = (n, adv) => ref.tooltips.find((r) => r.name === n && r.advanced === adv);
  assert.deepEqual(byName("item35", true).tooltip, ["Wool (#0035/0)"]);
  assert.deepEqual(byName("item358", true).tooltip.slice(0, 1), ["Map (#0358/0)"]);
  assert.deepEqual(ref.tooltips.find((r) => r.id === 267 && r.damage === 10 && r.advanced).tooltip.at(-1), "Durability: 240 / 250");
  assert.ok(!byName("item267", false).tooltip.some((l) => l.includes("#0267")));
  assert.equal(ref.sweep.filter((r) => r.error).length, 0);
  for (const r of ref.sweep) {
    const m = /\(#(\d{4})(?:\/(\d+))?\)$/.exec(r.first);
    assert.ok(m, `${r.id} ${r.first}`);
    assert.equal(Number(m[1]), r.id);
    assert.equal(SUBTYPE_ORIGINAL_IDS.has(r.id), m[2] !== undefined, `subtypes of ${r.id}`);
  }
});

test("the port builds the same advanced titles", () => {
  const stack = (o, d) => ({ id: live(o, d), damage: d ?? 0 });
  assert.equal(advancedTitleSuffix(stack(35, 14)), " (#0035/14)");
  assert.equal(advancedTitleSuffix(stack(1)), " (#0001)");
  assert.equal(advancedTitleSuffix(stack(267)), " (#0267)");
  assert.equal(advancedTitleSuffix({ id: live(358), damage: 100 }), " (#0358/100)");
  assert.equal(advancedTitleSuffix({ id: live(1) }, false), "#0001");
  assert.equal(advancedTitleSuffix({ id: -5 }), "");
  const wool = { name: "Red Wool" };
  assert.equal(tooltipLines(wool, stack(35, 14), true)[0].text, "Red Wool (#0035/14)");
  assert.equal(tooltipLines(wool, stack(35, 14), false)[0].text, "Red Wool");
  const sword = tooltipLines({ name: "Iron Sword", attack: 6, durability: 250 }, { id: live(267), damage: 10 }, true).map((l) => l.text);
  assert.deepEqual(sword, ["Iron Sword (#0267)", "", "+6 Attack Damage", "Durability: 240 / 250"]);
  assert.equal(tooltipLines(wool, { ...stack(35, 5), displayName: "Bob" }, true)[0].text, "Bob§r (#0035/5)");
});

test("effect order: Java 7 and Java 8 HashMap differ only for ids 16 and up in a 16-bucket table", () => {
  const order = (mode, ids) => { const s = new JavaHashSetOrder(mode); for (const i of ids) s.add(i, i); return s.keys(); };
  const ids = [1, 16, 17, 2];
  assert.deepEqual(order("java8", ids).slice(0, 4), [16, 1, 17, 2]);
  assert.notDeepEqual(order("java7", ids), order("java8", ids));
  const small = [1, 5, 9, 12];
  assert.deepEqual(order("java7", small), order("java8", small));
});
