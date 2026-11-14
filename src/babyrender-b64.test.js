import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";

// three's TextureLoader asks the DOM for an <img>; the geometry under test never loads one.
globalThis.document ??= { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }) };
const { MobRenderer } = await import("./mob-renderer.js");

// Executed ModelBase.render of the unchanged 1.7.10 models, adult and child, at the constructor rest angles (tools/probes/BabyModelProbe.java).
const reference = JSON.parse(readFileSync(new URL("../public/research/baby-model-reference.json", import.meta.url)));
const record = Object.fromEntries(reference.models.map((m) => [m.model, m]));
const RAD = Math.PI / 180, LIFT = 1 / 128;

// The GL stack of one render, as the matrix of every drawn part. Units: blocks, model axes (y down, z back), origin 24 pixels above the feet.
function partMatrices(events) {
  const stack = [], out = new Map(), t = new THREE.Matrix4();
  let m = new THREE.Matrix4();
  for (const e of events) {
    if (e[0] === "P") stack.push(m.clone());
    else if (e[0] === "O") m = stack.pop();
    else if (e[0] === "T") m.multiply(t.makeTranslation(e[1], e[2], e[3]));
    else if (e[0] === "S") m.multiply(t.makeScale(e[1], e[2], e[3]));
    else if (e[0] === "R") m.multiply(t.makeRotationAxis(new THREE.Vector3(e[2], e[3], e[4]), e[1] * RAD));
    else if (e[0] === "L") out.set(e[1], m.clone());
  }
  return out;
}

// The boxes a render draws, in the rig's frame (x, 24 - y, -z) / 16 plus RendererLivingEntity's 1/128 lift. The biped's headwear is not drawn by the port
// (zombie.png and skeleton.png are transparent there, models.test.js).
function expectedBoxes(model, which, skip = []) {
  const rec = record[model], matrices = partMatrices(rec.render[which]), boxes = [];
  for (const [name, part] of Object.entries(rec.parts)) {
    if (skip.includes(name) || !matrices.has(name)) continue;
    const m = matrices.get(name);
    for (const b of part.boxes) {
      const box = new THREE.Box3();
      for (const x of [b.from[0] - b.grow, b.to[0] + b.grow]) for (const y of [b.from[1] - b.grow, b.to[1] + b.grow]) for (const z of [b.from[2] - b.grow, b.to[2] + b.grow]) {
        const v = new THREE.Vector3(x / 16, y / 16, z / 16).applyMatrix4(m);
        box.expandByPoint(new THREE.Vector3(v.x, 1.5 - v.y + LIFT, -v.z));
      }
      boxes.push({ name, box });
    }
  }
  return boxes;
}

function entity(type, extra = {}) {
  return { id: type, type, x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, renderYawOffset: 0, prevRenderYawOffset: 0, rotationYawHead: 0, prevRotationYawHead: 0,
    rotationPitch: 0, prevRotationPitch: 0, limbSwing: 0, limbSwingAmount: 0, prevLimbSwingAmount: 0, age: 0, death: 0, hurt: 0, growingAge: 0,
    lastActive: 0, fuseTime: 0, color: 0, ...extra };
}
function renderer() {
  const uniforms = { lightmap: { value: null }, fogColor: { value: new THREE.Vector3() }, fogNear: { value: 0 }, fogFar: { value: 1 }, fogDensity: { value: 0 } };
  return new MobRenderer(new THREE.Scene(), { lighting: { uniforms }, brightness: () => 0 });
}
// The rig at rest: the per-frame pose with every limb, wing and head angle back at zero.
function restRig(type, baby, extra) {
  const view = renderer(), e = entity(type, { growingAge: baby ? -24000 : 0, ...extra });
  view.update([e], 0, 1);
  const rig = view.rigs.get(e.id);
  for (const g of [...rig.limbs, ...(rig.wings ?? []), rig.neck]) g.rotation.set(0, 0, 0);
  rig.root.updateMatrixWorld(true);
  return rig;
}
function drawnBoxes(rig) {
  const out = [];
  rig.root.traverse((o) => {
    if (o.isMesh && o.geometry.type === "BoxGeometry" && o.material !== rig.eyes && !rig.saddleParts?.includes(o)) out.push(new THREE.Box3().setFromObject(o));
  });
  return out;
}
const near = (a, b) => a.min.distanceTo(b.min) < 1e-5 && a.max.distanceTo(b.max) < 1e-5;
const show = (b) => `[${b.min.toArray().map((v) => +(v * 16).toFixed(3))}]..[${b.max.toArray().map((v) => +(v * 16).toFixed(3))}]`;
// Every box the original model draws is drawn by the rig at the same place; returns the pairs it could not place.
function missing(type, models, which, baby, extra) {
  const actual = drawnBoxes(restRig(type, baby, extra)), lost = [];
  for (const [model, skip] of models) for (const want of expectedBoxes(model, which, skip)) {
    const i = actual.findIndex((b) => near(b, want.box));
    if (i < 0) lost.push(`${model} ${want.name} ${show(want.box)}`);
  }
  return { lost, actual };
}

