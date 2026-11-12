// Batch 49: the crosshair aims at the boat, cart, painting and frame client copies (EntityRenderer.getMouseOver searches the client world's entities, bytecode-read);
// the pick result names the live entity (the use / attack packet carries the entity id).
import test from "node:test";
import assert from "node:assert/strict";
import { ObjectTracker, aimBox } from "./object-tracker.js";
import { pickMinecart } from "./structure-simulation.js";
import { pickHanging, ARTS } from "./hanging.js";

const player = { x: 0, y: 0, z: 0 };
const mk = () => { const t = new ObjectTracker(10, () => 0.5); t.view.player = player; return t; };
const tick = (t, lists) => { t.serverTick(lists, player); t.clientTick(); };
const cart = (o = {}) => ({ id: 9, x: 5, posY: 64, z: 5, y: 64, px: 5, py: 64, pz: 5, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, rolling: 0, rollingDir: 1, damage: 0, type: 1, dead: false, bb: [4.5, 64, 4.5, 5.5, 64.7, 5.5], ...o });
const list = (...carts) => ({ pickable: () => carts.filter((c) => !c.dead) });
const eye = { x: 5, y: 64.3, z: 0 }, south = { x: 0, y: 0, z: 1 };

test("aim follows the copy when live and copy differ, and answers the live cart", () => {
  const t = mk(), c = cart();
  tick(t, { minecart: [c] });
  c.x = 12; c.bb = [11.5, 64, 4.5, 12.5, 64.7, 5.5]; // live cart moved; the copy has not heard
  const boxOf = (e) => aimBox(t, e);
  const hit = pickMinecart(list(c), eye, south, 6, 6, null, boxOf);
  assert.ok(hit); assert.equal(hit.cart, c, "the live entity is returned for the interaction");
  assert.ok(Math.abs(hit.distance - (4.5 - 0.1 - 0)) < 0.2 || hit.distance > 4, `distance ${hit.distance}`);
  assert.equal(pickMinecart(list(c), { x: 12, y: 64.3, z: 0 }, south, 6, 6, null, boxOf), null, "the live position is not aimable");
  assert.ok(pickMinecart(list(c), { x: 12, y: 64.3, z: 0 }, south, 6, 6) , "without boxOf the live box is picked");
});

test("a copy absent while tracked is not aimable; an unlisted entity falls back to live", () => {
  const t = mk(), c = cart({ x: 500, bb: [499.5, 64, 4.5, 500.5, 64.7, 5.5] });
  tick(t, { minecart: [c] }); // beyond tracking range: followed, no copy
  assert.equal(aimBox(t, c), null);
  assert.equal(pickMinecart(list(c), { x: 500, y: 64.3, z: 0 }, south, 6, 6, null, (e) => aimBox(t, e)), null);
  const other = cart({ id: 10 }); // never listed to the tracker
  assert.deepEqual(aimBox(t, other), other.bb);
  assert.equal(pickMinecart(list(other), eye, south, 6, 6, null, (e) => aimBox(t, e)).cart, other);
});

test("the ridden cart answers with its copy's box (batch 52) and the ignored cart is skipped", () => {
  const t = mk(), c = cart();
  tick(t, { minecart: [c] });
  c.bb = [0, 64, 0, 1, 64.7, 1];
  assert.deepEqual(aimBox(t, c, true), aimBox(t, c), "a ridden cart is aimed through its copy as any cart; only a boat stands in");
  assert.notDeepEqual(aimBox(t, c, true), c.bb);
  assert.equal(pickMinecart(list(c), eye, south, 6, 6, c, (e) => aimBox(t, e, true)), null);
});

test("a painting is aimed by its copy's box and answers the live entity", () => {
  const t = mk();
  const p = { kind: "painting", id: 21, x: 99, y: 99, z: 99, yaw: 0, tx: 4, ty: 2, tz: 6, dir: 1, art: ARTS.findIndex((a) => a[0] === "BurningSkull"), dead: false, bb: [90, 90, 90, 91, 91, 91] };
  tick(t, { painting: [p] });
  const box = aimBox(t, p);
  assert.ok(box, "the copy exists");
  const cx = (box[0] + box[3]) / 2, cy = (box[1] + box[4]) / 2, o = { x: cx, y: cy, z: box[2] - 3 };
  const all = { pickable: () => [p] };
  assert.equal(pickHanging(all, o, south, 6, 6, (e) => aimBox(t, e))?.entity, p, "aimed at the copy, live entity returned");
  assert.equal(pickHanging(all, o, south, 6, 6), null, "the live box is elsewhere");
});
