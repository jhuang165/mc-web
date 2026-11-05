// RenderBlaze (bnd) with ModelBlaze (bhd, blaze.png 64 x 32) and RenderGhast (bnt) with ModelGhast (bhl, ghast.png / ghast_shooting.png
// 64 x 32). Boxes, pivots and animations are read from the original classes' bytecode (bhd.<init>, bhd.a(FFFFFF), bhl.<init>,
// bhl.a(FFFFFF), bnt.a(ye, F)); they are not run, so they are bytecode-derived rather than probed. mob-renderer.js calls createBlazeRig /
// createGhastRig and the rig's `custom` hook every frame.
import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { entityMaterial } from "./light-material.js";
import { JavaRandom } from "./java-random.js";
const f = Math.fround, RAD = Math.PI / 180;
export const BLAZE_TEXTURE = "/media/1.7.10/entity/blaze.png", GHAST_TEXTURE = "/media/1.7.10/entity/ghast/ghast.png", GHAST_SHOOTING_TEXTURE = "/media/1.7.10/entity/ghast/ghast_shooting.png";
// RenderBlaze is fullbright (getBrightnessForRender 15728880); RenderGhast scales by (8 + ..) / 2 = 4.5 while its counters are 0.
export const BLAZE_LIGHT = 15728880, GHAST_SCALE = 4.5;
const turn = (g, ax = 0, ay = 0, az = 0) => (g.rotation.order = "ZYX", g.rotation.set(ax, -ay, -az), g);
function modelBoxes(materials, parent, list, tw, th, groups = null) {
  for (const [ox, oy, oz, w, h, d, u, v] of list) {
    materials.forEach((material, k) => {
      const mesh = new THREE.Mesh(skinBox(w, h, d, u, v, tw, th, false), material);
      mesh.position.set((ox + w / 2) / 16, -(oy + h / 2) / 16, -(oz + d / 2) / 16);
      parent.add(mesh);
      if (groups) groups[k].push(mesh);
    });
  }
}
function part(frame, [x, y, z]) {
  const g = new THREE.Group();
  g.rotation.order = "ZYX";
  g.position.set(x / 16, (24 - y) / 16, -z / 16);
  frame.add(g);
  return g;
}

// ModelBlaze: a head (-4,-4,-4, 8 x 8 x 8 at uv 0,0) and twelve 2 x 8 x 2 rods (uv 0,16) in three rings.
export function createBlazeRig(renderer) {
  const root = new THREE.Group(), frame = new THREE.Group(), skin = entityMaterial(renderer.view.lighting, { map: pixelTexture(BLAZE_TEXTURE) }), sticks = [];
  root.add(frame);
  frame.position.y = 1 / 128;
  const head = part(frame, [0, 0, 0]);
  modelBoxes([skin], head, [[-4, -4, -4, 8, 8, 8, 0, 0]], 64, 32);
  for (let i = 0; i < 12; i++) {
    const g = part(frame, [0, 0, 0]);
    modelBoxes([skin], g, [[0, 0, 0, 2, 8, 2, 0, 16]], 64, 32);
    sticks.push(g);
  }
  renderer.scene.add(root);
  return { root, neck: head, limbs: [], materials: [skin], type: "blaze", lift: 0, scale: 1, fullbright: BLAZE_LIGHT, blaze: { head, sticks }, custom: animateBlaze };
}
// bhd.a(f1..f6): the rods of each ring orbit the head; ring 1 (4 rods, radius 9, y -2), ring 2 (radius 7, y 2), ring 3 (radius 5, y 11).
export function animateBlaze(r, e, pose) {
  const { head, sticks } = r.blaze, age = pose.age, set = (g, x, y, z) => g.position.set(x / 16, (24 - y) / 16, -z / 16);
  let a = f(age * Math.PI * -0.1);
  for (let i = 0; i < 4; i++, a += Math.PI / 2) set(sticks[i], Math.cos(a) * 9, -2 + Math.cos((i * 2 + age) * 0.25), Math.sin(a) * 9);
  a = 0.7853982 + age * Math.PI * 0.03;
  for (let i = 4; i < 8; i++, a += Math.PI / 2) set(sticks[i], Math.cos(a) * 7, 2 + Math.cos((i * 2 + age) * 0.25), Math.sin(a) * 7);
  a = 0.47123894 + age * Math.PI * -0.05;
  for (let i = 8; i < 12; i++, a += Math.PI / 2) set(sticks[i], Math.cos(a) * 5, 11 + Math.cos((i * 1.5 + age) * 0.5), Math.sin(a) * 5);
  turn(head, pose.headPitch * RAD, pose.headYaw * RAD, 0);
}

// ModelGhast: a 16 cube body at y 8 and nine tentacles (2 wide, 8 to 14 long, lengths from Random(1660)) at y 15, in a 3 x 3 grid 5 apart.
export function createGhastRig(renderer) {
  const root = new THREE.Group(), frame = new THREE.Group(), normal = entityMaterial(renderer.view.lighting, { map: pixelTexture(GHAST_TEXTURE) }),
    shooting = entityMaterial(renderer.view.lighting, { map: pixelTexture(GHAST_SHOOTING_TEXTURE) }), groups = [[], []], tentacles = [], mats = [normal, shooting];
  root.add(frame);
  frame.position.y = 1 / 128 - 0.6; // bhl.render translates (0, 0.6, 0) in the flipped model space (down), inside the scale
  modelBoxes(mats, part(frame, [0, 8, 0]), [[-8, -8, -8, 16, 16, 16, 0, 0]], 64, 32, groups);
  const rand = new JavaRandom(1660);
  for (let i = 0; i < 9; i++) {
    const row = Math.trunc(i / 3), x = f(f(f(f(f(i % 3) - f(f(row % 2) * f(0.5))) + f(0.25)) / 2 * 2 - 1) * 5), z = f(f(f(row / 2) * 2 - 1) * 5), length = rand.nextInt(7) + 8;
    const g = part(frame, [x, 15, z]);
    modelBoxes(mats, g, [[-1, 0, -1, 2, length, 2, 0, 0]], 64, 32, groups);
    tentacles.push(g);
  }
  renderer.scene.add(root);
  return { root, neck: new THREE.Group(), limbs: [], materials: mats, type: "ghast", lift: 0, scale: GHAST_SCALE, ghast: { tentacles, groups }, custom: animateGhast };
}
// bhl.a: tentacle rotation X = 0.2 * sin(age * 0.3 + i) + 0.4; bnt picks ghast_shooting.png while the charging flag is set.
export function animateGhast(r, e, pose) {
  const { tentacles, groups } = r.ghast, age = pose.age, charging = !!e.charging;
  tentacles.forEach((g, i) => turn(g, 0.2 * Math.sin(age * 0.3 + i) + 0.4));
  groups[0].forEach((m) => { m.visible = !charging; });
  groups[1].forEach((m) => { m.visible = charging; });
}
