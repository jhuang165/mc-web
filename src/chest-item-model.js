// The chest family's item model (blocks 54, 146 and 130, render type 22), executed in batch 43: RenderBlocks.renderBlockAsItem -> TileEntityRendererChestHelper ->
// TileEntityChestRenderer -> ModelChest -> ModelRenderer / ModelBox -> Tessellator, recorded in public/research/chest-item-reference.json by tools/verify-chest-item.mjs
// (the three blocks record identical geometry; the texture file differs: normal, christmas, trapped, ender). Replayed by src/chest-item-model.test.js.
//
// After renderBlockAsItem's own 90 degree turn about y and -0.5 translate (the cube matrix in icon-cube.js), the renderer applies CHEST_ITEM_PREFIX (T, S, R and T events in
// call order), then each ModelRenderer part translates by its rotation point / 16 and draws its ModelBox quads with positions of box / 16. ModelChest.renderAll draws the lid,
// the latch, then the base. Boxes are [x, y, z, w, h, d] in texture pixels with the part's texture offset [u, v] on the 64x64 chest sheet.
export const CHEST_ITEM_PREFIX = Object.freeze([["T", 0, 1, 1], ["S", 1, -1, -1], ["T", 0.5, 0.5, 0.5], ["R", 0, 0, 1, 0], ["T", -0.5, -0.5, -0.5]]);
export const CHEST_ITEM_PARTS = Object.freeze([
  { at: [1, 7, 15], box: [0, -5, -14, 14, 5, 14], uv: [0, 0] }, // lid
  { at: [8, 7, 15], box: [-1, -2, -15, 2, 4, 1], uv: [0, 0] }, // latch
  { at: [1, 6, 1], box: [0, 0, 0, 14, 10, 14], uv: [0, 19] }, // base
]);
export const CHEST_SHEET = 64;

// ModelBox's six TexturedQuads (+x, -x, -y, +y, -z, +z of the model's own axes), each as four [x, y, z, u, v] vertices in the order the Tessellator receives them
// (positions in blocks = pixels / 16 relative to the part's rotation point, u and v as texture fractions, the same 0.0 inset as TexturedQuad's constructor).
export function modelBoxQuads({ box: [x, y, z, w, h, d], uv: [tx, ty] }, size = CHEST_SHEET) {
  const x1 = x + w, y1 = y + h, z1 = z + d, s = 1 / 16;
  const p7 = [x, y, z], p0 = [x1, y, z], p1 = [x1, y1, z], p2 = [x, y1, z], p3 = [x, y, z1], p4 = [x1, y, z1], p5 = [x1, y1, z1], p6 = [x, y1, z1];
  const quad = (verts, u1, v1, u2, v2) => [[u2, v1], [u1, v1], [u1, v2], [u2, v2]].map(([u, v], i) => [...verts[i].map((c) => c * s), u / size, v / size]);
  return [
    quad([p4, p0, p1, p5], tx + d + w, ty + d, tx + d + w + d, ty + d + h),
    quad([p7, p3, p6, p2], tx, ty + d, tx + d, ty + d + h),
    quad([p4, p3, p7, p0], tx + d, ty, tx + d + w, ty + d),
    quad([p1, p2, p6, p5], tx + d + w, ty + d, tx + d + w + w, ty),
    quad([p0, p7, p2, p1], tx + d, ty + d, tx + d + w, ty + d + h),
    quad([p3, p4, p5, p6], tx + d + w + d, ty + d, tx + d + w + d + w, ty + d + h),
  ];
}
export const chestItemQuads = () => CHEST_ITEM_PARTS.flatMap((part) => modelBoxQuads(part));
