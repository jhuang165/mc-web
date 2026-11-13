// Batch 57 prediction3: buckets, cocoa, buttons, repeaters, door and button sounds, the refusal revert (also on a streaming world with native light),
// and the items that draw nothing on the client (lead, bed, sign, skull). Replayed against public/research/client-predict-reference.json
// (tools/probes/ClientPredictProbe.java on the unchanged 1.7.10 classes with isRemote set; bucket records run ItemBucket.onItemRightClick for real).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { Survival, ITEMS } from "./survival.js";
import { fromOriginal } from "./block-registry.js";
import { createPrediction, dryBreak, dryActivate, dryBucket, dryPlace, useKind, activateSound, tracedBucket, drawPrediction, revertPrediction } from "./client-prediction.js";
import { serverClick, blockReach } from "./server-handlers.js";
import { LightVolume, lightEmission } from "./lighting.js";
import { StreamingLight } from "./streaming-light.js";
import { VoxelScene } from "./scene.js";
import { CHEST } from "./chest.js";

const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
const ref = JSON.parse(readFileSync(new URL("../public/research/client-predict-reference.json", import.meta.url), "utf8"));
const records = (kind) => ref.records.filter((r) => r.case === kind);

function freshWorld(name) {
  const w = new World(name);
  for (let x = 2; x <= 14; x++) for (let z = 2; z <= 14; z++) for (let y = 28; y <= 40; y++) w.set(x, y, z, y === 33 && x >= 3 && x <= 13 && z >= 3 && z <= 13 ? 1 : y < 33 ? 1 : 0, false, 0);
  return w;
}
const DY = -30, shift = ([x, y, z, ...rest]) => [x, y + DY, z, ...rest];
const mapped = (id, meta) => (id === 0 ? { id: 0, meta: 0 } : fromOriginal(id, meta));
const put = (w, cell) => { const [x, y, z, id, meta] = shift(cell); const m = mapped(id, meta); if (!m) return false; w.set(x, y, z, m.id, false, m.meta); return true; };
const key = (x, y, z, b, m) => `${x},${y},${z},${b},${m}`;

// Item.getMovingObjectPositionFromPlayer's view vector (bytecode-read: cos / sin of -yaw - pi and -pitch).
const dirOf = (pitch, yaw) => {
  const r = Math.PI / 180, f3 = Math.cos(-yaw * r - Math.PI), f4 = Math.sin(-yaw * r - Math.PI), f5 = -Math.cos(-pitch * r), f6 = Math.sin(-pitch * r);
  return [f4 * f5, f6, f3 * f5];
};
const BUCKET_PORT = { 325: 340, 326: 341, 327: 342 };

test("b57: bucket use on the client world (dryBucket) draws the executed ItemBucket.onItemRightClick cells for every probe record", () => {
  let checked = 0;
  for (const r of records("bucket")) {
    const heldId = BUCKET_PORT[r.item], w = freshWorld(`b57-bucket-${r.name}`);
    for (let x = 2; x <= 14; x++) for (let z = 2; z <= 14; z++) for (let y = 28; y <= 32; y++) w.set(x, y, z, 0, false, 0); // the probe's world is air below its one floor layer
    assert.ok(r.setup.every((c) => put(w, c)), r.name);
    if (r.hell) w.isHell = true;
    const eye = [r.eye[0], r.eye[1] + DY, r.eye[2]];
    const cells = dryBucket({ world: w, heldId }, eye, dirOf(r.pitch, r.yaw));
    // the native diff in port ids; a cell the port already holds as that block (flowing 8 over still 9 are the port's one water) is no change here
    const want = r.diff.map((d) => { const [x, y, z, id, meta] = shift(d), m = mapped(id, meta); return { x, y, z, id: m.id, meta: m.meta }; })
      .filter((d) => w.get(d.x, d.y, d.z) !== d.id || w.getMeta(d.x, d.y, d.z) !== d.meta).map((d) => key(d.x, d.y, d.z, d.id, d.meta)).sort();
    assert.deepEqual(cells.map((c) => key(c.x, c.y, c.z, c.block, c.meta)).sort(), want, `bucket ${r.name}`);
    for (const c of cells) assert.notEqual(w.get(c.x, c.y, c.z) === c.block && w.getMeta(c.x, c.y, c.z) === c.meta, true, "the real world is untouched");
    checked++;
  }
  assert.ok(checked >= 30, `${checked} bucket records`);
});