const HAT = ["bhm.d"];
const RIGS = [
  ["pig", [["pig", []]]],
  ["cow", [["cow", []]]],
  ["sheep", [["sheep", []], ["sheepFur", []]]],
  ["chicken", [["chicken", []]]],
  ["zombie", [["zombie", HAT]]],
  ["pigman", [["zombie", HAT]]],
  ["ocelot", [["ocelot", []]]],
];
for (const [type, models] of RIGS) {
  for (const baby of [false, true]) {
    test(`${type} ${baby ? "child" : "adult"}: every box of the executed ModelBase.render is drawn at its place`, () => {
      const { lost } = missing(type, models, baby ? "child" : "adult", baby);
      assert.deepEqual(lost, []);
    });
  }
}

const WOLF = { owner: "", sitting: false, angry: false, dwHealth: 20, shakeTime: 0, prevShakeTime: 0, headTilt: 0, prevHeadTilt: 0 };
// The wolf rig is posed every frame by ModelWolf's own animation maths, so its rest differs from the constructor's. The child frame is compared instead: what the executed
// render does to a part between the adult and the child draw (child matrix times the inverse of the adult one) is applied to the port's adult boxes.
test("wolf child: the executed head and body frames carry the port's adult boxes onto its child boxes", () => {
  const adultM = partMatrices(record.wolf.render.adult), childM = partMatrices(record.wolf.render.child);
  const F = new THREE.Matrix4().makeTranslation(0, 1.5 + LIFT, 0).multiply(new THREE.Matrix4().makeScale(1, -1, -1)), Fi = F.clone().invert();
  const delta = (name) => F.clone().multiply(childM.get(name)).multiply(adultM.get(name).clone().invert()).multiply(Fi);
  const headDelta = delta("bio.a"), bodyDelta = delta("bio.b");
  for (const name of ["bio.c", "bio.d", "bio.e", "bio.f", "bio.g", "bio.h"]) {
    const d = delta(name);
    for (let i = 0; i < 16; i++) assert.ok(Math.abs(d.elements[i] - bodyDelta.elements[i]) < 1e-6, `${name} moves with the body`);
  }
  const grab = (baby) => {
    const rig = restRig("wolf", baby, WOLF), head = [], rest = [];
    rig.wolf.skin.head.traverse((o) => o.isMesh && head.push(new THREE.Box3().setFromObject(o)));
    rig.wolf.skin.meshes.forEach((m) => { if (!head.some((b) => b.equals(new THREE.Box3().setFromObject(m)))) rest.push(new THREE.Box3().setFromObject(m)); });
    return { head, rest };
  };
  const a = grab(false), c = grab(true);
  assert.equal(a.head.length, c.head.length);
  assert.equal(a.rest.length, c.rest.length);
  a.head.forEach((b, i) => assert.ok(near(b.clone().applyMatrix4(headDelta), c.head[i]), `head box ${i}: ${show(b.clone().applyMatrix4(headDelta))} vs ${show(c.head[i])}`));
  a.rest.forEach((b, i) => assert.ok(near(b.clone().applyMatrix4(bodyDelta), c.rest[i]), `body box ${i}`));
});

