// ModelDragon replay: box tables, rotation points and the render() pose against the unchanged 1.7.10 ModelDragon (tools/probes/DragonModelProbe.java,
// public/research/dragon-model-reference.json). Java's display-list modelview matrices are compared with the three.js rig (in this renderer's y/z flipped frame).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { DRAGON_MODEL, dragonPose, buildModel, poseModel, assemblePass } from "./dragon-renderer.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/dragon-model-reference.json", import.meta.url)));
const boxRecords = ref.records.filter((r) => r.case === "boxes"), poseRecords = ref.records.filter((r) => r.case === "pose");

test("reference covers the unchanged client classes", () => {
  assert.equal(ref.target, "Minecraft Java 1.7.10");
  assert.equal(boxRecords.length, 12);
  assert.equal(poseRecords.length, 16);
});

test("model boxes, texture offsets, mirror flags and rotation points equal ModelDragon's", () => {
  for (const r of boxRecords) {
    const spec = DRAGON_MODEL[r.name];
    assert.ok(spec, r.name);
    assert.deepEqual(spec.boxes.map((b) => [...b.slice(0, 8), !!b[8]]), r.boxes, r.name);
    assert.deepEqual(spec.point ?? [0, 0, 0], r.point, r.name);
    assert.deepEqual(r.angles, [0, 0, 0]);
    assert.deepEqual(r.textureSize, [256, 256]);
  }
});

const F = new THREE.Matrix4().makeScale(1, -1, -1);

test("render() display-list matrices equal the rig's world matrices for every part, state and partial tick", () => {
  const material = new THREE.MeshBasicMaterial();
  const model = buildModel(material);
  const holder = assemblePass(model);
  const root = new THREE.Group();
  root.add(holder);
  let compared = 0;
  for (const r of poseRecords) {
    const t = r.anim[1] + (r.anim[0] - r.anim[1]) * r.partial;
    const pose = dragonPose((n) => r.offsets[n], Math.fround(t));
    // ModelDragon.render prologue: glTranslatef(0, f7 - 2, -3), glRotatef(f7 * 2, x); in the flipped frame the group sits at (0, 2 - f7, 3)
    root.position.set(0, 2 - pose.f7, 3);
    root.rotation.set((pose.f7 * 2 * Math.PI) / 180, 0, 0);
    poseModel(model, pose);
    root.updateMatrixWorld(true);
    const wingSet = (s) => [s.wing, s.wingtip, s.frontleg, s.frontlegtip, s.frontfoot, s.rearleg, s.rearlegtip, s.rearfoot];
    const expected = [...model.necks, model.head, model.jaw, model.body, ...wingSet(model.sides[0]), ...wingSet(model.sides[1]), ...model.tails];
    const calls = r.calls.filter((c) => c[0] === "call");
    assert.equal(calls.length, expected.length, r.name);
    calls.forEach((c, i) => {
      const java = new THREE.Matrix4().fromArray(c[2]);
      // Java matrices carry block units already; the same frame flip applies to both rotation and translation
      const want = F.clone().multiply(java).multiply(F);
      const got = expected[i].matrixWorld;
      for (let k = 0; k < 16; k++) assert.ok(Math.abs(want.elements[k] - got.elements[k]) < 2e-4, `${r.name} partial ${r.partial} call ${i} (${c[1]}) element ${k}: java ${want.elements[k]} port ${got.elements[k]}`);
      compared++;
    });
  }
  assert.equal(compared, 16 * 36);
});
