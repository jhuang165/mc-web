// RenderDragon with ModelDragon (256 x 256 dragon.png), the exploding mask, the additive eyes pass and the crystal beam.
// The box table and pose were reconstructed from ModelDragon. The death-ray
// transforms come from the original client RenderDragon bytecode. The ring
// offsets and animation clock are the probe-verified values from dragon.js.
// mob-renderer.js calls createDragonRig and runs `custom` (animateDragon) each frame.
import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { entityMaterial } from "./light-material.js";
import { movementOffsets, dragonBossStatus, DRAGON_MAX_HEALTH } from "./dragon.js";
import { setBossStatus, startBossBar } from "./boss-bar.js";
import { JavaRandom } from "./java-random.js";

const RAD = Math.PI / 180;

// RenderDragon's 432-seeded, cumulatively rotated triangle fans. Three.js
// interpolates each fan from an opaque white tip to a transparent magenta rim.
function createDeathRays() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(60 * 9 * 3), 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(60 * 9 * 4), 4));
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, fog: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const rays = new THREE.Mesh(geometry, material);
  rays.frustumCulled = false;
  rays.visible = false;
  return rays;
}

export function updateDeathRays(rays, ticks, partial) {
  rays.visible = ticks > 0;
  if (!rays.visible) return;
  const progress = Math.min(1, (ticks + partial) / 200), fade = Math.max(0, (progress - 0.8) / 0.2);
  const count = Math.ceil((progress + progress * progress) * 30);
  const random = new JavaRandom(432n);
  const matrix = new THREE.Matrix4(), rotation = new THREE.Matrix4(), v = new THREE.Vector3();
  const { position, color } = rays.geometry.attributes;
  let i = 0;
  for (let ray = 0; ray < count; ray++) {
    matrix.multiply(rotation.makeRotationX(random.nextFloat() * 2 * Math.PI));
    matrix.multiply(rotation.makeRotationY(random.nextFloat() * 2 * Math.PI));
    matrix.multiply(rotation.makeRotationZ(random.nextFloat() * 2 * Math.PI));
    matrix.multiply(rotation.makeRotationX(random.nextFloat() * 2 * Math.PI));
    matrix.multiply(rotation.makeRotationY(random.nextFloat() * 2 * Math.PI));
    matrix.multiply(rotation.makeRotationZ(random.nextFloat() * 2 * Math.PI + progress * Math.PI / 2));
    const length = 5 + random.nextFloat() * 20 + fade * 10;
    const width = 1 + random.nextFloat() * 2 + fade * 2;
    const rim = [[-0.866 * width, -0.5 * width], [0.866 * width, -0.5 * width], [0, width]];
    for (let j = 0; j < 3; j++) {
      position.setXYZ(i, 0, 0, 0);
      color.setXYZW(i++, 1, 1, 1, Math.trunc(255 * (1 - fade)) / 255);
      for (const [x, z] of [rim[j], rim[(j + 1) % 3]]) {
        v.set(x, length, z).applyMatrix4(matrix);
        position.setXYZ(i, v.x, v.y, v.z);
        color.setXYZW(i++, 1, 0, 1, 0);
      }
    }
  }
  rays.geometry.setDrawRange(0, i);
  position.needsUpdate = color.needsUpdate = true;
}
export const DRAGON_TEXTURES = Object.freeze({
  skin: "/media/1.7.10/entity/enderdragon/dragon.png",
  exploding: "/media/1.7.10/entity/enderdragon/dragon_exploding.png",
  eyes: "/media/1.7.10/entity/enderdragon/dragon_eyes.png",
  beam: "/media/1.7.10/entity/endercrystal/endercrystal_beam.png",
});
const F1 = -16;

