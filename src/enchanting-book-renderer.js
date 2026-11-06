// Three.js drawing of ModelBook for the enchanting table (RenderEnchantmentTable, bmn) and for the GuiEnchantment
// panel. The poses come from enchanting-book.js; the geometry is its modelBoxQuads (the original ModelBox ports, checked
// against the probe). The texture is original: `enchanting_table_book.png` is a Mojang asset, so this build paints its own
// 64 x 32 layout (bookTexturePixels) onto the same UV regions.
import * as THREE from "three";
import { entityMaterial } from "./light-material.js";
import {
  BOOK_PARTS, BOOK_PART_ORDER, BOOK_TEXTURE, BOOK_RENDER_DISTANCE_SQUARED, bookAngles, modelBoxQuads, tilePose, guiBookPose, GUI_BOOK_VIEW,
} from "./enchanting-book.js";

const D = 180 / Math.PI, SCALE = 0.0625;

// --- the original texture ---------------------------------------------------------------------------------------

// (u, v, w, h, kind) regions of the UV layout of the seven boxes (see modelBoxQuads): leather covers and spine, parchment
// page blocks with their edges, and the two flipping pages.
const REGIONS = [
  [0, 0, 6, 10, "leather"], [6, 0, 6, 10, "leatherInner"], [16, 0, 6, 10, "leather"], [22, 0, 6, 10, "leatherInner"],
  [12, 0, 2, 10, "spine"], [14, 0, 2, 10, "spine"],
  [1, 11, 5, 8, "page"], [7, 11, 5, 8, "page"], [0, 11, 1, 8, "edge"], [6, 11, 1, 8, "edge"], [1, 10, 5, 1, "edge"], [6, 10, 5, 1, "edge"],
  [13, 11, 5, 8, "page"], [19, 11, 5, 8, "page"], [12, 11, 1, 8, "edge"], [18, 11, 1, 8, "edge"], [13, 10, 5, 1, "edge"], [18, 10, 5, 1, "edge"],
  [24, 10, 5, 8, "page"], [29, 10, 5, 8, "page"],
];
const PALETTE = { leather: [64, 40, 96], leatherInner: [92, 62, 84], spine: [50, 30, 78], page: [232, 220, 184], edge: [214, 198, 158] };
const GOLD = [206, 164, 62], INK = [150, 128, 100];

/** RGBA bytes of the 64 x 32 book texture, rows top to bottom (a texel is transparent outside the painted regions). */
export function bookTexturePixels() {
  const { width, height } = BOOK_TEXTURE, data = new Uint8ClampedArray(width * height * 4);
  const put = (x, y, [r, g, b], shade = 0) => { const i = (y * width + x) * 4; data.set([r + shade, g + shade, b + shade, 255], i); };
  for (const [u, v, w, h, kind] of REGIONS) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const border = x === 0 || y === 0 || x === w - 1 || y === h - 1, noise = ((x * 7 + y * 13 + u * 3 + v) % 5) - 2;
      let colour = PALETTE[kind], shade = noise * 2;
      if ((kind === "leather" || kind === "leatherInner") && w > 2 && border) { colour = kind === "leather" ? GOLD : PALETTE.leather; shade = 0; }
      else if (kind === "leather" && x === 2 + (w > 5 ? 1 : 0) && y > 2 && y < h - 3) { colour = GOLD; shade = -20; } // a rune stroke
      else if (kind === "page" && h > 1 && y % 2 === 1 && x > 0 && x < w - 1 && y > 0 && y < h - 1) { colour = INK; shade = noise; }
      else if (kind === "spine" && y % 3 === 1) { colour = GOLD; shade = -30; }
      put(u + x, v + y, colour, shade);
    }
  }
  return data;
}

