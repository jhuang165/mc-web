import { eggBoxes } from './dragon-egg.js';
// RenderBlocks box sequences for the fence gate (renderBlockFenceGate, blm.a(ala, x, y, z)) and the cobblestone wall (renderBlockWall,
// blm.a(aoi, x, y, z)), replayed against public/research/render-types-2-reference.json by src/render-types-2.test.js.
// Bytecode-read AND executed: the box order, bounds and the uvRotateTop field (blm.v) below come from running the unchanged method's bytecode
// symbolically for every facing x open x wall-adjacent case (a throwaway interpreter, not shipped); the vertices of every case then match
// the native Tessellator input in the probe record.

// Native uvRotateTop value -> the turn index chunk-mesher's box() takes (the end portal frame record fixes the pairing: native 2 and 3 are swapped).
export const NATIVE_ROT_TO_TURN = [0, 1, 3, 2];

// renderBlockFenceGate: eight boxes, renderAllFaces on. `lowered` is the wall case: the same-axis neighbours on both sides are cobblestone walls, which drops every y by 3/16
// (f9..f14 = 0.375, 0.5625, 0.75, 0.9375, 0.3125, 1 minus 0.1875). Returns [[x0,y0,z0,x1,y1,z1], uvRotateTop] in native emission order.
export function gateRenderPlan(meta, lowered) {
  const dir = meta & 3, open = (meta & 4) !== 0, d = lowered ? 0.1875 : 0;
  const a = 0.375 - d, b = 0.5625 - d, c = 0.75 - d, e = 0.9375 - d, g = 0.3125 - d, h = 1 - d;
  // Built for the gate spanning x (facings 0 and 2), thin in z: [box in x/z/y order as the native call]
  const out = [], spanX = (dir & 1) === 0;
  const put = (x0, y0, z0, x1, y1, z1, rot) => out.push([spanX ? [x0, y0, z0, x1, y1, z1] : [z0, y0, x0, z1, y1, x1], rot]);
  const postRot = spanX ? 0 : 1;
  put(0, g, 0.4375, 0.125, h, 0.5625, postRot);
  put(0.875, g, 0.4375, 1, h, 0.5625, postRot);
  if (!open) {
    const rot = spanX ? 0 : 1;
    put(0.375, a, 0.4375, 0.5, e, 0.5625, rot);
    put(0.5, a, 0.4375, 0.625, e, 0.5625, rot);
    put(0.625, a, 0.4375, 0.875, b, 0.5625, rot);
    put(0.625, c, 0.4375, 0.875, e, 0.5625, rot);
    put(0.125, a, 0.4375, 0.375, b, 0.5625, rot);
    put(0.125, c, 0.4375, 0.375, e, 0.5625, rot);
  } else {
    // The leaves swing 90 degrees about their posts: towards +z for facing 0, -z for 2; for 1 and 3 the x/z swap, facing 1 mirrored to -x.
    const mirror = dir === 1 || dir === 2, rot = spanX ? 1 : 0;
    for (const [z0, z1, y0, y1] of [[0.8125, 0.9375, a, e], [0.5625, 0.8125, a, b], [0.5625, 0.8125, c, e]]) {
      const [p0, p1] = mirror ? [1 - z1, 1 - z0] : [z0, z1];
      for (const [x0, x1] of [[0, 0.125], [0.875, 1]]) out.push([spanX ? [x0, y0, p0, x1, y1, p1] : [p0, y0, x0, p1, y1, x1], rot]);
    }
  }
  return out;
}

// RenderBlocks.renderBlockAsItem for render type 21 (the fence gate in a hand or inventory slot, blm.a(aji, int, float); bytecode-read in batch 41, executed in batch 42:
// public/research/item-render-reference.json, src/item-render.test.js, all three boxes and their faces agree): NOT the world path above. Three boxes, each drawn with its six faces (icon faces 0..5 of the gate block, planks) around a -0.5 translate, with
// f = 1/16: [0.5 - f, 0.3, 0, 0.5 + f, 1, 2f], [0.5 - f, 0.3, 1 - 2f, 0.5 + f, 1, 1] (two posts) and [0.5 - f, 0.5, 0, 0.5 + f, 1 - f, 1] (one bar across).
export const GATE_ITEM_BOXES = Object.freeze([[0.4375, 0.3, 0, 0.5625, 1, 0.125], [0.4375, 0.3, 0.875, 0.5625, 1, 1], [0.4375, 0.5, 0, 0.5625, 0.9375, 1]]);

