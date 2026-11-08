import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  cameraDistance, thirdPersonCamera, nextView, PlayerBody, javaYaw, modelBox, bipedPose, armorLayer, heldKind,
  heldItemMatrix, ARMOR_PASS_PARTS, playerShadowCaster, BIPED, sleepingTransform, SLEEP_YAW,
  playerRootRotation, sleeperShadowCaster, SLEEP_SIZE,
} from "./player-renderer.js";
import { BedSleep, BED_DIR } from "./bed.js";
import { mobPose } from "./entities.js";
import { shadowQuads, SHADOWS } from "./shadows.js";

const slab = (z0, z1) => ({ get: (x, y, z) => (z >= z0 && z < z1 && x >= 0 && x < 40 && y >= 0 && y < 20 ? 1 : 0) });
const open = { get: () => 0 };
const eye = { x: 10.5, y: 5.5, z: 10.5 };

test("F5 cycles 0, 1, 2 and wraps", () => {
  assert.deepEqual([0, 1, 2].map(nextView), [1, 2, 0]);
});

test("camera stays at distance 4 in open space, behind or in front", () => {
  assert.equal(cameraDistance(open, eye, 0, 0, 1), 4);
  const back = thirdPersonCamera(open, eye, 0, 0, 1), front = thirdPersonCamera(open, eye, 0, 0, 2);
  // yaw 0 looks toward -z: behind is +z, in front is -z.
  assert.deepEqual(back.position.map((v) => +v.toFixed(6)), [10.5, 5.5, 14.5]);
  assert.deepEqual(front.position.map((v) => +v.toFixed(6)), [10.5, 5.5, 6.5]);
  assert.equal(front.rotation.y, Math.PI);
  assert.equal(front.rotation.x, -0);
});

test("front view negates pitch and the camera looks back at the player", () => {
  const pitch = 0.4, yaw = 0.9, cam = thirdPersonCamera(open, eye, yaw, pitch, 2),
    dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(cam.rotation.x, cam.rotation.y, 0, "YXZ")),
    to = new THREE.Vector3(eye.x - cam.position[0], eye.y - cam.position[1], eye.z - cam.position[2]).normalize();
  assert.ok(dir.distanceTo(to) < 1e-9);
});

test("a wall pulls the camera in to the nearest of eight corner rays, with the 1.7.10 x end-point quirk", () => {
  const d = cameraDistance(slab(12, 13), eye, 0, 0, 1);
  let expected = 4;
  for (let i = 0; i < 8; i++) {
    const a = ((i & 1) * 2 - 1) * 0.1, b = (((i >> 1) & 1) * 2 - 1) * 0.1, c = (((i >> 2) & 1) * 2 - 1) * 0.1,
      t = (12 - (10.5 + c)) / 4;
    // x also drifts by c * t because the end x adds f6.
    expected = Math.min(expected, Math.hypot(a + t * c, b, 1.5));
  }
  assert.ok(Math.abs(d - expected) < 1e-9, `${d} vs ${expected}`);
  assert.ok(d < 1.6 && d > 1.4);
  // Position follows the shortened distance.
  assert.ok(Math.abs(thirdPersonCamera(slab(12, 13), eye, 0, 0, 1).position[2] - (10.5 + d)) < 1e-9);
});

test("a wall beyond 4 blocks does not move the camera; front view traces the other way", () => {
  assert.equal(cameraDistance(slab(16, 17), eye, 0, 0, 1), 4);
  assert.equal(cameraDistance(slab(12, 13), eye, 0, 0, 2), 4);
  assert.ok(cameraDistance(slab(8, 9), eye, 0, 0, 2) < 2.7);
});

test("limb swing, arm swing and held item follow ModelBiped.setRotationAngles", () => {
  const rest = bipedPose();
  assert.deepEqual(rest.rightLeg.point, [-1.9, 12.1 - 0.1, 0.1]);
  assert.deepEqual(rest.head.point, [0, 0, 0]);
  const walk = bipedPose({ limbSwing: 1, limbSwingAmount: 1, age: 0 });
  // Opposite legs and arms swing against each other.
  assert.ok(Math.abs(walk.rightLeg.rot[0] + walk.leftLeg.rot[0]) < 1e-3);
  assert.ok(Math.abs(walk.rightArm.rot[0] + walk.leftArm.rot[0]) < 0.2);
  assert.ok(Math.abs(walk.rightLeg.rot[0] - Math.cos(0.6662) * 1.4) < 1e-3);
  // Arms always hang slightly out (cos(0) * 0.05 + 0.05).
  assert.ok(Math.abs(rest.rightArm.rot[2] - 0.1) < 1e-6 && Math.abs(rest.leftArm.rot[2] + 0.1) < 1e-6);
  const held = bipedPose({ heldRight: 1 });
  assert.ok(Math.abs(held.rightArm.rot[0] + 0.31415927) < 1e-6);
  const head = bipedPose({ headYaw: 90, headPitch: 45 });
  assert.ok(Math.abs(head.head.rot[1] - Math.PI / 2) < 1e-4 && Math.abs(head.hat.rot[0] - Math.PI / 4) < 1e-4);
});

