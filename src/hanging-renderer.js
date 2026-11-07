// RenderPainting (bon) and RenderItemFrame (bnx) from the 1.7.10 client JAR (bytecode read with javap).
//
// Painting: translate to the entity, rotate by its yaw, scale 1/16, and per 16 x 16 cell draw the front
// (texture u/v from the EnumArt offsets in paintings_kristoffer_zetterstrand.png, 256 x 256), the back, the four
// edges (strips of the same atlas at 0.75 / 0.0019531), each cell lit at its own block
// (RenderPainting.func_77008_a). Item frame: origin at the centre of the cell in front of the wall
// (tile + Direction offset), rotate by the yaw, then RenderBlocks.renderBlockAsItem's rotate 90 degrees about Y
// and translate (-0.5, -0.5, -0.5) around a 0.0625 deep back panel (itemframe_background, bounds
// 0..0.03125 thick, 0.0625 inset) and four birch plank bars; the item (RenderItem with renderInFrame) sits
// 0.453125 toward the wall, -0.18 down, turned 180 + yaw and 90 degrees per rotation step.
// Frames holding a map are drawn like any other frame (maps are not implemented).
import * as THREE from "three";
import { entityMaterial } from "./light-material.js";
import { pixelTexture, itemTexture } from "./first-person.js";
import { itemFrameTag } from "./item-animation.js";
import { blockTile, tileRect } from "./block-textures.js";
import { DropRenderer } from "./drop-renderer.js";
import { ARTS, DIR_X, DIR_Z } from "./hanging.js";
import { ITEM_FILLED_MAP, mapStore } from "./maps.js";
import { MapSurface, frameMapMatrix } from "./map-render.js";

const D = Math.PI / 180;
const PAINTING_ATLAS = "/media/1.7.10/painting/paintings_kristoffer_zetterstrand.png";
const FRAME_BACKGROUND = "/media/1.7.10/blocks/itemframe_background.png";
const PLANKS = 7, BIRCH = 2; // internal oak planks block (original 5), metadata 2

// RenderPainting.func_77010_a for one 16 x 16 cell (i, j) of a w x h art at atlas offset (u, v): quads as
// [normal, [x, y, z, u, v] x 4] in 1/16 block units.
export function paintingCellQuads(w, h, u, v, i, j) {
  const f = -w / 2, f1 = -h / 2, d = 0.5;
  const x1 = f + (i + 1) * 16, x0 = f + i * 16, y1 = f1 + (j + 1) * 16, y0 = f1 + j * 16;
  const ua = (u + w - i * 16) / 256, ub = (u + w - (i + 1) * 16) / 256, va = (v + h - j * 16) / 256, vb = (v + h - (j + 1) * 16) / 256;
  const [bu0, bu1, bv0, bv1] = [0.75, 0.8125, 0, 0.0625], [eu0, eu1, ev0, ev1] = [0.75, 0.8125, 0.001953125, 0.001953125], [su0, su1, sv0, sv1] = [0.7519531, 0.7519531, 0, 0.0625];
  return [
    [[0, 0, -1], [[x1, y0, -d, ub, va], [x0, y0, -d, ua, va], [x0, y1, -d, ua, vb], [x1, y1, -d, ub, vb]]],
    [[0, 0, 1], [[x1, y1, d, bu0, bv0], [x0, y1, d, bu1, bv0], [x0, y0, d, bu1, bv1], [x1, y0, d, bu0, bv1]]],
    [[0, 1, 0], [[x1, y1, -d, eu0, ev0], [x0, y1, -d, eu1, ev0], [x0, y1, d, eu1, ev1], [x1, y1, d, eu0, ev1]]],
    [[0, -1, 0], [[x1, y0, d, eu0, ev0], [x0, y0, d, eu1, ev0], [x0, y0, -d, eu1, ev1], [x1, y0, -d, eu0, ev1]]],
    [[-1, 0, 0], [[x1, y1, d, su0, sv0], [x1, y0, d, su0, sv1], [x1, y0, -d, su1, sv1], [x1, y1, -d, su1, sv0]]],
    [[1, 0, 0], [[x0, y1, -d, su0, sv0], [x0, y0, -d, su0, sv1], [x0, y0, d, su1, sv1], [x0, y1, d, su1, sv0]]],
  ];
}

