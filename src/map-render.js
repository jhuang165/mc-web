// Map rendering (polish track), ported from the unchanged 1.7.10 classes by javap (bytecode-derived):
//  - ItemRenderer.renderItemInFirstPerson (bly.a(float)), the filled-map branch: both arms, then the 128 x 128 map on the
//    map_background.png quad (-7..135);
//  - MapItemRenderer (bbx) / MapItemRenderer.Instance (bbz.a(boolean)): the colour quad at z = -0.01 and the decoration
//    icons of map_icons.png (a 4 x 4 grid of 8 px icons) at z = -0.02 - 0.001 * i; the boolean selects frame markers only;
//  - RenderItemFrame.d (bnx): a filled map in a frame is drawn at 1/128 scale with only the frame marker icons.
// The matrices use GL conventions (the item pipeline's), like heldItemMatrix.
import * as THREE from "three";
import { mapByteRgb } from "./map-colors.js";
import { pixelTexture } from "./first-person.js";
import { MAP_SIZE } from "./maps.js";

const RAD = Math.PI / 180, f32 = Math.fround;
export const MAP_BACKGROUND = "/media/1.7.10/map/map_background.png", MAP_ICONS = "/media/1.7.10/map/map_icons.png";
// Constants read from the bytecode (see public/research/polish-reference.json, case mapFirstPerson).
export const MAP_HAND = Object.freeze({
  scale: 0.8, // f7
  // translate(-sin(sqrt(s) pi) * 0.4, sin(sqrt(s) pi 2) * 0.2, -sin(s pi) * 0.2), then the pitch lift
  swingTranslate: [0.4, 0.2, 0.2], pitchLift: 0.1, pitchDivisor: 45, equipDrop: 1.2, lift: 0.04, forward: -0.9, tilt: -85,
  armOffset: [0, -0.6, 1.1], armX: -45, armZ: [-90, 59], armY: -65,
  swingRot: [-20, -20, -80], mapScale: 0.38, mapTurn: [90, 180], mapShift: [-1, -1, 0], pixel: 0.015625,
  quad: [[-7, 135, 0, 1], [135, 135, 1, 1], [135, -7, 1, 0], [-7, -7, 0, 0]], // x, y, u, v (GL v)
});
// RenderItemFrame.d: translate per ItemFrame rotation (0..3) after rotate y 180, rotate z 180, scale 1/128.
export const FRAME_MAP_SHIFT = Object.freeze([[-64, -87, -1.5], [-66.5, -84.5, -1.5], [-64, -82, -1.5], [-61.5, -84.5, -1.5]]);
export const FRAME_MAP_SCALE = 0.0078125;
export const MAP_COLOR_Z = -0.01, ICON_Z = -0.02, ICON_STEP = -0.001;

// The matrices of the first-person map pose. `pose`: { bob, sway, progress (swing), equip }; `pitchDeg` is the Java
// rotationPitch (positive looking down). Returns { base, arms: [left, right], map } as Matrix4 chains from the camera.
export function mapHandMatrices(pose, pitchDeg = 0) {
  const H = MAP_HAND, T = new THREE.Matrix4(), mk = () => new THREE.Matrix4();
  const tr = (m, x, y, z) => m.multiply(T.makeTranslation(x, y, z)),
    rot = (m, axis, deg) => m.multiply(axis === "x" ? T.makeRotationX(deg * RAD) : axis === "y" ? T.makeRotationY(deg * RAD) : T.makeRotationZ(deg * RAD));
  const base = mk(), b = pose.bob ?? { x: 0, y: 0, rz: 0, rx: 0 };
  tr(base, b.x, b.y, 0); rot(base, "z", b.rz / RAD); rot(base, "x", b.rx / RAD);
  rot(base, "x", (pose.sway?.x || 0) / RAD); rot(base, "y", (pose.sway?.y || 0) / RAD);
  const s = f32(pose.progress ?? 0), sinS = Math.sin(f32(s * Math.PI)), root = Math.sin(f32(Math.sqrt(s) * Math.PI)),
    squared = Math.sin(f32(f32(s * s) * Math.PI));
  tr(base, -root * H.swingTranslate[0], Math.sin(f32(Math.sqrt(s) * Math.PI * 2)) * H.swingTranslate[1], -sinS * H.swingTranslate[2]);
  let p = 1 - pitchDeg / H.pitchDivisor + H.pitchLift;
  p = p < 0 ? 0 : p > 1 ? 1 : p;
  p = -Math.cos(f32(p * Math.PI)) * 0.5 + 0.5;
  tr(base, 0, 0 * H.scale - (1 - pose.equip) * H.equipDrop - p * 0.5 + H.lift, H.forward * H.scale);
  rot(base, "y", 90);
  rot(base, "z", p * H.tilt);
  const arms = [0, 1].map((k) => {
    const l = k * 2 - 1, m = mk();
    tr(m, H.armOffset[0], H.armOffset[1], H.armOffset[2] * l);
    rot(m, "x", H.armX * l); rot(m, "z", H.armZ[0]); rot(m, "z", H.armZ[1]); rot(m, "y", H.armY * l);
    return m;
  });
  const map = mk();
  rot(map, "y", squared * H.swingRot[0]); rot(map, "z", root * H.swingRot[1]); rot(map, "x", root * H.swingRot[2]);
  map.multiply(T.makeScale(H.mapScale, H.mapScale, H.mapScale));
  rot(map, "y", H.mapTurn[0]); rot(map, "z", H.mapTurn[1]);
  tr(map, ...H.mapShift);
  map.multiply(T.makeScale(H.pixel, H.pixel, H.pixel));
  return { base, arms, map };
}
// The frame's map matrix, in the frame's item frame of reference (after the rotation shift RenderItemFrame already applies).
export function frameMapMatrix(rotation) {
  const m = new THREE.Matrix4(), T = new THREE.Matrix4(), sh = FRAME_MAP_SHIFT[rotation & 3];
  m.multiply(T.makeRotationY(Math.PI)); m.multiply(T.makeRotationZ(Math.PI));
  m.multiply(T.makeScale(FRAME_MAP_SCALE, FRAME_MAP_SCALE, FRAME_MAP_SCALE));
  m.multiply(T.makeTranslation(sh[0], sh[1], sh[2]));
  m.multiply(T.makeTranslation(0, 0, -1));
  return m;
}

