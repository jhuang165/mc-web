// b99 horse99: (1) the client applies the server's `dismount` message as S08, S1B, S08 (bjb.a(fu): ySize 0, motion 0, setPositionAndRotation; S1B clears the ride);
// (2) the probe horse seat 64.1 vs 64.7 is a foal vs an adult (Executed, horse99-reference.json), not the ground; the port's mountedOffset has both.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyDismount } from "./multiplayer/client-dismount.js";
import { DedicatedClient } from "./multiplayer/client.js";
import { mountedOffset } from "./horse.js";

const vec = (x = 0, y = 0, z = 0) => ({ x, y, z, set(a, b, c) { this.x = a; this.y = b; this.z = c; } });
const mkState = () => {
  const log = [];
  const st = { position: vec(5.5, 64.7, 5.5), previous: vec(5.4, 64.6, 5.4), velocity: vec(0.1, 0.2, 0.1), motion: { ySize: 0.3 }, riding: "m7", setRiding: (on) => { st.riding = on; log.push(["riding", on]); } };
  return { st, log };
};

test("applyDismount puts the position and the previous position at the spot, zeroes motion and ySize, and unlinks the ride", () => {
  const { st } = mkState();
  assert.equal(applyDismount({ type: "dismount", x: 6.5, y: 65.7, z: 5.5, vehicle: "m7" }, st), true);
  assert.deepEqual([st.position.x, st.position.y, st.position.z], [6.5, 65.7, 5.5]);
  assert.deepEqual([st.previous.x, st.previous.y, st.previous.z], [6.5, 65.7, 5.5], "no one-tick jump velocity");
  assert.deepEqual([st.velocity.x, st.velocity.y, st.velocity.z], [0, 0, 0]);
  assert.equal(st.motion.ySize, 0);
  assert.equal(st.riding, false);
});

test("a dismount message with a bad coordinate is ignored", () => {
  const { st } = mkState();
  assert.equal(applyDismount({ type: "dismount", x: NaN, y: 1, z: 2 }, st), false);
  assert.equal(st.riding, "m7");
});

test("the client routes a dismount message to onDismount when ready", () => {
  const seen = [];
  const c = new DedicatedClient({ onDismount: (m) => seen.push(m) });
  c.ready = true;
  c.apply({ type: "dismount", x: 1, y: 2, z: 3, vehicle: "c1" });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].vehicle, "c1");
});

test("the executed horse seat: adult ae() 1.2 (seat 64.7), foal 0.6 (seat 64.1), whatever the ground; the port's mountedOffset matches", () => {
  const ref = JSON.parse(readFileSync(new URL("../public/research/horse99-reference.json", import.meta.url), "utf8"));
  const rows = ref.runs.flat();
  assert.ok(rows.some((r) => r[3] === -24000) && rows.some((r) => r[3] === 0));
  for (const [, y, ae, age] of rows) {
    assert.ok(Math.abs(ae - (age === 0 ? 1.2 : 0.6)) < 1e-6);
    assert.ok(Math.abs(y - (64 + ae - 0.5)) < 1e-6);
    assert.ok(Math.abs(mountedOffset({ age }) - ae) < 1e-6, `age ${age}`);
  }
  assert.ok(new Set(rows.filter((r) => r[3] === 0).map((r) => r[0])).size > 1, "adult seats seen on more than one ground");
});