// renderBlockWall's boxes are wallRenderBoxes (shaped-blocks.js, already exact); what the record added is the face rule: BlockWall.shouldSideBeRendered (aoi.a(ahl, x, y, z, side))
// returns true for every side but 0, and side 0 asks Block's rule, so only the bottom face is hidden by an opaque block below (bytecode-read, then confirmed by the record).

// renderBlockAnvilMetadata / renderBlockAnvilOrient (blm.a(ajb, x, y, z, meta), render type 35): four boxes, every face drawn, the texture turned per facing through
// uvRotateTop/Bottom/East/West/North/South. The turns were fitted to the executed record (every facing, damage, box and face agrees to 0.002 texel fraction); they are
// not read from the bytecode. ANVIL_UV[facing][face] = [u from the second in-plane axis, u form, v form]; the in-plane axes are the two axes other than the face's own,
// in x, y, z order, and a form maps the coordinate c to c, 1 - c, (min + max) - c or 1 - ((min + max) - c) (min and max: the box's extent on that axis). Face order is the mesher's FACES: +x, -x, +y, -y, +z, -z.
const ANVIL_UV = [
  [[0, 2, 1], [0, 2, 1], [0, 1, 1], [0, 1, 1], [0, 0, 1], [0, 1, 1]],
  [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 1, 0], [1, 3, 0], [1, 3, 0]],
  [[0, 3, 0], [0, 3, 0], [0, 0, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]],
  [[1, 1, 1], [1, 0, 1], [1, 0, 1], [1, 0, 1], [1, 2, 1], [1, 2, 1]],
];
const form = (f, c, lo, hi) => (f === 0 ? c : f === 1 ? 1 - c : f === 2 ? lo + hi - c : 1 - (lo + hi - c));
export function anvilUv(facing, fi, p, box) {
  const axis = fi >> 1, o = [0, 1, 2].filter((k) => k !== axis), [swap, uf, vf] = ANVIL_UV[facing & 3][fi], ua = o[swap ? 1 : 0], va = o[swap ? 0 : 1];
  return [form(uf, p[ua], box[ua], box[ua + 3]), form(vf, p[va], box[va], box[va + 3])];
}

// Batch 42: renderBlockAsItem executed (tools/probes/ItemRenderProbe.java, public/research/item-render-reference.json). Every block whose render type RenderBlocks.renderItemIn3d
// accepts draws as boxes between a translate of -0.5 (type 0, 31, 39 and 26 first turn 90 degrees about y) with all six faces per box, in the order -y, +y, -z, +z, -x, +x.
// ITEM_BOXES: the boxes of the blocks whose item is NOT a unit cube, keyed by the ORIGINAL block id (blm.a(aji, meta, f) sets the block's own item bounds first:
// Block.setBlockBoundsForItemRender, so a carpet is 1/16 high, a plate a 4/16 slab in the middle of the cube, a button a small block). Stairs (STAIR_ITEM_BOXES in
// stairs.js), fences (FENCE_ITEM_BOXES in fences.js), the gate (above), the anvil (anvilModelBoxes) and the beacon (BEACON_ITEM_BOXES) have their own tables; the dragon egg
// (122) is BlockDragonEgg's eight stacked rows (dragon-egg.js eggBoxes; one draw of 48 quads, every face's uv fits itemBoxUv, batch 43), and the chests (22) go through
// TileEntityRendererChestHelper (chest-item-model.js).
const SLAB = Object.freeze([0, 0, 0, 1, 0.5, 1]), PLATE = Object.freeze([0, 0.375, 0, 1, 0.625, 1]), BUTTON = Object.freeze([0.3125, 0.375, 0.375, 0.6875, 0.625, 0.625]);
export const ITEM_BOXES = Object.freeze({
  44: [SLAB], 126: [SLAB], 60: [[0, 0, 0, 1, 0.9375, 1]], 70: [PLATE], 72: [PLATE], 147: [PLATE], 148: [PLATE], 77: [BUTTON], 143: [BUTTON],
  78: [[0, 0, 0, 1, 0.125, 1]], 96: [[0, 0.40625, 0, 1, 0.59375, 1]], 116: [[0, 0, 0, 1, 0.75, 1]], 120: [[0, 0, 0, 1, 0.8125, 1]], 151: [[0, 0, 0, 1, 0.375, 1]],
  122: eggBoxes(), 171: [[0, 0, 0, 1, 0.0625, 1]], 92: [[0.0625, 0, 0.0625, 0.9375, 0.5, 0.9375]], 139: [[0, 0, 0.3125, 1, 0.8125, 0.6875], [0.25, 0, 0.25, 0.75, 1, 0.75]],
});
// renderBlockAsItem type 34 (the beacon): inner obsidian base (metadata 1 faces), the beacon core (metadata 2), then the glass shell (metadata 0).
export const BEACON_ITEM_BOXES = Object.freeze([[0.125, 0, 0.125, 0.875, 0.1875, 0.875], [0.1875, 0.1875, 0.1875, 0.8125, 0.875, 0.8125], [0, 0, 0, 1, 1, 1]]);

