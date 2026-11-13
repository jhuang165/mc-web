// Batch 58 prediction4: wooden button and comparator toggles, the held-stack change at the click, the Nether's smoke at the click, and the sounds the client does NOT
// play itself. Replayed against public/research/client-predict-reference.json (tools/probes/ClientPredictProbe.java, unchanged 1.7.10 classes, isRemote world double).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { Survival, ITEMS } from "./survival.js";
import { fromOriginal } from "./block-registry.js";
import { PlayerInventory, makeStack } from "./inventory.js";
import { dryActivate, dryBucketUse, activateSound, useKind, heldPlan, applyHeldPlan, filledBucketOf } from "./client-prediction.js";

const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
const ref = JSON.parse(readFileSync(new URL("../public/research/client-predict-reference.json", import.meta.url), "utf8"));
const records = (kind) => ref.records.filter((r) => r.case === kind);
const mapped = (id, meta) => (id === 0 ? { id: 0, meta: 0 } : fromOriginal(id, meta));
const key = (x, y, z, b, m) => `${x},${y},${z},${b},${m}`;
const flat = () => { const w = new World("b58-p4"); for (let x = 2; x <= 14; x++) for (let z = 2; z <= 14; z++) { for (let y = 28; y <= 32; y++) w.set(x, y, z, 0, false, 0); w.set(x, 33, z, 1, false, 0); } return w; };
const DY = -30;
const BUCKET_PORT = { 325: 340, 326: 341, 327: 342 };

test("b58: wooden button and both comparators change on the client at the click (executed records)", () => {
  let checked = 0;
  for (const r of records("activate")) {
    if (!/^(woodbutton|button|comparator\d+-m)/.test(r.name)) continue;
    const w = flat();
    for (const [x, y, z, id, meta] of r.setup) { const m = mapped(id, meta); w.set(x, y + DY, z, m.id, false, m.meta); }
    const out = dryActivate({ world: w, yaw: 0 }, { block: [r.at[0], r.at[1] + DY, r.at[2]] }) ?? [];
    const want = r.diff.map(([x, y, z, id, meta]) => { const m = mapped(id, meta); return key(x, y + DY, z, m.id, m.meta); }).sort();
    assert.deepEqual(out.map((c) => key(c.x, c.y, c.z, c.block, c.meta)).sort(), want, r.name);
    checked++;
  }
  assert.equal(checked, 14, "wood button, stone button, 8 + 4 comparator records");
});

test("b58: a click on a wooden button or a comparator is an 'activate' that draws; the clicked block does not place past it", () => {
  const w = flat();
  for (const [id, meta] of [[143, 1], [149, 0], [150, 0]]) {
    const m = mapped(id, meta); w.set(8, 34, 8, m.id, false, m.meta);
    assert.equal(useKind({ world: w, target: { block: [8, 34, 8], adjacent: [8, 35, 8] }, heldId: 1, sneaking: false, aimed: false }), "activate", `block ${id}`);
  }
});

test("b58: no click sound at the click: the client's own random.click is silent, S29 plays it once for the clicker (executed sound chain)", () => {
  const chain = records("soundchain")[0];
  assert.deepEqual(chain.clicker, chain.near, "the clicker gets the packet like every near player");
  assert.deepEqual(chain.far, []); assert.deepEqual(chain.otherDimension, []);
  assert.ok(chain.clicker[0].startsWith("S29 random.click") && chain.clicker[1].startsWith("S29 random.fizz"));
  for (const id of [mapped(77, 1).id, mapped(143, 1).id, mapped(149, 0).id, mapped(150, 0).id]) assert.equal(activateSound(id), null, `block ${id}`);
  assert.match(main, /dryPlace\(state, \{ id: held, item: ITEMS\[held\], target \}, \{\}\)/, "the place sound is the queued run's, not the click's");
});

test("b58: the held stack: one taken on a placement that happened, nothing on a refusal or in Creative (executed 'use' records)", () => {
  let checked = 0;
  for (const r of records("use")) {
    const stack = { id: 1, count: 3, damage: 0 };
    const plan = heldPlan({ kind: "use", stack, creative: false, placed: r.diff.length > 0 });
    const was = stack.count;
    if (plan) stack.count += plan.dCount;
    assert.equal(stack.count, r.count, r.name);
    stack.count = was; checked++;
  }
  assert.ok(checked >= 20);
  assert.equal(heldPlan({ kind: "place", stack: { id: 1, count: 3 }, creative: true, placed: true }), null);
});

test("b58: thrown items take one at once; a Creative controller restores it (executed 'throw' records)", () => {
  for (const r of records("throw")) {
    const stack = { id: r.item, count: r.count, damage: 0 };
    const plan = heldPlan({ kind: "throw", stack, creative: r.creative });
    if (plan) stack.count += plan.dCount;
    assert.equal(stack.count, r.resultCount, r.name);
  }
});