test("b57: bucket clicks reach the prediction with no block under the cursor (water), and a block that takes the click keeps the bucket out", () => {
  const w = freshWorld("b57-bucket-kind");
  w.set(8, 33, 8, 1, false, 0);
  assert.equal(tracedBucket(340), "empty"); assert.equal(tracedBucket(341), "filled"); assert.equal(tracedBucket(343), null); assert.equal(tracedBucket(0), null);
  assert.equal(useKind({ world: w, target: null, heldId: 340, sneaking: false, aimed: false }), "bucket", "water only: raycast gives no block target");
  assert.equal(useKind({ world: w, target: { block: [8, 33, 8], adjacent: [8, 34, 8] }, heldId: 341, sneaking: false, aimed: false }), "bucket");
  assert.equal(useKind({ world: w, target: null, heldId: 343, sneaking: false, aimed: false }), null, "milk is not traced");
  assert.equal(useKind({ world: w, target: null, heldId: 340, sneaking: false, aimed: true }), null, "an aimed entity (cow) takes the click");
  w.set(8, 34, 8, CHEST, false, 0); // a chest: onBlockActivated returns true on the client, no bucket use
  const chest = { block: [8, 34, 8], adjacent: [8, 35, 8] };
  assert.equal(useKind({ world: w, target: chest, heldId: 340, sneaking: false, aimed: false }), null);
  assert.equal(useKind({ world: w, target: chest, heldId: 340, sneaking: true, aimed: false }), "bucket", "sneaking skips the block's use");
  assert.match(main, /dryBucket\(\{ world: seen, heldId: held \}, eyeRay\.origin, eyeRay\.dir\)/);
  assert.match(main, /if \(place && \(target \|\| tracedBucket\(heldId\(\)\)\)\) return true;/, "a bucket click waits for the network tick like C08");
});

test("b57: button and repeater activation is drawn at once (executed records); lever, bed, note block, cake draw nothing", () => {
  let checked = 0;
  for (const r of records("activate")) {
    if (!/^(button|repeater-m)/.test(r.name)) continue;
    const w = freshWorld(`b57-act-${r.name}`);
    assert.ok(r.setup.every((c) => put(w, c)), r.name);
    const out = dryActivate({ world: w, yaw: 0 }, { block: shift(r.at).slice(0, 3) }) ?? [];
    const want = r.diff.map((d) => { const [x, y, z, id, meta] = shift(d), m = mapped(id, meta); return key(x, y, z, m.id, m.meta); }).sort();
    assert.deepEqual(out.map((c) => key(c.x, c.y, c.z, c.block, c.meta)).sort(), want, `activate ${r.name}`);
    checked++;
  }
  assert.equal(checked, 8, "one button and seven repeater records");
  // a pressed button stays as it is (BlockButton returns at once when the pressed bit is set)
  const w = freshWorld("b57-pressed"); w.set(7, 33, 8, 1, false, 0); w.set(8, 33, 8, 111, false, 9);
  assert.deepEqual(dryActivate({ world: w }, { block: [8, 33, 8] }), []);
  for (const name of ["lever", "bed-foot", "cake", "note", "anvil", "fence"]) {
    const r = records("activate").find((q) => q.name === name);
    if (name === "cake" || name === "note" || name === "anvil" || name === "fence" || name === "lever" || name === "bed-foot") assert.deepEqual(r.diff, [], name);
    assert.equal(dryActivate({ world: freshWorld("b57-none"), yaw: 0 }, { block: [8, 33, 8] }), null, "air is not an activation");
  }
  w.set(8, 34, 8, 111, false, 1);
  assert.equal(useKind({ world: w, target: { block: [8, 34, 8], adjacent: [8, 35, 8] }, heldId: 0, sneaking: false, aimed: false }), "activate");
  w.set(8, 34, 8, 112, false, 0);
  assert.equal(useKind({ world: w, target: { block: [8, 34, 8], adjacent: [8, 35, 8] }, heldId: 1, sneaking: false, aimed: false }), "activate", "a held block does not place past a repeater");
  w.set(8, 34, 8, 108, false, 5);
  assert.equal(useKind({ world: w, target: { block: [8, 34, 8], adjacent: [8, 35, 8] }, heldId: 0, sneaking: false, aimed: false }), null, "the lever's client use returns early");
});

