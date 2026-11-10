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