// The uv of an item box vertex (renderFaceXPos ... with no uv rotation, executed): face order +x, -x, +y, -y, +z, -z as FACES in chunk-mesher.js; p = the vertex, box =
// [x0, y0, z0, x1, y1, z1]. XPos and ZNeg run (min + max) - p on their horizontal axis, so a thin box shows a strip of the texture; the other faces use p; vertical v is 1 - y.
// A face whose box reaches outside the block on one of its axes (the fence bars, z -1/8 to 9/8) takes the whole texture along that axis instead of a crop. Returns [s, t] in
// tile fractions (t from the top).
export function itemBoxUv(fi, p, box) {
  const along = (a, mode) => { // mode 0: c, 1: 1 - c, 2: (min + max) - c
    const lo = box[a], hi = box[a + 3];
    if (lo < 0 || hi > 1) { const n = (p[a] - lo) / (hi - lo); return mode === 0 ? n : 1 - n; }
    return mode === 0 ? p[a] : mode === 1 ? 1 - p[a] : lo + hi - p[a];
  };
  return [[along(2, 2), along(1, 1)], [along(2, 0), along(1, 1)], [along(0, 0), along(2, 0)], [along(0, 0), along(2, 0)], [along(0, 0), along(1, 1)], [along(0, 2), along(1, 1)]][fi];
}

// The corners of a box face for the face order +x, -x, +y, -y, +z, -z (0 = the box's minimum on that axis, 1 = its maximum), counter-clockwise seen from outside; shared by
// the held / dropped geometry (first-person.js boxItemGeometry) and the inventory icon quads (icon-quads.js).
export const BOX_FACE_CORNERS = Object.freeze([
  [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
  [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
  [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
]);

// RenderBlocks.renderBlockAsItem for the cactus (render type 13, executed in item-render-reference.json): not a box. The top and the bottom are full quads, the four sides are
// inset 1/16 (renderBlockCactus' own inset). Quads of [x, y, z, s, t] (s right, t from the top of the texture fraction), the face index in the port's order +x, -x, +y, -y, +z, -z
// choosing the texture. The item is not turned (type 13 is not among the types renderBlockAsItem turns).
export const CACTUS_ITEM_QUADS = Object.freeze([
  [3, [[0, 0, 1, 0, 1], [0, 0, 0, 0, 0], [1, 0, 0, 1, 0], [1, 0, 1, 1, 1]]],
  [2, [[1, 1, 1, 1, 1], [1, 1, 0, 1, 0], [0, 1, 0, 0, 0], [0, 1, 1, 0, 1]]],
  [5, [[0, 1, 0.0625, 1, 0], [1, 1, 0.0625, 0, 0], [1, 0, 0.0625, 0, 1], [0, 0, 0.0625, 1, 1]]],
  [4, [[0, 1, 0.9375, 0, 0], [0, 0, 0.9375, 0, 1], [1, 0, 0.9375, 1, 1], [1, 1, 0.9375, 1, 0]]],
  [1, [[0.0625, 1, 1, 1, 0], [0.0625, 1, 0, 0, 0], [0.0625, 0, 0, 0, 1], [0.0625, 0, 1, 1, 1]]],
  [0, [[0.9375, 0, 1, 0, 1], [0.9375, 0, 0, 1, 1], [0.9375, 1, 0, 1, 0], [0.9375, 1, 1, 0, 0]]],
].map(([fi, q]) => Object.freeze([fi, Object.freeze(q.map(Object.freeze))])));
