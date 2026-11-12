import { EntityFireRenderer } from "./entity-fire-renderer.js";
import { stackHasEffect } from "./armor-enchantments.js";
import { headWearable, headItemMatrix } from "./wearable-heads.js";
import { ITEM_SKULL as SKULL_ITEM, SKULL_TEXTURES, skullTextureHeight } from "./skull.js";
import * as THREE from "three";
import { pixelTexture, itemTexture } from "./first-person.js";
import { itemFrameTag } from "./item-animation.js";
import { FISHING_ROD, rodState } from "./fishing-content.js";
import { entityMaterial } from "./light-material.js";
import { ITEMS, ARMOR_MATERIALS } from "./survival.js";
import { blockTile, tileRect } from "./block-textures.js";
import { spriteGeometry } from "./sprite-geometry.js";
import { mobPose, wrapDegrees, nearAngle } from "./entities.js";
import { BRIGHTNESS, mhSin, mhCos } from "./lighting.js";
import { rayTraceBlocks } from "./projectiles.js";
import { PHYSICS } from "./world.js";
import { LEATHER_ARMOR, LEATHER_COLOR, leatherColorComponents } from "./leather-dye.js";
import { itemPasses } from "./item-passes.js";
import { glintMesh, blockItemGeometry, blockItemTurn } from "./first-person.js";
import { chestItemTexture, chestItemModel } from "./chest-renderer.js";
import { arrowGeometry } from "./arrow-renderer.js";
import { stuckArrowPlacements } from "./stuck-arrows.js";
export { LEATHER_COLOR } from "./leather-dye.js";

// Third-person player: EntityRenderer.orientCamera (blt.h), RenderPlayer (bop)
// and ModelBiped (bhm), as read from the 1.7.10 bytecode. See
// public/research/third-person.md.
let nextPlayerEntityId = 1; // runtime entity ids, unsaved like Entity.entityId
const f = Math.fround, RAD = Math.PI / 180, DEG = 180 / Math.PI;
const ARMOR_URL = "/media/1.7.10/models/armor/";
export const STEVE_URL = "/media/1.7.10/entity/steve.png";

// ---------------------------------------------------------------------------
// Camera (EntityRenderer.orientCamera, blt.h(F)V = func_78467_g)
// ---------------------------------------------------------------------------

// thirdPersonDistance (E) and ...Temp (F) are both 4.0 outside the F1 debug camera.
export const THIRD_PERSON_DISTANCE = 4;
// F5 (bao): `if (++thirdPersonView > 2) thirdPersonView = 0`.
export const nextView = (view) => (view + 1 > 2 ? 0 : view + 1);

// Eight rays, one per corner of a 0.2 cube around the eye, pull the camera in
// to the nearest block. The corner offsets come from the bits of i (x: bit 0,
// y: bit 1, z: bit 2). The end point adds f6 to x as well as z: 1.7.10 writes
// `d0 - d3 + f4 + f6` for x, which this keeps. `yaw`/`pitch` are the view's
// three.js angles; `mode` 2 looks back at the player (pitch + 180 in Java), so
// the camera sits on the other side of the eye.
export function cameraDistance(world, eye, yaw, pitch, mode = 1, distance = THIRD_PERSON_DISTANCE) {
  const cp = Math.cos(pitch), s = mode === 2 ? -1 : 1,
    d = [-Math.sin(yaw) * cp * distance * s, Math.sin(pitch) * distance * s, -Math.cos(yaw) * cp * distance * s];
  let d7 = distance;
  for (let i = 0; i < 8; i++) {
    const a = ((i & 1) * 2 - 1) * 0.1, b = (((i >> 1) & 1) * 2 - 1) * 0.1, c = (((i >> 2) & 1) * 2 - 1) * 0.1,
      hit = rayTraceBlocks(world, [eye.x + a, eye.y + b, eye.z + c], [eye.x - d[0] + a + c, eye.y - d[1] + b, eye.z - d[2] + c]);
    if (hit) {
      const dist = Math.hypot(hit.vec[0] - eye.x, hit.vec[1] - eye.y, hit.vec[2] - eye.z);
      if (dist < d7) d7 = dist;
    }
  }
  return d7;
}

