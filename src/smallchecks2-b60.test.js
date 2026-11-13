// Batch 60 smallchecks2: the client's comparator toggle with powered inputs (executed records, 144 new in client-predict-reference.json), the non-italic F3+H suffix on a named stack
// (executed b59 rows), and the HashMap order of a player's effects (Java 8 chosen, Java 7 differences recorded).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { fromOriginal } from "./block-registry.js";
import { dryActivate } from "./client-prediction.js";
import { clientComparatorToggle } from "./client-comparator.js";
import { tooltipString } from "./bitmap-text.js";
import { tooltipLines } from "./gui.js";
import { Effects, effectsMapOrder } from "./status-effects.js";
import { ORIGINAL_ITEMS } from "./original-items.js";
import { JavaHashSetOrder } from "./java-hashset-order.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/client-predict-reference.json", import.meta.url), "utf8"));
const mapped = (id, meta) => (id === 0 ? { id: 0, meta: 0 } : fromOriginal(id, meta));
const key = (x, y, z, b, m) => `${x},${y},${z},${b},${m}`;
const flat = () => { const w = new World("b60-sc2"); for (let x = 2; x <= 14; x++) for (let z = 2; z <= 14; z++) { for (let y = 28; y <= 32; y++) w.set(x, y, z, 0, false, 0); w.set(x, 33, z, 1, false, 0); } return w; };
const DY = -30;

test("b60: comparator toggle with a powered input matches the executed client records", () => {
  const rows = ref.records.filter((r) => r.case === "activate" && r.name.startsWith("comparator-powered"));
  assert.equal(rows.length, 144);
  let leftSubtract = 0, litKept = 0;
  for (const r of rows) {
    const w = flat(), lit = new Set();
    for (const [x, y, z, id, meta] of r.setup) { const m = mapped(id, meta); w.set(x, y + DY, z, m.id, false, m.meta); if (id === 94) lit.add(`${x},${y + DY},${z}`); }
    const at = [r.at[0], r.at[1] + DY, r.at[2]];
    const redstoneHooks = { lit: (x, y, z) => lit.has(`${x},${y},${z}`), signal: (x, y, z) => (x === at[0] && y === at[1] && z === at[2] ? r.tileSignal[0] : undefined) };
    const out = dryActivate({ world: w, yaw: 0, redstoneHooks }, { block: at }) ?? [];
    const want = r.diff.map(([x, y, z, id, meta]) => { const m = mapped(id, meta); return key(x, y + DY, z, m.id, m.meta); }).sort();
    assert.deepEqual(out.map((c) => key(c.x, c.y, c.z, c.block, c.meta)).sort(), want, r.name);
    assert.equal(clientComparatorToggle(w, ...at, redstoneHooks).output, r.tileSignal[1], r.name + " tile output");
    const was = r.setup[0][4];
    if (was & 4 && r.diff.length && r.diff[0][4] & 8) leftSubtract++;
    if (!(was & 4) && r.diff.length) litKept++;
  }
  assert.ok(leftSubtract > 0 && litKept > 0);
});

test("b60: an unpowered comparator keeps the b58 shortcut (m & 4 ? m & 3 : m | 4)", () => {
  const w = flat();
  w.set(8, 3, 8, 127, false, 4);
  assert.equal(dryActivate({ world: w, yaw: 0 }, { block: [8, 3, 8] })[0].meta, 0);
  w.set(8, 3, 8, 127, false, 0);
  assert.equal(dryActivate({ world: w, yaw: 0 }, { block: [8, 3, 8] })[0].meta, 4);
});

test("b60: F3+H suffix of a named stack is not italic (native '§oBob§r (#0035/5)')", () => {
  const lines = tooltipLines({ name: "Wool" }, { id: ORIGINAL_ITEMS["35:5"] ?? ORIGINAL_ITEMS[35], damage: 5, displayName: "Bob" }, true);
  assert.equal(lines[0].text, "Bob§r (#0035/5)");
  assert.equal(tooltipString(lines[0], 0), "§f§oBob§r (#0035/5)");
  const row = ref && JSON.parse(readFileSync(new URL("../public/research/smallchecks-reference.json", import.meta.url), "utf8")).tooltips.find((t) => t.custom === "Bob" && t.advanced);
  assert.equal(row.tooltip[0], "§oBob§r (#0035/5)");
  assert.equal(tooltipLines({ name: "Wool" }, { id: ORIGINAL_ITEMS["35:5"] ?? ORIGINAL_ITEMS[35], damage: 5 }, true)[0].text.includes("§"), false);
  assert.equal(tooltipLines({ name: "Wool" }, { id: ORIGINAL_ITEMS["35:5"] ?? ORIGINAL_ITEMS[35], damage: 5, displayName: "Bob" }, false)[0].text, "Bob");
});

test("b60: effects iterate in HashMap bucket order (Java 8), not insertion or id order", () => {
  const e = new Effects();
  for (const id of [1, 16, 17, 2, 22, 8]) e.add({ id, duration: 100 });
  // buckets: 16 -> 0, 1 and 17 -> 1, 2 -> 2, 22 -> 6, 8 -> 8; a chain keeps insertion order
  assert.deepEqual(e.ordered().map((x) => x.id), [16, 1, 17, 2, 22, 8]);
  assert.deepEqual(e.serialize().map((x) => x.id), [16, 1, 17, 2, 22, 8]);
  const model = new JavaHashSetOrder("java8");
  for (const id of [1, 16, 17, 2, 22, 8]) model.add(id, id);
  assert.deepEqual(model.keys(), e.ordered().map((x) => x.id));
  // past 12 entries the table is 32 wide and stays so
  const f = new Effects();
  for (let id = 1; id <= 13; id++) f.add({ id, duration: 100 });
  f.remove(13); f.remove(12); f.remove(11);
  const m32 = new JavaHashSetOrder("java8");
  for (let id = 1; id <= 13; id++) m32.add(id, id);
  for (const id of [13, 12, 11]) m32.remove(id);
  assert.deepEqual(f.ordered().map((x) => x.id), m32.keys());
});

test("b60: every id set of 1..23 pairs matches the Java 8 HashMap model; Java 7 differs only through ids 16..23", () => {
  for (let a = 1; a <= 23; a++) for (let b = 1; b <= 23; b++) {
    if (a === b) continue;
    const list = [{ id: a }, { id: b }], model = new JavaHashSetOrder("java8");
    model.add(a, a); model.add(b, b);
    assert.deepEqual(effectsMapOrder(list).map((x) => x.id), model.keys());
    const m7 = new JavaHashSetOrder("java7"); m7.add(a, a); m7.add(b, b);
    if (a <= 15 && b <= 15) assert.deepEqual(m7.keys(), model.keys());
  }
  const m7 = new JavaHashSetOrder("java7"), m8 = new JavaHashSetOrder("java8");
  for (const id of [1, 17]) { m7.add(id, id); m8.add(id, id); }
  assert.deepEqual(m8.keys(), [1, 17]); assert.deepEqual(m7.keys(), [17, 1]);
});
