// RenderHorse (bnv) with ModelHorse (bhs, 128 x 128): the rest-pose boxes below are dumped from the unchanged class by
// tools/probes/HorseProbe.java (`model` row of public/research/horse-reference.json): p is the part's rotation point, a its
// rest angles, b its boxes as [ox, oy, oz, w, h, d, u, v]. Model (x, y, z) becomes (x, 24 - y, -z) / 16 in three.js and Java's Y
// and Z rotations change sign. Simplified: the rear / eat / tail animation of setLivingAnimations (bhs.a(sv,F,F,F)) is not ported;
// the four legs swing with the limb angles the renderer already computes.
import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { entityMaterial } from "./light-material.js";

export const HORSE_PARTS = {
  a: {"p":[0,4,-10],"a":[0.5236,0,0],"b":[[-2.5,-10,-1.5,5.0,5,7.0,0,0]]},
  b: {"p":[0,3.95,-10],"a":[0.5236,0,0],"b":[[-2,-10,-7,4,3,6,24,18]]},
  c: {"p":[0,4,-10],"a":[0.5236,0,0],"b":[[-2,-7,-6.5,4,2,5.0,24,27]]},
  d: {"p":[0,4,-10],"a":[0.5236,0,0],"b":[[0.45,-12,4,2.0,3,1,0,0]]},
  e: {"p":[0,4,-10],"a":[0.5236,0,0],"b":[[-2.45,-12,4,2.0,3,1,0,0]]},
  f: {"p":[0,4,-10],"a":[0.5236,0,0.2618],"b":[[-2,-16,4,2,7,1,0,12]]},
  g: {"p":[0,4,-10],"a":[0.5236,0,-0.2618],"b":[[0,-16,4,2,7,1,0,12]]},
  h: {"p":[0,4,-10],"a":[0.5236,0,0],"b":[[-2.05,-9.8,-2,4.0,14.0,8,0,12]]},
  i: {"p":[0,4,-10],"a":[0.5236,0,0],"b":[[-2.5,-10.1,-7,5.0,5.0,12,80,12]]},
  j: {"p":[0,4,-10],"a":[0.5236,0,0],"b":[[-1,-11.5,5,2,16.0,4,58,0]]},
  k: {"p":[0,11,9],"a":[0,0,0],"b":[[-5,-8,-19,10,10,24,0,34]]},
  l: {"p":[0,3,14],"a":[-1.13446,0,0],"b":[[-1,-1,0,2,2,3,44,0]]},
  m: {"p":[0,3,14],"a":[-1.13446,0,0],"b":[[-1.5,-2,3,3.0,4,7,38,7]]},
  n: {"p":[0,3,14],"a":[-1.40215,0,0],"b":[[-1.5,-4.5,9,3.0,4.0,7,24,3]]},
  o: {"p":[4,9,11],"a":[0,0,0],"b":[[-2.5,-2,-2.5,4.0,9,5.0,78,29]]},
  v: {"p":[4,16,11],"a":[0,0,0],"b":[[-2,0,-1.5,3,5,3.0,78,43]]},
  w: {"p":[4,16,11],"a":[0,0,0],"b":[[-2.5,5.1,-2,4.0,3.0,4,78,51]]},
  x: {"p":[-4,9,11],"a":[0,0,0],"b":[[-1.5,-2,-2.5,4.0,9,5.0,96,29]]},
  y: {"p":[-4,16,11],"a":[0,0,0],"b":[[-1,0,-1.5,3,5,3.0,96,43]]},
  z: {"p":[-4,16,11],"a":[0,0,0],"b":[[-1.5,5.1,-2,4.0,3.0,4,96,51]]},
  A: {"p":[4,9,-8],"a":[0,0,0],"b":[[-1.9,-1,-2.1,3.0,8,4.0,44,29]]},
  B: {"p":[4,16,-8],"a":[0,0,0],"b":[[-1.9,0,-1.6,3.0,5,3.0,44,41]]},
  C: {"p":[4,16,-8],"a":[0,0,0],"b":[[-2.4,5.1,-2.1,4.0,3.0,4.0,44,51]]},
  D: {"p":[-4,9,-8],"a":[0,0,0],"b":[[-1.1,-1,-2.1,3.0,8,4.0,60,29]]},
  E: {"p":[-4,16,-8],"a":[0,0,0],"b":[[-1.1,0,-1.6,3.0,5,3.0,60,41]]},
  F: {"p":[-4,16,-8],"a":[0,0,0],"b":[[-1.6,5.1,-2.1,4.0,3.0,4.0,60,51]]},
  G: {"p":[-7.5,3,10],"a":[0,1.5708,0],"b":[[-3,0,0,8,8,3,0,34]]},
  H: {"p":[4.5,3,10],"a":[0,1.5708,0],"b":[[-3,0,0,8,8,3,0,47]]},
  I: {"p":[0,2,2],"a":[0,0,0],"b":[[-5,0,-3,10,1,8,80,0]]},
  J: {"p":[0,2,2],"a":[0,0,0],"b":[[-1.5,-1,-3,3.0,1,2,106,9]]},
  K: {"p":[0,2,2],"a":[0,0,0],"b":[[-4,-1,3,8,1,2,80,9]]},
  L: {"p":[5,3,2],"a":[0,0,0],"b":[[-0.5,0,-0.5,1.0,6,1.0,70,0]]},
  M: {"p":[5,3,2],"a":[0,0,0],"b":[[-0.5,6,-1,1.0,2,2,74,0]]},
  N: {"p":[-5,3,2],"a":[0,0,0],"b":[[-0.5,0,-0.5,1.0,6,1.0,80,0]]},
  O: {"p":[-5,3,2],"a":[0,0,0],"b":[[-0.5,6,-1,1.0,2,2,74,4]]},
  P: {"p":[0,4,-10],"a":[0.5236,0,0],"b":[[1.5,-8,-4,1.0,2,2,74,13]]},
  Q: {"p":[0,4,-10],"a":[0.5236,0,0],"b":[[-2.5,-8,-4,1.0,2,2,74,13]]},
  R: {"p":[0,4,-10],"a":[0,0,0],"b":[[2.6,-6,-6,0.0,3,16,44,10]]},
  S: {"p":[0,4,-10],"a":[0,0,0],"b":[[-2.6,-6,-6,0.0,3,16,44,5]]},
};
const HEAD = "abcdefghijPQRS", SADDLE = "IJKLMNOPQRS", BAGS = "GH";
const LEG_UPPER = [["x", "y", "z"], ["o", "v", "w"], ["D", "E", "F"], ["A", "B", "C"]]; // hind -x, hind +x, front -x, front +x
const COATS = ["white", "creamy", "chestnut", "brown", "black", "gray", "darkbrown"];
const MARKINGS = [null, "white", "whitefield", "whitedots", "blackdots"];
const BASE = "/media/1.7.10/entity/horse/";
const ARMOR = [null, "iron", "gold", "diamond"];
export function horseTextures(h) {
  const t = h.type;
  const coat = t === 0 ? BASE + "horse_" + COATS[(h.variant & 255) % 7] + ".png" : t === 1 ? BASE + "donkey.png" : t === 2 ? BASE + "mule.png" : t === 3 ? BASE + "horse_zombie.png" : BASE + "horse_skeleton.png";
  const marking = t === 0 && MARKINGS[((h.variant & 65280) >> 8) % 5] ? BASE + "horse_markings_" + MARKINGS[((h.variant & 65280) >> 8) % 5] + ".png" : null;
  return { coat, marking, armor: ARMOR };
}

