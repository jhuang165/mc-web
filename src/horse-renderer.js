// RenderHorse (bnv) with ModelHorse (bhs, 128 x 128). The parts and ModelHorse.setLivingAnimations are src/horse-model.js (executed:
// public/research/horse-model-reference.json); this file builds the three.js rig and applies that pose each frame: head and neck lean and
// rearing, the lips' opening, the legs (swing and rearing), the tail, the saddle straps and bags, and a foal's three scaled groups
// (ModelHorse.render, bytecode-read). Model (x, y, z) becomes (x, -y, -z) / 16 about the model origin, 24 pixels above the feet, and Java's
// Y and Z rotations change sign. RenderHorse.preRenderCallback scales a donkey by 0.87 and a mule by 0.92 (bytecode-read).
import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { entityMaterial } from "./light-material.js";
import { HORSE_PARTS, createHorseModel, setHorseAnimations } from "./horse-model.js";
import { horseLean, horseRear, horseMouth, newHorseAnim } from "./horse-copy.js";

export { HORSE_PARTS };
// ModelHorse.render's draw order (bytecode-read): the saddle tack (unscaled, adult and saddled only; the reins R and S only with a rider), the twelve leg boxes, the
// body (k), tail (l, m, n), neck (h) and mane (j), the ears (d and e, or f and g for a donkey or mule) and the head `a` with its lips b and c, then the chest bags
// (unscaled, adult only). A foal draws the legs, the body and the head in three scaled groups (ci = EntityHorse.getHorseSize).
const TACK = "iIJKLMNOPQ", REINS = "RS", LEGS = "ovwxyzABCDEF", BODY = "klmnhj", EARS = "defg", BAGS = "GH";
const HORSE_MODEL = createHorseModel(); // one ModelHorse for every horse, as RenderHorse has: a field a branch does not write keeps what the last horse left
const ZERO_ANIM = newHorseAnim();
const f = Math.fround;
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

const rotate = (g, m) => { g.rotation.order = "ZYX"; g.rotation.set(m.f, -m.g, -m.h); };
const place = (g, m) => { g.position.set(m.c / 16, -m.d / 16, -m.e / 16); rotate(g, m); };

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
  // frame: the model origin (24 pixels above the feet). tack and bags are drawn unscaled; each of legs, body and head sits in a scale group holding a translate group.
  const frame = new THREE.Group(), neck = new THREE.Group(), pivots = {}, meshes = [], groups = {};
  frame.position.set(0, 24 / 16, 0);
  for (const k of ["tack", "legs", "body", "head", "bags"]) {
    const scale = new THREE.Group(), move = new THREE.Group();
    scale.add(move);
    frame.add(scale);
    groups[k] = { scale, move };
  }
  const part = (k, parent) => {
    const { b } = HORSE_PARTS[k], g = new THREE.Group();
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
  const into = (keys, group) => { for (const k of keys) part(k, groups[group].move); };
  into(TACK + REINS, "tack");
  into(LEGS, "legs");
  into(BODY, "body");
  into(EARS + "a", "head");
  for (const k of "bc") part(k, pivots.a); // the head's children
  into(BAGS, "bags");
  root.add(frame);
  renderer.scene.add(root);
  const type = h.type;
  // The preview and a world mob call this with different inputs: `pose` (mobPose: limb swing, head turn) and the entity with the yaw fields of RendererLivingEntity.
  const custom = (r, ent, pose, partial, client) => {
    const hs = ent.horse ?? {};
    const age = ent.growingAge ?? hs.age ?? 0, adult = age >= 0;
    const rider = !!(ent.rider || ent.riddenBy), saddled = !!hs.saddled;
    const t = f(partial ?? 1), anim = client?.horse ?? ent.horseAnim ?? ZERO_ANIM;
    const lookDiff = pose?.headYaw ?? 0, lookPitch = pose?.headPitch ?? 0;
    const ang = ent.renderYawOffset !== undefined; // a world mob carries the yaw fields; the preview gives the head turn directly
    setHorseAnimations(HORSE_MODEL, {
      prevRenderYawOffset: ang ? ent.prevRenderYawOffset : 0, renderYawOffset: ang ? ent.renderYawOffset : 0,
      prevRotationYawHead: ang ? ent.prevRotationYawHead : lookDiff, rotationYawHead: ang ? ent.rotationYawHead : lookDiff,
      prevRotationPitch: ang ? ent.prevRotationPitch : lookPitch, rotationPitch: ang ? ent.rotationPitch : lookPitch,
      ticksExisted: ent.age ?? 0, lean: horseLean(anim, t), rear: horseRear(anim, t), mouth: horseMouth(anim, t), tail: anim.tail, saddled, rider,
    }, pose?.limbSwing ?? 0, pose?.limbSwingAmount ?? 0, t);
    for (const k of Object.keys(pivots)) place(pivots[k], HORSE_MODEL[k]);
    // ModelHorse.render: tack needs an adult with a saddle, the reins a rider too, the bags an adult with a chest.
    for (const k of TACK) pivots[k].visible = adult && saddled;
    for (const k of REINS) pivots[k].visible = adult && saddled && rider;
    for (const k of BAGS) pivots[k].visible = adult && !!hs.chested;
    // Donkeys and mules wear long ears (f, g), horses short ones (d, e).
    for (const k of "de") pivots[k].visible = hs.type === 0 || hs.type > 2;
    for (const k of "fg") pivots[k].visible = hs.type === 1 || hs.type === 2;
    for (const m of meshes) {
      const n = m.userData.skin;
      m.visible = n.startsWith("armor") ? Number(n.slice(5)) === (hs.armor ?? 0) : true;
    }
    // ci() = EntityHorse.getHorseSize: 1 for an adult, else 0.5 + (-24000 - age) / -24000 * 0.5. An adult draws its three groups unscaled.
    const ci = adult ? 1 : f(0.5 + f(f(f(-24000 - age) / -24000) * 0.5));
    for (const k of ["tack", "bags"]) { groups[k].scale.scale.set(1, 1, 1); groups[k].move.position.set(0, 0, 0); }
    if (adult) {
      for (const k of ["legs", "body", "head"]) { groups[k].scale.scale.set(1, 1, 1); groups[k].move.position.set(0, 0, 0); }
    } else {
      const inv = f(1 - ci);
      groups.legs.scale.scale.set(ci, f(0.5 + f(ci * 0.5)), ci);
      groups.legs.move.position.set(0, -f(f(0.95) * inv), 0);
      groups.body.scale.scale.set(ci, ci, ci);
      groups.body.move.position.set(0, -f(f(1.35) * inv), 0);
      const s = f(0.5 + f(f(ci * ci) * 0.5)), lean0 = f(anim.prevHeadLean); // wi.p(0.0F)
      groups.head.scale.scale.set(s, s, s);
      if (lean0 <= 0) groups.head.move.position.set(0, -f(f(1.35) * inv), 0);
      else groups.head.move.position.set(0, -f(f(f(f(0.9) * inv) * lean0) + f(f(f(1.35) * inv) * f(1 - lean0))), -f(f(f(0.15) * inv) * lean0));
    }
  };
  custom(null, e, null, 1, null);
  return { root, neck, limbs: [], materials, type: "horse", lift: 1 / 128, custom, horse: true, scale: type === 1 ? f(0.87) : type === 2 ? f(0.92) : 1, ownGrowth: true };
}
