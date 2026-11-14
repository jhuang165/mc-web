// A held 2D item as ItemRenderer.renderItem draws it for a mob: pass 0 of getIconFromDamageForRenderPass in getColorFromItemStack's colour, then pass 1 over it when
// requiresMultipleRenderPasses (item-passes.js: spawn eggs, potions). `material(options)` makes one entity material and returns it; the overlay gets a polygon offset so it
// wins the depth test over pass 0 on the same quad. Returns null when the item has no sprite (a block item).
import * as THREE from "three";
import { itemTexture, pixelTexture, blockItemGeometry, blockItemTurn, blockCubeGeometry } from "./first-person.js";
import { chestItemTexture, chestItemModel } from "./chest-renderer.js";
import { spriteGeometry } from "./sprite-geometry.js";
import { itemPasses } from "./item-passes.js";

export function heldSprite(id, damage, material) {
  const passes = itemPasses(id, damage), url = passes?.base ?? itemTexture(id, damage);
  if (!url) return null;
  const geometry = spriteGeometry(), mesh = new THREE.Mesh(geometry, material({ map: pixelTexture(url), ...(passes ? { color: passes.tint } : {}) }));
  if (passes) {
    const m = material({ map: pixelTexture(passes.overlay), ...(passes.overlayTint ? { color: passes.overlayTint } : {}), alphaTest: 0.1 });
    m.transparent = true;
    m.depthWrite = false;
    m.polygonOffset = true;
    m.polygonOffsetFactor = -1;
    const overlay = new THREE.Mesh(geometry, m);
    overlay.renderOrder = 1;
    mesh.add(overlay);
  }
  return mesh;
}

// A held block item as ItemRenderer.renderItem draws it (the 3D branch, renderBlockAsItem at brightness 1) for a mob's hand: the chest model, the box list of stairs, fences, slabs
// and the like, or the unit cube, turned about y as renderBlockAsItem turns it. The matrix that places it is heldItemMatrix("block") (executed, held-pose-reference.json). `atlas`
// is the block texture atlas; null when the item has a sprite (heldSprite) or no atlas is loaded.
export function heldBlock(id, damage, material, atlas) {
  if (itemTexture(id, damage)) return null;
  const chest = chestItemTexture(id);
  if (chest) {
    const mesh = chestItemModel(material({ map: pixelTexture(chest) }));
    mesh.rotation.y = Math.PI / 2;
    return mesh;
  }
  if (!atlas) return null;
  const mesh = new THREE.Mesh(blockItemGeometry(id, damage) ?? blockCubeGeometry(id, damage), material({ map: atlas }));
  mesh.rotation.y = blockItemTurn(id, damage);
  return mesh;
}