const rotate = (g, [rx, ry, rz]) => { g.rotation.order = "ZYX"; g.rotation.set(rx, -ry, -rz); };

export function createHorseRig(renderer, e) {
  const h = e.horse ?? { type: 0, variant: 0 }, tex = horseTextures(h), root = new THREE.Group(), materials = [];
  const make = (url, offset) => {
    const m = entityMaterial(renderer.view.lighting, { map: pixelTexture(url), transparent: offset > 0 });
    if (offset > 0) Object.assign(m, { polygonOffset: true, polygonOffsetFactor: -offset, polygonOffsetUnits: -offset });
    materials.push(m);
    return m;
  };
  // One skeleton, several skins: the coat, the marking overlay and the three armour overlays share every box and pose.
  const skins = [{ name: "coat", m: make(tex.coat, 0) }];
  if (tex.marking) skins.push({ name: "marking", m: make(tex.marking, 1) });
  ARMOR.forEach((n, i) => { if (n) skins.push({ name: "armor" + i, m: make(BASE + "armor/horse_armor_" + n + ".png", 2 + i) }); });
  const frame = new THREE.Group(), neck = new THREE.Group(), pivots = {}, meshes = [];
  neck.position.set(0, 20 / 16, 10 / 16);
  neck.rotation.order = "YXZ";
  const part = (k, parent, origin) => {
    const { p, a, b } = HORSE_PARTS[k], g = new THREE.Group();
    g.position.set((p[0] - origin[0]) / 16, -(p[1] - origin[1]) / 16, -(p[2] - origin[2]) / 16);
    rotate(g, a);
    for (const [ox, oy, oz, w, hh, d, u, v] of b) for (const skin of skins) {
      const mesh = new THREE.Mesh(skinBox(w, hh, d, u, v, 128, 128), skin.m);
      mesh.position.set((ox + w / 2) / 16, -(oy + hh / 2) / 16, -(oz + d / 2) / 16);
      mesh.userData.skin = skin.name;
      g.add(mesh);
      meshes.push(mesh);
    }
    parent.add(g);
    pivots[k] = g;
  };
  const legKeys = LEG_UPPER.flat(), legs = [];
  for (const k of Object.keys(HORSE_PARTS)) {
    if (HEAD.includes(k)) part(k, neck, [0, 4, -10]);
    else if (!legKeys.includes(k)) part(k, frame, [0, 24, 0]);
  }
  frame.add(neck);
  // A leg's three boxes swing together about the upper leg's pivot (limb order: hind -x, hind +x, front -x, front +x).
  for (const keys of LEG_UPPER) {
    const o = HORSE_PARTS[keys[0]].p, group = new THREE.Group();
    group.position.set(o[0] / 16, (24 - o[1]) / 16, -o[2] / 16);
    for (const k of keys) part(k, group, o);
    frame.add(group);
    legs.push(group);
  }
  root.add(frame);
  renderer.scene.add(root);
  const custom = (r, ent) => {
    const hs = ent.horse ?? {};
    for (const k of SADDLE) if (pivots[k]) pivots[k].visible = !!hs.saddled;
    for (const k of BAGS) if (pivots[k]) pivots[k].visible = !!hs.chested;
    // Donkeys and mules wear long ears (f, g), horses short ones (d, e).
    for (const k of "de") pivots[k].visible = hs.type === 0 || hs.type > 2;
    for (const k of "fg") pivots[k].visible = hs.type === 1 || hs.type === 2;
    for (const m of meshes) {
      const n = m.userData.skin;
      m.visible = n.startsWith("armor") ? Number(n.slice(5)) === (hs.armor ?? 0) : true;
    }
  };
  return { root, neck, limbs: legs, materials, type: "horse", lift: 1 / 128, custom, horse: true };
}
