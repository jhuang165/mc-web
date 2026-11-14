import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newCapeState, capeTick, chaseStep, capeAngles, capeVisible, earsVisible, earTransform, CLOAK_BOX, EARS_BOX } from "./cape.js";
import { PlayerBody, PlayerRenderer } from "./player-renderer.js";

// public/research/cape-reference.json: the unchanged 1.7.10 EntityPlayerSP run through the real EntityPlayer.onUpdate
// (tools/probes/CapeChaseProbe.java, tools/verify-cape.mjs). Executed evidence covers the chasing position, cameraYaw and
// distanceWalkedModified; the RenderPlayer angle formulas below are bytecode-read (that class draws and cannot be run headless).
const ref = JSON.parse(readFileSync(new URL("../public/research/cape-reference.json", import.meta.url), "utf8"));

test("the chasing position replays the real EntityPlayer.onUpdate (executed)", () => {
  let rows = 0;
  for (const c of ref.cases) {
    const s = newCapeState({ x: c.data.start.x, y: c.data.start.y, z: c.data.start.z });
    for (const t of c.data.ticks) {
      chaseStep(s.chase, { x: t.x, y: t.y, z: t.z });
      assert.deepEqual([s.chase.px, s.chase.py, s.chase.pz, s.chase.x, s.chase.y, s.chase.z], [t.pcx, t.pcy, t.pcz, t.cx, t.cy, t.cz], `script ${c.script}`);
      rows++;
    }
  }
  assert.ok(rows > 40);
  // the scripts include jumps beyond 10 in x, y and z, both signs
  assert.ok(ref.cases.some((c) => c.data.ticks.some((t) => Math.abs(t.cx - t.x) > 2 && t.pcx === t.lx)), "a snap row exists");
});

test("cameraYaw and distanceWalkedModified replay the real onLivingUpdate and moveEntity (executed)", () => {
  for (const c of ref.cases) {
    const s = newCapeState({ x: c.data.start.x, y: c.data.start.y, z: c.data.start.z });
    for (const t of c.data.ticks) {
      capeTick(s, { position: { x: t.x, y: t.y, z: t.z }, motion: { x: t.vx, y: t.vy, z: t.vz, onGround: t.ground }, delta: c.script === 4 ? { x: t.x - t.lx, z: t.z - t.lz } : { x: 0, z: 0 } }); // the flying scripts write the position directly, so moveEntity moved 0
      const f = Math.fround; // the probe prints Java floats as shortest decimals
      assert.equal(s.prevCameraYaw, f(t.pcam)); assert.equal(s.cameraYaw, f(t.cam));
      assert.equal(s.prevWalked, f(t.pwalk)); assert.equal(s.walked, f(t.walk));
    }
  }
  assert.ok(ref.cases[4].data.ticks.some((t) => t.walk > 0.5 && t.cam > 0.05), "the walking case exercises both");
});

// An independent double-precision version of bop.a's cape formulas for comparison (no float rounding, no sine table).
function plain(chase, at, bodyYaw, cam, walk, partial, sneak) {
  const d0 = chase.px + (chase.x - chase.px) * partial - at.x, d1 = chase.py + (chase.y - chase.py) * partial - at.y, d2 = chase.pz + (chase.z - chase.pz) * partial - at.z;
  const r = bodyYaw * Math.PI / 180, s = Math.sin(r), co = -Math.cos(r);
  let f12 = Math.min(32, Math.max(-6, d1 * 10)), f13 = Math.max(0, (d0 * s + d2 * co) * 100); const f14 = (d0 * co - d2 * s) * 100;
  f12 += Math.sin(walk * 6) * 32 * cam + (sneak ? 25 : 0);
  return { x: 6 + f13 / 2 + f12, z: f14 / 2, y: 180 - f14 / 2 };
}