// Camera position and orientation for view 1 (behind) or 2 (in front, facing
// the player). Returns three.js Euler angles in "YXZ" order.
export function thirdPersonCamera(world, eye, yaw, pitch, mode, distance = THIRD_PERSON_DISTANCE) {
  const d = cameraDistance(world, eye, yaw, pitch, mode, distance), cp = Math.cos(pitch), s = mode === 2 ? -1 : 1,
    look = [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
  return {
    distance: d,
    position: [eye.x - look[0] * s * d, eye.y - look[1] * s * d, eye.z - look[2] * s * d],
    rotation: mode === 2 ? { x: -pitch, y: yaw + Math.PI, z: 0 } : { x: pitch, y: yaw, z: 0 },
  };
}

// ---------------------------------------------------------------------------
// Body state (EntityLivingBase.onUpdate / func_110146_f, sv.f(FF))
// ---------------------------------------------------------------------------

// Entity.rotationYaw is Java degrees (0 faces +z, increasing toward -x);
// this game's yaw is three.js radians (0 faces -z, increasing toward -x).
export const javaYaw = (yaw) => f(180 - yaw * DEG);
// Java rotationPitch is positive looking down.
export const javaPitch = (pitch) => f(-pitch * DEG);

// The fields mobPose() reads, kept for the local player and stepped once per
// 20 Hz tick. `position`/`previous` are the feet (lastTickPos and pos).
export class PlayerBody {
  constructor() {
    this.reset({ x: 0, y: 0, z: 0 }, 0, 0);
  }
  reset(position, yaw, pitch) {
    this.entityId = nextPlayerEntityId++;
    const j = javaYaw(yaw), p = javaPitch(pitch);
    Object.assign(this, {
      px: position.x, py: position.y, pz: position.z, x: position.x, y: position.y, z: position.z,
      rotationYaw: j, renderYawOffset: j, prevRenderYawOffset: j, rotationYawHead: j, prevRotationYawHead: j,
      rotationPitch: p, prevRotationPitch: p, limbSwing: 0, limbSwingAmount: 0, prevLimbSwingAmount: 0,
      growingAge: 0, death: 0, age: 0,
    });
  }
  // func_110146_f: the body follows the walking direction (or the head while
  // swinging), turning 30% of the way each tick and never more than 75 degrees
  // from the head.
  turnBody(target) {
    this.renderYawOffset = f(this.renderYawOffset + f(wrapDegrees(f(target - this.renderYawOffset)) * f(0.3)));
    let d = wrapDegrees(f(this.rotationYaw - this.renderYawOffset));
    d = Math.min(Math.max(d, -75), 75);
    this.renderYawOffset = f(this.rotationYaw - d);
    if (d * d > 2500) this.renderYawOffset = f(this.renderYawOffset + f(d * f(0.2)));
  }
  tick({ position, previous, yaw, pitch, swinging = false, riding = false }) {
    this.prevRenderYawOffset = this.renderYawOffset;
    this.prevRotationYawHead = this.rotationYawHead;
    this.prevRotationPitch = this.rotationPitch;
    this.px = previous.x; this.py = previous.y; this.pz = previous.z;
    this.x = position.x; this.y = position.y; this.z = position.z;
    this.rotationYaw = javaYaw(yaw);
    this.rotationPitch = javaPitch(pitch);
    // The old-AI branch of onLivingUpdate sets rotationYawHead = rotationYaw.
    this.rotationYawHead = this.rotationYaw;
    const dx = f(position.x - previous.x), dz = f(position.z - previous.z), d2 = riding ? 0 : f(f(dx * dx) + f(dz * dz));
    let target = this.renderYawOffset;
    if (d2 > f(0.0025000002)) target = f(f(Math.atan2(dz, dx) * DEG) - 90);
    if (swinging) target = this.rotationYaw;
    this.turnBody(target);
    this.prevRenderYawOffset = nearAngle(this.prevRenderYawOffset, this.renderYawOffset);
    this.prevRotationPitch = nearAngle(this.prevRotationPitch, this.rotationPitch);
    this.prevRotationYawHead = nearAngle(this.prevRotationYawHead, this.rotationYawHead);
    // Tail of onLivingUpdate (sv.e(FF)): limb swing follows the horizontal speed.
    this.prevLimbSwingAmount = this.limbSwingAmount;
    const speed = Math.min(f(Math.sqrt(d2) * 4), 1);
    this.limbSwingAmount = riding ? 0 : f(this.limbSwingAmount + f(f(speed - this.limbSwingAmount) * f(0.4)));
    this.limbSwing = f(this.limbSwing + this.limbSwingAmount);
    this.age++;
  }
}

// ---------------------------------------------------------------------------
// ModelBiped (bhm): boxes
// ---------------------------------------------------------------------------

// ModelBox (bis) + TexturedQuad (bhv). Returns a non-indexed geometry in model
// space: pixels / 16, +y pointing down, as the model is drawn before the
// renderer's (-1, -1, 1) scale. The quad corner table, UV rectangles, the
// (u2,v1) (u1,v1) (u1,v2) (u2,v2) vertex mapping, the mirror's x swap plus
// face flip and the normal (p1-p2) x (p1-p0) are all taken from the bytecode.
export function modelBox(u, v, x, y, z, w, h, d, expand = 0, mirror = false, tw = 64, th = 32) {
  let x1 = x - expand, y1 = y - expand, z1 = z - expand, x2 = x + w + expand, y2 = y + h + expand, z2 = z + d + expand;
  if (mirror) [x1, x2] = [x2, x1];
  const P = [[x1, y1, z1], [x2, y1, z1], [x2, y2, z1], [x1, y2, z1], [x1, y1, z2], [x2, y1, z2], [x2, y2, z2], [x1, y2, z2]],
    quads = [
      [[5, 1, 2, 6], u + d + w, v + d, u + d + w + d, v + d + h],
      [[0, 4, 7, 3], u, v + d, u + d, v + d + h],
      [[5, 4, 0, 1], u + d, v, u + d + w, v + d],
      [[2, 3, 7, 6], u + d + w, v + d, u + d + w + w, v],
      [[1, 0, 3, 2], u + d, v + d, u + d + w, v + d + h],
      [[4, 5, 6, 7], u + d + w + d, v + d, u + d + w + d + w, v + d + h],
    ],
    pos = [], nor = [], uv = [];
  for (const [index, u1, v1, u2, v2] of quads) {
    const corners = index.map((i) => P[i].map((c) => c / 16)),
      coords = [[u2, v1], [u1, v1], [u1, v2], [u2, v2]];
    if (mirror) { corners.reverse(); coords.reverse(); }
    const a = new THREE.Vector3(...corners[1]).sub(new THREE.Vector3(...corners[0])),
      b = new THREE.Vector3(...corners[1]).sub(new THREE.Vector3(...corners[2])),
      n = b.cross(a).normalize();
    for (const i of [0, 1, 2, 0, 2, 3]) {
      pos.push(...corners[i]);
      nor.push(n.x, n.y, n.z);
      uv.push(coords[i][0] / tw, 1 - coords[i][1] / th);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

// ModelBiped constructor boxes: texture offset, box (x, y, z, w, h, d), the
// ModelRenderer rotation point and the extra expansion over the model's `f`.
export const BIPED = {
  head: { uv: [0, 0], box: [-4, -8, -4, 8, 8, 8], point: [0, 0, 0], extra: 0 },
  hat: { uv: [32, 0], box: [-4, -8, -4, 8, 8, 8], point: [0, 0, 0], extra: 0.5 },
  body: { uv: [16, 16], box: [-4, 0, -2, 8, 12, 4], point: [0, 0, 0], extra: 0 },
  rightArm: { uv: [40, 16], box: [-3, -2, -2, 4, 12, 4], point: [-5, 2, 0], extra: 0 },
  leftArm: { uv: [40, 16], box: [-1, -2, -2, 4, 12, 4], point: [5, 2, 0], extra: 0, mirror: true },
  rightLeg: { uv: [0, 16], box: [-2, 0, -2, 4, 12, 4], point: [-1.9, 12, 0], extra: 0 },
  leftLeg: { uv: [0, 16], box: [-2, 0, -2, 4, 12, 4], point: [1.9, 12, 0], extra: 0, mirror: true },
};
export const PART_NAMES = Object.keys(BIPED);

// ModelBiped.setRotationAngles (bhm.a). `headYaw` is relative to the body, in
// degrees; `swing` is onGround (swing progress 0..1); `heldRight`/`heldLeft` are
// heldItemRight (m) / heldItemLeft (l). Returns each part's rotation point
// (model pixels) and angles (radians). The riding branch is included; the bow pose is not.
export function bipedPose({ limbSwing = 0, limbSwingAmount = 0, age = 0, headYaw = 0, headPitch = 0, swing = 0, sneak = false, riding = false, heldRight = 0, heldLeft = 0 } = {}) {
  const p = {};
  for (const n of PART_NAMES) p[n] = { point: [...BIPED[n].point], rot: [0, 0, 0] };
  const ls = limbSwing * 0.6662, lsa = limbSwingAmount, S = 57.295776;
  p.head.rot[1] = headYaw / S;
  p.head.rot[0] = headPitch / S;
  p.rightArm.rot[0] = mhCos(ls + Math.PI) * 2 * lsa * 0.5;
  p.leftArm.rot[0] = mhCos(ls) * 2 * lsa * 0.5;
  p.rightLeg.rot[0] = mhCos(ls) * 1.4 * lsa;
  p.leftLeg.rot[0] = mhCos(ls + Math.PI) * 1.4 * lsa;
  if (riding) {
    p.rightArm.rot[0] -= Math.fround(Math.PI / 5);
    p.leftArm.rot[0] -= Math.fround(Math.PI / 5);
    p.rightLeg.rot[0] = p.leftLeg.rot[0] = -Math.fround(Math.fround(Math.PI) * Math.fround(2 / 5));
    p.rightLeg.rot[1] = Math.fround(Math.PI / 10);
    p.leftLeg.rot[1] = -Math.fround(Math.PI / 10);
  }
  if (heldLeft) p.leftArm.rot[0] = p.leftArm.rot[0] * 0.5 - 0.31415927 * heldLeft;
  if (heldRight) p.rightArm.rot[0] = p.rightArm.rot[0] * 0.5 - 0.31415927 * heldRight;
  // Attack swing (onGround is 0 at rest, which leaves these at their defaults).
  if (swing > -9990) {
    const body = mhSin(Math.sqrt(swing) * Math.PI * 2) * 0.2;
    p.body.rot[1] = body;
    p.rightArm.point[2] = mhSin(body) * 5;
    p.rightArm.point[0] = -mhCos(body) * 5;
    p.leftArm.point[2] = -mhSin(body) * 5;
    p.leftArm.point[0] = mhCos(body) * 5;
    p.rightArm.rot[1] += body;
    p.leftArm.rot[1] += body;
    p.leftArm.rot[0] += body;
    let q = 1 - swing;
    q *= q;
    q *= q;
    q = 1 - q;
    const arc = mhSin(q * Math.PI), lift = mhSin(swing * Math.PI) * -(p.head.rot[0] - 0.7) * 0.75;
    p.rightArm.rot[0] -= arc * 1.2 + lift;
    p.rightArm.rot[1] += body * 2;
    p.rightArm.rot[2] = mhSin(swing * Math.PI) * -0.4;
  }
  if (sneak) {
    p.body.rot[0] = 0.5;
    p.rightArm.rot[0] += 0.4;
    p.leftArm.rot[0] += 0.4;
    p.rightLeg.point[2] = p.leftLeg.point[2] = 4;
    p.rightLeg.point[1] = p.leftLeg.point[1] = 9;
    p.head.point[1] = 1;
  } else {
    p.body.rot[0] = 0;
    p.rightLeg.point[2] = p.leftLeg.point[2] = 0.1;
    p.rightLeg.point[1] = p.leftLeg.point[1] = 12;
    p.head.point[1] = 0;
  }
  p.hat.rot = [...p.head.rot];
  p.hat.point = [...p.head.point];
  p.rightArm.rot[2] += mhCos(age * 0.09) * 0.05 + 0.05;
  p.leftArm.rot[2] -= mhCos(age * 0.09) * 0.05 + 0.05;
  p.rightArm.rot[0] += mhSin(age * 0.067) * 0.05;
  p.leftArm.rot[0] -= mhSin(age * 0.067) * 0.05;
  return p;
}

// ---------------------------------------------------------------------------
// Armor (RenderPlayer.shouldRenderPass, bop.a(blg, int, float))
// ---------------------------------------------------------------------------

// Parts each pass shows: head and hat on pass 0, body on 1 and 2, arms on 1,
// legs on 2 and 3.
export const ARMOR_PASS_PARTS = [["head", "hat"], ["body", "rightArm", "leftArm"], ["body", "rightLeg", "leftLeg"], ["rightLeg", "leftLeg"]];
// `pass` 0..3 is helmet, chestplate, leggings, boots (stack armor[3 - pass]).
// RenderBiped.getArmorResource picks layer 2 only for leggings (pass 2); the
// leggings model (h) is expanded by 0.5, the others (g) by 1.0. Leather is
// tinted and always gets its `_overlay` drawn untinted on top.
export function armorLayer(id, pass, color = LEATHER_COLOR) {
  const item = ITEMS[id];
  if (!item || item.armor === undefined || item.armor !== pass || !(id >= 400 && id < 400 + ARMOR_MATERIALS.length * 4)) return null;
  const material = ARMOR_MATERIALS[Math.floor((id - 400) / 4)][4], leather = material === "leather",
    base = `${ARMOR_URL}${material}_layer_${pass === 2 ? 2 : 1}`;
  return {
    url: base + ".png",
    overlay: leather ? base + "_overlay.png" : null,
    tint: leather ? leatherColorComponents(color) : null,
    expand: pass === 2 ? 0.5 : 1,
    parts: ARMOR_PASS_PARTS[pass],
  };
}

// ---------------------------------------------------------------------------
// Held item (RenderPlayer.renderSpecials, bop.a(blg, float))
// ---------------------------------------------------------------------------

const FULL3D_KINDS = new Set(["pickaxe", "axe", "shovel", "hoe", "sword", "fishing_rod"]);
// Item.isFull3D: tools, hoes and swords, plus the stick, bone and carrot on a stick (setFull3D / abp.f).
export const isFull3D = (id) => FULL3D_KINDS.has(ITEMS[id]?.kind) || id === 300 || id === 311 || id === 2100;
// "block" draws the cube, "tool" a full-3D sprite, "rod" a full-3D sprite that also shouldRotateAroundOrigin (the fishing rod and the carrot on a
// stick), "flat" any other sprite and "bow" the bow's own transform (RenderPlayer and RenderBiped test `item == Items.bow`).
const ROTATES_AROUND_ORIGIN = (id) => id === FISHING_ROD || id === 2100;
export const heldKind = (id, damage = 0) => (id === 127 ? "bow" : itemTexture(id, damage) ? (isFull3D(id) ? (ROTATES_AROUND_ORIGIN(id) ? "rod" : "tool") : "flat") : "block");

// The matrix from the part the item hangs on (after postRender) to the item. `origin` "arm" is the right arm of RenderPlayer and RenderBiped (zombies,
// pigmen, skeletons); "nose" is RenderWitch, which hangs the item on ModelWitch's nose and adds two rotations before ItemRenderer.renderItem.
// `blocking` is the player's blocking sword (getItemInUseCount > 0 and EnumAction.block): the full-3D branch shifts and turns the item first.
// All of it is executed in public/research/held-pose-reference.json (src/held-pose.test.js).
export function heldItemMatrix(kind, { origin = "arm", blocking = false } = {}) {
  const m = new THREE.Matrix4(), t = new THREE.Matrix4(),
    translate = (x, y, z) => m.multiply(t.makeTranslation(x, y, z)),
    rotate = (axis, deg) => m.multiply(axis === "x" ? t.makeRotationX(deg * RAD) : axis === "y" ? t.makeRotationY(deg * RAD) : t.makeRotationZ(deg * RAD)),
    scale = (x, y, z) => m.multiply(t.makeScale(x, y, z)),
    nose = origin === "nose";
  if (nose) translate(-0.0625, 0.53125, 0.21875);
  else translate(-0.0625, 0.4375, 0.0625);
  if (kind === "block") {
    let s = 0.5;
    translate(0, 0.1875, -0.3125);
    s *= 0.75;
    rotate("x", 20);
    rotate("y", 45);
    scale(nose ? s : -s, -s, s); // RenderWitch turns y only
  } else {
    if (kind === "bow") {
      // The bow branch of RenderPlayer.renderSpecials (bop.a): it is held upright, a
      // little in front of the hand, and turned 20 degrees about y.
      const s = 0.625;
      translate(0, 0.125, 0.3125);
      rotate("y", -20);
      scale(s, -s, s);
      rotate("x", -100);
      rotate("y", 45);
    } else if (kind === "tool" || kind === "rod") {
      const s = 0.625;
      if (kind === "rod") {
        rotate("z", 180);
        translate(0, -0.125, 0);
      }
      if (blocking) {
        translate(0.05, 0, -0.1);
        rotate("y", -50);
        rotate("x", -10);
        rotate("z", -60);
      }
      translate(0, 0.1875, 0);
      scale(s, -s, s);
      rotate("x", -100);
      rotate("y", 45);
    } else {
      const s = 0.375;
      translate(0.25, 0.1875, -0.1875);
      scale(s, s, s);
      rotate("z", 60);
      rotate("x", -90);
      rotate("z", 20);
    }
  }
  if (nose) {
    rotate("x", -15);
    rotate("z", 40);
  }
  if (kind !== "block") {
    // ItemRenderer.renderItem's 2D branch.
    translate(0, -0.3, 0);
    scale(1.5, 1.5, 1.5);
    rotate("y", 50);
    rotate("z", 335);
    translate(-0.9375, -0.0625, 0);
  }
  return m;
}

// ---------------------------------------------------------------------------
// Shadow
// ---------------------------------------------------------------------------

// Render.renderShadow centres the shadow on lastTickPos/posY + height / 2.
// The local player's posY is its eye height (yOffset 1.62), so unlike mobs the
// centre sits 2.52 above the feet; EntityPlayer does not override
// getShadowSize. `partial` interpolates previous -> position.
// `prevDrop`/`drop` are the sneak ySize (posY = minY + yOffset - ySize).
export function playerShadowCaster(position, previous, partial, size, prevDrop = 0, drop = 0) {
  const lerp = (a, b) => a + (b - a) * partial, eye = PHYSICS.eye;
  return {
    ...size,
    x: lerp(previous.x, position.x), y: lerp(previous.y - prevDrop, position.y - drop) + eye, z: lerp(previous.z, position.z),
    pos: { x: position.x, y: position.y - drop + eye, z: position.z }, height: PHYSICS.height,
  };
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

const boxCache = new Map();
function boxGeometry(name, expand) {
  const key = name + "|" + expand;
  if (!boxCache.has(key)) {
    const b = BIPED[name];
    boxCache.set(key, modelBox(...b.uv, ...b.box, expand + b.extra, !!b.mirror));
  }
  return boxCache.get(key);
}

export class PlayerRenderer {
  // `view` supplies the lightmap and brightness (VoxelScene); `atlas` is the block atlas.
  constructor(scene, view, atlas) {
    this.scene = scene;
    this.view = view;
    this.atlas = atlas;
    this.materials = [];
    // bop: ModelBiped(0) at scale 0.9375, drawn with (-1, -1, 1) and shifted so
    // the feet are at the entity position (24 * 0.0625 + 0.0078125 down).
    this.root = new THREE.Group();
    this.frame = new THREE.Group();
    this.frame.scale.set(-0.9375, -0.9375, 0.9375);
    this.model = new THREE.Group();
    this.model.position.set(0, -1.5078125, 0);
    this.frame.add(this.model);
    this.root.add(this.frame);
    this.root.visible = false;
    this.base = this.material({ map: pixelTexture(STEVE_URL) });
    this.pivots = {};
    for (const name of PART_NAMES) {
      const pivot = new THREE.Group();
      pivot.rotation.order = "ZYX";
      pivot.add(new THREE.Mesh(boxGeometry(name, 0), this.base));
      this.pivots[name] = pivot;
      this.model.add(pivot);
    }
    this.fire = new EntityFireRenderer(scene);
    this.armorKey = "";
    this.armorNodes = [];
    this.armorMaterials = [];
    this.arrowKey = "";
    this.arrowNodes = [];
    this.arrowMaterial = null;
    this.heldId = 0;
    this.heldKey = "0:0";
    this.held = null;
    this.heldMaterial = null;
    this.heldOverlayMaterial = null;
    this.heldGeometry = null;
    scene.add(this.root);
  }
  material(options) {
    const m = entityMaterial(this.view.lighting, { ...options, side: THREE.DoubleSide });
    if (options.depthWrite !== undefined) m.depthWrite = options.depthWrite;
    if (options.polygonOffset !== undefined) m.polygonOffset = options.polygonOffset;
    if (options.polygonOffsetFactor !== undefined) m.polygonOffsetFactor = options.polygonOffsetFactor;
    this.materials.push(m);
    return m;
  }
  forget(m) {
    this.materials = this.materials.filter((x) => x !== m);
    m.dispose();
  }
  // Stacks are ordered helmet..boots. Color participates in the cache key for redyeing.
  syncArmor(stacks) {
    const key = stacks.map(s => `${s?.id ?? 0}:${s?.color ?? LEATHER_COLOR}:${stackHasEffect(s, ITEMS[s?.id]) ? 1 : 0}:${s?.id === SKULL_ITEM ? s.damage | 0 : 0}`).join(",");
    if (key === this.armorKey) return;
    this.armorKey = key;
    for (const n of this.armorNodes) n.parent?.remove(n);
    for (const m of this.armorMaterials) this.forget(m);
    this.armorNodes = [];
    this.armorMaterials = [];
    for (const m of this.armorGlints ?? []) m.dispose();
    this.armorGlints = [];
    if (stacks[0] && headWearable(stacks[0].id)) this.attachHeadItem(stacks[0]);
    stacks.forEach((stack, pass) => {
      const layer = armorLayer(stack?.id ?? 0, pass, stack?.color);
      if (!layer) return;
      const make = (url, tint, order) => {
        const m = this.material({ map: pixelTexture(url), color: tint });
        this.armorMaterials.push(m);
        for (const name of layer.parts) {
          const mesh = new THREE.Mesh(boxGeometry(name, layer.expand), m);
          mesh.renderOrder = order;
          this.pivots[name].add(mesh);
          this.armorNodes.push(mesh);
          if (stackHasEffect(stack, ITEMS[stack?.id]) && order === 0) {
            const glint = armorGlintMesh(mesh.geometry, m.uniforms.map.value);
            mesh.add(glint); this.armorGlints.push(glint.material);
          }
        }
      };
      make(layer.url, layer.tint, 0);
      if (layer.overlay) make(layer.overlay, null, 1);
    });
  }
  // RenderPlayer.renderSpecials head branch (wearable-heads.js): a pumpkin block cube or the skull model on the head part.
  attachHeadItem(stack) {
    const group = new THREE.Group();
    group.matrixAutoUpdate = false;
    group.matrix.copy(headItemMatrix(stack.id));
    let mesh;
    if (stack.id === SKULL_ITEM) {
      const type = (stack.damage | 0) in SKULL_TEXTURES ? stack.damage | 0 : 0, m = this.material({ map: pixelTexture(SKULL_TEXTURES[type]) });
      // ModelSkeletonHead: one 8 x 8 x 8 box at uv (0, 0), 64 x 32 (zombie 64 x 64), hanging from the head pivot.
      mesh = new THREE.Mesh(modelBox(0, 0, -4, -8, -4, 8, 8, 8, 0, false, 64, skullTextureHeight(type)), m);
      this.armorMaterials.push(m);
    } else {
      const g = new THREE.BoxGeometry(1, 1, 1), uv = g.attributes.uv;
      for (let face = 0; face < 6; face++) {
        const r = tileRect(blockTile(stack.id, face));
        uv.setXY(face * 4, r.u0, r.v1); uv.setXY(face * 4 + 1, r.u1, r.v1); uv.setXY(face * 4 + 2, r.u0, r.v0); uv.setXY(face * 4 + 3, r.u1, r.v0);
      }
      const m = this.material({ map: this.atlas });
      mesh = new THREE.Mesh(g, m);
      mesh.rotation.y = Math.PI / 2; // as the held block cube
      this.armorMaterials.push(m);
    }
    group.add(mesh);
    this.pivots.head.add(group);
    this.armorNodes.push(group);
  }
  syncHeld(id, damage = 0, color = undefined, glint = false, blocking = false) {
    blocking = blocking && heldKind(id, damage) === "tool"; // only the full-3D branch of RenderPlayer.renderSpecials reads EnumAction.block
    // RenderPlayer.renderSpecials (bop.a, executed in held-pose-reference.json): while the player's bobber is out (fishEntity != null) the hand
    // holds a plain stick, not the cast rod icon (that icon is the first person one, first-person.js).
    if (id === FISHING_ROD && rodState.cast) { id = 300; damage = 0; color = undefined; glint = false; }
    const leather = itemPasses(id, damage, color),
      cast = 0, key = (blocking ? "b" : "") + id + ":" + damage + ":" + (leather?.color ?? 0) + ":" + (glint ? 1 : 0) + ":" + cast + ":" + (id ? itemFrameTag(itemTexture(id, damage, cast)) : 0); // animated icon frame (item-animation.js): rebuilt only when it changes
    if (key === this.heldKey) return;
    this.heldKey = key;
    this.heldId = id;
    if (this.held) {
      this.held.parent?.remove(this.held);
      const owned = new Set();
      this.held.traverse((node) => { node.geometry?.dispose(); if (node.material) for (const material of Array.isArray(node.material) ? node.material : [node.material]) owned.add(material); });
      for (const material of owned) this.forget(material);
      this.held = this.heldMaterial = this.heldOverlayMaterial = this.heldGeometry = null;
    }
    if (!id || !ITEMS[id]) return;
    const kind = heldKind(id, damage), url = leather?.base ?? itemTexture(id, damage);
    let mesh;
    const chestUrl = !url && chestItemTexture(id);
    if (chestUrl) {
      this.heldMaterial = this.material({ map: pixelTexture(chestUrl) });
      mesh = chestItemModel(this.heldMaterial);
      mesh.rotation.y = Math.PI / 2; // as the held block cube
    } else if (url) {
      this.heldGeometry = spriteGeometry();
      this.heldMaterial = this.material({ map: pixelTexture(url), ...(leather ? { color: leather.tint } : {}) });
      mesh = new THREE.Mesh(this.heldGeometry, this.heldMaterial);
      if (leather) {
        const overlayMap = pixelTexture(leather.overlay);
        this.heldOverlayMaterial = this.material({ map: overlayMap, ...(leather.overlayTint ? { color: leather.overlayTint } : {}), transparent: true, alphaTest: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
        const overlay = new THREE.Mesh(this.heldGeometry, this.heldOverlayMaterial);
        overlay.renderOrder = 1;
        mesh.add(overlay);
        if (glint) overlay.add(glintMesh(this.heldGeometry, overlayMap));
      }
    } else if (blockItemGeometry(id)) {
      this.heldMaterial = this.material({ map: this.atlas });
      mesh = new THREE.Mesh((this.heldGeometry = blockItemGeometry(id)), this.heldMaterial);
      mesh.rotation.y = blockItemTurn(id);
    } else {
      const g = (this.heldGeometry = new THREE.BoxGeometry(1, 1, 1)), uv = g.attributes.uv;
      for (let face = 0; face < 6; face++) {
        const r = tileRect(blockTile(id, face));
        uv.setXY(face * 4, r.u0, r.v1);
        uv.setXY(face * 4 + 1, r.u1, r.v1);
        uv.setXY(face * 4 + 2, r.u0, r.v0);
        uv.setXY(face * 4 + 3, r.u1, r.v0);
      }
      this.heldMaterial = this.material({ map: this.atlas });
      mesh = new THREE.Mesh(g, this.heldMaterial);
      mesh.rotation.y = Math.PI / 2;
    }
    if (glint && mesh.geometry) mesh.add(glintMesh(mesh.geometry, url ? pixelTexture(url) : this.atlas));
    const group = new THREE.Group();
    group.matrixAutoUpdate = false;
    group.matrix.copy(heldItemMatrix(kind, { blocking }));
    group.add(mesh);
    this.pivots.rightArm.add(group);
    this.held = group;
  }
  // RendererLivingEntity.func_85093_e: `count` arrows stuck in the model, placed from Random(entityId). Drawn between
  // disableStandardItemLighting / enableStandardItemLighting, so the arrows are unlit (diffuse 1) and not hurt-tinted.
  syncArrows(count, entityId = 0) {
    const key = `${count | 0}:${entityId | 0}`;
    if (key === this.arrowKey) return;
    this.arrowKey = key;
    for (const n of this.arrowNodes) n.parent?.remove(n);
    this.arrowNodes = [];
    if (!(count > 0)) return;
    if (!this.arrowMaterial) {
      this.arrowMaterial = entityMaterial(this.view.lighting, { map: pixelTexture("/media/1.7.10/entity/arrow.png"), side: THREE.DoubleSide });
      this.arrowMaterial.vertexShader = this.arrowMaterial.vertexShader.replace(/vDiffuse=min\([^;]*;/, "vDiffuse=1.;");
      this.arrowMaterial.needsUpdate = true;
      this.arrowGeometry = arrowGeometry();
    }
    for (const a of stuckArrowPlacements(entityId, count)) {
      const mesh = new THREE.Mesh(this.arrowGeometry, this.arrowMaterial);
      mesh.rotation.order = "YZX";
      mesh.position.set(a.pos[0], a.pos[1], a.pos[2]);
      mesh.rotation.set(Math.PI / 4, ((a.yaw - 90) * Math.PI) / 180, (a.pitch * Math.PI) / 180);
      mesh.frustumCulled = false;
      // hat shares the head's transform; the cape and ears have no pivot here (rotation point 0).
      (this.pivots[a.name === "hat" ? "head" : a.name] ?? this.model).add(mesh);
      this.arrowNodes.push(mesh);
    }
  }
  // `body` is a PlayerBody; `swing` is the swing progress (0 at rest); `armor`
  // is inventory.armor (boots first); `held` the held item id. `sleeping` is
  // { pos, offset, facing } from BedSleep while the player lies in a bed.
  update(body, partial, { visible = true, swing = 0, armor = [], held = 0, heldDamage = 0, heldColor = undefined, heldGlint = false, blocking = false, hurt = false, sneak = false, riding = false, invisible = false, arrowCount = 0, arrowEntityId = body.entityId ?? 0, burning = false, fireViewYaw = 180, sleeping = null, deathTime = 0 } = {}) {
    this.root.visible = visible;
    if (!visible) { this.fire.root.visible = false; return; }
    // EntityLivingBase.deathTime drives RendererLivingEntity.rotateCorpse (mobPose turns it into the 0..90 degree roll).
    body.death = deathTime;
    let pose = mobPose(body, partial);
    if (sleeping) {
      const at = sleepingTransform(sleeping);
      // A sleeper does not walk; its entity position (not the corpse offset) is where light and fire sample.
      // The head keeps the yaw and pitch frozen at bed entry: EntityPlayer.isMovementBlocked skips the old-AI
      // rotationYawHead copy, GuiSleepMP releases the mouse and renderYawOffset stays inside its 75 degree clamp, so
      // ModelBiped still turns the head by rotationYawHead - renderYawOffset and rotationPitch (PlayerBody does not tick
      // its yaw while the player lies, and mobPose reads those frozen fields).
      pose = { ...pose, x: sleeping.pos.x, y: at.y, z: sleeping.pos.z, limbSwing: 0, limbSwingAmount: 0 };
      this.root.position.set(at.x, at.y, at.z);
      this.root.quaternion.copy(at.quaternion);
    } else {
      this.root.position.set(pose.x, pose.y, pose.z);
      this.root.rotation.set(...playerRootRotation(pose.bodyYaw, pose.death));
    }
    this.fire.update(pose, burning, fireViewYaw);
    this.syncArmor([3, 2, 1, 0].map((slot) => armor[slot]));
    for (const m of this.armorGlints) m.uniforms.time.value = pose.age;
    this.syncHeld(held, heldDamage, heldColor, heldGlint, blocking);
    this.syncArrows(arrowCount, arrowEntityId);
    const parts = bipedPose({
      limbSwing: pose.limbSwing, limbSwingAmount: pose.limbSwingAmount, age: pose.age,
      headYaw: pose.headYaw, headPitch: pose.headPitch, swing, sneak: sneak && !sleeping, riding: riding && !sleeping, heldRight: held ? (blocking ? 3 : 1) : 0, // RenderPlayer.func_82439_a: heldItemRight 3 for a blocking sword
    });
    for (const name of PART_NAMES) {
      const { point, rot } = parts[name], pivot = this.pivots[name];
      // RendererLivingEntity.renderModel draws no body for an invisible entity (Entity.isInvisibleToPlayer, no teams); armour and the held item still draw.
      pivot.children[0].visible = !invisible;
      pivot.position.set(point[0] / 16, point[1] / 16, point[2] / 16);
      pivot.rotation.set(rot[0], rot[1], rot[2]);
    }
    // Entity.getBrightnessForRender samples feet + 0.66 * height. Hurt tints
    // red like RendererLivingEntity (brightness, 0, 0, 0.4).
    // A sleeper's box is 0.2 tall (EntityPlayer.sleepInBedAt setSize(0.2, 0.2)).
    const packed = this.view.brightness(pose.x, pose.y + (sleeping ? SLEEP_SIZE : PHYSICS.height) * 0.66, pose.z),
      level = Math.max(((packed >> 20) & 15) - (this.view.subtracted ?? 0), (packed >> 4) & 15),
      b = BRIGHTNESS[Math.max(0, level)];
    this.arrowMaterial?.setLight(packed);
    for (const m of this.materials) {
      m.setLight(packed);
      // RendererLivingEntity tints while hurtTime > 0 || deathTime > 0.
      const tint = hurt || deathTime > 0;
      m.uniforms.overlay.value.set(tint ? b : 0, 0, 0, tint ? 0.4 : 0);
    }
  }
}

// RendererLivingEntity.rotateCorpse (boh.a(sv,F,F,F)): glRotatef(180 - renderYawOffset, 0,1,0), then for deathTime > 0
// glRotatef(min(1, sqrt((deathTime + partial - 1) / 20 * 1.6)) * getDeathMaxRotation (90), 0,0,1). `death` is that
// angle in degrees (mobPose); returns the three.js Euler [x, y, z] in radians (order XYZ = Ry * Rz here).
export function playerRootRotation(bodyYaw, death = 0) {
  return [0, (180 - bodyYaw) * RAD, death * RAD];
}

// Render.doRenderShadowAndFire runs for every rendered entity at its interpolated position, so a sleeper (rendered in
// first person too) casts the shadow at the BedSleep entity position with its 0.2 box: Entity.getShadowSize is height / 2.
export function sleeperShadowCaster(pos, size) {
  return { ...size, x: pos.x, y: pos.y, z: pos.z, pos: { x: pos.x, y: pos.y, z: pos.z }, height: SLEEP_SIZE };
}

// EntityPlayer.sleepInBedAt: setSize(0.2, 0.2) and yOffset 0.2, so RenderPlayer draws at posY - 0.2.
export const SLEEP_SIZE = 0.2;
// EntityPlayer.getBedOrientationInDegrees (bK) for bed direction 0..3.
export const SLEEP_YAW = Object.freeze([90, 0, 270, 180]);
const Y_AXIS = new THREE.Vector3(0, 1, 0), Z_AXIS = new THREE.Vector3(0, 0, 1);
// RenderPlayer.renderLivingAt adds the sleeping offset (field_71079_bU, 0, field_71089_bV) to the
// render position, and rotateCorpse for a living sleeper turns glRotatef(bK, 0,1,0),
// glRotatef(getDeathMaxRotation = 90, 0,0,1), glRotatef(270, 0,1,0) in place of the body yaw.
// `pos` is the BedSleep entity position (posY = bed + 0.9375), `offset` BedSleep.offset.
export function sleepingTransform({ pos, offset = [0, 0, 0], facing = 0 }) {
  const quaternion = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, SLEEP_YAW[facing & 3] * RAD)
    .multiply(new THREE.Quaternion().setFromAxisAngle(Z_AXIS, 90 * RAD))
    .multiply(new THREE.Quaternion().setFromAxisAngle(Y_AXIS, 270 * RAD));
  return { x: pos.x + offset[0], y: pos.y - SLEEP_SIZE + offset[1], z: pos.z + offset[2], quaternion };
}

// RendererLivingEntity's armour effect: two SRC_COLOR/ONE passes, tint (0.38, 0.19, 0.608),
// texture matrix scale 1/3, rotations 30/−30, age scrolling at 0.02 / 0.08 per tick before the texture scale.
export function armorGlintMesh(geometry, map) {
  const mesh = glintMesh(geometry, map), m = mesh.material;
  m.fragmentShader = `uniform sampler2D item,glint;uniform float time;varying vec2 vUv;
vec2 turn(vec2 p,float degrees){float a=radians(degrees),c=cos(a),s=sin(a);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);}
void main(){if(texture2D(item,vUv).a<=0.1)discard;
vec3 a=texture2D(glint,turn((vUv+vec2(0.,time*.02))/3.,30.)).rgb;
vec3 b=texture2D(glint,turn((vUv+vec2(0.,time*.08))/3.,-30.)).rgb;
gl_FragColor=vec4(sqrt(a*a+b*b)*vec3(.38,.19,.608),1.);}`;
  mesh.onBeforeRender=()=>{};
  // UV placement/depth precision still use the browser renderer, so the effect is not pixel-exact.
  return mesh;
}
