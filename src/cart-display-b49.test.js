// Batch 49: the minecart's custom display tile (data watcher 20-22) and the TNT cart's client fuse (status 10), replayed against the executed 1.7.10 classes
// (tools/probes/CartDisplayProbe.java, public/research/cart-display-reference.json), and the views the renderer draws (object-tracker.js vehicleView: `display`, `fuse`).
// RenderMinecart's display block draw (getDisplayTile n(), getDisplayTileData p(), getDisplayTileOffset r(); scale 0.75, translate (0, offset / 16, 0)) and its 0.5 shadow
// (constructor shadowSize) are bytecode-read; air is render type -1 and draws nothing.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { ObjectTracker, vehicleViews } from "./object-tracker.js";
import { displayTile, displayData, displayOffset, setDisplayTile, setDisplayTileData, setDisplayTileOffset, tntIgnite, initVariant, variantJSON, variantNBT } from "./cart-variants.js";
import { SHADOWS } from "./shadows.js";
import { summonCart } from "./cart-summon.js";
import { NBT } from "./nbt.js";

const ref = JSON.parse(await readFile(new URL("../public/research/cart-display-reference.json", import.meta.url), "utf8"));
const raw = (c) => c.dispRaw | 0, off = (c) => c.dispOffset ?? 6, on = (c) => (c.dispOn ? 1 : 0);
// [tile, data, offset, flag, watcher 20, 21, 22] of a live cart
const state = (c) => [displayTile(c), displayData(c), displayOffset(c), on(c), raw(c), off(c), on(c)];
const reorder = ([tile, data, offset, flag, w20, w21, w22]) => [tile, data, offset, flag, w20, w21, w22];
const mkCart = (type) => ({ id: 9, x: 5, posY: 64, z: 5, y: 64, px: 5, py: 64, pz: 5, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, rolling: 0, rollingDir: 1, damage: 0, type, dead: false, bb: [0, 0, 0, 0, 0, 0] });
const player = { x: 5, y: 64, z: 5 };
const mk = () => { const t = new ObjectTracker(10, () => 0.5); t.view.player = player; return t; };
const tick = (t, lists) => { t.serverTick(lists, player); t.clientTick(); };

test("the type's own display tile, data and offset equal the executed getDisplayTile / Data / Offset", () => {
  ref.defaults.forEach((row, type) => { if (row) assert.deepEqual(state(mkCart(type)), reorder(row), "type " + type); });
});

test("setDisplayTile / Data / Offset (k, l, m) write the executed watcher values in the executed order", () => {
  for (const seq of ref.sequences) {
    const c = mkCart(seq.type);
    assert.deepEqual(state(c), seq.start);
    for (const [which, arg, expect] of seq.steps) {
      if (which === 1) setDisplayTile(c, arg); else if (which === 2) setDisplayTileData(c, arg); else setDisplayTileOffset(c, arg);
      assert.deepEqual(state(c), expect, JSON.stringify([seq.type, which, arg]));
    }
  }
});

test("the copy's watcher carries 20-22 and the view hands the renderer the watched block and offset", () => {
  const t = mk(), c = mkCart(1);
  tick(t, { minecart: [c] });
  assert.equal(vehicleViews(t, [c])[0].display, null, "the default: the type's own block");
  setDisplayTile(c, 54); setDisplayTileData(c, 1); setDisplayTileOffset(c, 3);
  tick(t, { minecart: [c] }); tick(t, { minecart: [c] });
  const v = vehicleViews(t, [c])[0], d = v.display;
  assert.deepEqual({ id: d.id, data: d.data, offset: d.offset }, { id: 54, data: 1, offset: 3 });
  assert.equal(t.entries.get(c).client.meta.get(20), 54 | (1 << 16));
  assert.equal(vehicleViews(t, [c])[0].display, d, "the display record is reused");
  assert.equal(c.display, undefined, "the live cart is not touched");
});