function quadGeometry(quads, scale = 1 / 16) {
  const position = [], normal = [], uv = [], index = [];
  for (const [n, verts] of quads) {
    const base = position.length / 3;
    for (const [x, y, z, s, t] of verts) { position.push(x * scale, y * scale, z * scale); normal.push(...n); uv.push(s, 1 - t); }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

// RenderItemFrame.c: bounds (minX, minY, minZ, maxX, maxY, maxZ) in the unit cell. `back` uses the
// background icon on every face, the bars birch planks.
const F3 = 0.0625, F5 = 0.375;
export const FRAME_PARTS = [
  { back: true, bounds: [0, 0.5 - F5 + F3, 0.5 - F5 + F3, F3 * 0.5, 0.5 + F5 - F3, 0.5 + F5 - F3] },
  { bounds: [0, 0.5 - F5, 0.5 - F5, F3 + 1e-4, F3 + 0.5 - F5, 0.5 + F5] },
  { bounds: [0, 0.5 + F5 - F3, 0.5 - F5, F3 + 1e-4, 0.5 + F5, 0.5 + F5] },
  { bounds: [0, 0.5 - F5, 0.5 - F5, F3, 0.5 + F5, F3 + 0.5 - F5] },
  { bounds: [0, 0.5 - F5, 0.5 + F5 - F3, F3, 0.5 + F5, 0.5 + F5] },
];

const itemKey = (item) => (item ? item.id + ":" + (item.damage || 0) + ":" + itemFrameTag(itemTexture(item.id, item.damage || 0)) + ":" + (item.color ?? "") + ":" + JSON.stringify(item.tag?.ench ?? "") : "");

export class HangingRenderer {
  constructor(scene, view) {
    Object.assign(this, { scene, view, records: new Map() });
    this.drops = new DropRenderer(scene, view);
    this.atlas = pixelTexture(PAINTING_ATLAS);
    this.background = pixelTexture(FRAME_BACKGROUND);
  }

  createPainting(e) {
    const [, w, h, u, v] = ARTS[e.art], root = new THREE.Group(), cells = [], materials = [], geometries = [];
    for (let i = 0; i < w / 16; i++)
      for (let j = 0; j < h / 16; j++) {
        const g = quadGeometry(paintingCellQuads(w, h, u, v, i, j)), m = entityMaterial(this.view.lighting, { map: this.atlas, side: THREE.DoubleSide });
        root.add(new THREE.Mesh(g, m));
        geometries.push(g);
        materials.push(m);
        cells.push({ m, cx: f16(w, i), cy: f16(h, j) });
      }
    this.scene.add(root);
    return { root, cells, materials, geometries, key: "painting:" + e.art + ":" + e.dir, items: null };
  }
  createFrame() {
    const root = new THREE.Group(), turn = new THREE.Group(), materials = [], geometries = [];
    turn.rotation.y = Math.PI / 2; // renderBlockAsItem
    const planks = tileRect(blockTile(PLANKS, 0, false, BIRCH));
    const plankMaterial = entityMaterial(this.view.lighting, { map: this.view.textures.texture, side: THREE.DoubleSide }),
      backMaterial = entityMaterial(this.view.lighting, { map: this.background, side: THREE.DoubleSide });
    materials.push(plankMaterial, backMaterial);
    for (const part of FRAME_PARTS) {
      const [x0, y0, z0, x1, y1, z1] = part.bounds, g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
      if (!part.back) {
        const uv = g.attributes.uv;
        for (let f = 0; f < 6; f++) {
          uv.setXY(f * 4, planks.u0, planks.v1);
          uv.setXY(f * 4 + 1, planks.u1, planks.v1);
          uv.setXY(f * 4 + 2, planks.u0, planks.v0);
          uv.setXY(f * 4 + 3, planks.u1, planks.v0);
        }
      }
      const mesh = new THREE.Mesh(g, part.back ? backMaterial : plankMaterial);
      mesh.position.set((x0 + x1) / 2 - 0.5, (y0 + y1) / 2 - 0.5, (z0 + z1) / 2 - 0.5);
      turn.add(mesh);
      geometries.push(g);
    }
    root.add(turn);
    this.scene.add(root);
    return { root, materials, geometries, key: "frame", item: null, itemRoot: null };
  }

  // RenderItemFrame.d: the displayed item in the frame's own frame of reference.
  syncItem(r, e) {
    const key = itemKey(e.item);
    if (r.item?.key !== key || r.item?.rotation !== e.rotation) {
      if (r.item) { r.item.holder.removeFromParent(); r.item.surface?.dispose(); if (r.item.pile) this.drops.remove(r.item.pile); r.item = null; }
      if (e.item?.id === ITEM_FILLED_MAP) { this.syncMap(r, e, key); return; }
      if (e.item) {
        const stack = { ...e.item, count: 1 }, pile = this.drops.build(stack, 0), sprite = !!itemTexture(stack.id, stack.damage);
        const holder = new THREE.Group(), turn = new THREE.Group(), shift = new THREE.Group();
        // glTranslatef(-0.453125 * offsetX, -0.18, -0.453125 * offsetZ); glRotatef(180 + yaw, Y); glRotatef(-90 * rotation, Z);
        holder.position.set(-0.453125 * DIR_X[e.dir], -0.18, -0.453125 * DIR_Z[e.dir]);
        holder.rotation.y = (180 + e.yaw) * D;
        turn.rotation.z = -90 * e.rotation * D;
        const rot = e.rotation % 4;
        shift.position.set(rot === 1 ? -0.16 : rot === 3 ? 0.16 : 0, rot === 1 || rot === 3 ? -0.16 : rot === 2 ? -0.32 : 0, 0);
        // RenderItem with renderInFrame: blocks scale 1.25, translate (0, 0.05, 0), rotate -90 about Y; sprites scale
        // 0.5128205 and translate (0, -0.05, 0). The pile's own 0.5 (sprites) or 0.25 (blocks) scale is built in.
        pile.group.position.set(0, 0.125 + 0.1, 0);
        pile.spin.rotation.y = sprite ? 0 : -Math.PI / 2;
        pile.spin.scale.setScalar(sprite ? 0.5128205 / 0.5 : 1.25);
        pile.spin.position.set(0, sprite ? -0.05 * 0.5128205 : 0.05 * 1.25, 0);
        shift.add(pile.group);
        turn.add(shift);
        holder.add(turn);
        r.root.add(holder);
        r.item = { key, rotation: e.rotation, pile, holder };
      }
    }
  }

  // RenderItemFrame.d, filled map: rotate 180 about y and z, scale 1/128, the per-rotation shift, then MapItemRenderer with only
  // the frame markers (GL lighting is off for the item, so no diffuse shading). Bytecode-derived (map-render.js).
  syncMap(r, e, key) {
    const surface = new MapSurface((o) => {
      const m = entityMaterial(this.view.lighting, o);
      m.vertexShader = m.vertexShader.replace(/vDiffuse=min\([^;]*;/, "vDiffuse=1.;");
      m.needsUpdate = true;
      return m;
    }, { frameOnly: true });
    const holder = new THREE.Group(), turn = new THREE.Group(), shift = new THREE.Group();
    holder.position.set(-0.453125 * DIR_X[e.dir], -0.18, -0.453125 * DIR_Z[e.dir]);
    holder.rotation.y = (180 + e.yaw) * D;
    turn.rotation.z = -90 * e.rotation * D;
    const rot = e.rotation % 4;
    shift.position.set(rot === 1 ? -0.16 : rot === 3 ? 0.16 : 0, rot === 1 || rot === 3 ? -0.16 : rot === 2 ? -0.32 : 0, 0);
    surface.root.matrix.copy(frameMapMatrix(e.rotation));
    shift.add(surface.root); turn.add(shift); holder.add(turn);
    r.root.add(holder);
    r.item = { key, rotation: e.rotation, surface, holder, pile: null, map: e.item.damage | 0 };
  }

  // `list` is the live hanging entities; `world` unused (the lights come from `view`).
  update(list) {
    const seen = new Set();
    for (const e of list) {
      if (e.dead) continue;
      seen.add(e);
      let r = this.records.get(e);
      const key = e.kind === "painting" ? "painting:" + e.art + ":" + e.dir : "frame";
      if (r && r.key !== key) { this.dispose(r); this.records.delete(e); r = null; }
      if (!r) { r = e.kind === "painting" ? this.createPainting(e) : this.createFrame(); this.records.set(e, r); }
      if (e.kind === "painting") {
        r.root.position.set(e.x, e.y, e.z);
        r.root.rotation.y = e.yaw * D;
        for (const c of r.cells) c.m.setLight(this.cellLight(e, c.cx, c.cy));
      } else {
        // The centre of the cell in front of the wall block.
        r.root.position.set(e.tx + DIR_X[e.dir] + 0.5, e.ty + 0.5, e.tz + DIR_Z[e.dir] + 0.5);
        r.root.rotation.y = e.yaw * D;
        this.syncItem(r, e);
        const packed = this.view.brightness(e.x, e.y, e.z);
        for (const m of r.materials) m.setLight(packed);
        if (r.item?.surface) { r.item.surface.update(mapStore.get(r.item.map)); r.item.surface.setLight(packed); }
        else if (r.item) { r.item.pile.material.setLight(packed); r.item.pile.overlayMaterial?.setLight(packed); }
      }
    }
    for (const [e, r] of this.records)
      if (!seen.has(e)) { this.dispose(r); this.records.delete(e); }
  }
  // RenderPainting.func_77008_a: the light at the block the cell centre (x, y in 1/16) is in.
  cellLight(e, x, y) {
    let i = Math.floor(e.x), k = Math.floor(e.z);
    const j = Math.floor(e.y + y / 16);
    if (e.dir === 2) i = Math.floor(e.x + x / 16);
    if (e.dir === 1) k = Math.floor(e.z - x / 16);
    if (e.dir === 0) i = Math.floor(e.x - x / 16);
    if (e.dir === 3) k = Math.floor(e.z + x / 16);
    return this.view.brightness(i + 0.5, j + 0.5, k + 0.5);
  }
  dispose(r) {
    if (r.item) { r.item.holder.removeFromParent(); r.item.surface?.dispose(); if (r.item.pile) this.drops.remove(r.item.pile); r.item = null; }
    this.scene.remove(r.root);
    for (const g of r.geometries) g.dispose();
    for (const m of r.materials) m.dispose();
  }
  clear() {
    for (const r of this.records.values()) this.dispose(r);
    this.records.clear();
  }
}
// The centre of cell `n` along an art side of `size` pixels, in 1/16 units.
function f16(size, n) { return -size / 2 + n * 16 + 8; }