// ModelDragon boxes: [x, y, z, w, h, d, u, v, mirror]. Rotation points are in model pixels (y down, as in Java).
export const DRAGON_MODEL = Object.freeze({
  head: { boxes: [[-6, -1, -8 + F1, 12, 5, 16, 176, 44], [-8, -8, 6 + F1, 16, 16, 16, 112, 30], [-5, -12, 12 + F1, 2, 4, 6, 0, 0, true], [-5, -3, -6 + F1, 2, 2, 4, 112, 0, true], [3, -12, 12 + F1, 2, 4, 6, 0, 0], [3, -3, -6 + F1, 2, 2, 4, 112, 0]] },
  jaw: { point: [0, 4, 8 + F1], boxes: [[-6, 0, -16, 12, 4, 16, 176, 65]] },
  neck: { boxes: [[-5, -5, -5, 10, 10, 10, 192, 104], [-1, -9, -3, 2, 4, 6, 48, 0]] },
  body: { point: [0, 4, 8], boxes: [[-12, 0, -16, 24, 24, 64, 0, 0], [-1, -6, 10, 2, 6, 12, 220, 53], [-1, -6, 30, 2, 6, 12, 220, 53], [-1, -6, 50, 2, 6, 12, 220, 53]] },
  wing: { point: [-12, 5, 2], boxes: [[-56, -4, -4, 56, 8, 8, 112, 88], [-56, 0, 2, 56, 0, 56, -56, 88]] },
  wingtip: { point: [-56, 0, 0], boxes: [[-56, -2, -2, 56, 4, 4, 112, 136], [-56, 0, 2, 56, 0, 56, -56, 144]] },
  frontleg: { point: [-12, 20, 2], boxes: [[-4, -4, -4, 8, 24, 8, 112, 104]] },
  frontlegtip: { point: [0, 20, -1], boxes: [[-3, -1, -3, 6, 24, 6, 226, 138]] },
  frontfoot: { point: [0, 23, 0], boxes: [[-4, 0, -12, 8, 4, 16, 144, 104]] },
  rearleg: { point: [-16, 16, 42], boxes: [[-8, -4, -8, 16, 32, 16, 0, 0]] },
  rearlegtip: { point: [0, 32, -4], boxes: [[-6, -2, 0, 12, 32, 12, 196, 0]] },
  rearfoot: { point: [0, 31, 4], boxes: [[-9, 0, -20, 18, 6, 24, 112, 0]] },
});

// A ModelRenderer pivot in the frame the other rigs use: position (x, -y, -z) / 16, angles (rx, -ry, -rz), Z-Y-X order.
export const place = (g, [x, y, z], [rx, ry, rz]) => {
  g.position.set(x / 16, -y / 16, -z / 16);
  g.rotation.set(rx, -ry, -rz);
};
const pivot = () => { const g = new THREE.Group(); g.rotation.order = "ZYX"; return g; };
function makePart(spec, material) {
  const g = pivot();
  for (const [x, y, z, w, h, d, u, v, mirror] of spec.boxes) {
    const mesh = new THREE.Mesh(skinBox(w, h, d, u, v, 256, 256, !!mirror), material);
    mesh.position.set((x + w / 2) / 16, -(y + h / 2) / 16, -(z + d / 2) / 16);
    g.add(mesh);
  }
  if (spec.point) place(g, spec.point, [0, 0, 0]);
  return g;
}

// One complete copy of the model (the original draws the same ModelDragon in up to three passes).
function buildModel(material) {
  const M = DRAGON_MODEL, p = {};
  p.head = makePart(M.head, material);
  p.jaw = makePart(M.jaw, material);
  p.head.add(p.jaw);
  p.necks = Array.from({ length: 5 }, () => makePart(M.neck, material));
  p.tails = Array.from({ length: 12 }, () => makePart(M.neck, material));
  p.body = makePart(M.body, material);
  p.sides = [0, 1].map(() => {
    const s = {}, mirror = new THREE.Group();
    s.wing = makePart(M.wing, material); s.wingtip = makePart(M.wingtip, material); s.wing.add(s.wingtip);
    s.frontleg = makePart(M.frontleg, material); s.frontlegtip = makePart(M.frontlegtip, material); s.frontfoot = makePart(M.frontfoot, material);
    s.frontleg.add(s.frontlegtip); s.frontlegtip.add(s.frontfoot);
    s.rearleg = makePart(M.rearleg, material); s.rearlegtip = makePart(M.rearlegtip, material); s.rearfoot = makePart(M.rearfoot, material);
    s.rearleg.add(s.rearlegtip); s.rearlegtip.add(s.rearfoot);
    mirror.add(s.wing, s.frontleg, s.rearleg);
    s.group = mirror;
    return s;
  });
  p.sides[1].group.scale.x = -1; // glScalef(-1, 1, 1) for the second wing and legs
  return p;
}