// MapColor bytes -> a 128 x 128 canvas (alpha 0 for colour 0, so the background shows through).
const textures = new Map();
export function mapColorTexture(data) {
  let rec = textures.get(data.id);
  if (!rec) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = MAP_SIZE;
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = texture.minFilter = THREE.NearestFilter;
    rec = { canvas, texture, revision: -1, image: canvas.getContext("2d").createImageData(MAP_SIZE, MAP_SIZE) };
    textures.set(data.id, rec);
  }
  if (rec.revision !== data.revision) {
    rec.revision = data.revision;
    const px = rec.image.data;
    for (let i = 0; i < MAP_SIZE * MAP_SIZE; i++) { const c = mapByteRgb(data.colors[i]); px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2]; px[i * 4 + 3] = c[3]; }
    rec.canvas.getContext("2d").putImageData(rec.image, 0, 0);
    rec.texture.needsUpdate = true;
  }
  return rec.texture;
}

function quad(points) { // points: [x, y, z, u, v] with GL v; three flips v for loader/canvas textures
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(points.flatMap((p) => [p[0], p[1], p[2]]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(points.flatMap(() => [0, 0, -1]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(points.flatMap((p) => [p[3], 1 - p[4]]), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}
const COLOR_QUAD = quad([[0, 128, MAP_COLOR_Z, 0, 1], [128, 128, MAP_COLOR_Z, 1, 1], [128, 0, MAP_COLOR_Z, 1, 0], [0, 0, MAP_COLOR_Z, 0, 0]]);
const BACKGROUND_QUAD = quad(MAP_HAND.quad.map(([x, y, u, v]) => [x, y, 0, u, v]));

// One map surface in pixel units (the caller sets root.matrix). `frameOnly` draws only the frame markers (RenderItemFrame).
export class MapSurface {
  constructor(makeMaterial, { frameOnly = false, background = false } = {}) {
    this.makeMaterial = makeMaterial; this.frameOnly = frameOnly;
    this.root = new THREE.Group(); this.root.matrixAutoUpdate = false;
    this.materials = [];
    const over = { depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 };
    if (background) { this.bg = this.add(BACKGROUND_QUAD, { map: pixelTexture(MAP_BACKGROUND) }, 0); }
    const blank = new THREE.DataTexture(new Uint8Array(4), 1, 1); blank.needsUpdate = true; // entityMaterial only samples a texture given at creation
    this.colors = this.add(COLOR_QUAD, { map: blank, transparent: true, alphaTest: 0, ...over }, 1);
    this.iconMaterial = this.make({ map: pixelTexture(MAP_ICONS), alphaTest: 0.1, ...over });
    this.icons = new THREE.Group(); this.root.add(this.icons);
    this.iconQuads = new Map();
    this.shown = null;
  }
  make(options) { const m = this.makeMaterial({ ...options, side: THREE.DoubleSide }); if (options.depthWrite !== undefined) m.depthWrite = options.depthWrite; if (options.polygonOffset) { m.polygonOffset = true; m.polygonOffsetFactor = options.polygonOffsetFactor; } this.materials.push(m); return m; }
  add(geometry, options, order) { const mesh = new THREE.Mesh(geometry, this.make(options)); mesh.renderOrder = order; this.root.add(mesh); return mesh; }
  // MapItemRenderer.Instance.a(boolean): the colour quad, then every decoration (or the frame markers only).
  update(data) {
    this.colors.visible = !!data;
    if (data) this.colors.material.uniforms.map.value = mapColorTexture(data);
    for (const c of [...this.icons.children]) this.icons.remove(c);
    if (!data) return;
    let i = 0;
    for (const [type, x, z, rotation] of data.decorations.values()) {
      if (this.frameOnly && type !== 1) continue;
      let g = this.iconQuads.get(type);
      if (!g) {
        const u0 = (type % 4) / 4, v0 = Math.floor(type / 4) / 4, u1 = (type % 4 + 1) / 4, v1 = (Math.floor(type / 4) + 1) / 4;
        g = quad([[-1, 1, 0, u0, v0], [1, 1, 0, u1, v0], [1, -1, 0, u1, v1], [-1, -1, 0, u0, v1]]);
        this.iconQuads.set(type, g);
      }
      const mesh = new THREE.Mesh(g, this.iconMaterial), m = new THREE.Matrix4(), T = new THREE.Matrix4();
      m.multiply(T.makeTranslation(x / 2 + 64, z / 2 + 64, ICON_Z));
      m.multiply(T.makeRotationZ(((rotation * 360) / 16) * RAD));
      m.multiply(T.makeScale(4, 4, 3));
      m.multiply(T.makeTranslation(-0.125, 0.125, i * ICON_STEP)); // the quad's vertex z is i * -0.001, inside the scale (4, 4, 3)
      mesh.matrixAutoUpdate = false; mesh.matrix.copy(m); mesh.renderOrder = 2;
      this.icons.add(mesh);
      i++;
    }
  }
  setLight(packed) { for (const m of this.materials) m.setLight(packed); }
  dispose() { for (const m of this.materials) m.dispose(); }
}
