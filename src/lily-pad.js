// RenderBlocks.renderBlockLilyPad (blm.o, 1.7.10): a position hash picks one of four rotations of the
// lily pad quad, i1 = (l >> 16) & 3 with l = (int)(x * 3129871) ^ (long)z * 116129781L ^ y, then
// l = l * l * 42317861L + l * 11L in 64-bit arithmetic. The top quad sits 1/64 above the cell floor.
export function lilyPadRotation(x, y, z) {
  let l = BigInt(Math.imul(x | 0, 3129871)) ^ BigInt.asIntN(64, BigInt(z | 0) * 116129781n) ^ BigInt(y | 0);
  l = BigInt.asIntN(64, BigInt.asIntN(64, l * l) * 42317861n + l * 11n);
  return Number((l >> 16n) & 3n);
}
// The four vertices of the top quad as [dx, dz, u, v] around the cell centre (u: 0 minU, 1 maxU; v: 0 minV, 1 maxV),
// in the bytecode's order. The underside quad uses the same texture coordinates at the same corners, reversed.
export function lilyPadQuad(rotation) {
  const f3 = (rotation & 1) * 0.5 * (1 - (Math.trunc(rotation / 2) % 2) * 2),
    f4 = ((rotation + 1) & 1) * 0.5 * (1 - (Math.trunc((rotation + 1) / 2) % 2) * 2);
  return [[f3 - f4, f3 + f4, 0, 0], [f3 + f4, -f3 + f4, 1, 0], [-f3 + f4, -f3 - f4, 1, 1], [-f3 - f4, f3 - f4, 0, 1]];
}
// Texture coordinates for the corner of the cell at (cornerX, cornerZ) in {0, 1}, as [u, v] selectors (0 min, 1 max).
export function lilyPadCornerUv(x, y, z, cornerX, cornerZ) {
  const hit = lilyPadQuad(lilyPadRotation(x, y, z)).find(([dx, dz]) => dx === cornerX - 0.5 && dz === cornerZ - 0.5);
  return [hit[2], hit[3]];
}
