// Batch 56 prediction2: what the 1.7.10 client changes at once on a break, a right click and an activation, replayed against
// public/research/client-predict-reference.json (tools/probes/ClientPredictProbe.java run on the unchanged native classes with isRemote set,
// driven by tools/verify-client-predict.mjs). The probe's world double has no light, no power and no tile entities; the order of
// PlayerControllerMP.onPlayerDestroyBlock and onPlayerRightClick is bytecode-read. The overlay, the relight and the refused-click handling are port mechanisms.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { Survival, ITEMS } from "./survival.js";
import { fromOriginal } from "./block-registry.js";
import { createPrediction, dryBreak, dryActivate, dryUse, dryPlace, useKind } from "./client-prediction.js";
import { serverClick } from "./server-handlers.js";
import { LightVolume, lightEmission } from "./lighting.js";
import { VoxelScene } from "./scene.js";
import { ITEM_CAKE } from "./stems-cake.js";
import { WOODEN_DOOR_ITEM, IRON_DOOR_ITEM } from "./doors-panes.js";
import { ITEM_BED } from "./bed.js";
import { ITEM_SIGN } from "./signs.js";
import { ITEM_SKULL } from "./skull.js";

const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
const scene = readFileSync(new URL("./scene.js", import.meta.url), "utf8");
const ref = JSON.parse(readFileSync(new URL("../public/research/client-predict-reference.json", import.meta.url), "utf8"));
const records = (kind) => ref.records.filter((r) => r.case === kind);

function freshWorld(name) {
  const w = new World(name);
  // The probe's base world: stone at y 63 (here 33) for x and z 3..13, air above; the cells below are never read.
  for (let x = 2; x <= 14; x++) for (let z = 2; z <= 14; z++) for (let y = 28; y <= 40; y++) w.set(x, y, z, y === 33 && x >= 3 && x <= 13 && z >= 3 && z <= 13 ? 1 : y < 33 ? 1 : 0, false, 0);
  return w;
}
// The probe's cells sit at y 63-67; the port's default world is 64 high with ground below, so every cell is shifted down by DY.
const DY = -30, shift = ([x, y, z, ...rest]) => [x, y + DY, z, ...rest], shiftPos = ([x, y, z]) => [x, y + DY, z];
const mapped = (id, meta) => (id === 0 ? { id: 0, meta: 0 } : fromOriginal(id, meta));
const put = (w, cell) => { const [x, y, z, id, meta] = shift(cell); const m = mapped(id, meta); if (!m) return false; w.set(x, y, z, m.id, false, m.meta); return true; };
const key = (x, y, z, b, m) => `${x},${y},${z},${b},${m}`;
const expected = (diff) => diff.map((d) => { const [x, y, z, id, meta] = shift(d); const m = mapped(id, meta); return m ? key(x, y, z, m.id, m.meta) : null; });
const faceCell = ([x, y, z], side) => [[x, y - 1, z], [x, y + 1, z], [x, y, z - 1], [x, y, z + 1], [x - 1, y, z], [x + 1, y, z]][side];

test("b56: the client's break chain (dryBreak) matches the native classes for every probe break scenario", () => {
  let checked = 0, skipped = [];
  for (const r of records("break")) {
    const w = freshWorld(`b56-break-${r.name}`);
    if (!r.setup.every((c) => put(w, c))) { skipped.push(r.name); continue; }
    // Only air results are compared: the probe's own water cell in reeds-base-sand changes through its flowing-water double, not through a neighbour rule.
    const want = r.diff.filter((d) => d[3] === 0).map((d) => shift(d).slice(0, 3).join(",")).sort();
    const target = shiftPos(r.target), out = dryBreak({ world: w }, target);
    const got = out.cells.filter((c) => c.block === 0).map((c) => `${c.x},${c.y},${c.z}`).sort();
    // the probe records trapdoor, rail, dust and falling-block cases where only the broken cell changes
    assert.deepEqual(got, want, `break ${r.name}`);
    for (const c of out.cells) assert.equal(c.block, 0, `break ${r.name}: a break only writes air`);
    assert.equal(w.get(...target) !== 0, true, `${r.name}: the real world is untouched`);
    checked++;
  }
  assert.ok(checked >= 55, `checked ${checked}, skipped ${skipped.join(",")}`);
});

test("b56: wooden door, trapdoor and fence gate toggle at once; iron door, lever, cake, bed, note block do not (dryActivate)", () => {
  let checked = 0;
  for (const r of records("activate")) {
    if (!/^(door64|door71|trapdoor|irontrapdoor|gate)/.test(r.name)) continue;
    const w = freshWorld(`b56-act-${r.name}`);
    if (!r.setup.every((c) => put(w, c))) continue;
    const yaw = Math.PI; // the probe's yaw is 0 degrees: doorRotationYaw(PI) = 0
    const out = dryActivate({ world: w, yaw }, { block: shiftPos(r.at) }) ?? [];
    const want = expected(r.diff).filter(Boolean).sort(), got = out.map((c) => key(c.x, c.y, c.z, c.block, c.meta)).sort();
    assert.deepEqual(got, want, `activate ${r.name}`);
    checked++;
  }
  assert.ok(checked >= 10);
});

