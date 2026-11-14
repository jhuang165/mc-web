// What a zombie, pigman or skeleton wears and holds (mob-equipment.md): RenderBiped.shouldRenderPass (the player's armour
// textures on the ModelBiped armour boxes), renderEquippedItems (the held item in the right hand, a pumpkin on the head).
// The mob rigs of mob-renderer.js draw the bare body with parts at the model's own pivots in three.js axes
// (x, 24 - y, -z) / 16; the armour boxes of player-renderer.js are in model space (y down, z back), so each is
// mirrored with scale (1, -1, -1) onto the same pivot. Enchantment glint is not drawn on mobs (a gap).
import * as THREE from "three";
import { modelBox, BIPED, armorLayer, heldKind, heldItemMatrix } from "./player-renderer.js";
import { pixelTexture, itemTexture } from "./first-person.js";
import { itemFrameTag } from "./item-animation.js";
import { entityMaterial } from "./light-material.js";
import { headItemMatrix } from "./wearable-heads.js";
import { blockTile, tileRect } from "./block-textures.js";
import { trackCubeUv, trackUv } from "./uv-rebake.js";
import { toLiveStack, GEAR_TYPES } from "./mob-equipment-live.js";
import { heldSprite, heldBlock } from "./held-sprite.js";

const LIMB = { rightArm: 0, leftArm: 1, rightLeg: 2, leftLeg: 3 };

// The rig's pivot of one ModelBiped part; the body has none of its own, so it gets one at the model origin.
function pivotOf(r, name) {
  if (name === "head" || name === "hat") return r.neck;
  if (name === "body") {
    if (!r.bodyPivot) {
      r.bodyPivot = new THREE.Group();
      r.bodyPivot.position.set(0, 24 / 16, 0);
      r.neck.parent.add(r.bodyPivot);
    }
    return r.bodyPivot;
  }
  return r.limbs[LIMB[name]];
}

// RenderBiped.renderEquippedItems for a child (ModelBiped.isChild): before the arm's postRender the item's frame moves down 0.625, tilts 20 degrees about x
// (glRotatef(-20, -1, 0, 0)) and halves (bytecode-read bnw.a). The native entity frame is not scaled, while the port's rig root carries the child's 0.5 about
// the feet, so the matrix also undoes that 0.5 (scale 2). It is in rig axes: feet origin, y up, z forward; model space starts 24 pixels up and flips y and z.
const CHILD_HELD = (() => {
  const flip = new THREE.Matrix4().makeScale(1, -1, -1), up = new THREE.Matrix4().makeTranslation(0, 1.5, 0), down = new THREE.Matrix4().makeTranslation(0, -1.5, 0);
  const model = new THREE.Matrix4().makeTranslation(0, 0.625, 0).multiply(new THREE.Matrix4().makeRotationX((20 * Math.PI) / 180)).multiply(new THREE.Matrix4().makeScale(0.5, 0.5, 0.5));
  return new THREE.Matrix4().makeScale(2, 2, 2).multiply(up).multiply(flip).multiply(model).multiply(flip).multiply(down);
})();

// Called every frame after the limbs are posed: a child's held item follows its arm through CHILD_HELD.
export function followChildHeld(r) {
  const c = r.heldChild;
  if (!c) return;
  c.limb.updateMatrix();
  c.follow.matrix.copy(childHeldMatrix(c.limb.matrix, c.limb.parent?.position.y ?? 0));
}

// The child frame in front of the arm: the native prefix (0.625 down, tilt, half size) comes BEFORE the arm's postRender (executed, held-pose-reference.json).
// `lift` is the frame's own height (RendererLivingEntity's 1/128): the rig root's 0.5 halves it, and the native frame is not scaled, so it is added once more.
export function childHeldMatrix(limbMatrix, lift = 0) {
  return new THREE.Matrix4().makeTranslation(0, lift, 0).multiply(CHILD_HELD).multiply(limbMatrix);
}

function dispose(r) {
  r.heldChild = null;
  for (const n of r.gearNodes ?? []) {
    n.parent?.remove(n);
    n.traverse((o) => o.isMesh && o.geometry.dispose());
  }
  for (const m of r.gearMaterials ?? []) {
    r.materials = r.materials.filter((x) => x !== m);
    m.dispose();
  }
  r.gearNodes = [];
  r.gearMaterials = [];
}

