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
import { spriteGeometry } from "./sprite-geometry.js";
import { headItemMatrix } from "./wearable-heads.js";
import { blockTile, tileRect } from "./block-textures.js";
import { toLiveStack, GEAR_TYPES } from "./mob-equipment-live.js";

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

function dispose(r) {
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
  const key = e.equipment.map((s) => (s ? `${s.id}:${s.damage | 0}` : "0")).join(",") + (heldLive ? ":" + itemFrameTag(itemTexture(heldLive.id, heldLive.damage)) : "");
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
    const g = new THREE.BoxGeometry(1, 1, 1), uv = g.attributes.uv;
    for (let face = 0; face < 6; face++) {
      const t = tileRect(blockTile(helmet.id, face));
      uv.setXY(face * 4, t.u0, t.v1); uv.setXY(face * 4 + 1, t.u1, t.v1); uv.setXY(face * 4 + 2, t.u0, t.v0); uv.setXY(face * 4 + 3, t.u1, t.v0);
    }
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
  // The held item in the right hand.
  const held = live[0], url = held && itemTexture(held.id, held.damage);
  if (url) {
    const mesh = new THREE.Mesh(spriteGeometry(), material({ map: pixelTexture(url) })), group = new THREE.Group(), flip = new THREE.Group();
    group.matrixAutoUpdate = false;
    group.matrix.copy(heldItemMatrix(heldKind(held.id, held.damage)));
    flip.scale.set(1, -1, -1);
    group.add(mesh);
    flip.add(group);
    r.limbs[0].add(flip);
    r.gearNodes.push(flip);
  }
}