test("cape angles follow the bytecode-read formulas (bytecode-read, cross-checked in double precision)", () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 0.05, `${a} vs ${b}`);
  const idle = newCapeState({ x: 3, y: 64, z: 3 });
  const rest = capeAngles(idle, { at: { x: 3, y: 64, z: 3 }, bodyYaw: 0, partial: 0.5 });
  assert.deepEqual([rest.x, rest.z + 0, rest.y], [6, 0, 180]);
  assert.equal(capeAngles(idle, { at: { x: 3, y: 64, z: 3 }, bodyYaw: 0, partial: 0.5, sneak: true }).x, 31);
  const s = newCapeState({ x: 0, y: 64, z: 0 });
  const trail = [];
  for (const [x, y, z] of [[0.3, 64, 0.1], [0.7, 64.2, 0.3], [1.2, 64.1, 0.6], [1.8, 64, 0.8]]) {
    capeTick(s, { position: { x, y, z }, motion: { x: 0.2, y: 0, z: 0.05, onGround: true }, delta: { x: 0.4, z: 0.1 } });
    for (const bodyYaw of [0, 40, -90, 170]) for (const sneak of [false, true]) {
      const at = { x: s.chase.x + 0.5, y: s.chase.y - 0.2, z: s.chase.z - 0.1 }, a = capeAngles(s, { at, bodyYaw, partial: 0.3, sneak });
      const p = plain(s.chase, at, bodyYaw, s.prevCameraYaw + (s.cameraYaw - s.prevCameraYaw) * 0.3, s.prevWalked + (s.walked - s.prevWalked) * 0.3, 0.3, sneak);
      near(a.x, p.x); near(a.z, p.z); near(a.y, p.y); trail.push(a);
    }
  }
  assert.ok(trail.some((a) => Math.abs(a.z) > 1) && trail.some((a) => a.x > 6.5), "the cape actually swings");
  // a long fall clamps f12 at 32 and a rise at -6
  const up = newCapeState({ x: 0, y: 64, z: 0 }), down = newCapeState({ x: 0, y: 64, z: 0 });
  assert.equal(capeAngles(down, { at: { x: 0, y: 64 - 9, z: 0 }, bodyYaw: 0, partial: 0 }).x, 6 + 32);
  assert.equal(capeAngles(up, { at: { x: 0, y: 64 + 9, z: 0 }, bodyYaw: 0, partial: 0 }).x, 6 - 6);
});

test("cape model, ears and visibility rules (bytecode-read)", () => {
  assert.deepEqual(CLOAK_BOX, { uv: [0, 0], box: [-5, 0, -1, 10, 16, 1] });
  assert.deepEqual(EARS_BOX, { uv: [24, 0], box: [-3, -6, -1, 6, 6, 1] });
  assert.equal(capeVisible({ hasCape: true }), true);
  assert.equal(capeVisible({ hasCape: false }), false);
  assert.equal(capeVisible({ hasCape: true, invisible: true }), false);
  assert.equal(capeVisible({ hasCape: true, hideCape: true }), false);
  assert.equal(earsVisible({ name: "deadmau5", hasSkin: true }), true);
  assert.equal(earsVisible({ name: "Deadmau5", hasSkin: true }), false);
  assert.equal(earsVisible({ name: "deadmau5", hasSkin: false }), false);
  const l = earTransform(30, -10, 0), r = earTransform(30, -10, 1);
  assert.ok(Math.abs(l.position[0] + 0.375) < 1e-6 && Math.abs(r.position[0] - 0.375) < 1e-6 && l.position[1] === -0.375);
  assert.ok(Math.abs(l.scale - 4 / 3) < 1e-6);
});

test("PlayerBody carries the cape state: remote bodies keep cameraYaw 0, a local one with motion sways (port)", () => {
  const remote = new PlayerBody(), local = new PlayerBody();
  remote.reset({ x: 0, y: 64, z: 0 }, 0, 0); local.reset({ x: 0, y: 64, z: 0 }, 0, 0);
  let prev = { x: 0, y: 64, z: 0 };
  for (let i = 1; i <= 6; i++) {
    const pos = { x: i * 0.2, y: 64, z: 0 };
    remote.tick({ position: pos, previous: prev, yaw: 0, pitch: 0 });
    local.tick({ position: pos, previous: prev, yaw: 0, pitch: 0, motion: { x: 0.2, y: 0, z: 0, onGround: true } });
    prev = pos;
  }
  assert.equal(remote.cape.cameraYaw, 0); assert.equal(remote.cape.walked, 0);
  assert.ok(local.cape.cameraYaw > 0.05 && Math.abs(local.cape.walked - 6 * 0.2 * 0.6) < 1e-5);
  assert.ok(remote.cape.chase.x > 0 && remote.cape.chase.x < 1.2, "the chasing position lags");
  assert.equal(typeof PlayerRenderer, "function");
});
