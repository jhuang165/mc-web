// RenderMooshroom (cow model, mooshroom.png, red mushrooms) and RenderSnowMan (bif ModelSnowMan, snowman.png, pumpkin head).
// The snow golem boxes are the ModelProbe dump of bif in public/research/mooshroom-golem-reference.json. The mushroom
// and pumpkin placements are approximations of the RenderBlocks calls (see public/research/mooshroom-golem.md, Gaps).
import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { entityMaterial } from "./light-material.js";

// bif parts (point, box, uv); the model texture is 64 x 64.
const SNOW_PARTS = {
  piece1: { point: [0, 13, 0], box: [-5, -10, -5, 10, 10, 10], uv: [0, 16], grow: -0.5 },
  piece2: { point: [0, 24, 0], box: [-6, -12, -6, 12, 12, 12], uv: [0, 36], grow: -0.5 },
  head: { point: [0, 4, 0], box: [-4, -8, -4, 8, 8, 8], uv: [0, 0], grow: -0.5 },
  arm1: { point: [0, 6, 0], box: [-1, 0, -1, 12, 2, 2], uv: [32, 0], grow: -0.5 },
  arm2: { point: [0, 6, 0], box: [-1, 0, -1, 12, 2, 2], uv: [32, 0], grow: -0.5 },
};

function addPart(renderer, root, skin, { point: [x, y, z], box: [ox, oy, oz, w, h, d], uv, grow }) {
  const pivot = new THREE.Group();
  pivot.position.set(x / 16, (24 - y) / 16, -z / 16);
  const g = skinBox(w, h, d, uv[0], uv[1], 64, 64);
  g.scale((w + 2 * grow) / w, (h + 2 * grow) / h, (d + 2 * grow) / d);
  const mesh = new THREE.Mesh(g, skin);
  mesh.position.set((ox + w / 2) / 16, -(oy + h / 2) / 16, -(oz + d / 2) / 16);
  pivot.add(mesh);
  root.add(pivot);
  return pivot;
}

export function createSnowGolemRig(renderer) {
  const root = new THREE.Group(), lighting = renderer.view.lighting,
    skin = entityMaterial(lighting, { map: pixelTexture("/media/1.7.10/entity/snowman.png") }), p = {};
  for (const [name, part] of Object.entries(SNOW_PARTS)) p[name] = addPart(renderer, root, skin, part);
  p.head.rotation.order = "YXZ";
  const faces = ["pumpkin_side", "pumpkin_side", "pumpkin_top", "pumpkin_top", "pumpkin_side", "pumpkin_face_off"],
    mats = faces.map((n) => entityMaterial(lighting, { map: pixelTexture(`/media/1.7.10/blocks/${n}.png`) }));
  // RenderSnowMan.renderEquippedItems: translate(0, -0.34375, 0), scale 0.625 -> a 10 px cube centred 5.5 px above the pivot.
  const pumpkin = new THREE.Mesh(new THREE.BoxGeometry(10 / 16, 10 / 16, 10 / 16), mats);
  pumpkin.position.set(0, 5.5 / 16, 0);
  p.head.add(pumpkin);
  renderer.scene.add(root);
  return { root, neck: p.head, limbs: [], snow: p, materials: [skin, ...mats], type: "snow_golem", lift: 1 / 128 };
}

// ModelSnowMan.setRotationAngles (reconstructed, not probed): the arms and the upper body turn a quarter of the head yaw.
export function animateSnowGolem(rig, pose) {
  const a = -pose.headYaw * Math.PI / 180 * 0.25, { snow } = rig;
  snow.piece1.rotation.y = a;
  snow.arm1.rotation.y = a;
  snow.arm2.rotation.y = a + Math.PI;
  snow.arm1.position.x = Math.cos(a) * 5 / 16;
  snow.arm1.position.z = Math.sin(a) * 5 / 16;
  snow.arm2.position.x = -Math.cos(a) * 5 / 16;
  snow.arm2.position.z = -Math.sin(a) * 5 / 16;
}

// The mushrooms: RenderMooshroom draws the red mushroom block twice on the back (the body) and once on the head, as
// two crossed quads each.
export function addMooshroomMushrooms(rig, renderer) {
  const map = pixelTexture("/media/1.7.10/blocks/mushroom_red.png"),
    mat = entityMaterial(renderer.view.lighting, { map });
  mat.side = THREE.DoubleSide;
  mat.transparent = true;
  const cross = (parent, x, y, z, s) => {
    for (const a of [Math.PI / 4, -Math.PI / 4]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), mat);
      m.position.set(x, y + s / 2, z);
      m.rotation.y = a;
      parent.add(m);
    }
  };
  const s = 0.75;
  cross(rig.root, 0.2, 0.9 + 0.5, 0.15, s);
  cross(rig.root, -0.2, 0.9 + 0.5, -0.25, s);
  cross(rig.neck, 0, 0.25 + 0.1, 0.3, s * 0.8);
  rig.materials.push(mat);
}