test("swing progress twists the body and raises the right arm", () => {
  const s = bipedPose({ swing: 0.5 });
  const body = Math.sin(Math.sqrt(0.5) * Math.PI * 2) * 0.2;
  assert.ok(Math.abs(s.body.rot[1] - body) < 1e-3);
  assert.ok(Math.abs(s.rightArm.point[0] + Math.cos(body) * 5) < 1e-3);
  assert.ok(Math.abs(s.rightArm.point[2] - Math.sin(body) * 5) < 1e-3);
  const q = 1 - Math.pow(0.5, 4), expectedX = -(Math.sin(q * Math.PI) * 1.2 + 0.7 * 0.75);
  assert.ok(Math.abs(s.rightArm.rot[0] - expectedX) < 1e-3, String(s.rightArm.rot[0]));
  assert.ok(Math.abs(s.rightArm.rot[2] - (-0.4 + 0.1)) < 1e-3);
  assert.ok(Math.abs(s.leftArm.rot[0] - body) < 1e-3);
});

test("sneak pose leans the body and moves legs and head", () => {
  const s = bipedPose({ sneak: true });
  assert.equal(s.body.rot[0], 0.5);
  assert.deepEqual([s.rightLeg.point[1], s.rightLeg.point[2], s.head.point[1], s.hat.point[1]], [9, 4, 1, 1]);
  assert.ok(Math.abs(s.rightArm.rot[0] - 0.4) < 1e-6);
});

test("body yaw follows the head by 30% per tick and never trails by more than 75 degrees", () => {
  const body = new PlayerBody();
  const pos = { x: 5, y: 1, z: 5 };
  body.reset(pos, 0, 0);
  assert.equal(body.renderYawOffset, 180);
  // Turn the head 90 degrees left without moving.
  const yaw = Math.PI / 2;
  body.tick({ position: pos, previous: pos, yaw, pitch: 0 });
  const head = javaYaw(yaw);
  assert.equal(head, 90);
  assert.ok(Math.abs(wrap(body.rotationYaw - body.renderYawOffset)) <= 75 + 1e-3);
  for (let i = 0; i < 60; i++) body.tick({ position: pos, previous: pos, yaw, pitch: 0 });
  // 90 - 75 = 15 is the farthest it trails; the 2500 rule drags it the rest of the way slowly.
  assert.ok(Math.abs(wrap(body.rotationYaw - body.renderYawOffset)) <= 75 + 1e-3);
  assert.equal(body.limbSwingAmount, 0);
});

const wrap = (a) => ((a + 540) % 360) - 180;

test("walking turns the body toward the movement and drives limb swing", () => {
  const body = new PlayerBody(), prev = { x: 5, y: 1, z: 5 };
  body.reset(prev, 0, 0);
  // Moving forward (yaw 0 faces -z) keeps the body facing the same way.
  const pos = { x: 5, y: 1, z: 4.8 };
  body.tick({ position: pos, previous: prev, yaw: 0, pitch: 0 });
  assert.ok(Math.abs(wrap(body.renderYawOffset - 180)) < 1e-3);
  assert.ok(body.limbSwingAmount > 0.2 && body.limbSwing > 0);
  assert.equal(body.prevLimbSwingAmount, 0);
  const amount = body.limbSwingAmount;
  body.tick({ position: { x: 5, y: 1, z: 4.6 }, previous: pos, yaw: 0, pitch: 0 });
  assert.ok(body.limbSwingAmount > amount && body.limbSwingAmount <= 1);
  assert.equal(body.prevLimbSwingAmount, amount);
});

test("a swing snaps the body target to the head", () => {
  const body = new PlayerBody(), p = { x: 0, y: 0, z: 0 };
  body.reset(p, 0, 0);
  body.tick({ position: { x: 1, y: 0, z: 0 }, previous: p, yaw: 0, pitch: 0, swinging: true });
  assert.ok(Math.abs(wrap(body.renderYawOffset - 180)) < 1e-3);
});

