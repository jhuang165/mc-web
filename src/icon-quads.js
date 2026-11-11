// Inventory icons of models that are not a unit cube, drawn the way the GL does renderItemIntoGUI's flat-shaded textured quads (the cube matrix of icon-cube.js, binary
// pixel-centre coverage with the top-left rule, GL_NEAREST texels, a depth buffer): boxes from RenderBlocks.renderBlockAsItem (executed in batch 42, item-render-reference.json)
// and the chest model (batch 43, chest-item-reference.json). A quad is { pos: 4 x [x, y, z] in the model's block frame, uv: 4 x [s, t] texture fractions (t from the top),
// tex: { data, w, h } straight-alpha RGBA, shade }. Every quad is a parallelogram under the affine projection, so the texture coordinate is affine in screen space.
import { BOX_FACE_CORNERS, itemBoxUv } from "./render-shapes.js";
import { glFace } from "./atlas-texels.js";
import { gl, transformPoint, cubeModelView } from "./icon-cube.js";
import { CHEST_ITEM_PREFIX, CHEST_ITEM_PARTS, modelBoxQuads } from "./chest-item-model.js";

const f = Math.fround;
// GL lighting of the icon, as the cube path models it: faces whose normal runs along x are darkened by .2 and along z by .08 (the west and south faces the projection shows).
export const FACE_SHADE = Object.freeze([0.2, 0, 0.08]);

// The six faces of every box (face order +x, -x, +y, -y, +z, -z; native draw order is -y, +y, -z, +z, -x, +x, which only matters for equal depths). tileOf(fi, boxIndex) gives
// the texture of a face, uvOf the face's texture coordinates (itemBoxUv, the executed crop).
export function boxQuads(boxes, tileOf, uvOf = itemBoxUv) {
  const out = [];
  boxes.forEach((box, bk) => {
    for (let fi = 0; fi < 6; fi++) {
      const pos = BOX_FACE_CORNERS[fi].map(([a, b, c]) => [a ? box[3] : box[0], b ? box[4] : box[1], c ? box[5] : box[2]]);
      out.push({ pos, uv: pos.map((p) => uvOf(fi, p, box)), tex: tileOf(fi, bk), shade: FACE_SHADE[fi >> 1] });
    }
  });
  return out;
}

// The matrix of a recorded T / S / R event list, composed in float32 in call order.
export function eventsMatrix(events, m = gl.identity()) {
  for (const [k, a, b, c, d] of events) m = k === "T" ? gl.translate(m, a, b, c) : k === "S" ? gl.scale(m, a, b, c) : gl.rotate(m, a, b, c, d);
  return m;
}

// The chest quads: vertices in each part's own frame with `m` the whole chain (the cube matrix, then the prefix and the part's rotation-point translate, in call order as the GL
// stack multiplies them). `tex` is the 64x64 chest sheet. The shade follows the face's normal in the block frame.
export function chestIconQuads(tex) {
  const block = eventsMatrix(CHEST_ITEM_PREFIX), chain = eventsMatrix(CHEST_ITEM_PREFIX, cubeModelView()), out = [];
  for (const part of CHEST_ITEM_PARTS) {
    const at = part.at.map((c) => c / 16), m = gl.translate(chain, ...at), mb = gl.translate(block, ...at);
    for (const q of modelBoxQuads(part)) {
      const n = cross(q.map(([x, y, z]) => transformPoint(mb, x, y, z))), axis = n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs)));
      out.push({ pos: q.map((v) => v.slice(0, 3)), uv: q.map(([, , , u, v]) => [u, v]), tex, shade: FACE_SHADE[axis], m });
    }
  }
  return out;
}
const cross = (p) => { const a = [0, 1, 2].map((k) => p[1][k] - p[0][k]), b = [0, 1, 2].map((k) => p[3][k] - p[0][k]); return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };

// Rasterise quads (in order) into a width x height RGBA buffer. `m` takes the quads' frame to GUI pixels (cubeModelView() by default; a quad's own `m` replaces it), `scale` physical pixels per GUI pixel.
export function rasterQuads(width, height, quads, scale = 4, m = cubeModelView()) {
  const out = new Uint8Array(width * height * 4), depth = new Float32Array(width * height).fill(Infinity);
  for (const { pos, uv, tex, shade = 0, m: own = m } of quads) {
    const P = pos.map(([x, y, z]) => { const [px, py, pz] = transformPoint(own, x, y, z); return [px * scale, py * scale, -pz]; });
    const a = P[1][0] - P[0][0], b = P[1][1] - P[0][1], c = P[3][0] - P[0][0], d = P[3][1] - P[0][1], e = P[0][0], g = P[0][1], det = a * d - b * c;
    if (Math.abs(det) < 1e-9) continue; // edge-on
    const inside = glFace([a, b, c, d, e, g], 1, 0), mul = 1 - shade;
    const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
    const x0 = Math.max(0, Math.floor(Math.min(...xs)) - 1), x1 = Math.min(width - 1, Math.ceil(Math.max(...xs)) + 1), y0 = Math.max(0, Math.floor(Math.min(...ys)) - 1), y1 = Math.min(height - 1, Math.ceil(Math.max(...ys)) + 1);
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const X = px + 0.5, Y = py + 0.5;
      if (!inside(X, Y)) continue;
      const l1 = ((X - e) * d - (Y - g) * c) / det, l2 = (a * (Y - g) - b * (X - e)) / det;
      const s = uv[0][0] + l1 * (uv[1][0] - uv[0][0]) + l2 * (uv[3][0] - uv[0][0]), t = uv[0][1] + l1 * (uv[1][1] - uv[0][1]) + l2 * (uv[3][1] - uv[0][1]);
      const tx = Math.max(0, Math.min(tex.w - 1, Math.floor(s * tex.w))), ty = Math.max(0, Math.min(tex.h - 1, Math.floor(t * tex.h))), si = (ty * tex.w + tx) * 4;
      if (!tex.data[si + 3]) continue; // alpha test: a clear texel writes neither colour nor depth
      const z = P[0][2] + l1 * (P[1][2] - P[0][2]) + l2 * (P[3][2] - P[0][2]), o = py * width + px;
      if (!(z < depth[o])) continue;
      depth[o] = z;
      const sa = tex.data[si + 3] / 255, oo = o * 4, da = out[oo + 3] / 255, ra = sa + da * (1 - sa);
      for (let k = 0; k < 3; k++) {
        const sc = shade ? Math.round(f(tex.data[si + k] * f(mul))) : tex.data[si + k];
        out[oo + k] = da === 0 ? sc : Math.round((sc * sa + out[oo + k] * da * (1 - sa)) / ra);
      }
      out[oo + 3] = Math.round(ra * 255);
    }
  }
  return out;
}
