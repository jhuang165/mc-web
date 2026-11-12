// Batch 48: the boat, minecart, painting, item frame and leash knot renderers draw the tracker's client copies (object-tracker.js vehicleViews, hangingViews, knotViews).
// The copies themselves are replayed against the executed 1.7.10 classes in object-tracker-vehicles.test.js; here the views laid over the live entities are checked, and the
// per-tick wobble decrement (EntityBoat.h / EntityMinecart.h, bytecode-read: timeSinceHit and damage lose 1 a tick on the client too).
import test from "node:test";
import assert from "node:assert/strict";
import { ObjectTracker, vehicleViews, vehicleView, hangingViews, knotViews } from "./object-tracker.js";
import { ARTS } from "./hanging.js";

const player = { x: 0, y: 0, z: 0 };
const mk = () => { const t = new ObjectTracker(10, () => 0.5); t.view.player = player; return t; };
const tick = (t, lists) => { t.serverTick(lists, player); t.clientTick(); };
const boat = (o = {}) => ({ id: 7, x: 3, posY: 64, z: 4, y: 64, px: 3, py: 64, pz: 4, vx: 0, vy: 0, vz: 0, yaw: 90, pitch: 0, prevYaw: 90, timeSinceHit: 0, forwardDir: 1, damage: 0, dead: false, bb: [0, 0, 0, 0, 0, 0], height: 0.6, ...o });
const cart = (o = {}) => ({ id: 9, x: 5, posY: 64, z: 5, y: 64, px: 5, py: 64, pz: 5, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, rolling: 0, rollingDir: 1, damage: 0, type: 1, dead: false, bb: [0, 0, 0, 0, 0, 0], ...o });

test("a boat is drawn from its copy: the copy's position and the live one's later moves", () => {
  const t = mk(), b = boat();
  tick(t, { boat: [b] });
  const v0 = vehicleViews(t, [b])[0];
  assert.notEqual(v0, b);
  assert.equal(v0.x, 3); assert.equal(v0.posY, 64 + Math.fround(0.3)); // the copy's y is the packet's + the constructor's 0.3F (executed, b47), the view's y the box bottom
  assert.ok(Math.abs(v0.y - (v0.posY - Math.fround(0.3))) < 1e-9);
  b.x = 40; b.vx = 0.5; // the live boat jumps; the client has not heard of it yet
  assert.equal(vehicleViews(t, [b])[0].x, 3, "the view keeps the copy's x");
  assert.equal(vehicleViews(t, [b])[0], v0, "the view object is stable");
});

test("the copy's position follows the packets, interpolated, and the live boat is not read", () => {
  const t = mk(), b = boat();
  tick(t, { boat: [b] });
  b.x = 3.5; b.posY = 64; // moved half a block: the next update sends a position packet (3 ticks), the copy walks towards it over 8 ticks
  for (let i = 0; i < 3; i++) tick(t, { boat: [b] });
  const mid = vehicleViews(t, [b])[0].x;
  for (let i = 0; i < 12; i++) tick(t, { boat: [b] });
  const end = vehicleViews(t, [b])[0].x;
  assert.ok(mid >= 3 && mid <= end && end <= 3.5 + 1 / 32, `${mid} ${end}`);
  assert.ok(Math.abs(end - 3.5) < 1 / 16, "reached the packet position " + end);
});

test("the boat wobble is the watched metadata, losing 1 a client tick", () => {
  const t = mk(), b = boat({ timeSinceHit: 10, damage: 20, forwardDir: -1 });
  tick(t, { boat: [b] });
  let v = vehicleViews(t, [b])[0];
  // the spawn S1C gave 10 / 20 / -1; this tick's client update already took one off
  assert.equal(v.forwardDir, -1);
  const first = v.timeSinceHit, firstDmg = v.damage;
  assert.ok(first <= 10 && first >= 9 && firstDmg <= 20 && firstDmg >= 19);
  b.timeSinceHit = 0; b.damage = 0; // the server's wobble ended; the copy only learns it with the next S1C but ticks down on its own
  tick(t, { boat: [b] });
  v = vehicleViews(t, [b])[0];
  assert.ok(v.timeSinceHit === first - 1 || v.timeSinceHit === 0);
  for (let i = 0; i < 30; i++) tick(t, { boat: [b] });
  v = vehicleViews(t, [b])[0];
  assert.equal(v.timeSinceHit, 0); assert.equal(v.damage, 0);
});

