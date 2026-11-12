// Batch 50: the minecart display block of a non-cube render type, the client TNT cart's smoke and the TNT swell.
// Executed: the client cart's smoke per tick (public/research/cart-display-reference.json clientFuse column 3, batch 49 probe, EntityMinecartTNT.h on an isRemote cart).
// Bytecode-read (`javap -c -p` on blm, boi, box = RenderTntMinecart, xv = EntityMinecartTNT): RenderBlocks.renderBlockAsItem's branches by render type; RenderMinecart.doRender scales
// 0.75 and translates (0, offset / 16, 0) before func_147910_a; RenderTntMinecart's func_147910_a does glScalef(swell) then super (the block) and the flash cube, so the swell scales the
// display block and the flash inside that frame, not the cart model; EntityMinecartTNT.h spawns "smoke" at (posX, posY + 0.5, posZ), velocity 0, each tick the fuse is above 0.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { ObjectTracker } from "./object-tracker.js";
import { tntIgnite } from "./cart-variants.js";
import { displayShape, displayQuads } from "./cart-display-shape.js";

const ref = JSON.parse(await readFile(new URL("../public/research/cart-display-reference.json", import.meta.url), "utf8"));
const mkCart = (type) => ({ id: 9, x: 5, posY: 64, z: 5, y: 64, px: 5, py: 64, pz: 5, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, rolling: 0, rollingDir: 1, damage: 0, type, dead: false, bb: [0, 0, 0, 0, 0, 0] });
const player = { x: 5, y: 64, z: 5 };

test("the client TNT cart spawns one smoke per tick while its fuse is above 0, at (x, posY + 0.5, z) (executed counts)", () => {
  const t = new ObjectTracker(10, () => 0.5); t.view.player = player; t.log = [];
  const c = mkCart(3); c.fuse = -1;
  const counts = [];
  for (let i = 0; i < 90; i++) {
    if (i === 3) tntIgnite(c, null);
    const before = t.log.length;
    t.serverTick({ minecart: [c] }, player); t.clientTick();
    counts.push(t.log.slice(before).filter((p) => p[0] === "smoke").length);
  }
  assert.deepEqual(counts, ref.clientFuse.ticks.map((r) => r[3]));
  const smoke = t.log.filter((p) => p[0] === "smoke");
  assert.ok(smoke.length > 0);
  const e = [...t.entries.values()][0].client;
  for (const p of smoke) { assert.equal(p[2] - (e.y), 0.5, "posY + 0.5"); assert.deepEqual(p.slice(4), [0, 0, 0]); }
});

test("a cart that was never primed on the client spawns no smoke", () => {
  const t = new ObjectTracker(10, () => 0.5); t.view.player = player; t.log = [];
  const c = mkCart(3); c.fuse = 40;
  for (let i = 0; i < 5; i++) { t.serverTick({ minecart: [c] }, player); t.clientTick(); }
  assert.equal(t.log.filter((p) => p[0] === "smoke").length, 0);
});

test("renderBlockAsItem's branches by render type: flat plant shapes, torches, and nothing for the types it has no branch for", () => {
  for (const id of [6, 37, 38, 39, 40, 31, 32, 30, 83]) assert.equal(displayShape(id), "cross", "type 1 " + id);
  for (const id of [59, 115, 141, 142]) assert.equal(displayShape(id), "crops", "type 6 " + id);
  for (const id of [104, 105]) assert.equal(displayShape(id), "stem", "type 19 " + id);
  for (const id of [50, 75, 76]) assert.equal(displayShape(id), "torch", "type 2 " + id);
  for (const id of [8, 9, 10, 11, 27, 28, 66, 157, 64, 71, 65, 51, 55, 106, 111, 118, 117, 140, 93, 94, 69, 26, 63, 68, 102, 101]) assert.equal(displayShape(id), "none", "no branch " + id);
  for (const id of [1, 2, 53, 85, 107, 139, 145, 138, 122, 81, 54, 154, 44, 78, 171, 52]) assert.equal(displayShape(id), "item", "box, stairs, fence and cube types keep the existing paths " + id);
  assert.equal(displayShape(0), "none");
});

test("the flat shapes' quads: crossed squares 4, crops 8, small stem 4, torch 6 (top, bottom, four sides); all centred on the -0.5 origin", () => {
  assert.equal(displayQuads("cross").length, 4);
  assert.equal(displayQuads("crops").length, 8);
  assert.equal(displayQuads("stem").length, 4);
  assert.equal(displayQuads("torch").length, 6);
  assert.equal(displayQuads("item").length, 0);
  for (const shape of ["cross", "crops", "stem", "torch"]) for (const q of displayQuads(shape)) {
    assert.equal(q.verts.length, 4);
    for (const [x, y, z] of q.verts) { assert.ok(Math.abs(x) <= 0.5 + 1e-6 && Math.abs(z) <= 0.5 + 1e-6 && y >= -0.5625 - 1e-6 && y <= 0.5 + 1e-6, shape + " " + [x, y, z]); }
  }
  // the crossed squares reach 0.45 from the centre, one block tall from the -0.5 base
  const xs = displayQuads("cross").flatMap((q) => q.verts.map((v) => Math.abs(v[0])));
  assert.ok(Math.abs(Math.max(...xs) - 0.45) < 1e-6);
  const ys = displayQuads("cross").flatMap((q) => q.verts.map((v) => v[1]));
  assert.deepEqual([Math.min(...ys), Math.max(...ys)], [-0.5, 0.5]);
  // the torch is 2 pixels wide (1/8) and one block tall
  const tys = displayQuads("torch")[2].verts.map((v) => v[1]);
  assert.deepEqual([Math.min(...tys), Math.max(...tys)], [-0.5, 0.5]);
});