test("model box normals point outward, mirrored or not", () => {
  for (const mirror of [false, true])
    for (const expand of [0, 0.5, 1]) {
      const g = modelBox(40, 16, -3, -2, -2, 4, 12, 4, expand, mirror),
        p = g.attributes.position, n = g.attributes.normal, c = new THREE.Vector3((-3 + 2) / 16, (-2 + 6) / 16, 0);
      assert.equal(p.count, 36);
      for (let q = 0; q < 6; q++) {
        const centroid = new THREE.Vector3();
        for (let k = 0; k < 6; k++) centroid.add(new THREE.Vector3().fromBufferAttribute(p, q * 6 + k));
        centroid.divideScalar(6).sub(c);
        const normal = new THREE.Vector3().fromBufferAttribute(n, q * 6);
        assert.ok(Math.abs(normal.length() - 1) < 1e-6);
        assert.ok(normal.dot(centroid) > 0, `quad ${q} mirror ${mirror}`);
      }
    }
});

test("model box UVs use the skin layout (head front face)", () => {
  const g = modelBox(0, 0, -4, -8, -4, 8, 8, 8, 0, false), uv = g.attributes.uv, pos = g.attributes.position;
  // Quad 4 is the z-min face; its region is u 8..16, v 8..16 of a 64x32 sheet.
  const us = [], vs = [];
  for (let k = 0; k < 6; k++) { us.push(uv.getX(4 * 6 + k)); vs.push(uv.getY(4 * 6 + k)); assert.equal(pos.getZ(4 * 6 + k), -0.25); }
  assert.equal(Math.min(...us), 8 / 64);
  assert.equal(Math.max(...us), 16 / 64);
  assert.equal(Math.min(...vs), 1 - 16 / 32);
  assert.equal(Math.max(...vs), 1 - 8 / 32);
});

test("armor layers: layer 1 for helmet, chest and boots, layer 2 for leggings", () => {
  const iron = [402, 403, 404, 405].map((_, i) => 400 + 2 * 4 + i);
  assert.equal(armorLayer(iron[0], 0).url, "/media/1.7.10/models/armor/iron_layer_1.png");
  assert.equal(armorLayer(iron[1], 1).url, "/media/1.7.10/models/armor/iron_layer_1.png");
  assert.equal(armorLayer(iron[2], 2).url, "/media/1.7.10/models/armor/iron_layer_2.png");
  assert.equal(armorLayer(iron[3], 3).url, "/media/1.7.10/models/armor/iron_layer_1.png");
  assert.deepEqual(iron.map((id, pass) => armorLayer(id, pass).expand), [1, 1, 0.5, 1]);
  assert.equal(armorLayer(iron[0], 0).overlay, null);
  assert.equal(armorLayer(iron[0], 0).tint, null);
  for (const [m, name] of [[1, "chainmail"], [3, "gold"], [4, "diamond"]])
    assert.ok(armorLayer(400 + m * 4 + 2, 2).url.endsWith(`${name}_layer_2.png`));
});

test("leather is tinted 0xA06540 and draws its overlay", () => {
  const cap = armorLayer(400, 0), pants = armorLayer(402, 2);
  assert.deepEqual(cap.tint.map((v) => Math.round(v * 255)), [0xa0, 0x65, 0x40]);
  assert.ok(cap.overlay.endsWith("leather_layer_1_overlay.png"));
  assert.ok(pants.overlay.endsWith("leather_layer_2_overlay.png"));
});

test("saved leather dye changes worn base tint and leaves the overlay and metal armor unchanged", () => {
  const layer = armorLayer(400, 0, 0x1278ab);
  assert.deepEqual(layer.tint.map(v => Math.round(v * 255)), [0x12, 0x78, 0xab]);
  assert.equal(layer.overlay, armorLayer(400, 0).overlay);
  assert.deepEqual(armorLayer(403, 3, 0).tint, [0, 0, 0]);
  assert.equal(armorLayer(408, 0, 0x1278ab).tint, null);
});

test("armor must match its slot, and non-armor gives no layer", () => {
  assert.equal(armorLayer(0, 0), null);
  assert.equal(armorLayer(300, 1), null);
  assert.equal(armorLayer(408, 3), null);
  assert.equal(armorLayer(411, 3).parts.join(), "rightLeg,leftLeg");
});