export function bookTexture() {
  const { width, height } = BOOK_TEXTURE, top = bookTexturePixels(), flipped = new Uint8Array(top.length);
  // DataTexture row 0 is v = 0 (the bottom); the UVs below use v' = 1 - v, so write the rows upside down.
  for (let y = 0; y < height; y++) flipped.set(top.subarray(y * width * 4, (y + 1) * width * 4), (height - 1 - y) * width * 4);
  const texture = new THREE.DataTexture(flipped, width, height, THREE.RGBAFormat);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

// --- the model --------------------------------------------------------------------------------------------------

// TexturedQuad.draw: normal = (v1 - v2) x (v1 - v0). Degenerate quads (the zero-depth boxes' sides) are skipped.
function boxGeometry(part) {
  const quads = modelBoxQuads(part.uv, part.box), position = [], normal = [], uv = [];
  for (const q of quads) {
    const a = new THREE.Vector3(...q[0].slice(0, 3)), b = new THREE.Vector3(...q[1].slice(0, 3)), c = new THREE.Vector3(...q[2].slice(0, 3));
    const n = new THREE.Vector3().subVectors(b, c).cross(new THREE.Vector3().subVectors(b, a));
    if (n.lengthSq() === 0) continue;
    n.normalize();
    for (const i of [0, 1, 2, 0, 2, 3]) {
      position.push(q[i][0] * SCALE, q[i][1] * SCALE, q[i][2] * SCALE);
      normal.push(n.x, n.y, n.z);
      uv.push(q[i][3], 1 - q[i][4]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/** The seven parts under one group; `pose(tick, flipRight, flipLeft, spread)` applies ModelBook.setRotationAngles. */
export function buildBook(material) {
  const root = new THREE.Group(), parts = {};
  for (const name of BOOK_PART_ORDER) {
    const def = BOOK_PARTS[name], group = new THREE.Group(), mesh = new THREE.Mesh(boxGeometry(def), material);
    mesh.frustumCulled = false;
    group.rotation.order = "ZYX"; // ModelRenderer.render: rotateZ, then Y, then X
    group.add(mesh);
    root.add(group);
    parts[name] = group;
  }
  const pose = (tick, flipRight, flipLeft, spread) => {
    const angles = bookAngles(tick, flipRight, flipLeft, spread);
    for (const name of BOOK_PART_ORDER) {
      const [px, py, pz, ax, ay, az] = angles[name];
      parts[name].position.set(px * SCALE, py * SCALE, pz * SCALE);
      parts[name].rotation.set(ax, ay, az, "ZYX");
    }
  };
  pose(0, 0, 0, 0);
  return { root, parts, pose, geometries: () => root.children.map((g) => g.children[0].geometry) };
}

// --- the table ---------------------------------------------------------------------------------------------------

export class EnchantingBookRenderer {
  // `view` supplies the lightmap and the cell brightness (VoxelScene).
  constructor(scene, view) { Object.assign(this, { scene, view, records: new Map(), texture: null, material: null }); }
  create() {
    this.texture ??= bookTexture();
    this.material ??= entityMaterial(this.view.lighting, { map: this.texture }); // culling stays on, as the renderer enables GL_CULL_FACE
    const model = buildBook(this.material), root = new THREE.Group();
    const tilt = new THREE.Group(), yaw = new THREE.Group(); // glRotatef(-yaw, y) then glRotatef(80, z)
    tilt.rotation.z = 80 / D;
    yaw.add(tilt); tilt.add(model.root); root.add(yaw);
    this.scene.add(root);
    return { root, yaw, model };
  }
  /** tiles: BookTile list; `camera` {x, y, z}; partial in 0..1. */
  update(tiles, world, camera, partial) {
    const seen = new Set();
    for (const t of tiles) {
      const dx = t.x + 0.5 - camera.x, dy = t.y + 0.5 - camera.y, dz = t.z + 0.5 - camera.z;
      if (dx * dx + dy * dy + dz * dz >= BOOK_RENDER_DISTANCE_SQUARED) continue;
      seen.add(t);
      let r = this.records.get(t);
      if (!r) { r = this.create(); this.records.set(t, r); }
      const pose = tilePose(t, partial);
      r.root.position.set(t.x + pose.translate[0], t.y + pose.translate[1], t.z + pose.translate[2]);
      r.yaw.rotation.y = pose.yawDegrees / D; // glRotatef(yawDegrees, 0, 1, 0): both APIs turn counter-clockwise about +y
      r.model.pose(pose.tick, pose.flipRight, pose.flipLeft, pose.spread);
      this.material.setLight(this.view.brightness(t.x, t.y, t.z));
    }
    for (const [t, r] of this.records) if (!seen.has(t)) { this.scene.remove(r.root); this.records.delete(t); }
  }
  clear() { for (const r of this.records.values()) this.scene.remove(r.root); this.records.clear(); }
  dispose() { this.clear(); this.material?.dispose(); this.texture?.dispose(); this.material = this.texture = null; }
}

// --- the GUI panel -----------------------------------------------------------------------------------------------

/** The GuiEnchantment book on its own transparent WebGL canvas, laid over the 320 x 240 region centred on the screen. */
export class EnchantingGuiBookView {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(canvas.width, canvas.height, false);
    this.renderer.setClearColor(0, 0);
    const v = GUI_BOOK_VIEW;
    this.camera = new THREE.PerspectiveCamera(v.fov, v.aspect, v.near, v.far);
    // glTranslatef(shift) before gluPerspective: the shift lands in clip space.
    this.camera.projectionMatrix.makeTranslation(v.shift[0], v.shift[1], 0).multiply(new THREE.Matrix4().copy(this.camera.projectionMatrix));
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    this.scene = new THREE.Scene();
    this.texture = bookTexture();
    // The item lights are set while the modelview is the identity, so they live in eye space, the space of this scene.
    // The GUI has no lightmap: a white one keeps the texel colour and the two item lights.
    this.lightmap = new THREE.DataTexture(new Uint8Array(1024).fill(255), 16, 16, THREE.RGBAFormat);
    this.lightmap.needsUpdate = true;
    this.material = entityMaterial({ uniforms: { lightmap: { value: this.lightmap } } }, { map: this.texture, fog: false, side: THREE.DoubleSide });
    this.model = buildBook(this.material);
    this.frame = new THREE.Group();
    this.frame.add(this.model.root);
    this.scene.add(this.frame);
  }
  /** Draw `book` (a GuiBook) at `partial`. */
  render(book, partial) {
    const pose = guiBookPose(book, partial), v = GUI_BOOK_VIEW;
    // modelview = T(0, 3.3, -16) S(5) Rz(180) Rx(20) T(shift) Ry(yaw) Rx(180), applied to the model first-to-last right to left.
    const m = new THREE.Matrix4();
    m.makeTranslation(v.translate[0], v.translate[1], v.translate[2]);
    m.multiply(new THREE.Matrix4().makeScale(v.scale, v.scale, v.scale));
    m.multiply(new THREE.Matrix4().makeRotationZ(Math.PI));
    m.multiply(new THREE.Matrix4().makeRotationX(20 / D));
    m.multiply(new THREE.Matrix4().makeTranslation(...pose.shift));
    m.multiply(new THREE.Matrix4().makeRotationY(pose.yawDegrees / D));
    m.multiply(new THREE.Matrix4().makeRotationX(Math.PI));
    this.frame.matrixAutoUpdate = false;
    this.frame.matrix.copy(m);
    this.frame.matrixWorldNeedsUpdate = true;
    this.model.pose(pose.tick, pose.flipRight, pose.flipLeft, pose.spread);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.model.geometries().forEach((g) => g.dispose());
    this.material.dispose(); this.texture.dispose(); this.lightmap.dispose();
    this.renderer.dispose(); this.renderer.forceContextLoss();
  }
}
