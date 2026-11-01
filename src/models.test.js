import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import * as THREE from "three";

// three's TextureLoader asks the DOM for an <img>; the geometry under test never loads one.
globalThis.document ??= { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }) };
const { MobRenderer } = await import("./mob-renderer.js");

const reference = JSON.parse(readFileSync(new URL("../public/research/model-reference.json", import.meta.url)));
const model = Object.fromEntries(reference.records.map((r) => [r.model, r]));
const HALF_PI = Math.PI / 2;
// The parts each model's render() draws (the probe lists every field) and the rest angles
// setRotationAngles gives them at zero swing and head angles. Biped headwear is left out:
// zombie.png and skeleton.png are fully transparent there (checked in the test below).
const QUAD = ["bhw.a", "bhw.b", "bhw.c", "bhw.d", "bhw.e", "bhw.f"], BIPED = ["bhm.c", "bhm.e", "bhm.f", "bhm.g", "bhm.h", "bhm.i"],
  CREEPER = ["bhj.a", "bhj.c", "bhj.d", "bhj.e", "bhj.f", "bhj.g"];
const RIGS = {
  pig: [["pig", QUAD, { "bhw.b": HALF_PI }]],
  cow: [["cow", QUAD, { "bhw.b": HALF_PI }]],
  sheep: [["sheep", QUAD, { "bhw.b": HALF_PI }], ["sheepFur", QUAD, { "bhw.b": HALF_PI }]],
  chicken: [["chicken", ["bhh.a", "bhh.b", "bhh.c", "bhh.d", "bhh.e", "bhh.f", "bhh.g", "bhh.h"], { "bhh.b": HALF_PI }]],
  zombie: [["zombie", BIPED, {}]],
  skeleton: [["skeleton", BIPED, {}]],
  spider: [["spider", Object.keys(model.spider.parts), {}]],
  creeper: [["creeper", CREEPER, {}], ["creeperArmor", CREEPER, {}]],
};

// ModelRenderer.render: translate to the rotation point, then rotate Z, Y, X; a box corner
// grown by `grow` on every side. Model pixels map to three.js as (x, 24 - y, -z) / 16, plus
// RendererLivingEntity's 1/128 lift.
function expectedBoxes(name, parts, rest) {
  const out = [];
  for (const key of parts) {
    const p = model[name].parts[key], angle = rest[key] ?? 0;
    const m = new THREE.Matrix4().makeTranslation(...p.point).multiply(new THREE.Matrix4().makeRotationX(angle));
    for (const b of p.boxes) {
      const box = new THREE.Box3();
      for (const x of [b.from[0] - b.grow, b.to[0] + b.grow]) for (const y of [b.from[1] - b.grow, b.to[1] + b.grow]) for (const z of [b.from[2] - b.grow, b.to[2] + b.grow]) {
        const v = new THREE.Vector3(x, y, z).applyMatrix4(m);
        box.expandByPoint(new THREE.Vector3(v.x / 16, (24 - v.y) / 16 + 1 / 128, -v.z / 16));
      }
      out.push({ box, uv: b.uv, size: p.texture });
    }
  }
  return out;
}

function entity(type) {
  return { id: type, type, x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, renderYawOffset: 0, prevRenderYawOffset: 0, rotationYawHead: 0, prevRotationYawHead: 0,
    rotationPitch: 0, prevRotationPitch: 0, limbSwing: 0, limbSwingAmount: 0, prevLimbSwingAmount: 0, age: 0, death: 0, hurt: 0, growingAge: 0,
    lastActive: 0, fuseTime: 0, color: 0 };
}
function renderer() {
  const uniforms = { lightmap: { value: null }, fogColor: { value: new THREE.Vector3() }, fogNear: { value: 0 }, fogFar: { value: 1 }, fogDensity: { value: 0 } };
  return new MobRenderer(new THREE.Scene(), { lighting: { uniforms }, brightness: () => 0 });
}
// The rig at rest: the per-frame pose with every limb, wing and head angle back at zero.
function restRig(type) {
  const view = renderer(), e = entity(type);
  view.update([e], 0, 1);
  const rig = view.rigs.get(e.id);
  for (const g of [...rig.limbs, ...(rig.wings ?? []), rig.neck]) g.rotation.set(0, 0, 0);
  rig.root.updateMatrixWorld(true);
  return rig;
}
const near = (a, b) => a.min.distanceTo(b.min) < 1e-6 && a.max.distanceTo(b.max) < 1e-6;
const show = (b) => `[${b.min.toArray().map((v) => +(v * 16).toFixed(3))}]..[${b.max.toArray().map((v) => +(v * 16).toFixed(3))}]`;