const ITEM_PORT = { 324: 470, 330: 471, 354: ITEM_CAKE, 338: 327, 390: 1106, 379: 1134, 380: 1105, 356: 356, 331: 360, 295: 309, 361: 361, 362: 362, 391: 322, 392: 323, 372: 386 };
test("b56: right-click item use (placeHeldBlock for doors, redstone, pot, stand, cauldron, reeds; dryUse for cake, seeds, wart) draws the native cells", () => {
  const done = [], notDrawn = [];
  for (const r of records("use")) {
    const id = ITEM_PORT[r.item];
    if (!id) { notDrawn.push(r.name); continue; } // bed, sign, skull, cocoa, lead: see the note
    const w = freshWorld(`b56-use-${r.name}`);
    if (!r.setup.every((c) => put(w, c))) { notDrawn.push(r.name); continue; }
    const survival = new Survival({ food: 10, slots: [] }, "creative");
    survival.inventory.main[survival.inventory.current] = { id, count: 5, damage: 0 };
    const [x, y, z] = shiftPos(r.at), side = r.at[3], target = { block: [x, y, z], adjacent: faceCell([x, y, z], side), hit: [x + 0.5, y + 1, z + 0.5] };
    const st = { world: w, survival, position: { x: 100.5, y: 100, z: 100.5 }, flowers: {}, yaw: ((180 - r.yaw) * Math.PI) / 180 };
    let cells = dryUse(st, { id, item: ITEMS[id], target });
    if (!cells.length) cells = dryPlace(st, { id, item: ITEMS[id], target }).cells;
    const want = expected(r.diff).filter(Boolean).sort(), got = cells.map((c) => key(c.x, c.y, c.z, c.block, c.meta)).sort();
    assert.deepEqual(got, want, `use ${r.name}`);
    done.push(r.name);
  }
  assert.ok(done.length >= 25, `${done.length} replayed; not drawn: ${notDrawn.join(",")}`);
});

test("b56: bed, sign and skull items change nothing on the client (isRemote early return): useKind and dryUse predict nothing", () => {
  for (const r of records("use").filter((q) => ["bed", "sign-top", "sign-wall", "skull"].includes(q.name))) assert.deepEqual(r.diff, [], r.name);
  const w = freshWorld("b56-bed"); w.set(8, 33, 8, 3, false, 0);
  const target = { block: [8, 33, 8], adjacent: [8, 34, 8] };
  for (const id of [ITEM_BED, ITEM_SIGN, ITEM_SKULL]) assert.equal(useKind({ world: w, target, heldId: id, sneaking: false, aimed: false }), null);
});

test("b56: a refused click (serverAcceptsClick): the client drew it, the server's gate refuses and reverts; the port keeps both halves", () => {
  // Native: the client draws the break/placement at once; NetHandlerPlayServer.processPlayerBlockPlacement / ItemInWorldManager refuse a click out of range
  // and send S23 with the real block, so the cell snaps back (bytecode-read in server-handlers.js). dryBreak/dryPlace draw it; the queued task's refusal reverts.
  const far = serverClick({ kind: "place", player: [0, 64, 0], pos: [20, 64, 0], adjacent: [20, 65, 0] });
  assert.equal(far.accept, false);
  const w = freshWorld("b56-refuse"); w.set(8, 34, 8, 3, false, 0);
  const pred = createPrediction(w);
  const drawn = dryBreak({ world: w }, [8, 34, 8]).cells;
  for (const c of drawn) pred.set(c.x, c.y, c.z, c.block, c.meta, 1);
  assert.equal(pred.view.get(8, 34, 8), 0, "drawn at once");
  pred.clear(8, 34, 8, 1); // the task runs, the server refuses: nothing was written to the real world
  assert.equal(pred.read().get(8, 34, 8), 3, "reverted to the real block");
  assert.match(main, /serverAcceptsClick/);
});

function litWorld(name) {
  const w = new World(name);
  for (let x = 0; x < 128; x++) for (let z = 0; z < 128; z++) { for (let y = 1; y <= 11; y++) w.set(x, y, z, 3, false, 0); for (let y = 12; y < 64; y++) w.set(x, y, z, 0, false, 0); }
  for (let x = 38; x < 47; x++) for (let z = 38; z < 47; z++) w.set(x, 14, z, 3, false, 0); // a 9 x 9 roof over a dark pocket
  return w;
}
test("b56: a predicted break relights at once from the predicted view, writes nothing real, and meshes each touching column once", () => {
  const w = litWorld("b56-relight"), light = new LightVolume(w, (x, y, z, b) => lightEmission(b, false));
  const p = createPrediction(w); p.set(42, 14, 42, 0, 0, 1);
  const fake = { world: w, light, predicted: p, dirty: new Set(), built: [], buildChunk(a, b) { this.built.push(`${a},${b}`); } };
  assert.equal(light.skyAt(42, 13, 42), 10, "under the roof before the break");
  VoxelScene.prototype.showPredictedCells.call(fake, [{ x: 42, y: 14, z: 42 }]);
  assert.equal(light.skyAt(42, 13, 42), 15, "the cell below the predicted hole is lit at once");
  assert.equal(w.get(42, 14, 42), 3, "the real world still has its block");
  assert.deepEqual(fake.built, ["32,32"], "an interior cell meshes its own column only");
  // two cells across a column border (a bed or a door pair): each touching column is meshed once, not once per cell
  const q = { world: w, light, predicted: p, dirty: new Set(), built: [], buildChunk(a, b) { this.built.push(`${a},${b}`); } };
  VoxelScene.prototype.showPredictedCells.call(q, [{ x: 47, y: 13, z: 40 }, { x: 48, y: 13, z: 40 }]);
  assert.deepEqual([...q.built].sort(), ["32,32", "48,32"]);
  assert.equal(new Set(q.built).size, q.built.length);
});