// Brings the rig's armour, held item and head block in line with `e.equipment`. Cheap when nothing changed.
export function syncMobEquipment(renderer, r, e) {
  if (!e.equipment || !GEAR_TYPES.has(e.type) || !r.neck || r.villager) return;
  // The held item (slot 0) also carries its animated icon frame (item-animation.js), so a frame change rebuilds the sprite only then.
  const heldStack = e.equipment[0], heldLive = heldStack ? toLiveStack(heldStack) : null;
  const baby = e.growingAge < 0, key = (baby ? "b" : "") + e.equipment.map((s) => (s ? `${s.id}:${s.damage | 0}` : "0")).join(",") + (heldLive ? ":" + itemFrameTag(itemTexture(heldLive.id, heldLive.damage)) : "");
  if (r.gearKey === key) return;
  r.gearKey = key;
  dispose(r);
  const lighting = renderer.view.lighting, live = e.equipment.map((s) => (s ? toLiveStack(s) : null));
  const material = (options) => {
    const m = entityMaterial(lighting, { ...options, side: THREE.DoubleSide });
    r.materials.push(m);
    r.gearMaterials.push(m);
    return m;
  };
  // The built-in pigman sword and skeleton bow give way to what the mob actually holds.
  for (const m of r.keep ?? []) m.visible = false;
  // Boots (slot 1) .. helmet (slot 4) are armour passes 3 .. 0.
  for (let pass = 0; pass < 4; pass++) {
    const stack = live[4 - pass], layer = stack && armorLayer(stack.id, pass);
    if (!layer) continue;
    const make = (url, tint, order) => {
      const m = material({ map: pixelTexture(url), color: tint });
      for (const name of layer.parts) {
        const b = BIPED[name], mesh = new THREE.Mesh(modelBox(...b.uv, ...b.box, layer.expand + b.extra, !!b.mirror), m), pivot = pivotOf(r, name);
        mesh.scale.set(1, -1, -1);
        // The armour model's pivots are the biped's: the skeleton's legs sit 0.1 pixel wider.
        mesh.position.x = (b.point[0] - pivot.position.x * 16) / 16;
        mesh.renderOrder = order;
        pivot.add(mesh);
        r.gearNodes.push(mesh);
      }
    };
    make(layer.url, layer.tint, 0);
    if (layer.overlay) make(layer.overlay, null, 1);
  }
  // A pumpkin or jack-o'-lantern on the head (RenderBiped.renderEquippedItems, block branch).
  const helmet = live[4], atlas = renderer.view.textures?.texture;
  if (helmet && atlas && !armorLayer(helmet.id, 0) && !itemTexture(helmet.id, 0)) {
    const g = trackCubeUv(new THREE.BoxGeometry(1, 1, 1), (face) => blockTile(helmet.id, face));
    const mesh = new THREE.Mesh(g, material({ map: atlas })), group = new THREE.Group(), flip = new THREE.Group();
    mesh.rotation.y = Math.PI / 2;
    group.matrixAutoUpdate = false;
    group.matrix.copy(headItemMatrix(helmet.id));
    flip.scale.set(1, -1, -1);
    group.add(mesh);
    flip.add(group);
    r.neck.add(flip);
    r.gearNodes.push(flip);
  }
  // The held item in the right hand (RenderBiped.renderEquippedItems: both passes of a spawn egg or a potion).
  const held = live[0], sprite = held && (heldSprite(held.id, held.damage, material) ?? heldBlock(held.id, held.damage, material, atlas)); // a block item is the cube or box list (RenderBiped.renderEquippedItems 3D branch)
  if (sprite) {
    const group = new THREE.Group(), flip = new THREE.Group();
    group.matrixAutoUpdate = false;
    group.matrix.copy(heldItemMatrix(heldKind(held.id, held.damage)));
    flip.scale.set(1, -1, -1);
    group.add(sprite);
    flip.add(group);
    if (baby) {
      const follow = new THREE.Group();
      follow.matrixAutoUpdate = false;
      follow.add(flip);
      r.limbs[0].parent.add(follow);
      r.heldChild = { follow, limb: r.limbs[0] };
      r.gearNodes.push(follow);
      followChildHeld(r);
    } else {
      r.limbs[0].add(flip);
      r.gearNodes.push(flip);
    }
  }
}