test("b57: the click-time sounds: door, trapdoor and gate play aux effect 1003, a button plays random.click 0.3 / 0.6", () => {
  assert.equal(activateSound(97, () => 0.2).event, "random.door_open");
  assert.equal(activateSound(97, () => 0.7).event, "random.door_close");
  assert.equal(activateSound(97, () => 0.2).volume, 1);
  for (const id of [fromOriginal(96, 0).id, fromOriginal(107, 0).id]) assert.ok(activateSound(id, () => 0.3).event.startsWith("random.door_"), `block ${id}`);
  assert.deepEqual(activateSound(111), { event: "random.click", volume: 0.3, pitch: 0.6 });
  assert.equal(activateSound(112), null, "the repeater is silent");
  assert.equal(activateSound(108), null);
  assert.match(main, /const s = cells\.length \? activateSound\(seen\.get\(\.\.\.target\.block\)\) : null;/);
  assert.match(main, /playSound: \(name, options\) => \{ if \(!mutePlaceSound\) sounds\.play\(name, options\); \}/, "the queued run does not repeat the sound");
});

test("b57: cocoa beans on a jungle log are drawn through placeHeldBlock (executed cocoa record)", () => {
  const r = records("use").find((q) => q.name === "cocoa");
  const w = freshWorld("b57-cocoa");
  assert.ok(r.setup.every((c) => put(w, c)));
  const survival = new Survival({ food: 10, slots: [] }, "creative");
  survival.inventory.main[survival.inventory.current] = { id: 351, count: 5, damage: 3 };
  const [x, y, z] = shift(r.at), target = { block: [x, y, z], adjacent: [x + 1, y, z], hit: [x + 1, y + 0.5, z + 0.5] };
  assert.equal(useKind({ world: w, target, heldId: 351, heldDamage: 3, sneaking: false, aimed: false }), "place");
  assert.equal(useKind({ world: w, target, heldId: 351, heldDamage: 1, sneaking: false, aimed: false }), null, "other dyes draw nothing on a log");
  const out = dryPlace({ world: w, survival, position: { x: 100.5, y: 100, z: 100.5 }, flowers: {}, yaw: 0 }, { id: 351, item: ITEMS[351], target });
  const want = r.diff.map((d) => { const [a, b, c, id, meta] = shift(d), m = mapped(id, meta); return key(a, b, c, m.id, m.meta); });
  assert.deepEqual(out.cells.map((c) => key(c.x, c.y, c.z, c.block, c.meta)), want);
});

