// A held 2D item as ItemRenderer.renderItem draws it for a mob: pass 0 of getIconFromDamageForRenderPass in getColorFromItemStack's colour, then pass 1 over it when
// requiresMultipleRenderPasses (item-passes.js: spawn eggs, potions). `material(options)` makes one entity material and returns it; the overlay gets a polygon offset so it
// wins the depth test over pass 0 on the same quad. Returns null when the item has no sprite (a block item).
import * as THREE from "three";
import { itemTexture, pixelTexture } from "./first-person.js";
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