for (const [type, models] of Object.entries(RIGS)) {
  test(`${type} rig boxes match the original model at rest`, () => {
    const rig = restRig(type),
      actual = [];
    rig.root.traverse((o) => {
      if (!o.isMesh || o.geometry.type !== "BoxGeometry" || o.material === rig.eyes) return;
      const uv = o.geometry.attributes.uv;
      let u = Infinity, v = -Infinity;
      for (let i = 0; i < uv.count; i++) { u = Math.min(u, uv.getX(i)); v = Math.max(v, uv.getY(i)); }
      actual.push({ box: new THREE.Box3().setFromObject(o), u, v });
    });
    const expected = models.flatMap(([name, parts, rest]) => expectedBoxes(name, parts, rest));
    assert.equal(actual.length, expected.length, `${type}: ${actual.length} boxes drawn, ${expected.length} in the model`);
    const left = [...actual];
    for (const want of expected) {
      const i = left.findIndex((have) => near(have.box, want.box));
      assert.ok(i >= 0, `${type}: no drawn box at ${show(want.box)}; drawn: ${left.map((h) => show(h.box)).join(" ")}`);
      // The box's texture offset: three.js flips v, so the top of the skin is the largest v.
      const [have] = left.splice(i, 1), [w, h] = want.size;
      assert.deepEqual([Math.round(have.u * w), Math.round((1 - have.v) * h)], want.uv, `${type}: texture offset of ${show(want.box)}`);
    }
  });
}

test("cow and pig child heads use childYOffset / childZOffset", () => {
  assert.deepEqual([model.pig.parts["bhw.g"], model.pig.parts["bhw.h"]], [4, 4]);
  assert.deepEqual([model.cow.parts["bhw.g"], model.cow.parts["bhw.h"]], [8, 6]);
  for (const [type, [px, py, pz], [dy, dz]] of [["pig", model.pig.parts["bhw.a"].point, [4, 4]], ["cow", model.cow.parts["bhw.a"].point, [8, 6]]]) {
    const view = renderer(), e = { ...entity(type), growingAge: -24000 };
    view.update([e], 0, 1);
    const { root, neck } = view.rigs.get(type);
    root.updateMatrixWorld(true);
    const at = new THREE.Vector3().setFromMatrixPosition(neck.matrixWorld);
    assert.ok(Math.abs(at.x - px / 16) < 1e-9 && Math.abs(at.y - ((24 - py - dy) / 16 + 1 / 128)) < 1e-9 && Math.abs(at.z - (-pz - dz) / 16) < 1e-9, `${type} child head at ${at.toArray()}`);
    assert.ok(Math.abs(new THREE.Vector3().setFromMatrixScale(neck.matrixWorld).x - 1) < 1e-9, `${type} child head is drawn full size`);
  }
});

// An 8-bit RGBA, non-interlaced PNG's pixels (both skins are stored that way).
function rgba(bytes) {
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20), idat = [];
  assert.deepEqual([bytes[24], bytes[25], bytes[28]], [8, 6, 0]);
  for (let at = 8; at < bytes.length; ) {
    const length = bytes.readUInt32BE(at), kind = bytes.toString("latin1", at + 4, at + 8);
    if (kind === "IDAT") idat.push(bytes.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = width * 4, data = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? data[y * stride + x - 4] : 0, b = y ? data[(y - 1) * stride + x] : 0, c = x >= 4 && y ? data[(y - 1) * stride + x - 4] : 0,
        pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c),
        predict = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      data[y * stride + x] = raw[y * (stride + 1) + 1 + x] + predict;
    }
  }
  return { width, data };
}
test("biped headwear is transparent on the zombie and skeleton skins", () => {
  for (const file of ["zombie/zombie.png", "skeleton/skeleton.png"]) {
    const png = rgba(readFileSync(new URL(`../public/media/1.7.10/entity/${file}`, import.meta.url)));
    let opaque = 0;
    for (let y = 0; y < 16; y++) for (let x = 32; x < 64; x++) opaque += png.data[(y * png.width + x) * 4 + 3] > 0;
    assert.equal(opaque, 0, file);
  }
  // The decoder sees the head itself, so an all-zero result is not a misread.
  const head = rgba(readFileSync(new URL("../public/media/1.7.10/entity/zombie/zombie.png", import.meta.url)));
  assert.ok(head.data[(8 * head.width + 8) * 4 + 3] > 0);
});

test("the third-person player's ModelBiped table matches ModelBiped(0)", async () => {
  const { BIPED } = await import("./player-renderer.js");
  const parts = { head: "bhm.c", hat: "bhm.d", body: "bhm.e", rightArm: "bhm.f", leftArm: "bhm.g", rightLeg: "bhm.h", leftLeg: "bhm.i" };
  for (const [name, key] of Object.entries(parts)) {
    const p = model.biped.parts[key], [b] = p.boxes, ours = BIPED[name];
    assert.deepEqual(ours.point, p.point, name);
    assert.deepEqual(ours.uv, b.uv, name);
    assert.deepEqual(ours.box, [...b.from, ...b.to.map((t, i) => t - b.from[i])], name);
    assert.equal(ours.extra, b.grow, name);
    assert.equal(!!ours.mirror, p.mirror, name);
  }
});