test("b58: bucket swaps: empty to the liquid's bucket when alone, full to empty on a placement or the Nether's fizz, stacks and Creative untouched (executed)", () => {
  for (const r of records("bucket")) {
    const stack = { id: BUCKET_PORT[r.item], count: r.count, damage: 0 };
    const w = flat();
    for (let x = 2; x <= 14; x++) for (let z = 2; z <= 14; z++) for (let y = 28; y <= 32; y++) w.set(x, y, z, 0, false, 0);
    for (const [x, y, z, id, meta] of r.setup) { const m = mapped(id, meta); w.set(x, y + DY, z, m.id, false, m.meta); }
    if (r.hell) w.isHell = true;
    const f = Math.PI / 180, d = [Math.sin(-r.yaw * f - Math.PI) * -Math.cos(-r.pitch * f), Math.sin(-r.pitch * f), Math.cos(-r.yaw * f - Math.PI) * -Math.cos(-r.pitch * f)];
    const out = dryBucketUse({ world: w, heldId: stack.id }, [r.eye[0], r.eye[1] + DY, r.eye[2]], d);
    const plan = heldPlan({ kind: "bucket", stack, creative: r.creative, placed: out.used, took: out.took });
    if (plan) { stack.count += plan.dCount; if (plan.swap) stack.id = plan.swap[1]; }
    if (r.count === 1 || r.creative || stack.id === BUCKET_PORT[r.item]) {
      if (r.count === 1) { assert.equal(stack.id, BUCKET_PORT[r.resultItem], `${r.name} item`); assert.equal(stack.count, r.resultCount, `${r.name} count`); }
    }
    if (r.count > 1 && !r.creative && r.inventory.length > 1) assert.equal(stack.count, r.count, `${r.name}: a stack's own bucket count is left to the server (follow-up)`);
  }
  assert.equal(filledBucketOf(ITEMS[341].contains), 341); assert.equal(filledBucketOf(ITEMS[342].contains), 342);
});

test("b58: the Nether's water: no cell, a fizz cell for the smoke, the bucket empties (executed 'full326-nether')", () => {
  const w = flat(); w.isHell = true;
  w.evaporated = () => assert.fail("the dry run must not run the real fizz");
  const out = dryBucketUse({ world: w, heldId: 341 }, [8.5, 36, 8.5], [0, -1, 0]);
  assert.deepEqual(out.cells, []); assert.ok(out.used); assert.deepEqual(out.fizz, [8, 34, 8]);
  const nat = records("bucket").find((r) => r.name === "full326-nether");
  assert.ok(nat.log.some((l) => l.startsWith("particle largesmoke")) && nat.log.filter((l) => l.startsWith("particle")).length === 8 && nat.resultItem === 325);
  assert.match(main, /muteFizzSmoke/); assert.match(main, /y \+ Math\.random\(\), z \+ Math\.random\(\), 0, 0, 0\); \};/, "the smoke y is y + random, as the executed world double shows");
});

test("b58: applyHeldPlan changes the real stack at once and the undo is relative; an emptied slot leaves and returns", () => {
  const inv = new PlayerInventory(); inv.main[0] = makeStack(1, 2); inv.current = 0;
  const stack = inv.held, undo1 = applyHeldPlan(inv, { dCount: -1 });
  assert.equal(stack.count, 1);
  const undo2 = applyHeldPlan(inv, { dCount: -1 });
  assert.equal(inv.held, null, "a stack of 0 leaves the slot at once");
  undo1(); assert.equal(stack.count, 1, "the first undo gives back its own one"); assert.equal(inv.held, stack, "and the slot fills again");
  undo2(); assert.equal(stack.count, 2, "relative: each undo gives back only its own one"); assert.equal(inv.held, stack);
  const b = makeStack(340, 1); inv.main[0] = b;
  const undo = applyHeldPlan(inv, { dCount: 0, swap: [340, 341] });
  assert.equal(b.id, 341); undo(); assert.equal(b.id, 340);
  assert.equal(applyHeldPlan(inv, null), null);
});

test("b58: main.js wiring: the held change at the click, undone before the server's run; throws reach the prediction", () => {
  assert.match(main, /const undoHeld = applyHeldPlan\(survival\.inventory, plan\);/);
  assert.match(main, /q\.predicted\?\.undoHeld\?\.\(\);/);
  assert.match(main, /kind = 'throw'/);
  assert.match(main, /for \(const q of pendingEdits\) q\.predicted\?\.undoHeld\?\.\(\);/, "a world reset takes the queued held changes back");
});
