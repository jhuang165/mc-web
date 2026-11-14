// Geometries that bake terrain-atlas uvs (tileRect) when they are built keep those uvs for as long as they live: held and dropped block items, hand and armour cubes, item frame
// planks, cart contents, the carried block of an enderman. A resource pack switch can lay the atlas out again (block-textures.js setTerrainSizes), which moves every tile.
// `trackUv(geometry, fill)` runs `fill(geometry)` now and again on every layout change, so a cached geometry follows the new layout instead of showing the old cells. The registry holds
// geometries weakly. Native: TextureMap.stitch re-creates every sprite's uv in place, so a cached model always reads the current sprite (initSprite).
import * as THREE from "three";
import { tileRect, onTerrainRelayout } from "./block-textures.js";

const fills = new WeakMap(), live = new Set();
let subscribed = false;
function rebake() {
  for (const ref of [...live]) {
    const g = ref.deref();
    if (!g) { live.delete(ref); continue; }
    try { fills.get(g)?.(g); } catch { /* a disposed or half-built geometry keeps its old uvs */ }
  }
}
export function trackUv(geometry, fill) {
  if (!subscribed) { subscribed = true; onTerrainRelayout(rebake); }
  fill(geometry);
  fills.set(geometry, fill);
  live.add(new WeakRef(geometry));
  if (live.size > 4096) for (const ref of [...live]) if (!ref.deref()) live.delete(ref);
  return geometry;
}
export const trackedCount = () => { let n = 0; for (const ref of live) if (ref.deref()) n++; return n; };

// A BoxGeometry(1,1,1)-style cube: face f (0..5, the three.js box face order) takes tile `tileOf(f)` (an atlas tile index); `inset` as tileRect (undefined: the native 0.01 px inset); `after` runs after the four uvs of every face are written.
export function trackCubeUv(geometry, tileOf, inset, after) {
  return trackUv(geometry, (g) => {
    const uv = g.attributes.uv;
    for (let face = 0; face < 6; face++) {
      const r = tileRect(tileOf(face), inset);
      uv.setXY(face * 4, r.u0, r.v1); uv.setXY(face * 4 + 1, r.u1, r.v1); uv.setXY(face * 4 + 2, r.u0, r.v0); uv.setXY(face * 4 + 3, r.u1, r.v0);
    }
    after?.(); // e.g. the cube's flipped bottom face
    uv.needsUpdate = true;
  });
}
// A geometry whose whole uv attribute comes from `uvsOf()` (a flat array), replaced as one attribute.
export function trackUvArray(geometry, uvsOf) {
  return trackUv(geometry, (g) => g.setAttribute("uv", new THREE.Float32BufferAttribute(uvsOf(), 2)));
}