test("b56: the relight runs on a streaming world (ringSink and blockTap set): light updated, ring and tap never told, world unchanged", () => {
  const w = litWorld("b56-ring"), light = new LightVolume(w, (x, y, z, b) => lightEmission(b, false));
  const edits = [], taps = [], ring = { edited: (...a) => edits.push(a), holds: () => false, putOutside: () => false, get: () => 0 }, tap = (...a) => taps.push(a);
  w.ringSink = ring; w.blockTap = tap;
  const p = createPrediction(w); p.set(42, 14, 42, 0, 0, 1);
  const fake = { world: w, light, predicted: p, dirty: new Set(), built: [], buildChunk(a, b) { this.built.push(`${a},${b}`); } };
  VoxelScene.prototype.showPredictedCells.call(fake, [{ x: 42, y: 14, z: 42 }]);
  assert.equal(light.skyAt(42, 13, 42), 15, "relit although the world has a ringSink");
  assert.equal(fake.predictedRelights, 1);
  assert.equal(w.ringSink, ring); assert.equal(w.blockTap, tap);
  assert.deepEqual(edits, [], "ring columns were not told of the swap"); assert.deepEqual(taps, [], "the light shadow was not told of the swap");
  assert.equal(w.get(42, 14, 42), 3); assert.equal(w.edits.has("42,14,42"), false, "no edit record");
});

test("b56: useKind with the real browser ids: held door item gives both door halves, empty hand toggles the live door (id 97)", () => {
  assert.equal(WOODEN_DOOR_ITEM, 470); assert.equal(ITEMS[WOODEN_DOOR_ITEM]?.block, undefined, "the door item is not an ItemBlock");
  const w = freshWorld("b56-doorkind"); w.set(8, 33, 8, 1, false, 0);
  const survival = new Survival({ food: 10, slots: [] }, "creative");
  survival.inventory.main[survival.inventory.current] = { id: WOODEN_DOOR_ITEM, count: 5, damage: 0 };
  const target = { block: [8, 33, 8], adjacent: [8, 34, 8], hit: [8.5, 34, 8.5] }, st = { world: w, survival, position: { x: 100.5, y: 100, z: 100.5 }, flowers: {}, yaw: Math.PI };
  const kind = useKind({ world: w, target, heldId: WOODEN_DOOR_ITEM, sneaking: false, aimed: false });
  assert.equal(kind, "place");
  const cells = dryPlace(st, { id: WOODEN_DOOR_ITEM, item: ITEMS[WOODEN_DOOR_ITEM], target }).cells;
  assert.deepEqual(cells.map((c) => [c.y, c.block]).sort(), [[34, 97], [35, 97]], "lower and upper half, door block 97");
  assert.equal(cells.find((c) => c.y === 35).meta, 8, "the upper half carries the top flag");
  assert.equal(useKind({ world: w, target, heldId: IRON_DOOR_ITEM, sneaking: false, aimed: false }), "place");
  // the other items placeHeldBlock places
  for (const id of [327, 360, 356, 1134, 1105, 1106]) assert.equal(useKind({ world: w, target, heldId: id, sneaking: false, aimed: false }), "place", `item ${id}`);
  // the live door: empty hand toggles, a held door item at the door toggles first, sneaking with the item places past it
  w.set(8, 34, 8, 97, false, 0); w.set(8, 35, 8, 97, false, 8);
  const doorT = { block: [8, 34, 8], adjacent: [8, 35, 8] };
  assert.equal(useKind({ world: w, target: doorT, heldId: 0, sneaking: false, aimed: false }), "activate");
  assert.equal(useKind({ world: w, target: doorT, heldId: WOODEN_DOOR_ITEM, sneaking: false, aimed: false }), "activate");
  assert.equal(useKind({ world: w, target: doorT, heldId: 0, sneaking: true, aimed: false }), "activate", "sneaking with an empty hand still activates");
  assert.deepEqual(dryActivate({ world: w, yaw: 0 }, doorT).map((c) => [c.y, c.block, c.meta]), [[34, 97, 4]]);
});

test("b56: the wiring in main.js and scene.js", () => {
  assert.match(main, /dryBreak\(/);
  assert.match(main, /useKind\(/);
  assert.match(main, /dryActivate\(/);
  assert.match(scene, /showPredictedCells\(/);
});
