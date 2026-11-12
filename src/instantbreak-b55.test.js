// Batch 55 instantbreak: the client's own break and placement are drawn before the queued packet is handled (client-prediction.js).
// Bytecode-read (not executed): PlayerControllerMP.clickBlock / onPlayerDamageBlock / clickBlockCreative call onPlayerDestroyBlock on the client world at once
// (aux 2001 sound and particles, then setBlockToAir), and onPlayerRightClick runs ItemBlock.onItemUse on the client world before C08 is sent. The overlay
// itself is a port mechanism for the shared world, with no native class behind it; these tests pin its behaviour.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { Farming } from "./farming.js";
import { createPrediction, dryPlace, predictsPlacement } from "./client-prediction.js";
import { placeHeldBlock } from "./block-placement-simulation.js";
import { raycast } from "./world.js";
import { ChunkMesher } from "./chunk-mesher.js";
import { StreamingLight } from "./streaming-light.js";
import { lightEmission } from "./lighting.js";
import { BiomeColorField, setColormaps } from "./biome-colors.js";
import { layersOf, LAYERS } from "./mesh-region.js";
import { ITEMS } from "./survival.js";
import { CHEST } from "./chest.js";

const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
const scene = readFileSync(new URL("./scene.js", import.meta.url), "utf8");
const POS = [42, 12, 42];

function world(name = "b55-ib") {
  const w = new World(name);
  for (let x = 38; x < 47; x++) for (let z = 38; z < 47; z++) { for (let y = 1; y <= 11; y++) w.set(x, y, z, 3, false, 0); for (let y = 12; y < 20; y++) w.set(x, y, z, 0, false, 0); }
  return w;
}
const rig = (w, creative = false) => ({ world: w, survival: new Survival({ food: 10, slots: [] }, creative ? "creative" : "survival"), position: { x: 10.5, y: 30, z: 10.5 }, flowers: {}, yaw: 0.3, farming: new Farming(w) });

test("b55: the overlay answers get/getMeta for the client and leaves the real world alone; mutators go to the real world", () => {
  const w = world(); w.set(...POS, 3, false, 0);
  const p = createPrediction(w);
  assert.equal(p.read(), w, "no entry: readers see the real world");
  assert.equal(p.set(...POS, 0, 0, 1), true);
  assert.equal(p.read(), p.view);
  assert.equal(p.view.get(...POS), 0); assert.equal(w.get(...POS), 3);
  assert.equal(p.view.solid(...POS), false, "derived reads (solid, collision) follow the overlay");
  p.view.set(POS[0] + 1, POS[1], POS[2], 4, false, 2);
  assert.equal(w.get(POS[0] + 1, POS[1], POS[2]), 4, "a write through the view is the real write");
  assert.equal(p.set(POS[0] + 1, POS[1], POS[2], 4, 2, 1), false, "equal to the world: nothing to show");
  // a newer prediction of the same cell survives the older task's end
  p.set(...POS, 0, 0, 2);
  assert.equal(p.clear(...POS, 1), false); assert.equal(p.active, true);
  assert.equal(p.clear(...POS, 2), true); assert.equal(p.active, false);
});

test("b55: the aim ray sees through a predicted break and stops at a predicted placement", () => {
  const w = world(); w.set(...POS, 3, false, 0);
  const p = createPrediction(w), o = { x: POS[0] + 0.5, y: POS[1] + 2.5, z: POS[2] + 0.5 }, down = { x: 0, y: -1, z: 0 };
  assert.deepEqual(raycast(w, o, down, 5).block, POS);
  p.set(...POS, 0, 0, 1);
  assert.deepEqual(raycast(p.read(), o, down, 5).block, [POS[0], POS[1] - 1, POS[2]], "the cell below shows through");
  p.clearAll(); p.set(POS[0], POS[1] + 1, POS[2], 3, 0, 1);
  assert.deepEqual(raycast(p.read(), o, down, 5).block, [POS[0], POS[1] + 1, POS[2]]);
});

