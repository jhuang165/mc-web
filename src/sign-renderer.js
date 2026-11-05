// TileEntitySignRenderer (bmr) and ModelSign (bhz) from the unchanged 1.7.10 client jar (constants read with javap
// into public/research/sign-reference.json "bytecode.render", mirrored in sign-layout.js).
//
// A standing sign translates to (x + 0.5, y + 0.75 * s, z + 0.5), s = 2 / 3, and rotates -(meta * 360 / 16) degrees; a wall
// sign rotates 180 / 0 / 90 / -90 degrees for metadata 2 / 3 / 4 / 5, moves (0, -0.3125, -0.4375) and hides the stick. The
// board (a 24 x 12 x 2 box at UV 0, 0) and stick (2 x 14 x 2 at UV 0, 14) are drawn at scale (s, -s, -s) / 16. The text is
// drawn at 0.016666668 * s per font pixel, translate (0, 0.5 * s, 0.07 * s), line k at y = k * 10 - 20, centred, colour 0,
// no shadow, depth mask off. Tile entities further than 64 blocks (getMaxRenderDistanceSquared 4096) are not drawn.
import * as THREE from "three";
import { entityMaterial } from "./light-material.js";
import { pixelTexture, skinBox } from "./first-person.js";
import { SIGN_RENDER } from "./sign-layout.js";
import { SIGN_POST, WALL_SIGN } from "./world.js";

const SIGN_TEXTURE = "/media/1.7.10/entity/sign.png";
const D = Math.PI / 180, S = SIGN_RENDER.scale, TEXT_W = 90, TEXT_H = 45, PX = 4; // the text plane is 90 x 45 font pixels

// The standing sign's heading and the wall sign's heading in degrees (the GL rotation before the sign is drawn).
export const signAngle = (block, meta) => (block === SIGN_POST ? (meta * 360) / 16 : SIGN_RENDER.wallAngle[meta] ?? 0);

// Text on a canvas: each line k centred at x = w / 2 with its top at h / 2 + (k * 10 - 20) font pixels.
export function drawSignText(canvas, lines) {
  const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#000";
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  ctx.font = `${8 * PX}px Minecraft, monospace`;
  for (let k = 0; k < 4; k++) if (lines[k]) ctx.fillText(lines[k], w / 2, h / 2 + (k * SIGN_RENDER.lineSpacing - 20) * PX);
}

export class SignRenderer {
  constructor(scene, view) {
    Object.assign(this, { scene, view, records: new Map() });
    this.texture = pixelTexture(SIGN_TEXTURE);
    this.boardGeometry = skinBox(24, 12, 2, 0, 0, 64, 32);
    this.stickGeometry = skinBox(2, 14, 2, 0, 14, 64, 32);
    this.textGeometry = new THREE.PlaneGeometry(TEXT_W * SIGN_RENDER.textScale, TEXT_H * SIGN_RENDER.textScale);
  }
  create() {
    const root = new THREE.Group(), frame = new THREE.Group(), model = new THREE.Group(), materials = [];
    const body = entityMaterial(this.view.lighting, { map: this.texture }), textMaterial = entityMaterial(this.view.lighting, { transparent: true, alphaTest: 0.01 });
    textMaterial.depthWrite = false;
    materials.push(body, textMaterial);
    model.scale.setScalar(S);
    const board = new THREE.Mesh(this.boardGeometry, body), stick = new THREE.Mesh(this.stickGeometry, body);
    board.position.set(0, 8 / 16, 0); // y is flipped by scale(s, -s, -s): the box spans model y -14 to -2
    stick.position.set(0, -5 / 16, 0); // model y -2 to 12
    model.add(board, stick);
    const canvas = document.createElement("canvas");
    canvas.width = TEXT_W * PX;
    canvas.height = TEXT_H * PX;
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = texture.minFilter = THREE.NearestFilter;
    textMaterial.uniforms.map.value = texture;
    const text = new THREE.Mesh(this.textGeometry, textMaterial);
    text.position.set(SIGN_RENDER.textTranslate[0], SIGN_RENDER.textTranslate[1] * S, SIGN_RENDER.textTranslate[2] * S);
    frame.add(model, text);
    root.add(frame);
    this.scene.add(root);
    return { root, frame, stick, text, canvas, texture, materials, key: null, block: 0 };
  }
  // `tiles` is the Signs store's tile list; the camera position is in world coordinates.
  update(tiles, world, camera) {
    const seen = new Set();
    for (const t of tiles) {
      const block = world.get(t.x, t.y, t.z);
      if (block !== SIGN_POST && block !== WALL_SIGN) continue;
      const dx = t.x + 0.5 - camera.x, dy = t.y + 0.5 - camera.y, dz = t.z + 0.5 - camera.z;
      if (dx * dx + dy * dy + dz * dz > SIGN_RENDER.maxDistanceSquared) continue;
      seen.add(t);
      let r = this.records.get(t);
      if (!r) { r = this.create(); this.records.set(t, r); }
      const meta = world.getMeta(t.x, t.y, t.z);
      r.root.position.set(t.x + 0.5, t.y + 0.75 * S, t.z + 0.5);
      r.root.rotation.y = -signAngle(block, meta) * D;
      const wall = block === WALL_SIGN;
      r.frame.position.set(...(wall ? SIGN_RENDER.wallTranslate : [0, 0, 0]));
      r.stick.visible = !wall;
      const key = t.text.join("\n"), empty = t.text.every((l) => !l);
      if (r.key !== key) { r.key = key; drawSignText(r.canvas, t.text); r.texture.needsUpdate = true; }
      r.text.visible = !empty;
      const packed = this.view.brightness(t.x, t.y, t.z);
      for (const m of r.materials) m.setLight(packed);
    }
    for (const [t, r] of this.records) if (!seen.has(t)) { this.dispose(r); this.records.delete(t); }
  }
  dispose(r) {
    this.scene.remove(r.root);
    r.texture.dispose();
    for (const m of r.materials) m.dispose();
  }
  clear() {
    for (const r of this.records.values()) this.dispose(r);
    this.records.clear();
  }
}