test("each pass shows the parts RenderPlayer.shouldRenderPass enables", () => {
  assert.deepEqual(ARMOR_PASS_PARTS, [["head", "hat"], ["body", "rightArm", "leftArm"], ["body", "rightLeg", "leftLeg"], ["rightLeg", "leftLeg"]]);
  for (const part of ARMOR_PASS_PARTS.flat()) assert.ok(BIPED[part]);
});

test("held item classes: cube blocks, full-3D tools, flat items", () => {
  assert.equal(heldKind(3), "block");
  assert.equal(heldKind(100), "tool");
  assert.equal(heldKind(112), "tool");
  assert.equal(heldKind(300), "tool");
  assert.equal(heldKind(311), "tool");
  assert.equal(heldKind(125), "flat");
  assert.equal(heldKind(20), "flat");
  assert.equal(heldKind(200), "flat");
  for (const kind of ["block", "tool", "flat"]) assert.ok(heldItemMatrix(kind).elements.every(Number.isFinite));
  // Block items shrink to 0.375 and flip x and y; tools scale 0.625 * 1.5.
  const block = heldItemMatrix("block").elements;
  assert.ok(Math.abs(Math.hypot(block[0], block[1], block[2]) - 0.375) < 1e-9);
  const tool = heldItemMatrix("tool").elements;
  assert.ok(Math.abs(Math.hypot(tool[0], tool[1], tool[2]) - 0.625 * 1.5) < 1e-9);
});

test("the player shadow is centred on posY (eye height) + height / 2, as 1.7.10", () => {
  const prev = { x: 5, y: 10, z: 5 }, pos = { x: 6, y: 10, z: 5 },
    caster = playerShadowCaster(pos, prev, 0.5, SHADOWS.player);
  assert.equal(SHADOWS.player.size, Math.fround(0.5));
  assert.equal(SHADOWS.player.opaque, 1);
  assert.equal(caster.x, 5.5);
  assert.ok(Math.abs(caster.y - 11.62) < 1e-9);
  assert.equal(caster.height, 1.8);
  const floor = { get: (x, y, z) => (y < 10 ? 1 : 0), light: () => 15 }, viewer = { x: 6, y: 11.62, z: 5 };
  // Over flat ground the centre is 2.52 up, so no solid cell lies below it.
  assert.equal(shadowQuads(caster, viewer, floor).length, 0);
  // With a ceiling just above the head, the shadow lands on it.
  const ceiling = { get: (x, y) => (y === 11 ? 1 : 0), light: () => 15 };
  assert.ok(shadowQuads(caster, viewer, ceiling).length > 0);
});

test("a sleeper lies on its back along the bed with its feet 1.8 from the entity position (RenderPlayer.rotateCorpse)", () => {
  assert.deepEqual(SLEEP_YAW, [90, 0, 270, 180]);
  for (let facing = 0; facing < 4; facing++) {
    const [dx, dz] = BED_DIR[facing], pos = { x: 10.5 + dx * 0.4, y: 64.9375, z: 20.5 + dz * 0.4 };
    const offset = [-1.8 * dx, 0, -1.8 * dz], at = sleepingTransform({ pos, offset, facing });
    assert.ok(Math.abs(at.x - (pos.x - 1.8 * dx)) < 1e-9 && Math.abs(at.z - (pos.z - 1.8 * dz)) < 1e-9);
    assert.ok(Math.abs(at.y - 64.7375) < 1e-9);
    // Model up (feet to head) points at the bed head; the face (-z) points at the sky.
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(at.quaternion), face = new THREE.Vector3(0, 0, -1).applyQuaternion(at.quaternion);
    assert.ok(up.distanceTo(new THREE.Vector3(dx, 0, dz)) < 1e-9, `facing ${facing} up ${up.toArray()}`);
    assert.ok(face.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-9, `facing ${facing} face ${face.toArray()}`);
  }
});

test("BedSleep.offset agrees with the sleeping corpse offset", () => {
  const s = new BedSleep();
  for (let facing = 0; facing < 4; facing++) {
    s.facing = facing;
    const [dx, dz] = BED_DIR[facing];
    assert.deepEqual(s.offset.map((v) => v + 0), [-1.8 * dx + 0, 0, -1.8 * dz + 0]);
  }
});