const wrap180 = (d) => { while (d < -180) d += 360; while (d >= 180) d -= 360; return d; };

// ModelDragon.render (pose maths). Returns per-part [point, angle] data in pixels and radians (Java sign), plus the body roll
// and the whole-model offset. `offset(n)` is dragon.getMovementOffsets(n, partial); `t` is the animation clock.
export function dragonPose(offset, t) {
  const jaw = (Math.sin(t * Math.PI * 2) + 1) * 0.2;
  let f7 = Math.sin(t * Math.PI * 2 - 1) + 1;
  f7 = (f7 * f7 + f7 * 2) * 0.05;
  const f10 = 1.5, o7 = offset(7), o5 = offset(5);
  const f11 = wrap180(o5[0] - offset(10)[0]), f12 = wrap180(o5[0] + f11 / 2);
  const f13 = t * Math.PI * 2;
  let y = 20, z = -12, x = 0;
  const necks = [];
  for (let i = 0; i < 5; i++) {
    const o = offset(5 - i), ry = wrap180(o[0] - o7[0]) * RAD * f10;
    const rx = Math.cos(i * 0.45 + f13) * 0.15 + (o[1] - o7[1]) * RAD * f10 * 5, rz = -wrap180(o[0] - f12) * RAD * f10;
    necks.push({ point: [x, y, z], angle: [rx, ry, rz] });
    y += Math.sin(rx) * 10;
    z -= Math.cos(ry) * Math.cos(rx) * 10;
    x -= Math.sin(ry) * Math.cos(rx) * 10;
  }
  const o0 = offset(0);
  const head = { point: [x, y, z], angle: [0, wrap180(o0[0] - o7[0]) * RAD, -wrap180(o0[0] - f12) * RAD] };
  const wing = { x: 0.125 - Math.cos(f13) * 0.2, y: 0.25, z: (Math.sin(f13) + 0.125) * 0.8, tip: -(Math.sin(f13 + 2) + 0.5) * 0.75 };
  const legs = { rearleg: 1 + f7 * 0.1, rearlegtip: 0.5 + f7 * 0.1, rearfoot: 0.75 + f7 * 0.1, frontleg: 1.3 + f7 * 0.1, frontlegtip: -0.5 - f7 * 0.1, frontfoot: 0.75 + f7 * 0.1 };
  const tails = [];
  let ty = 10, tz = 60, tx = 0, bend = 0;
  const o11 = offset(11);
  for (let k = 0; k < 12; k++) {
    const o = offset(12 + k);
    bend += Math.sin(k * 0.45 + f13) * 0.05;
    const ry = (wrap180(o[0] - o11[0]) * f10 + 180) * RAD, rx = bend + (o[1] - o11[1]) * RAD * f10 * 5, rz = wrap180(o[0] - f12) * RAD * f10;
    tails.push({ point: [tx, ty, tz], angle: [rx, ry, rz] });
    ty += Math.sin(rx) * 10;
    tz -= Math.cos(ry) * Math.cos(rx) * 10;
    tx -= Math.sin(ry) * Math.cos(rx) * 10;
  }
  return { jaw, f7, f11, f10, necks, head, wing, legs, tails, yaw: o7[0], pitch: o5[1] - offset(10)[1] };
}