test("b55: dryPlace writes the same cells and metadata as the real placement and changes nothing", () => {
  // the items below stand for the paths of placeHeldBlock: a cube, a log, stairs, a slab, a torch on a wall, a rail, a fence gate, a trapdoor, a chest, a pumpkin
  const cases = [[1, "top"], [17, "top"], [53, "top"], [44, "top"], [50, "wall"], [66, "top"], [107, "top"], [96, "wall"], [CHEST, "top"], [86, "top"]];
  for (const [id, where] of cases) {
    const mk = () => { const w = world("b55-dry-" + id); w.set(...POS, 3, false, 0); w.set(POS[0] + 1, POS[1], POS[2], 3, false, 0); return w; };
    const target = where === "top" ? { block: [...POS], adjacent: [POS[0], POS[1] + 1, POS[2]], hit: [POS[0] + 0.4, POS[1] + 1, POS[2] + 0.6] }
      : { block: [POS[0] + 1, POS[1], POS[2]], adjacent: [POS[0], POS[1], POS[2]], hit: [POS[0] + 1, POS[1] + 0.5, POS[2] + 0.5] };
    const a = mk(), b = mk(), ra = rig(a, true), rb = rig(b, true), before = JSON.stringify([...a.edits]);
    ra.survival.inventory.main[ra.survival.inventory.current] = { id, count: 5, damage: 0 }; rb.survival.inventory.main[rb.survival.inventory.current] = { id, count: 5, damage: 0 };
    const request = (t) => ({ id, item: ITEMS[id], target: t });
    const dry = dryPlace(ra, request(target)), real = placeHeldBlock(rb, request(target));
    assert.equal(dry.placed, real.placed, `item ${id}: same verdict (${real.reason})`);
    assert.equal(JSON.stringify([...a.edits]), before, `item ${id}: the real world is untouched`);
    assert.deepEqual(ra.survival.chests, {}, "no tile state leaked");
    for (const c of dry.cells) {
      assert.equal(b.get(c.x, c.y, c.z), c.block, `item ${id} cell ${c.x},${c.y},${c.z} block`);
      assert.equal(b.getMeta(c.x, c.y, c.z), c.meta, `item ${id} cell meta`);
    }
    if (real.placed) assert.ok(dry.cells.some((c) => c.x === real.position[0] && c.y === real.position[1] && c.z === real.position[2]), `item ${id}: the placed cell is predicted`);
  }
});

test("b55: a refused placement predicts nothing, the sound hook runs only for a placement, and the held stack is not taken", () => {
  const w = world(); w.set(...POS, 3, false, 0);
  const r = rig(w); r.position = { x: POS[0] + 0.5, y: POS[1] + 1, z: POS[2] + 0.5 }; // the player stands in the target cell
  r.survival.inventory.main[r.survival.inventory.current] = { id: 1, count: 3, damage: 0 };
  const sounds = [], target = { block: [...POS], adjacent: [POS[0], POS[1] + 1, POS[2]] };
  const stuck = dryPlace(r, { id: 1, item: ITEMS[1], target }, { sound: (...a) => sounds.push(a) });
  assert.equal(stuck.placed, false); assert.deepEqual(stuck.cells, []); assert.deepEqual(sounds, []);
  r.position = { x: 10.5, y: 30, z: 10.5 };
  const ok = dryPlace(r, { id: 1, item: ITEMS[1], target }, { sound: (...a) => sounds.push(a) });
  assert.equal(ok.placed, true); assert.deepEqual(sounds, [[true, 1]]);
  assert.equal(r.survival.held.count, 3, "the stack is the server half's to take");
});

