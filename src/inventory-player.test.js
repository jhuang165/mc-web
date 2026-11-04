import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { paperdollPose, paperdollLook, paperdollMatrix, paperdollLights, paperdollBody, PAPERDOLL_LAYOUTS } from "./inventory-player.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/inventory-player-reference.json", import.meta.url)));

test("pose floats match the JVM for every recorded mouse offset", () => {
  assert.equal(ref.rows.length, 801);
  for (const r of ref.rows) {
    const p = paperdollPose(r.m, 0), q = paperdollPose(0, r.m);
    assert.ok(p.renderYawOffset === Math.fround(r.yawOffset), `yawOffset ${r.m}`);
    assert.ok(p.rotationYaw === Math.fround(r.yaw), `yaw ${r.m}`);
    assert.ok(p.rotationYawHead === Math.fround(r.yaw));
    assert.ok(q.rotationPitch === Math.fround(r.pitch), `pitch ${r.m}`);
    assert.equal(q.tilt, q.rotationPitch);
  }
});

test("layouts equal the constants read from the bytecode", () => {
  assert.deepEqual(ref.survival.callerPushes.slice(ref.survival.callerPushes.indexOf(51), ref.survival.callerPushes.indexOf(51) + 6), [51, 75, 30, 51, 75, 50]);
  const s = PAPERDOLL_LAYOUTS.inventory, c = PAPERDOLL_LAYOUTS.creative;
  assert.deepEqual([s.x, s.y, s.scale, s.lookX, s.lookY], [51, 75, 30, 51, 75 - 50]);
  assert.deepEqual([c.x, c.y, c.scale, c.lookX, c.lookY], [43, 45, 20, 43, 45 - 30]);
  assert.deepEqual(ref.drawCalls.slice(2, 9), ["glTranslatef", "glScalef", "glRotatef", "glRotatef", "glRotatef", "glRotatef", "glTranslatef"]);
});

test("the mouse over the model's anchor leaves it facing the front", () => {
  const p = paperdollLook(PAPERDOLL_LAYOUTS.inventory, 51, 25);
  assert.equal(p.rotationYaw, 0);
  assert.equal(p.rotationPitch === 0, true);
  const left = paperdollLook(PAPERDOLL_LAYOUTS.inventory, 11, 25);
  assert.ok(left.rotationYaw > 0 && left.renderYawOffset === Math.fround(left.rotationYaw / 2));
});

test("the model is anchored with the mirrored scale and a feet-on-anchor origin", () => {
  const m = paperdollMatrix(PAPERDOLL_LAYOUTS.inventory, 0);
  const e = m.elements;
  assert.equal(e[12], 51);
  assert.equal(e[13], 75);
  assert.equal(e[14], -1950);
  // scale(-s, s, s) then rotateZ(180): x -> +s, y -> -s (y points up the screen), z -> s
  assert.ok(Math.abs(e[0] - 30) < 1e-9 && Math.abs(e[5] + 30) < 1e-9 && Math.abs(e[10] - 30) < 1e-9);
  assert.equal(paperdollLights(PAPERDOLL_LAYOUTS.inventory).length, 2);
});

test("the stand-in body reproduces the pose at partial tick 1", () => {
  const pose = paperdollPose(30, -20), b = paperdollBody(pose, { limbSwing: 1, limbSwingAmount: 0.5, prevLimbSwingAmount: 0.25, age: 7 });
  assert.equal(b.rotationYawHead, b.prevRotationYawHead);
  assert.equal(b.renderYawOffset, b.prevRenderYawOffset);
  assert.equal(b.rotationPitch, pose.rotationPitch);
});
