// Batch 54: the client copy of a horse the local player rides. Replays public/research/horse-copy-reference.json (tools/probes/HorseCopyProbe.java: the unchanged wi.e(F,F)
// and wi.ac() on a client world double) against horse-copy.js, and checks the tracker leaves a saddled ridden copy where the packets put it.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { steerHorseCopy, copySeat, rearSeat, copySteered } from "./horse-copy.js";
import { mountedOffset } from "./horse.js";
import { dismountSpot } from "./minecarts.js";

const ref = JSON.parse(await readFile(new URL("../public/research/horse-copy-reference.json", import.meta.url), "utf8"));
const f = Math.fround;

test("the executed client horse never moves or jumps on its own: only its angles follow the rider (8 scenarios)", () => {
  assert.equal(ref.steer.length, 8);
  for (const s of ref.steer) {
    const c = { x: 64, y: 0, z: 64, rotationYaw: 0, prevRotationYaw: 0, rotationPitch: 0, renderYawOffset: 0, rotationYawHead: 0 };
    for (const t of s.ticks) {
      // the client copy never receives a jump power (wi.w(I) is the server's), so the executed motion is zero except in the case that writes it directly
      if (s.name !== "jumpPowerSet") assert.deepEqual([t.mx, t.my, t.mz, t.jumpPower], [0, 0, 0, 0], s.name);
      assert.deepEqual([t.x, t.y, t.z], [64, 0, 64], s.name);
      steerHorseCopy(c, { yaw: f(t.riderYaw), pitch: f(s.pitch) });
      assert.equal(c.rotationYaw, f(t.yaw), s.name + " yaw");
      assert.equal(c.prevRotationYaw, f(t.prevYaw), s.name + " previous yaw");
      assert.equal(c.rotationPitch, f(t.pitch), s.name + " pitch");
      assert.equal(c.renderYawOffset, f(t.body), s.name + " body");
      assert.equal(c.rotationYawHead, f(t.head), s.name + " head");
    }
  }
});

test("the rearing rider's seat shift matches wi.ac() (20 executed rows)", () => {
  assert.equal(ref.rear.length, 20);
  for (const r of ref.rear) {
    const s = rearSeat(r.rearAmount, r.body);
    // the probe's rider y is its posY (feet + the player's 1.62 yOffset); the port's seat is the feet, 0.5 lower than posY - yOffset + ad()
    assert.ok(Math.abs(r.rider[0] - r.horse[0] - s.dx) < 1e-6, "dx");
    assert.ok(Math.abs(r.rider[2] - r.horse[2] - s.dz) < 1e-6, "dz");
    const flat = ref.rear.find((q) => q.rearAmount === 0 && q.body === r.body);
    assert.ok(Math.abs(r.rider[1] - flat.rider[1] - s.dy) < 1e-6, "dy");
  }
});

test("the seat follows the copy, not the live horse; a pig keeps its own offset", () => {
  const copy = { x: 10, y: 5, z: 20, renderYawOffset: 90 };
  const live = { type: "horse", growingAge: 0, rearAmount: 0 };
  const seat = copySeat(copy, live);
  assert.equal(seat.x, 10); assert.equal(seat.z, 20);
  assert.ok(Math.abs(seat.y - (5 + mountedOffset({ age: 0 }) - 0.5)) < 1e-9);
  const rear = copySeat({ ...copy, horse: { rearAmount: 1 } }, live); // the copy's own counter (batch 55), not the live horse's
  assert.equal(copySeat(copy, { ...live, rearAmount: 1 }).y, seat.y, "the live horse's amount no longer moves the seat");
  assert.ok(rear.x > 10.6 && rear.y > seat.y + 0.1);
  assert.equal(copySeat(null, live), null);
  assert.ok(Math.abs(copySeat(copy, { type: "pig" }).y - (5 + f(0.9) * 0.75 - 0.5)) < 1e-9);
});

test("only a saddled horse with a rider is steered", () => {
  assert.equal(copySteered({ type: "horse", rider: {}, horse: { saddled: true } }), true);
  assert.equal(copySteered({ type: "horse", rider: {}, horse: { saddled: false } }), false);
  assert.equal(copySteered({ type: "horse", rider: null, horse: { saddled: true } }), false);
  assert.equal(copySteered({ type: "pig", rider: {}, horse: { saddled: true } }), false);
});

test("a dismount lands on the mount's top when nothing is clear, else beside it (sv.m)", () => {
  const world = { get: () => 0 };
  const rider = { x: 5.5, y: 70.5, z: 5.5 };
  const mount = { x: 5.5, minY: 69, height: 1.6, z: 5.5 };
  assert.deepEqual(dismountSpot(world, rider, mount, () => false), { x: 5.5, y: 70.6, z: 5.5 });
  const ground = { get: (x, y) => (y < 70 ? 1 : 0), solid: (x, y) => y < 70 };
  const out = dismountSpot(ground, rider, mount, () => true);
  assert.ok(out.x !== 5.5 || out.z !== 5.5, "a free spot beside the mount");
});

test("the horse seat system's dismount runs the landing search, the buck keeps its own placement", async () => {
  const { horseSeats } = await import("./horse-live.js");
  const e = { type: "horse", x: 5.5, y: 69, z: 5.5, health: 20, horse: { saddled: true }, growingAge: 0 };
  const mobs = { size: () => [1.4, 1.6], entities: [e] };
  const seats = horseSeats(mobs);
  const ground = { get: (x, y) => (y < 69 ? 1 : 0), solid: (x, y) => y < 69, getMeta: () => 0 };
  for (const landing of [true, false]) {
    const rider = { x: 5.5, y: 70.2, z: 5.5, vehicle: { horse: true, entity: e } };
    e.rider = rider;
    seats.dismount(ground, rider, landing);
    assert.equal(rider.vehicle, null);
    if (landing) assert.ok(rider.x !== 5.5 || rider.z !== 5.5 || rider.y !== 70.2, "moved to the landing spot");
    else assert.deepEqual([rider.x, rider.y, rider.z], [5.5, 70.2, 5.5]);
  }
});
