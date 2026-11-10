// RenderBlocks vertex streams for the vessel-like render types (cauldron 24, hopper 38, flower pot 33, cocoa 28, stems 19, brewing stand 25),
// read off the unchanged 1.7.10 bytecode (blm methods func_147785_a, func_147799_a, func_147752_a, func_147772_a, func_147795_a / func_147740_a,
// func_147741_a, func_147765_a; javap, bytecode-read) and compared vertex by vertex with the executed probe
// (tools/probes/RenderTypes2Probe.java, public/research/render-types-2-reference.json, src/render-types-2.test.js).
// Each function returns quads { icon | tile, verts: [[x, y, z] x4], uv: [[fu, fv] x4], colour: [r, g, b] } in native vertex order; fu and fv are icon
// fractions with v from the icon's top (Icon.getInterpolatedV), as the native Tessellator received them. chunk-mesher.js maps them into the atlas and
// lights them (the cell's own brightness for everything here that RenderBlocks draws outside renderStandardBlock).
const f = Math.fround;
const WHITE = [1, 1, 1];

// The corners of the six faces in the order +x, -x, +y, -y, +z, -z (the winding of chunk-mesher FACES).
const CORNERS = [
  [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
  [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
  [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
];
// RenderBlocks.renderFaceXPos .. renderFaceZNeg drawn alone (the face of the current render bounds, moved by an offset, in a given icon, at the
// tessellator's colour and brightness): u and v run over the bounds' extent, the mirrored axes as (min + max) - p (the same rule as the door's end caps).
export function boundFace(fi, [x0, y0, z0, x1, y1, z1], x, y, z, [dx, dy, dz], icon, tile) {
  const pick = (v) => [v[0] ? x1 : x0, v[1] ? y1 : y0, v[2] ? z1 : z0];
  const st = (p) => [[z0 + z1 - p[2], 1 - p[1]], [p[2], 1 - p[1]], [p[0], p[2]], [p[0], p[2]], [p[0], 1 - p[1]], [x0 + x1 - p[0], 1 - p[1]]][fi];
  const cs = CORNERS[fi].map(pick);
  return { icon, tile, verts: cs.map((p) => [x + dx + p[0], y + dy + p[1], z + dz + p[2]]), uv: cs.map(st), colour: WHITE };
}

// RenderBlocks.renderBlockHopper (func_147799_a, world branch): after the bowl box, four inner walls (hopper_outside) 1/8 inside the sides and the
// bowl floor at 5/8 (hopper_inside), all with the cell's brightness and the block colour (white). The bowl, funnel and spout are standard blocks.
export const HOPPER_BOWL = [0, 0.625, 0, 1, 1, 1];
export function hopperInner(x, y, z) {
  const e = f(0.125), b = HOPPER_BOWL, at = (fi, d, ic) => boundFace(fi, b, x, y, z, d, ic);
  return [
    at(0, [f(f(-1) + e), 0, 0], "hopper_outside"), at(1, [f(f(1) - e), 0, 0], "hopper_outside"),
    at(4, [0, 0, f(f(-1) + e)], "hopper_outside"), at(5, [0, 0, f(f(1) - e)], "hopper_outside"),
    at(2, [0, f(f(-1) + 0.625) - 0, 0], "hopper_inside"),
  ];
}
// The hopper's funnel and spout bounds (standard blocks in hopper_outside), the spout by facing (BlockHopper.getDirectionFromMetadata = meta & 7).
export const HOPPER_FUNNEL = [0.25, 0.25, 0.25, 0.75, 0.625 - 0.002, 0.75];
export const hopperSpout = (facing) => ({ 0: [0.375, 0, 0.375, 0.625, 0.25, 0.625], 2: [0.375, 0.25, 0, 0.625, 0.5, 0.25], 3: [0.375, 0.25, 0.75, 0.625, 0.5, 1], 4: [0, 0.25, 0.375, 0.25, 0.5, 0.625], 5: [0.75, 0.25, 0.375, 1, 0.5, 0.625] })[facing] || null;

// RenderBlocks.renderBlockCauldron (func_147785_a): a standard block of the full cell (cauldron_top / cauldron_side / cauldron_bottom), then four inner
// walls 1/8 inside the sides in cauldron_side, the floor's two faces at 4/16 in cauldron_inner and, for a non-zero metadata, the water plane at
// (6 + 3 * metadata) / 16 in water_still, all at the cell's brightness with white.
export function cauldronInner(x, y, z, meta) {
  const e = f(0.125), b = [0, 0, 0, 1, 1, 1], at = (fi, d, ic) => boundFace(fi, b, x, y, z, d, ic), out = [
    at(0, [f(f(-1) + e), 0, 0], "cauldron_side"), at(1, [f(f(1) - e), 0, 0], "cauldron_side"),
    at(4, [0, 0, f(f(-1) + e)], "cauldron_side"), at(5, [0, 0, f(f(1) - e)], "cauldron_side"),
    at(2, [0, f(f(-1) + 0.25), 0], "cauldron_inner"), at(3, [0, f(f(1) - 0.75), 0], "cauldron_inner"),
  ];
  if (meta > 0) out.push(at(2, [0, f(f(-1) + f(f(6 + 3 * meta) / 16)), 0], "water_still"));
  return out;
}

// RenderBlocks.renderBlockBrewingStand (func_147741_a): the bottle planes. icon = brewing_stand; for each of the three arms (angle i * pi * 2 / 3 +
// pi / 2) a double-sided vertical plane from the centre to 8/16 out, u from the icon's middle to its right edge (to its left edge when the
// bottle bit 1 << i is set).
export function brewingBottles(x, y, z, meta) {
  const out = [], icon = "brewing_stand";
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3 + Math.PI / 2, u0 = 0.5, u1 = meta & (1 << i) ? 0 : 1, x0 = x + 0.5, z0 = z + 0.5, x1 = x + 0.5 + (Math.sin(angle) * 8) / 16, z1 = z + 0.5 + (Math.cos(angle) * 8) / 16;
    const p = (px, py, pz, u, v) => ({ p: [px, py, pz], uv: [u, v] });
    const quad = (vs) => out.push({ icon, verts: vs.map((v) => v.p), uv: vs.map((v) => v.uv), colour: WHITE });
    quad([p(x0, y + 1, z0, u0, 0), p(x0, y, z0, u0, 1), p(x1, y, z1, u1, 1), p(x1, y + 1, z1, u1, 0)]);
    quad([p(x1, y + 1, z1, u1, 0), p(x1, y, z1, u1, 1), p(x0, y, z0, u0, 1), p(x0, y + 1, z0, u0, 0)]);
  }
  return out;
}

// Tessellator.addVertexWithUV quads of the crossed squares of RenderBlocks.func_147765_a (drawCrossedSquares(icon, x, y, z, scale)): two planes
// crossing at 0.45 * scale from the centre, each drawn from both sides (the back side with u swapped).
export function crossedSquares(x, y, z, scale, icon, tile, colour = WHITE) {
  const d = 0.45 * f(scale), x0 = x + 0.5 - d, x1 = x + 0.5 + d, z0 = z + 0.5 - d, z1 = z + 0.5 + d, s = f(scale);
  const q = (list) => ({ icon, tile, colour, verts: list.map((v) => [v[0], v[1], v[2]]), uv: list.map((v) => [v[3], v[4]]) });
  return [
    q([[x0, y + s, z0, 0, 0], [x0, y, z0, 0, 1], [x1, y, z1, 1, 1], [x1, y + s, z1, 1, 0]]),
    q([[x1, y + s, z1, 0, 0], [x1, y, z1, 0, 1], [x0, y, z0, 1, 1], [x0, y + s, z0, 1, 0]]),
    q([[x0, y + s, z1, 0, 0], [x0, y, z1, 0, 1], [x1, y, z0, 1, 1], [x1, y + s, z0, 1, 0]]),
    q([[x1, y + s, z0, 0, 0], [x1, y, z0, 0, 1], [x0, y, z1, 1, 1], [x0, y + s, z1, 1, 0]]),
  ];
}

// RenderBlocks.func_147795_a (renderBlockStemSmall) and func_147740_a (renderBlockStemBig): `h` is the block's render height (BlockStem.setBlockBoundsBasedOnState),
// the cell is drawn 1/16 low (y - 0.0625f). The small stem is two planes (each double-sided, the back with the same u order) at 0.45 from the centre,
// its icon cropped to the height; the connected stem is one plane through the cell toward `dir` (0 -x, 1 +x, 2 -z, 3 +z; u swapped for 1 and 2).
const BIG = 0.44999998807907104;
export function stemSmall(x, y, z, h, icon) {
  const x0 = x + 0.5 - BIG, x1 = x + 0.5 + BIG, z0 = z + 0.5 - BIG, z1 = z + 0.5 + BIG, v1 = f(h * 16) / 16, c = WHITE;
  const q = (l) => ({ icon, colour: c, verts: l.map((v) => [v[0], v[1], v[2]]), uv: l.map((v) => [v[3], v[4]]) });
  return [
    q([[x0, y + h, z0, 0, 0], [x0, y, z0, 0, v1], [x1, y, z1, 1, v1], [x1, y + h, z1, 1, 0]]),
    q([[x1, y + h, z1, 1, 0], [x1, y, z1, 1, v1], [x0, y, z0, 0, v1], [x0, y + h, z0, 0, 0]]),
    q([[x0, y + h, z1, 0, 0], [x0, y, z1, 0, v1], [x1, y, z0, 1, v1], [x1, y + h, z0, 1, 0]]),
    q([[x1, y + h, z0, 1, 0], [x1, y, z0, 1, v1], [x0, y, z1, 0, v1], [x0, y + h, z1, 0, 0]]),
  ];
}
export function stemBig(x, y, z, h, dir, icon) {
  let a = 0, b = 1;
  if (Math.trunc((dir + 1) / 2) % 2 === 1) [a, b] = [1, 0];
  const q = (l) => ({ icon, colour: WHITE, verts: l.map((v) => [v[0], v[1], v[2]]), uv: l.map((v) => [v[3], v[4]]) });
  if (dir < 2) {
    const zc = z + 0.5, x0 = x, x1 = x + 1;
    return [q([[x0, y + h, zc, a, 0], [x0, y, zc, a, 1], [x1, y, zc, b, 1], [x1, y + h, zc, b, 0]]), q([[x1, y + h, zc, b, 0], [x1, y, zc, b, 1], [x0, y, zc, a, 1], [x0, y + h, zc, a, 0]])];
  }
  const xc = x + 0.5, z0 = z, z1 = z + 1;
  return [q([[xc, y + h, z1, a, 0], [xc, y, z1, a, 1], [xc, y, z0, b, 1], [xc, y + h, z0, b, 0]]), q([[xc, y + h, z0, b, 0], [xc, y, z0, b, 1], [xc, y, z1, a, 1], [xc, y + h, z1, a, 0]])];
}

// RenderBlocks.func_147772_a (renderBlockCocoa): meta & 3 the direction (BlockDirectional), (meta >> 2) & 3 the age. The pod is a box of width 4 + 2 * age and
// height 5 + 2 * age pixels hung from 12/16 and pushed against the log, its four sides, top and bottom in cocoa_stage_<age> (the top and bottom
// crop to the pod's width, minus one pixel from age 2), then a 4 x 4 stalk plane box on the log side at 12/16..1 in the same icon. White, cell brightness.
export function cocoaQuads(x, y, z, meta) {
  const dir = meta & 3, age = (meta >> 2) & 3, icon = "cocoa_stage_" + age, w = 4 + age * 2, hh = 5 + age * 2, out = [];
  const q = (l) => out.push({ icon, colour: WHITE, verts: l.map((v) => [v[0], v[1], v[2]]), uv: l.map((v) => [v[3], v[4]]) });
  let uL = (15 - w) / 16, uR = 15 / 16, vT = 4 / 16, vB = (4 + hh) / 16, ox = 0, oz = 0;
  const half = Math.trunc(w / 2);
  if (dir === 2) [ox, oz] = [8 - half, 1];
  else if (dir === 0) [ox, oz] = [8 - half, 15 - w];
  else if (dir === 3) [ox, oz] = [15 - w, 8 - half];
  else if (dir === 1) [ox, oz] = [1, 8 - half];
  const xa = x + ox / 16, xb = x + (ox + w) / 16, ya = y + (12 - hh) / 16, yb = y + 0.75, za = z + oz / 16, zb = z + (oz + w) / 16;
  [uL, uR, vT, vB] = [uL, uR, vT, vB].map(f);
  q([[xa, ya, za, uL, vB], [xa, ya, zb, uR, vB], [xa, yb, zb, uR, vT], [xa, yb, za, uL, vT]]);
  q([[xb, ya, zb, uL, vB], [xb, ya, za, uR, vB], [xb, yb, za, uR, vT], [xb, yb, zb, uL, vT]]);
  q([[xb, ya, za, uL, vB], [xa, ya, za, uR, vB], [xa, yb, za, uR, vT], [xb, yb, za, uL, vT]]);
  q([[xa, ya, zb, uL, vB], [xb, ya, zb, uR, vB], [xb, yb, zb, uR, vT], [xa, yb, zb, uL, vT]]);
  const n = age >= 2 ? w - 1 : w, tu = f(n / 16), tv = f(n / 16);
  q([[xa, yb, zb, 0, tv], [xb, yb, zb, tu, tv], [xb, yb, za, tu, 0], [xa, yb, za, 0, 0]]);
  q([[xa, ya, za, 0, 0], [xb, ya, za, tu, 0], [xb, ya, zb, tu, tv], [xa, ya, zb, 0, tv]]);
  // The stalk.
  let su = f(12 / 16), sv = f(4 / 16), s0 = 1, s1 = su, sx = 8, sz = 0;
  s0 = su; s1 = 1;
  if (dir === 2) [sx, sz] = [8, 0];
  else if (dir === 0) { [sx, sz] = [8, 12]; [s0, s1] = [s1, s0]; }
  else if (dir === 3) { [sx, sz] = [12, 8]; [s0, s1] = [s1, s0]; }
  else [sx, sz] = [0, 8];
  const x0 = x + sx / 16, x1 = x + (sx + 4) / 16, z0 = z + sz / 16, z1 = z + (sz + 4) / 16, y0 = y + 0.75, y1 = y + 1;
  if (dir === 2 || dir === 0) {
    q([[x0, y0, z0, s1, sv], [x0, y0, z1, s0, sv], [x0, y1, z1, s0, 0], [x0, y1, z0, s1, 0]]);
    q([[x0, y0, z1, s0, sv], [x0, y0, z0, s1, sv], [x0, y1, z0, s1, 0], [x0, y1, z1, s0, 0]]);
  } else {
    q([[x1, y0, z0, s0, sv], [x0, y0, z0, s1, sv], [x0, y1, z0, s1, 0], [x1, y1, z0, s0, 0]]);
    q([[x0, y0, z0, s1, sv], [x1, y0, z0, s0, sv], [x1, y1, z0, s0, 0], [x0, y1, z0, s1, 0]]);
  }
  return out;
}

// Tessellator.setColor(float, float, float) from a Block.colorMultiplier int: each channel is (c >> n & 255) / 255.0f.
export const colourOf = (c) => [f(((c >> 16) & 255) / 255), f(((c >> 8) & 255) / 255), f((c & 255) / 255)];

// RenderBlocks.renderBlockFlowerPot (func_147752_a), after the pot's own standard block: four inner walls in flower_pot at 0.1865 inside the pot bounds
// (float arithmetic of the bytecode) and the soil's top face (dirt) at y - 0.5 + 0.1865 + 0.1875, all at the cell's brightness with white.
export const POT_BOX = [0.3125, 0, 0.3125, 0.6875, 0.375, 0.6875];
export function potInner(x, y, z) {
  const e = f(0.1865), at = (fi, d, ic) => boundFace(fi, POT_BOX, x, y, z, d, ic);
  return [
    at(0, [f(f(x - 0.5) + e) - x, 0, 0], "flower_pot"), at(1, [f(f(x + 0.5) - e) - x, 0, 0], "flower_pot"),
    at(4, [0, 0, f(f(z - 0.5) + e) - z], "flower_pot"), at(5, [0, 0, f(f(z + 0.5) - e) - z], "flower_pot"),
    at(2, [0, f(f(f(y - 0.5) + e) + 0.1875) - y, 0], "dirt"),
  ];
}
// The cactus in a pot: three standard-block boxes (renderAllFaces on), 1/4 apart.
export const POT_CACTUS = [[0.375, 0, 0.375, 0.625, 0.25, 0.625], [0.375, 0.25, 0.375, 0.625, 0.5, 0.625], [0.375, 0.5, 0.375, 0.625, 0.75, 0.625]];
