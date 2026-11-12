// Batch 52: the minecart the client player rides is drawn from its client copy and the rider is seated from it (bytecode-read: ahb.a(sa, boolean) updates a mount's copy, xl.h
// interpolates it from the S18 packets with no rider test, then the rider's updateRidden -> updateRiderPosition). A ridden boat keeps the batch 51 live stand-in.
import test from "node:test";
import assert from "node:assert/strict";
import { ObjectTracker, vehicleView, vehicleViews, rideCopy } from "./object-tracker.js";

const mk = () => {
  const t = new ObjectTracker(10, () => 0.5), player = { x: 0, y: 0, z: 0 };
  t.view.player = player; t.ctx.world = null;
  return { t, player };
};
const cart = (o = {}) => ({ id: 9, x: 5, posY: 64, z: 5, y: 63.65, px: 5, py: 64, pz: 5, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, rolling: 0, rollingDir: 1, damage: 0, type: 0, dead: false, bb: [4.5, 63.65, 4.5, 5.5, 64.35, 5.5], ...o });

test("a ridden cart is drawn from its copy, which trails the live cart", () => {
  const { t, player } = mk(), live = cart();
  t.serverTick({ minecart: [live] }, player); t.clientTick();
  for (let i = 0; i < 6; i++) { live.x += 0.4; live.posY += 0.0; t.serverTick({ minecart: [live] }, player); t.clientTick(); }
  const v = vehicleView(t, live, true), c = rideCopy(t, live);
  assert.ok(c, "the copy is the seat");
  assert.notEqual(v, live, "not the live entity");
  assert.equal(v.x, c.x);
  assert.ok(v.x < live.x, `copy ${v.x} trails live ${live.x}`);
  assert.equal(vehicleViews(t, [live], (l) => l === live)[0].x, c.x);
});

test("a ridden boat keeps the live stand-in and has no seat copy", () => {
  const { t, player } = mk(), boat = { id: 1, x: 5.5, posY: 0.3, z: 5.5, y: 0.3, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, timeSinceHit: 0, forwardDir: 1, damage: 0, dead: false, bb: [4.75, 0, 4.75, 6.25, 0.6, 6.25] };
  t.serverTick({ boat: [boat] }, player); t.clientTick();
  assert.equal(vehicleView(t, boat, true), boat);
  assert.equal(rideCopy(t, boat), null);
  const targets = t.vehicleTargets((l) => l === boat);
  assert.equal(targets[0].box, boat.bb);
});

test("a ridden cart's hit box is its copy's, and an untracked cart has no seat copy", () => {
  const { t, player } = mk(), live = cart();
  assert.equal(rideCopy(t, live), null);
  t.serverTick({ minecart: [live] }, player); t.clientTick();
  live.x = 9; live.bb = [8.5, 63.65, 4.5, 9.5, 64.35, 5.5];
  const [tg] = t.vehicleTargets((l) => l === live);
  assert.notEqual(tg.box, live.bb);
});