test("b57: lead on a fence, bed, sign and skull draw no block at the click (executed on the client world; the server world does draw bed, sign, skull)", () => {
  // The gap list named them as not predicted; native does not draw them, so there is nothing missing. The knot and the bed halves arrive from the server.
  for (const n of ["lead-fence", "bed", "sign-top", "sign-wall", "skull"]) assert.deepEqual(records("use").find((q) => q.name === n).diff, [], `client ${n}`);
  const server = records("serveruse");
  assert.equal(server.length, 4);
  assert.equal(server.find((q) => q.name === "bed").diff.length, 2, "ItemBed on a server world sets both halves");
  assert.equal(server.find((q) => q.name === "sign-top").diff.length, 1);
  assert.equal(server.find((q) => q.name === "skull").diff.length, 1);
  const w = freshWorld("b57-lead"); w.set(8, 33, 8, 4, false, 0);
  assert.equal(useKind({ world: w, target: { block: [8, 33, 8], adjacent: [8, 34, 8] }, heldId: 2020, sneaking: false, aimed: false }), null, "lead item");
});

test("b57: the client's own range rule is the aim ray; the server's gates refuse what the ray cannot reach, and the prediction is drawn then reverted", () => {
  // Executed: the bucket traces 5.0 blocks (records reach-4.9 hit, reach-5.1 miss). Bytecode-read / recalled: blocks 4.5 survival, 5 creative (aim ray in main.js).
  assert.equal(blockReach(false), 4.5); assert.equal(blockReach(true), 5);
  assert.match(main, /survival\.creative \? 5 : 4\.5/);
  assert.equal(records("bucket").find((q) => q.name === "empty-reach-4.9").diff.length, 1);
  assert.equal(records("bucket").find((q) => q.name === "empty-reach-5.1").diff.length, 0);
  // The server's own checks (NetHandlerPlayServer, server-handlers.js): placement within 8 of the feet, dig within 6 of the eye, build limit.
  assert.equal(serverClick({ kind: "place", player: [0, 64, 0], pos: [20, 64, 0], adjacent: [20, 65, 0] }).accept, false);
  assert.equal(serverClick({ kind: "dig", player: [0, 64, 0], pos: [20, 64, 0] }).accept, false);
  assert.equal(serverClick({ kind: "dig", player: [0, 64, 0], pos: [4, 64, 0] }).accept, true);
  assert.equal(serverClick({ kind: "place", player: [0, 253, 0], pos: [1, 255, 0], adjacent: [1, 256, 0] }).accept, false, "build limit");
  // Draw, refuse, revert for a far break: the overlay answers at once, the queued task refuses, the cell is rebuilt from the real world.
  const w = freshWorld("b57-refuse"); w.set(8, 34, 8, 3, false, 0);
  const layer = createPrediction(w), rebuilt = [], shown = [];
  const scene = { showPredictedCells: (cells) => shown.push(...cells.map((c) => `${c.x},${c.y},${c.z}`)), updateBlock: (x, z, y) => rebuilt.push(`${x},${y},${z}`) };
  const pred = drawPrediction(layer, scene, 1, dryBreak({ world: w }, [8, 34, 8]).cells.map((c) => [c.x, c.y, c.z, c.block, c.meta]));
  assert.deepEqual(shown, ["8,34,8"]); assert.equal(layer.view.get(8, 34, 8), 0);
  layer.clear(8, 34, 8, 1); // the task starts; serverAcceptsClick refuses; nothing was written
  revertPrediction(w, scene, pred);
  assert.deepEqual(rebuilt, ["8,34,8"], "the refused cell is rebuilt from the real world");
  // An accepted click wrote the real change first: no rebuild is needed (the real landing already did it).
  const w2 = freshWorld("b57-accept"); w2.set(8, 34, 8, 3, false, 0);
  const l2 = createPrediction(w2), rb2 = [], p2 = drawPrediction(l2, { showPredictedCells() {}, updateBlock: (x, z, y) => rb2.push(1) }, 1, [[8, 34, 8, 0, 0]]);
  w2.set(8, 34, 8, 0, false, 0);
  revertPrediction(w2, { updateBlock: () => rb2.push(1) }, p2);
  assert.deepEqual(rb2, []);
});

