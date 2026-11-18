// b81 throwfire81: Render.doRenderShadowAndFire (bno.b, bytecode-read) ends every RenderManager draw with renderEntityOnFire when the entity's canRenderOnFire (sa.aA) holds.
// sa.aA is isBurning (sa.al: not immune to fire, and the fire counter above 0 or, on a client world, the watched flag 0); EntityFallingBlock (xj.aA) is the only override in the
// 1.7.10 jar and returns false. So a burning dropped item, experience orb, arrow or boat draws the flames like a mob does. This keeps one EntityFireRenderer per burning entity
// of a renderer's list, sized by the entity's box: width, height and posY - boundingBox.minY (the yOffset renderEntityOnFire starts the flames below posY).
import { EntityFireRenderer } from "./entity-fire-renderer.js";

// [width, height, posY - minY]: EntityItem 0.25 box (yOffset height / 2), EntityXPOrb 0.5 (height / 2), EntityArrow 0.5 (yOffset 0), EntityBoat 1.5 x 0.6 (height / 2).
export const FIRE_BOXES = { item: [0.25, 0.25, 0.125], orb: [0.5, 0.5, 0.25], arrow: [0.5, 0.5, 0], boat: [1.5, 0.6, 0.3] };

// Entity.isBurning as the renderer sees it: a client copy's watched flag 0 (object-tracker.js views set `burning`), else the live entity's counter.
export const entityBurning = (e) => !!(e && (e.burning ?? e.fire > 0));

// renderEntityOnFire turns the flames by -playerViewY; EntityFireRenderer takes playerViewY (180 for a camera looking along +z), here from the camera's own direction.
export function cameraViewYaw(camera) {
  const e = camera?.matrixWorld?.elements;
  if (!e) return 180;
  return 180 - (Math.atan2(e[8], e[10]) * 180) / Math.PI; // the camera looks along -z of its world matrix: direction (-e[8], -e[10])
}

export class FireOverlays {
  constructor(scene, [width, height, yOffset]) {
    Object.assign(this, { scene, width, height, yOffset, fires: new Map(), seen: new Set() });
  }
  // One entity of this frame: `x, y, z` is its interpolated box bottom (the render position minus the yOffset).
  draw(key, burning, x, y, z, viewYaw) {
    this.seen.add(key);
    let fire = this.fires.get(key);
    if (!burning) { fire?.update({ x, y, z }, false); return; }
    if (!fire) this.fires.set(key, (fire = new EntityFireRenderer(this.scene, this.width, this.height, this.yOffset)));
    fire.update({ x, y, z }, true, typeof viewYaw === "function" ? viewYaw() : viewYaw);
  }
  // After the frame's draws: the flames of entities no longer in the list go.
  sweep() {
    for (const [key, fire] of this.fires) if (!this.seen.has(key)) { fire.dispose(); this.fires.delete(key); }
    this.seen.clear();
  }
  clear() { this.seen.clear(); this.sweep(); }
}