test("the sleeping eye (posY + 0.12, orientCamera) clears the lying head and hat", () => {
  const pos = { x: 0.5, y: 64.9375, z: 0.9 }, at = sleepingTransform({ pos, offset: [0, 0, -1.8], facing: 0 });
  // Hat: 8 px head inflated by 0.5 px, at the 0.9375 player scale, centred on the body's lying axis.
  const hatTop = at.y + ((4 + 0.5) / 16) * 0.9375;
  assert.ok(hatTop < pos.y + 0.12 - 0.05, `hat top ${hatTop}`); // beyond the 0.05 near plane
});

// RendererLivingEntity.rotateCorpse (boh.a(sv,F,F,F)): f = sqrt((deathTime + partial - 1) / 20 * 1.6), clamped to 1,
// times getDeathMaxRotation (boh.a(sv) returns 90.0f), about z after glRotatef(180 - renderYawOffset, 0, 1, 0).
test("the player death roll follows rotateCorpse: sqrt((deathTime + partial - 1) / 20 * 1.6) * 90, clamped", () => {
  const body = new PlayerBody();
  body.reset({ x: 0, y: 0, z: 0 }, 0, 0);
  assert.equal(mobPose(body, 0.5).death, 0); // alive: deathTime 0, no rotation
  const roll = (deathTime, partial) => { body.death = deathTime; return mobPose(body, partial).death; };
  assert.ok(Math.abs(roll(1, 0) - 0) < 1e-4); // sqrt(0) = 0
  assert.ok(Math.abs(roll(5, 0.5) - Math.sqrt((5.5 - 1) / 20 * 1.6) * 90) < 1e-3);
  assert.ok(Math.abs(roll(10, 0) - Math.sqrt(9 / 20 * 1.6) * 90) < 1e-3);
  assert.equal(roll(13, 0.5), 90); // (12.5 / 20 * 1.6 = 1) reaches the clamp
  assert.equal(roll(19, 0.9), 90);
  const [x, y, z] = playerRootRotation(30, 90);
  assert.equal(x, 0);
  assert.ok(Math.abs(y - 150 * Math.PI / 180) < 1e-12 && Math.abs(z - Math.PI / 2) < 1e-12);
  // A lying corpse's head (model up) ends level: Ry(180 - yaw) * Rz(90) turns the model's up (+y, feet to head) sideways.
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...playerRootRotation(180, 90)));
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  assert.ok(Math.abs(up.y) < 1e-9);
});

test("a sleeper keeps the head yaw and pitch frozen at bed entry (mobPose of the unticked body)", () => {
  const body = new PlayerBody();
  body.reset({ x: 0, y: 0, z: 0 }, 0, 0);
  // Walk and look 40 degrees to the side with the head, then stop ticking as GuiSleepMP does.
  for (let i = 0; i < 30; i++) body.tick({ position: { x: 0, y: 0, z: 0 }, previous: { x: 0, y: 0, z: 0 }, yaw: 0.7, pitch: -0.3 });
  const a = mobPose(body, 0), b = mobPose(body, 0.7);
  assert.equal(a.headYaw, b.headYaw);
  assert.equal(a.headPitch, b.headPitch);
  assert.ok(Math.abs(a.headPitch - 0.3 * 180 / Math.PI) < 0.01); // Java pitch is positive downward
});

// Render.doRenderShadowAndFire runs after doRender for every entity (bnn.a(sa,DDDFFZ) at 70-82), centred on
// posY + getShadowSize() (sa.Y() = height / 2); a sleeping player's box is 0.2 high.
test("a sleeper's shadow is centred 0.1 above the entity position with the player's 0.5 size", () => {
  const pos = { x: 10.9, y: 64.9375, z: 20.5 }, caster = sleeperShadowCaster(pos, SHADOWS.player);
  assert.equal(caster.height, SLEEP_SIZE);
  assert.equal(caster.size, Math.fround(0.5));
  const floor = { get: (x, y) => (y < 64 ? 1 : 0), light: () => 15 };
  const quads = shadowQuads(caster, { x: pos.x, y: pos.y + 0.12, z: pos.z }, floor);
  // ey = 65.0375, so the scan starts at cell y 64 (floor 64.5375) and ends at 65; only cell 64 rests on stone (y 63).
  assert.ok(quads.length > 0 && quads.every((q) => q.y === 64 + 0.015625));
  // alpha = (opacity - (ey - by) / 2) * 0.5 * brightness(15 = 1); opacity ~1 at the viewer's distance.
  assert.ok(Math.abs(quads[0].alpha - (1 - (65.0375 - 64) / 2) * 0.5) < 1e-3);
});