test("a villager has no child branch in ModelVillager.render: the whole rig is only scaled (executed, RenderVillager scales it)", () => {
  const adult = restRig("villager", false), child = restRig("villager", true);
  assert.deepEqual(record.villager.render.adult, record.villager.render.child);
  assert.deepEqual(record.zombieVillager.render.child[0], ["P"]); // a zombie villager is a ModelBiped: head 0.75, body 0.5
  // the child's boxes are the adult's, scaled about the feet by the villager's own 0.5 (the rig root; the lift stays)
  const a = drawnBoxes(adult), c = drawnBoxes(child);
  assert.equal(a.length, c.length);
  const center = new THREE.Vector3(), cc = new THREE.Vector3();
  a.forEach((box, i) => {
    box.getCenter(center); c[i].getCenter(cc);
    assert.ok(Math.abs(cc.x - center.x * 0.5) < 1e-6 && Math.abs(cc.z - center.z * 0.5) < 1e-6 && Math.abs(cc.y - ((center.y - LIFT) * 0.5 + LIFT)) < 1e-6, `box ${i}`); // the 1/128 lift is not scaled
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// A mob holding a block (RenderBiped.renderEquippedItems, 3D branch), adult and child, against the executed held-pose-reference.json.
const held = JSON.parse(readFileSync(new URL("../public/research/held-pose-reference.json", import.meta.url)));
const { heldKind, heldItemMatrix } = await import("./player-renderer.js");
const { followChildHeld } = await import("./mob-equipment-renderer.js");
const { toLiveStack } = await import("./mob-equipment-live.js");

function replay(events, stop) {
  const m = new THREE.Matrix4(), t = new THREE.Matrix4();
  let on = false;
  for (const e of events) {
    if (e[0] === stop) break;
    if (!on) { on = e[0] === "T"; if (!on) continue; }
    if (e[0] === "T") m.multiply(t.makeTranslation(e[1], e[2], e[3]));
    else if (e[0] === "S") m.multiply(t.makeScale(e[1], e[2], e[3]));
    else if (e[0] === "R") m.multiply(t.makeRotationAxis(new THREE.Vector3(e[2], e[3], e[4]), e[1] * RAD));
  }
  return m;
}
function equipped(type, baby, id, damage) {
  const view = renderer();
  view.view.textures = { texture: new THREE.DataTexture(new Uint8Array(4), 1, 1) };
  const e = entity(type, { growingAge: baby ? -24000 : 0, equipment: [{ id, count: 1, damage }, null, null, null, null] });
  view.update([e], 0, 1);
  const rig = view.rigs.get(e.id);
  for (const g of [...rig.limbs, rig.neck]) g.rotation.set(0, 0, 0);
  followChildHeld(rig);
  rig.root.updateMatrixWorld(true);
  return rig;
}
const BLOCK_CASES = held.cases.filter((c) => c.who === "babyBiped" && c.events.some((e) => e[0] === "B"));

test("the executed baby biped record has block items, and the port classes them as blocks", () => {
  assert.ok(BLOCK_CASES.length >= 7, `${BLOCK_CASES.length} block cases`);
  const live = BLOCK_CASES.map((c) => toLiveStack({ id: c.id, damage: c.damage }));
  assert.ok(live.every(Boolean));
  assert.ok(live.every((s) => heldKind(s.id, s.damage) === "block"));
});

for (const baby of [false, true]) {
  for (const type of ["zombie", "pigman"]) {
    test(`a ${baby ? "baby " : ""}${type} holding a block puts the cube where the executed RenderBiped frame does`, () => {
      const model = new THREE.Matrix4().makeTranslation(0, 1.5, 0).multiply(new THREE.Matrix4().makeScale(1, -1, -1)); // model blocks -> rig
      const arm = new THREE.Matrix4().makeTranslation(-5 / 16, 2 / 16, 0); // arm at rest: postRender is a translate to the pivot
      for (const c of BLOCK_CASES) {
        const stack = toLiveStack({ id: c.id, damage: c.damage }), rig = equipped(type, baby, c.id, c.damage);
        assert.equal(heldKind(stack.id, stack.damage), "block");
        const ref = held.cases.find((r) => r.who === (baby ? "babyBiped" : "biped") && r.id === c.id && r.damage === c.damage && r.use === c.use);
        const i = ref.events.findIndex((e) => e[0] === "T" && e[1] === -0.3125 && e[2] === 0.125);
        const want = new THREE.Matrix4().makeTranslation(0, LIFT, 0).multiply(model).multiply(replay(ref.events.slice(0, i), "none")).multiply(arm).multiply(replay(ref.events.slice(i + 1), "none"));
        // the block mesh hangs under item group -> flip -> follow (child) or limb (adult)
        const fixed = [];
        for (const n of rig.gearNodes) n.traverse((o) => { if (o.matrixAutoUpdate === false) fixed.push(o); });
        const group = fixed[fixed.length - 1], got = group.matrixWorld; // the deepest fixed-matrix node is the item group
        assert.ok(group.children.length === 1 && group.children[0].matrixAutoUpdate !== false, `a block under the item group for ${c.id}`);
        // the native frame is unscaled and the port's adult root is unscaled too; the child root carries 0.5, undone by the follow matrix
        const e = want.elements;
        for (let k = 0; k < 16; k++) assert.ok(Math.abs(got.elements[k] - e[k]) < 1e-5, `${type} ${baby ? "baby " : ""}block ${c.id}:${c.damage} element ${k}: ${got.elements[k]} vs ${e[k]}`);
      }
    });
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// ItemRenderer.renderItemInFirstPerson, executed (first-person-reference.json, FirstPersonProbe: the unchanged bly.a(float) with a stand-in Minecraft, player and world; its
// GL calls are recorded). The port's firstPersonMatrix is replayed against every case: idle, swinging, blocking sword, bow draws, eating, drinking, a block, a turned view.
// native swing angles use the MathHelper sine table (about 1e-4 error), so the replay tolerance is 3e-4
const { firstPersonMatrix } = await import("./first-person-pose.js");
const { swingPose } = await import("./animation.js");
const fp = JSON.parse(readFileSync(new URL("../public/research/first-person-reference.json", import.meta.url)));
function itemFrame(events) {
  // after the light group's pop (the arm-lag sway rotations and the item branch follow it) to the first draw, in glTranslate / glRotate / glScale order
  const start = events.findIndex((e) => e[0] === "O"), m = new THREE.Matrix4(), t = new THREE.Matrix4();
  for (const e of events.slice(start + 1)) {
    if (e[0] === "D" || e[0] === "B") break;
    if (e[0] === "T") m.multiply(t.makeTranslation(e[1], e[2], e[3]));
    else if (e[0] === "S") m.multiply(t.makeScale(e[1], e[2], e[3]));
    else if (e[0] === "R") m.multiply(t.makeRotationAxis(new THREE.Vector3(e[2], e[3], e[4]), e[1] * RAD));
  }
  return m;
}
test("the first-person item matrix replays every executed ItemRenderer case", () => {
  assert.equal(fp.cases.length, 67); // 42 held-item cases and 25 map cases (batch 65, itemsprites2-b65.test.js replays those)
  let blockingCases = 0, bowCases = 0, eatCases = 0;
  for (const c of fp.cases.filter((c) => c.id !== 358)) {
    const [pitch, , yaw, , armPitch, armPitchPrev, armYaw, armYawPrev] = c.view, f32 = Math.fround;
    const lerp = (a, b) => f32(a + f32(f32(b - a) * f32(c.partial)));
    const equip = lerp(c.prevEquip, c.equip);
    const pose = { progress: c.swing, item: c.id, equip, swing: swingPose(c.swing), bob: { x: 0, y: 0, rz: 0, rx: 0 },
      sway: { x: f32(f32(pitch - lerp(armPitchPrev, armPitch)) * 0.1) * RAD, y: f32(f32(yaw - lerp(armYawPrev, armYaw)) * 0.1) * RAD } };
    const using = c.use > 0, rod = c.id === 346, drawn = c.events.some((e) => e[0] === "D"), opts = { sprite: drawn, turnAround: rod };
    if (using && c.id === 267) { opts.blocking = true; blockingCases++; }
    if (using && c.id === 261) { opts.bowDraw = 72000 - (c.use - c.partial + 1); bowCases++; }
    if (using && (c.id === 297 || c.id === 373)) { opts.eatingTicks = c.use - c.partial + 1; eatCases++; }
    const got = firstPersonMatrix(pose, opts), want = itemFrame(c.events);
    for (let i = 0; i < 16; i++) assert.ok(Math.abs(got.elements[i] - want.elements[i]) < 3e-4 * Math.max(1, Math.abs(want.elements[i])), `item ${c.id} use ${c.use} swing ${c.swing} view ${c.view} element ${i}: ${got.elements[i]} vs ${want.elements[i]}`);
  }
  assert.ok(blockingCases >= 5 && bowCases >= 8 && eatCases >= 4);
});