test("the client TNT cart's fuse is its own: status 10 sets 80, h() counts down and 0 stays (executed)", () => {
  const t = mk(), c = mkCart(3);
  c.fuse = -1;
  const rows = [];
  for (let i = 0; i < 90; i++) {
    if (i === 3) tntIgnite(c, null); // the server cart's e(): World.setEntityState(this, 10) goes out with this tick's packets
    tick(t, { minecart: [c] });
    rows.push(vehicleViews(t, [c])[0].fuse);
  }
  // the executed client cart: the fuse after each tick (status handled before the same tick's h())
  assert.deepEqual(rows, ref.clientFuse.ticks.map((r) => r[1]));
  assert.equal(ref.clientFuse.start, -1);
  assert.ok(!c.igniteStatus, "the status was sent once");
});

test("a TNT cart that was already primed on the server when the client heard of it stays at -1 on the client", () => {
  const t = mk(), c = mkCart(3);
  c.fuse = 40; // loaded from a save (TNTFuse): no status is sent, as natively
  for (let i = 0; i < 5; i++) tick(t, { minecart: [c] });
  assert.equal(vehicleViews(t, [c])[0].fuse, -1);
});

test("the renderer's flash and swell read the copy's fuse, not the live one", async () => {
  const { CartBlockRenderer } = await import("./cart-block-renderer.js");
  const t = mk(), c = mkCart(3);
  c.fuse = -1;
  tick(t, { minecart: [c] });
  tntIgnite(c, null);
  tick(t, { minecart: [c] });
  c.fuse = 3; // the live fuse runs ahead; the copy is the one drawn
  const v = vehicleViews(t, [c])[0];
  assert.equal(v.fuse, 79);
  assert.deepEqual(CartBlockRenderer.fuse(v, 0.5), CartBlockRenderer.fuse({ type: 3, fuse: 79 }, 0.5));
  assert.notDeepEqual(CartBlockRenderer.fuse(v, 0.5), CartBlockRenderer.fuse({ type: 3, fuse: 3 }, 0.5));
});

test("the display survives save and /summon (EntityMinecart NBT CustomDisplayTile, DisplayTile, DisplayData, DisplayOffset)", () => {
  const c = mkCart(0);
  initVariant(c, { customDisplay: true, displayTile: 41, displayData: 2, displayOffset: 5 });
  assert.deepEqual(state(c), [41, 2, 5, 1, 41 | (2 << 16), 5, 1]);
  assert.deepEqual(variantJSON(c), { customDisplay: true, displayTile: 41, displayData: 2, displayOffset: 5 });
  assert.deepEqual(variantNBT(c), { CustomDisplayTile: [1, 1], DisplayTile: [3, 41], DisplayData: [3, 2], DisplayOffset: [3, 5] });
  assert.deepEqual(variantNBT(variantJSON(c)), variantNBT(c), "a saved record exports the same tags");
  assert.deepEqual(variantJSON(mkCart(0)), {});
  let got = null;
  const tag = new Map([["CustomDisplayTile", { type: NBT.BYTE, value: 1 }], ["DisplayTile", { type: NBT.INT, value: 57 }], ["DisplayData", { type: NBT.INT, value: 0 }], ["DisplayOffset", { type: NBT.INT, value: 9 }]]);
  summonCart({ spawnCart: (type, record) => (got = record, mkCart(type)) }, 0, 0, 0, 0, tag);
  assert.deepEqual([got.customDisplay, got.displayTile, got.displayData, got.displayOffset], [true, 57, 0, 9]);
});

test("a cart casts RenderMinecart's 0.5 shadow like the boat (opaque, no size offset)", () => {
  assert.equal(SHADOWS.minecart.size, Math.fround(0.5));
  assert.equal(SHADOWS.minecart.opaque, 1);
  assert.deepEqual(SHADOWS.minecart, SHADOWS.boat);
});