function litWorld(name) {
  const w = new World(name);
  for (let x = 0; x < 128; x++) for (let z = 0; z < 128; z++) { for (let y = 1; y <= 11; y++) w.set(x, y, z, 3, false, 0); for (let y = 12; y < 64; y++) w.set(x, y, z, 0, false, 0); }
  for (let x = 38; x < 47; x++) for (let z = 38; z < 47; z++) w.set(x, 14, z, 3, false, 0);
  return w;
}
const fake = (w, light, layer) => ({ world: w, light, predicted: layer, dirty: new Set(), built: [], buildChunk(a, b) { this.built.push(`${a},${b}`); } });

test("b57: a refused predicted break relights back to the real light (fixed-point volume with a ringSink)", () => {
  const w = litWorld("b57-relight-refuse"), light = new LightVolume(w, (x, y, z, b) => lightEmission(b, false));
  w.ringSink = { edited() {}, holds: () => false, putOutside: () => false, get: () => 0 };
  const layer = createPrediction(w), scene = fake(w, light, layer);
  scene.showPredictedCells = VoxelScene.prototype.showPredictedCells; scene.updateBlock = VoxelScene.prototype.updateBlock;
  const before = light.skyAt(42, 13, 42);
  assert.equal(before, 10);
  const pred = drawPrediction(layer, scene, 1, [[42, 14, 42, 0, 0]]);
  assert.equal(light.skyAt(42, 13, 42), 15, "drawn and relit");
  layer.clear(42, 14, 42, 1);
  revertPrediction(w, scene, pred);
  assert.equal(light.skyAt(42, 13, 42), before, "relit back from the real world after the refusal");
  assert.equal(w.get(42, 14, 42), 3);
});

test("b57: a refused predicted break on a streaming world with the native light engine restores the real light, and the shadow ids follow", () => {
  const w = new World("17", "javaStreamed", 12); w.blockLight = () => 0;
  const x = w.minX + 64, z = w.minZ + 64; let top = 255; while (top > 0 && !w.get(x, top, z)) top--;
  const floor = top + 1, roofY = floor + 3;
  for (let a = x - 4; a <= x + 4; a++) for (let c = z - 4; c <= z + 4; c++) w.set(a, roofY, c, 1, false, 0);
  const light = new StreamingLight(w, (a, b, c, id) => lightEmission(id, false), { native: true });
  const idx = (a, y, c) => ((a - light.x) * 128 + (c - light.z)) * w.height + y;
  const layer = createPrediction(w), scene = fake(w, light, layer);
  scene.showPredictedCells = VoxelScene.prototype.showPredictedCells; scene.updateBlock = VoxelScene.prototype.updateBlock;
  const probe = [x, floor + 1, z], dark = light.skyAt(...probe);
  assert.ok(dark < 15, `under the roof: ${dark}`);
  const edits = [], tap = w.blockTap; assert.equal(typeof tap, "function", "native light taps the world");
  w.blockTap = (...a) => { edits.push(a); tap(...a); };
  const pred = drawPrediction(layer, scene, 1, [[x, roofY, z, 0, 0]]);
  assert.equal(light.skyAt(...probe), 15, "predicted break relit at once on the streaming light");
  assert.equal(w.get(x, roofY, z), 1, "the real world keeps its block");
  assert.deepEqual(edits, [], "the swap did not tell the world's tap");
  assert.equal(light.ids[idx(x, roofY, z)], 0, "the shadow holds the predicted id until the landing or the refusal");
  layer.clear(x, roofY, z, 1);
  revertPrediction(w, scene, pred);
  assert.equal(light.skyAt(...probe), dark, "native relight back to the roof's shade after the refusal");
  assert.equal(light.ids[idx(x, roofY, z)], 1, "the shadow follows the real block again");
  light.tick();
  assert.equal(light.skyAt(...probe), dark, "the next tick's flush has nothing stale to relight");
  // and an accepted click: the real change lands, the light follows it
  w.set(x, roofY, z, 0, true, 0); light.update(x, roofY, z, 1); light.tick();
  assert.equal(light.skyAt(...probe), 15);
});
