// The inventory cube icon's projection, as RenderItem.renderItemIntoGUI (bny.a(bty, bqf, add, int, int)) sets it up for a render type 0 block
// (bytecode-read; the GL11 matrix calls in order, x/y the slot's top-left in GUI pixels, zLevel only shifts depth):
//   glTranslatef(x - 2, y + 3, -3 + zLevel); glScalef(10, 10, 10); glTranslatef(1, 0.5, 1); glScalef(1, 1, -1);
//   glRotatef(210, 1, 0, 0); glRotatef(45, 0, 1, 0); glRotatef(-90, 0, 1, 0)
// then RenderBlocks.renderBlockAsItem (blm.a(aji, int, float)) does glRotatef(90, 0, 1, 0) and glTranslatef(-0.5, -0.5, -0.5) before it draws the
// six faces of the block's bounds. The GUI projection is glOrtho(0, W, H, 0, 1000, 3000) over the scaled resolution, so one GUI pixel is `scale`
// physical pixels and depth does not move x or y. The matrix below composes those calls in float32 like the GL matrix stack (Mesa's rotate:
// normalised axis, float sin/cos of the angle in degrees). Derived, not executed: tools/probes/IconEdgeProbe.java composes it independently.
const f = Math.fround;

const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; // column major, as GL
function mul(a, b) { // a * b in float32 (GL post-multiplies the current matrix)
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s = f(s + f(a[k * 4 + r] * b[c * 4 + k]));
    o[c * 4 + r] = s;
  }
  return o;
}
const translate = (m, x, y, z) => mul(m, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, f(x), f(y), f(z), 1]);
const scale = (m, x, y, z) => mul(m, [f(x), 0, 0, 0, 0, f(y), 0, 0, 0, 0, f(z), 0, 0, 0, 0, 1]);
function rotate(m, deg, x, y, z) {
  const len = f(Math.sqrt(f(f(x * x) + f(y * y)) + f(z * z))), ux = f(x / len), uy = f(y / len), uz = f(z / len);
  const a = deg * (Math.PI / 180), s = f(Math.sin(a)), c = f(Math.cos(a)), t = f(1 - c);
  const r = [
    f(f(f(t * ux) * ux) + c), f(f(f(t * ux) * uy) + f(s * uz)), f(f(f(t * ux) * uz) - f(s * uy)), 0,
    f(f(f(t * ux) * uy) - f(s * uz)), f(f(f(t * uy) * uy) + c), f(f(f(t * uy) * uz) + f(s * ux)), 0,
    f(f(f(t * ux) * uz) + f(s * uy)), f(f(f(t * uy) * uz) - f(s * ux)), f(f(f(t * uz) * uz) + c), 0,
    0, 0, 0, 1];
  return mul(m, r);
}

let CUBE;
// The model-view matrix (slot at the origin, one unit = one GUI pixel) applied to block coordinates in [0, 1].
export function cubeModelView() {
  if (CUBE) return CUBE;
  let m = identity();
  m = translate(m, -2, 3, -3); m = scale(m, 10, 10, 10); m = translate(m, 1, 0.5, 1); m = scale(m, 1, 1, -1);
  m = rotate(m, 210, 1, 0, 0); m = rotate(m, 45, 0, 1, 0); m = rotate(m, -90, 0, 1, 0);
  m = rotate(m, 90, 0, 1, 0); m = translate(m, -0.5, -0.5, -0.5);
  return (CUBE = m);
}
// Screen position in GUI pixels (y down, as glOrtho(0, W, H, 0)) of a block-space point.
export function projectCube(x, y, z, m = cubeModelView()) {
  return [f(f(f(m[0] * x) + f(m[4] * y)) + f(f(m[8] * z) + m[12])), f(f(f(m[1] * x) + f(m[5] * y)) + f(f(m[9] * z) + m[13]))];
}

// The three visible faces as canvas matrices (a, b, c, d, e, f: tile pixel (u, v) -> canvas X = a u + c v + e, Y = b u + d v + f) at `scale`
// physical pixels per GUI pixel. Tile orientation is the port's own (kept from its earlier hand-made matrices, whose faces map as below onto the block
// in the native projection): west face x = 0 (u runs along +z), south face z = 1 (u runs along +x), top face y = 1 - drop / 16 (u along +z, v along -x).
// `drop` (tile rows) lowers the top for the slab and layer icons, whose bounds are shorter than the cell. The faces visible natively are the west
// (-x), south (+z) and top; the native depth test hides the other three (their eye-space normals face away).
export function cubeFaces(scaleFactor = 4, drop = 0, m = cubeModelView()) {
  const S = scaleFactor, top = (16 - drop) / 16, at = (x, y, z) => projectCube(x, y, z, m);
  const face = (origin, du, dv) => [S * du[0] / 16, S * du[1] / 16, S * dv[0] / 16, S * dv[1] / 16, S * origin[0], S * origin[1]];
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
  const vertical = sub(at(0, 0, 0), at(0, 1, 0)); // one block up -> down the screen, the tile's v axis for the side faces
  const west = face(at(0, 1, 0), sub(at(0, 1, 1), at(0, 1, 0)), vertical);
  const south = face(at(0, 1, 1), sub(at(1, 1, 1), at(0, 1, 1)), vertical);
  const topFace = face(at(1, top, 0), sub(at(1, top, 1), at(1, top, 0)), sub(at(0, top, 0), at(1, top, 0)));
  return { west, south, top: topFace };
}