test("b55: placement is predicted only for a held block on a plain block", () => {
  const w = world(); w.set(...POS, 3, false, 0); w.set(POS[0] + 1, POS[1], POS[2], CHEST, false, 0); w.set(POS[0] + 2, POS[1], POS[2], 13, false, 0);
  const t = (x) => ({ block: [x, POS[1], POS[2]], adjacent: [x, POS[1] + 1, POS[2]] });
  const base = { world: w, heldId: 1, sneaking: false, aimed: false };
  assert.equal(predictsPlacement({ ...base, target: t(POS[0]) }), true);
  assert.equal(predictsPlacement({ ...base, target: t(POS[0] + 1) }), false, "a chest takes the click");
  assert.equal(predictsPlacement({ ...base, target: t(POS[0] + 1), sneaking: true }), true, "sneaking with an item places past it");
  assert.equal(predictsPlacement({ ...base, target: t(POS[0] + 2) }), false, "a crafting table takes the click");
  assert.equal(predictsPlacement({ ...base, target: t(POS[0]), aimed: true }), false);
  assert.equal(predictsPlacement({ ...base, target: t(POS[0]), heldId: 0 }), false);
  assert.equal(predictsPlacement({ ...base, target: t(POS[0]), heldId: 472 }), false, "a bed has its own path");
});

test("b55: the column mesh built from the predicted view equals the mesh of the world with the block gone", () => {
  const rgba = (n) => { /* flat colormap: the mesh geometry under test does not depend on the biome tint values */ return Buffer.alloc(256 * 256 * 4, 128); };
  setColormaps(rgba("grass"), rgba("foliage"));
  const mk = () => { const w = world("b55-mesh"); w.set(...POS, 3, false, 0); return w; };
  const source = (w) => ({ world: w, light: new StreamingLight(w, (x, y, z, b) => lightEmission(b, false), { native: false }), litFurnaces: new Set(), repeaterLit: () => false, colorX: 0, colorZ: 0,
    biomeColors: new BiomeColorField(() => ({ slot: 1, id: 1, temperature: 0.8, rainfall: 0.4 })) });
  const positions = (src) => { const all = layersOf(new ChunkMesher(src).meshColumn(32, 32)), g = all.solid.geometry(); return Array.from(g.attributes.position.array); };
  const withBlock = mk(), gone = mk(); gone.set(...POS, 0, false, 0);
  const shown = mk(), p = createPrediction(shown); p.set(...POS, 0, 0, 1);
  const src = source(shown); src.world = p.view;
  const a = positions(source(withBlock)), b = positions(source(gone)), c = positions(src);
  assert.notDeepEqual(a, b, "the break changes the mesh");
  assert.deepEqual(c, b, "the predicted view meshes as the broken world");
});

test("b55: main.js wiring, as written (the bytecode order: effects and overlay at once, server half in the queue)", () => {
  assert.match(main, /function predictBreak\(p\)/);
  assert.match(main, /const predicted = predictBreak\(p\);\n\s+pendingEdits\.push\(\{ fn: \(\) => \{\n\s+endPrediction\(predicted\);\n\s+muteBreakFx = !!predicted;/, "a queued break ends its overlay, then runs without its effects");
  assert.match(main, /predicted: place && target \? predictPlace\(\) : null/);
  assert.match(main, /endPrediction\(q\.predicted\); mutePlaceSound = !!q\.predicted\?\.soundDone;/);
  assert.match(main, /target = raycast\(\n\s+clientWorld\(\),/, "the aim ray reads the client world");
  assert.match(main, /const state = \{ world: clientWorld\(\), position, previous/, "the client player's collision reads the client world");
  assert.match(main, /playBlockSound: \(\.\.\.a\) => \{ if \(!muteBreakFx\) sound\(\.\.\.a\); \}/);
  assert.match(scene, /this\.predicted\?\.active && this\.predicted\.world === real/);
  assert.match(scene, /this\.predicted\?\.active \|\| !this\.world\.chunks\.has/, "worker snapshots are not used while an overlay is active");
});