test("a cart view carries the S0E cart type, the rolling fields and the previous rotation", () => {
  const t = mk(), c = cart({ type: 3, rolling: 5, rollingDir: -1, damage: 8, yaw: 30 });
  tick(t, { minecart: [c] });
  const v = vehicleViews(t, [c])[0];
  assert.equal(v.type, 3); assert.equal(v.rollingDir, -1);
  assert.ok(v.rolling <= 5 && v.damage <= 8 && v.damage >= 7);
  assert.equal(v.yaw, v.prevYaw, "no rotation change yet");
  assert.equal(v.id, 9, "the entity id jitter reads the live id");
  assert.equal(v.bb.length, 6); assert.notEqual(v.bb, c.bb);
  assert.ok(Math.abs(v.bb[4] - v.bb[1] - 0.7) < 1e-6);
});

test("the previous rotation is the last tick's", () => {
  const t = mk(), b = boat({ yaw: 0 });
  tick(t, { boat: [b] });
  b.yaw = 90; for (let i = 0; i < 3; i++) tick(t, { boat: [b] });
  const c = t.entries.get(b).client;
  const before = c.yaw; tick(t, { boat: [b] });
  const v = vehicleViews(t, [b])[0];
  assert.equal(v.prevYaw, before); assert.equal(v.yaw, c.yaw);
});

test("a boat the tracker follows that is out of range is not drawn; an untracked one and a ridden one use the live entity", () => {
  const t = mk(), b = boat(), far = boat({ id: 8, x: 300, z: 300, px: 300, pz: 300 }), ridden = boat({ id: 10, x: 6, px: 6 });
  tick(t, { boat: [b, far, ridden] });
  const views = vehicleViews(t, [b, far, ridden], (e) => e === ridden);
  assert.equal(views.length, 2, "the far one has no copy");
  assert.ok(views.includes(ridden), "the ridden boat is the live entity");
  const fresh = boat({ id: 11 });
  assert.equal(vehicleView(t, fresh), fresh, "not tracked yet: live");
  assert.deepEqual(vehicleViews(t, [{ ...b, dead: true }]), []);
});

test("the loaded-chunk test sees the copy's position", () => {
  const t = mk(), b = boat();
  tick(t, { boat: [b] });
  assert.equal(vehicleViews(t, [b], () => false, (x) => x > 100).length, 0);
  assert.equal(vehicleViews(t, [b], () => false, (x) => x < 100).length, 1);
});

test("a painting and an item frame are drawn from their S10 / S0E packets and S1C", () => {
  const t = mk();
  const art = ARTS.findIndex((a) => a[0] === "BurningSkull");
  const painting = { kind: "painting", id: 21, x: 99, y: 99, z: 99, yaw: 0, tx: 4, ty: 2, tz: 6, dir: 1, art, dead: false };
  const frame = { kind: "frame", id: 22, x: 98, y: 98, z: 98, yaw: 0, tx: 4, ty: 2, tz: 7, dir: 1, item: null, rotation: 0, dead: false };
  tick(t, { painting: [painting], itemFrame: [frame] });
  let [pv, fv] = hangingViews(t, [painting, frame]);
  assert.equal(pv.art, art);
  assert.notEqual(pv.x, 99, "the geometry is the copy's");
  assert.equal(pv.tx, 4); assert.equal(pv.dir, 1);
  assert.equal(fv.item, null); assert.equal(fv.rotation, 0);
  frame.item = { id: 288, count: 1, damage: 0 }; frame.rotation = 3;
  for (let i = 0; i < 3; i++) tick(t, { painting: [painting], itemFrame: [frame] });
  [pv, fv] = hangingViews(t, [painting, frame]);
  assert.equal(fv.item?.id, 288); assert.equal(fv.rotation, 3);
  painting.art = 0; // a live change of a painting's art is not sent: the copy keeps the S10 title
  tick(t, { painting: [painting], itemFrame: [frame] });
  assert.equal(hangingViews(t, [painting])[0].art, art);
});

test("a leash knot stands on its tile on the client, summoned ones too", () => {
  const t = mk();
  const placed = { x: 4, y: 65, z: 6, dead: false };
  const summoned = { x: 0, y: 0, z: 0, summoned: true, px: 10.7, py: 66.2, pz: -3.4, id: 5, dead: false };
  tick(t, { leashKnot: [placed, summoned] });
  const [a, b] = knotViews(t, [placed, summoned]);
  assert.deepEqual([a.x, a.y, a.z], [4, 65, 6]);
  assert.equal(b.id, 5);
  assert.deepEqual([b.x, b.y, b.z], [10, 66, -4]);
  assert.deepEqual([b.px, b.py, b.pz], [10.5, 66.5, -3.5]);
  assert.deepEqual(knotViews(t, [{ ...placed, dead: true }]), []);
});

test("views allocate nothing per call beyond the list (stable view objects)", () => {
  const t = mk(), b = boat(), c = cart();
  tick(t, { boat: [b], minecart: [c] });
  const first = vehicleViews(t, [b])[0], bb = first.bb;
  for (let i = 0; i < 100; i++) vehicleViews(t, [b]);
  assert.equal(vehicleViews(t, [b])[0], first); assert.equal(first.bb, bb);
});
