import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";

globalThis.document ??= { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }) };
const { heldKind, heldItemMatrix } = await import("./player-renderer.js");
const { childHeldMatrix } = await import("./mob-equipment-renderer.js");
const { firstPersonMatrix } = await import("./first-person-pose.js");
const { originalOfLive } = await import("./item-names.js");
const { ITEMS } = await import("./survival.js");

// Executed GL records of the unchanged RenderBiped (held-pose-reference.json, HeldPoseProbe). The child cases begin with the model's child prefix.
const reference = JSON.parse(readFileSync(new URL("../public/research/held-pose-reference.json", import.meta.url)));
const RAD = Math.PI / 180;
const live = new Map();
for (const id of Object.keys(ITEMS).map(Number).concat(Array.from({ length: 256 }, (_, i) => i))) {
  const o = originalOfLive(id);
  if (o && (!live.has(o.id) || id === o.id)) live.set(o.id + ":" + (o.damage ?? "*"), id);
}
const liveOf = (id, damage) => live.get(id + ":" + damage) ?? live.get(id + ":*");
function replay(events, stop, skipArm = false) {
  const m = new THREE.Matrix4(), t = new THREE.Matrix4();
  let on = false, armSkipped = !skipArm;
  for (const e of events) {
    if (e[0] === stop) break;
    if (!on) { on = e[0] === "T"; if (!on) continue; }
    // the arm's own postRender (translate to the pivot) is replaced by the turned arm in the test below
    if (!armSkipped && e[0] === "T" && e[1] === -0.3125 && e[2] === 0.125) { armSkipped = true; continue; }
    if (e[0] === "T") m.multiply(t.makeTranslation(e[1], e[2], e[3]));
    else if (e[0] === "S") m.multiply(t.makeScale(e[1], e[2], e[3]));
    else if (e[0] === "R") m.multiply(t.makeRotationAxis(new THREE.Vector3(e[2], e[3], e[4]), e[1] * RAD));
  }
  return m;
}

test("a baby biped's held item sits where the executed RenderBiped child frame puts it, for turned arms", () => {
  const LIFT = 1 / 128, up = new THREE.Matrix4().makeTranslation(0, 1.5, 0), flip = new THREE.Matrix4().makeScale(1, -1, -1);
  const model = up.clone().multiply(flip); // model blocks (x, y, z) -> rig (x, 1.5 - y, -z)
  let compared = 0;
  for (const [rx, ry, rz] of [[0, 0, 0], [-Math.PI / 2 + 0.03, 0.1, -0.07], [0.6, -0.2, 0.15]]) {
    for (const c of reference.cases.filter((c) => c.who === "babyBiped")) {
      const kind = heldKind(liveOf(c.id, c.damage), c.damage);
      if (kind === "block") continue; // the port draws block items through another path
      // native: arm postRender (translate point, then Rz, Ry, Rx), the child prefix and the item, in the unscaled entity frame
      // (the executed child prefix comes first, then the arm's pivot and angles, then the item)
      const arm = new THREE.Matrix4().makeTranslation(-5 / 16, 2 / 16, 0).multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, "ZYX")));
      const i = c.events.findIndex((e) => e[0] === "T" && e[1] === -0.3125 && e[2] === 0.125);
      const want = new THREE.Matrix4().makeTranslation(0, LIFT, 0).multiply(model).multiply(replay(c.events.slice(0, i), "none")).multiply(arm).multiply(replay(c.events.slice(i + 1), "D"));
      // port: rig root scaled 0.5, frame lifted, limb at (x, 24 - y, -z) / 16 with the angles turned into rig axes, follow group, flip, item matrix
      const root = new THREE.Group(), frame = new THREE.Group(), limb = new THREE.Group(), follow = new THREE.Group(), fl = new THREE.Group(), item = new THREE.Group();
      root.scale.setScalar(0.5); frame.position.y = LIFT;
      limb.position.set(-5 / 16, 22 / 16, 0); limb.rotation.order = "ZYX"; limb.rotation.set(rx, -ry, -rz);
      follow.matrixAutoUpdate = false; fl.scale.set(1, -1, -1); item.matrixAutoUpdate = false; item.matrix.copy(heldItemMatrix(kind));
      root.add(frame); frame.add(limb, follow); follow.add(fl); fl.add(item);
      limb.updateMatrix(); follow.matrix.copy(childHeldMatrix(limb.matrix, LIFT));
      root.updateMatrixWorld(true);
      for (let i = 0; i < 16; i++) assert.ok(Math.abs(item.matrixWorld.elements[i] - want.elements[i]) < 1e-5, `item ${c.id} arm ${rx},${ry},${rz} element ${i}: ${item.matrixWorld.elements[i]} vs ${want.elements[i]}`);
      compared++;
    }
  }
  assert.ok(compared > 20);
});

test("the first-person blocking sword follows ItemRenderer.renderItemInFirstPerson's EnumAction.block branch (bytecode-read)", () => {
  // bytecode of bly.a(float): after scale(0.4): translate(-0.5, 0.2, 0), rotate(30, 0,1,0), rotate(-80, 1,0,0), rotate(60, 0,1,0).
  const pose = { progress: 0, item: 276, equip: 1, swing: { x: 0, y: 0, z: 0, ry: 0, rz: 0, rx: 0 }, bob: { x: 0, y: 0, rz: 0, rx: 0 } };
  const plain = firstPersonMatrix(pose), block = firstPersonMatrix(pose, { blocking: true });
  const t = new THREE.Matrix4(), want = plain.clone();
  want.multiply(t.makeTranslation(-0.5, 0.2, 0)).multiply(t.makeRotationY(30 * RAD)).multiply(t.makeRotationX(-80 * RAD)).multiply(t.makeRotationY(60 * RAD));
  for (let i = 0; i < 16; i++) assert.ok(Math.abs(block.elements[i] - want.elements[i]) < 1e-9);
});

test("the first-person arm's box carries the executed ModelBox uvs in ModelBiped's own axes", async () => {
  const { firstPersonArmGeometry } = await import("./first-person.js");
  const rec = JSON.parse(readFileSync(new URL("../public/research/model-faces-reference.json", import.meta.url))).records.find((r) => r.name === "playerArm");
  assert.ok(rec);
  const g = firstPersonArmGeometry(), pos = g.attributes.position, uv = g.attributes.uv, c = [-1, 4, 0]; // the mesh centre of the port's arm (model pixels)
  const key = (p) => p.map((n) => Math.round(n * 1000) / 1000).join(",");
  const port = [];
  for (let f = 0; f < 6; f++) { const m = new Map(); for (let k = 0; k < 4; k++) { const i = f * 4 + k; m.set(key([pos.getX(i) * 16 + c[0], pos.getY(i) * 16 + c[1], pos.getZ(i) * 16 + c[2]]), [uv.getX(i) * 64, (1 - uv.getY(i)) * 32]); } port.push(m); }
  const bad = [];
  rec.quads.forEach((q, n) => {
    const corners = q.map(([x, y, z]) => key([x, y, z])), idx = port.findIndex((m) => corners.every((k) => m.has(k)));
    if (idx < 0) { bad.push("face " + n + ": no port face at the native corners"); return; }
    for (const [x, y, z, u, v] of q) { const got = port[idx].get(key([x, y, z])); if (Math.abs(got[0] - u) > 1e-3 || Math.abs(got[1] - v) > 1e-3) bad.push(`face ${n} corner ${x},${y},${z}: port ${got} native ${u},${v}`); }
  });
  assert.deepEqual(bad, []);
});
