import { BufferGeometry, Float32BufferAttribute } from 'three';
// ItemRenderer.renderItemIn2D (bly.a, executed in public/research/item-sprite-reference.json by tools/verify-item-sprite.mjs): the front face, the back face at z = -thickness,
// then one strip per pixel column on the left edge (x = i / w), one on the right (x = i / w + 1 / w), one per pixel row on the top (y = i / h + 1 / h) and on the bottom
// (y = i / h), in that draw order, every vertex and uv the float arithmetic of the original. The icon covers the whole texture here: native f1 = maxU = 1, f3 = minU = 0,
// f2 = minV = 0, f4 = maxV = 1 (three.js textures are flipped, so a native v is stored as 1 - v). Alpha testing trims the strips to the silhouette.
const F = Math.fround;
export function spriteGeometry(width = 16, height = width, thickness = 1 / 16) {
  const p = [], uv = [], n = [], t = F(thickness), f1 = 1, f2 = 0, f3 = 0, f4 = 1;
  // a quad is four [x, y, z, u, v] vertices in native order and native v; the port draws it as two triangles
  const quad = (verts, normal) => { for (const i of [0, 1, 2, 0, 2, 3]) { const [x, y, z, u, v] = verts[i]; p.push(x, y, z); uv.push(u, F(1 - v)); n.push(...normal); } };
  quad([[0, 0, 0, f1, f4], [1, 0, 0, f3, f4], [1, 1, 0, f3, f2], [0, 1, 0, f1, f2]], [0, 0, 1]);
  quad([[0, 1, F(0 - t), f1, f2], [1, 1, F(0 - t), f3, f2], [1, 0, F(0 - t), f3, f4], [0, 0, F(0 - t), f1, f4]], [0, 0, -1]);
  const f8 = F(F(0.5 * F(f1 - f3)) / width), f9 = F(F(0.5 * F(f4 - f2)) / height), zb = F(0 - t);
  for (let i = 0; i < width; i++) {
    const f11 = F(i / width), u = F(F(f1 + F(F(f3 - f1) * f11)) - f8);
    quad([[f11, 0, zb, u, f4], [f11, 0, 0, u, f4], [f11, 1, 0, u, f2], [f11, 1, zb, u, f2]], [-1, 0, 0]);
  }
  for (let i = 0; i < width; i++) {
    const f11 = F(i / width), u = F(F(f1 + F(F(f3 - f1) * f11)) - f8), x = F(f11 + F(1 / width));
    quad([[x, 1, zb, u, f2], [x, 1, 0, u, f2], [x, 0, 0, u, f4], [x, 0, zb, u, f4]], [1, 0, 0]);
  }
  for (let i = 0; i < height; i++) {
    const f11 = F(i / height), v = F(F(f4 + F(F(f2 - f4) * f11)) - f9), y = F(f11 + F(1 / height));
    quad([[0, y, 0, f1, v], [1, y, 0, f3, v], [1, y, zb, f3, v], [0, y, zb, f1, v]], [0, 1, 0]);
  }
  for (let i = 0; i < height; i++) {
    const f11 = F(i / height), v = F(F(f4 + F(F(f2 - f4) * f11)) - f9);
    quad([[1, f11, 0, f3, v], [0, f11, 0, f1, v], [0, f11, zb, f1, v], [1, f11, zb, f3, v]], [0, -1, 0]);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new Float32BufferAttribute(n, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return g;
}