export function createDragonRig(renderer) {
  startBossBar();
  const root = new THREE.Group(), lighting = renderer.view.lighting;
  const skin = entityMaterial(lighting, { map: pixelTexture(DRAGON_TEXTURES.skin) });
  const exploding = entityMaterial(lighting, { map: pixelTexture(DRAGON_TEXTURES.exploding), alphaTest: 0 });
  const eyes = new THREE.MeshBasicMaterial({ map: pixelTexture(DRAGON_TEXTURES.eyes), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  // RenderDragon.rotateCorpse (yaw, pitch, the 1 block shift) then the living-entity flip, in this renderer's frame.
  const yawG = new THREE.Group(), pitchG = new THREE.Group(), shiftG = new THREE.Group(), liftG = new THREE.Group(), bobG = new THREE.Group();
  root.add(yawG); yawG.add(pitchG); pitchG.add(shiftG); shiftG.add(liftG); liftG.add(bobG);
  liftG.position.y = 1.5078125;
  const passes = [buildModel(skin), buildModel(exploding), buildModel(eyes)];
  for (const p of passes) {
    const holder = new THREE.Group();
    holder.add(p.head, ...p.necks, ...p.tails);
    const rollOut = new THREE.Group(), rollIn = new THREE.Group();
    rollOut.add(rollIn);
    rollIn.add(p.body, p.sides[0].group, p.sides[1].group);
    holder.add(rollOut);
    p.rollOut = rollOut; p.rollIn = rollIn;
    bobG.add(holder);
  }
  passes[1].head.parent.visible = false;
  passes[2].head.parent.traverse((o) => { if (o.isMesh) o.renderOrder = 2; });
  // The crystal beam (RenderDragon.func_110827_a): 9 vertex pairs of a triangle strip, black thin end to white wide end.
  const beamTexture = new THREE.TextureLoader().load(DRAGON_TEXTURES.beam);
  beamTexture.wrapS = beamTexture.wrapT = THREE.RepeatWrapping;
  beamTexture.magFilter = beamTexture.minFilter = THREE.NearestFilter;
  const beamMaterial = new THREE.MeshBasicMaterial({ map: beamTexture, vertexColors: true, side: THREE.DoubleSide, fog: false });
  const beamGeometry = new THREE.BufferGeometry(), pos = new Float32Array(18 * 3), uv = new Float32Array(18 * 2), col = new Float32Array(18 * 3);
  const index = [];
  for (let i = 0; i < 16; i++) index.push(i, i + 1, i + 2);
  for (let i = 0; i < 9; i++) {
    const a = ((i % 8) * 2 * Math.PI) / 8, fx = Math.sin(a) * 0.75, fy = Math.cos(a) * 0.75;
    pos.set([fx * 0.2, fy * 0.2, 0], i * 6);
    pos.set([fx, fy, 0], i * 6 + 3);
    col.set([1, 1, 1], i * 6 + 3);
    uv[i * 4] = uv[i * 4 + 2] = (i % 8) / 8;
  }
  beamGeometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  beamGeometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  beamGeometry.setAttribute("color", new THREE.BufferAttribute(col, 3));
  beamGeometry.setIndex(index);
  const beamPivot = new THREE.Group(), beam = new THREE.Mesh(beamGeometry, beamMaterial);
  beamPivot.rotation.order = "YXZ";
  beamPivot.add(beam);
  beamPivot.visible = false;
  root.add(beamPivot);
  const deathRays = createDeathRays();
  deathRays.position.set(0, 1, 2);
  shiftG.add(deathRays);
  renderer.scene.add(root);
  return {
    root, neck: new THREE.Group(), limbs: [], materials: [skin, exploding], eyes, type: "ender_dragon", lift: 0, scale: 1,
    dragonRig: { passes, yawG, pitchG, shiftG, bobG, deathRays, beam: { pivot: beamPivot, geometry: beamGeometry, material: beamMaterial, texture: beamTexture } },
    custom: animateDragon,
  };
}

function poseModel(p, pose) {
  place(p.head, pose.head.point, pose.head.angle);
  place(p.jaw, DRAGON_MODEL.jaw.point, [pose.jaw, 0, 0]);
  pose.necks.forEach((n, i) => place(p.necks[i], n.point, n.angle));
  pose.tails.forEach((n, i) => place(p.tails[i], n.point, n.angle));
  place(p.body, DRAGON_MODEL.body.point, [0, 0, 0]);
  // Roll of the body group about (0, 1, 0) blocks: rotatef(-f11 * f10, z), seen through the model's x/y/z flip.
  p.rollOut.position.set(0, -1, 0);
  p.rollOut.rotation.set(0, 0, pose.f11 * pose.f10 * RAD);
  p.rollIn.position.set(0, 1, 0);
  for (const s of p.sides) {
    place(s.wing, DRAGON_MODEL.wing.point, [pose.wing.x, pose.wing.y, pose.wing.z]);
    place(s.wingtip, DRAGON_MODEL.wingtip.point, [0, 0, pose.wing.tip]);
    for (const k of ["rearleg", "rearlegtip", "rearfoot", "frontleg", "frontlegtip", "frontfoot"]) place(s[k], DRAGON_MODEL[k].point, [pose.legs[k], 0, 0]);
  }
}

// RenderDragon.doRender for the pose at `partial`. `e.dragon` is the state of dragon.js.
export function animateDragon(r, e, pose, partial) {
  const s = e.dragon, st = r.dragonRig;
  if (!s) return;
  // RenderDragon.doRender: BossStatus.setBossStatus(dragon, ...) every drawn frame (boss-bar.js keeps it 100 frames).
  setBossStatus({ health: e.health, maxHealth: DRAGON_MAX_HEALTH }, dragonBossStatus(e).name, false);
  const t = s.prevAnim + (s.anim - s.prevAnim) * partial, p = dragonPose((n) => movementOffsets(e, n, partial), t);
  // rotateCorpse: rotatef(-f3, y), rotatef(pitch * 10, x), translatef(0, 0, 1); the 180 turn the other living rigs get from
  // RendererLivingEntity is part of this frame's convention, so the three rotations are conjugated by it.
  r.root.rotation.set(0, 0, 0);
  r.root.scale.setScalar(1);
  st.yawG.rotation.y = -(p.yaw + 180) * RAD;
  st.pitchG.rotation.x = -p.pitch * 10 * RAD;
  st.shiftG.position.z = -1;
  // ModelDragon.render prologue: glTranslatef(0, f7 - 2, -3), glRotatef(f7 * 2, x).
  st.bobG.position.set(0, 2 - p.f7, 3);
  st.bobG.rotation.x = p.f7 * 2 * RAD;
  const dying = s.deathTicks > 0;
  updateDeathRays(st.deathRays, s.deathTicks, partial);
  st.passes.forEach((m, i) => poseModel(m, p));
  // RenderDragon.renderModel: the exploding texture goes first with an alpha test of deathTicks / 200, then the normal skin only
  // where that pass drew (GL_EQUAL); the eyes always on top.
  st.passes[1].head.parent.visible = dying;
  r.materials[1].uniforms.alphaTest.value = Math.max(0, s.deathTicks / 200);
  r.materials[0].depthFunc = dying ? THREE.EqualDepth : THREE.LessEqualDepth;
  const h = s.healer, b = st.beam;
  b.pivot.visible = !!h && e.health > 0;
  if (b.pivot.visible) {
    const t2 = (h.innerRotation ?? 0) + partial, w = (Math.sin(t2 * 0.2) / 2 + 0.5), bob = (w * w + w) * 0.2;
    const dx = h.x - pose.x, dy = bob + h.y - 1 - pose.y, dz = h.z - pose.z, horizontal = Math.hypot(dx, dz), length = Math.hypot(dx, dy, dz);
    b.pivot.position.set(0, 2, 0);
    b.pivot.rotation.set((-Math.atan2(horizontal, dy) * 180) / Math.PI * RAD - Math.PI / 2, (-Math.atan2(dz, dx) * 180) / Math.PI * RAD - Math.PI / 2, 0);
    const ticks = (h.age ?? 0) + partial, v0 = -ticks * 0.01, v1 = length / 32 - ticks * 0.01, uv = b.geometry.attributes.uv, pos = b.geometry.attributes.position;
    for (let i = 0; i < 9; i++) {
      uv.setY(i * 2, v1);
      uv.setY(i * 2 + 1, v0);
      pos.setZ(i * 2 + 1, length);
    }
    uv.needsUpdate = pos.needsUpdate = true;
  }
}

export function disposeDragonRig(r) {
  const b = r.dragonRig?.beam;
  if (!b) return;
  b.geometry.dispose();
  b.material.dispose();
  b.texture.dispose();
  r.dragonRig.deathRays.geometry.dispose();
  r.dragonRig.deathRays.material.dispose();
}
