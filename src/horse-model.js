// ModelHorse (bhs, 128 x 128): the parts and ModelHorse.setLivingAnimations (bhs.a(sv, F, F, F)), batch 56.
// Parts: p is a ModelRenderer's rotation point (c, d, e), a its rest angles (f, g, h) and b its boxes as [ox, oy, oz, w, h, d, u, v]. The points and angles are the
// unchanged class's `model` row (public/research/horse-reference.json, tools/probes/HorseProbe.java), the boxes were dumped by the same probe in batch 45.
// `a` (the head) has the children `b` and `c` (the lips), whose points are relative to the head's transform; every other part is drawn on its own.
export const HORSE_PARTS = {
  a: { p: [0,4,-10], a: [0.5235988,0,0], b: [[-2.5,-10,-1.5,5.0,5,7.0,0,0]] },
  b: { p: [0,3.95,-10], a: [0.5235988,0,0], b: [[-2,-10,-7,4,3,6,24,18]] },
  c: { p: [0,4,-10], a: [0.5235988,0,0], b: [[-2,-7,-6.5,4,2,5.0,24,27]] },
  d: { p: [0,4,-10], a: [0.5235988,0,0], b: [[0.45,-12,4,2.0,3,1,0,0]] },
  e: { p: [0,4,-10], a: [0.5235988,0,0], b: [[-2.45,-12,4,2.0,3,1,0,0]] },
  f: { p: [0,4,-10], a: [0.5235988,0,0.2617994], b: [[-2,-16,4,2,7,1,0,12]] },
  g: { p: [0,4,-10], a: [0.5235988,0,-0.2617994], b: [[0,-16,4,2,7,1,0,12]] },
  h: { p: [0,4,-10], a: [0.5235988,0,0], b: [[-2.05,-9.8,-2,4.0,14.0,8,0,12]] },
  i: { p: [0,4,-10], a: [0.5235988,0,0], b: [[-2.5,-10.1,-7,5.0,5.0,12,80,12]] },
  j: { p: [0,4,-10], a: [0.5235988,0,0], b: [[-1,-11.5,5,2,16.0,4,58,0]] },
  k: { p: [0,11,9], a: [0,0,0], b: [[-5,-8,-19,10,10,24,0,34]] },
  l: { p: [0,3,14], a: [-1.134464,0,0], b: [[-1,-1,0,2,2,3,44,0]] },
  m: { p: [0,3,14], a: [-1.134464,0,0], b: [[-1.5,-2,3,3.0,4,7,38,7]] },
  n: { p: [0,3,14], a: [-1.40215,0,0], b: [[-1.5,-4.5,9,3.0,4.0,7,24,3]] },
  o: { p: [4,9,11], a: [0,0,0], b: [[-2.5,-2,-2.5,4.0,9,5.0,78,29]] },
  v: { p: [4,16,11], a: [0,0,0], b: [[-2,0,-1.5,3,5,3.0,78,43]] },
  w: { p: [4,16,11], a: [0,0,0], b: [[-2.5,5.1,-2,4.0,3.0,4,78,51]] },
  x: { p: [-4,9,11], a: [0,0,0], b: [[-1.5,-2,-2.5,4.0,9,5.0,96,29]] },
  y: { p: [-4,16,11], a: [0,0,0], b: [[-1,0,-1.5,3,5,3.0,96,43]] },
  z: { p: [-4,16,11], a: [0,0,0], b: [[-1.5,5.1,-2,4.0,3.0,4,96,51]] },
  A: { p: [4,9,-8], a: [0,0,0], b: [[-1.9,-1,-2.1,3.0,8,4.0,44,29]] },
  B: { p: [4,16,-8], a: [0,0,0], b: [[-1.9,0,-1.6,3.0,5,3.0,44,41]] },
  C: { p: [4,16,-8], a: [0,0,0], b: [[-2.4,5.1,-2.1,4.0,3.0,4.0,44,51]] },
  D: { p: [-4,9,-8], a: [0,0,0], b: [[-1.1,-1,-2.1,3.0,8,4.0,60,29]] },
  E: { p: [-4,16,-8], a: [0,0,0], b: [[-1.1,0,-1.6,3.0,5,3.0,60,41]] },
  F: { p: [-4,16,-8], a: [0,0,0], b: [[-1.6,5.1,-2.1,4.0,3.0,4.0,60,51]] },
  G: { p: [-7.5,3,10], a: [0,1.570796,0], b: [[-3,0,0,8,8,3,0,34]] },
  H: { p: [4.5,3,10], a: [0,1.570796,0], b: [[-3,0,0,8,8,3,0,47]] },
  I: { p: [0,2,2], a: [0,0,0], b: [[-5,0,-3,10,1,8,80,0]] },
  J: { p: [0,2,2], a: [0,0,0], b: [[-1.5,-1,-3,3.0,1,2,106,9]] },
  K: { p: [0,2,2], a: [0,0,0], b: [[-4,-1,3,8,1,2,80,9]] },
  L: { p: [5,3,2], a: [0,0,0], b: [[-0.5,0,-0.5,1.0,6,1.0,70,0]] },
  M: { p: [5,3,2], a: [0,0,0], b: [[-0.5,6,-1,1.0,2,2,74,0]] },
  N: { p: [-5,3,2], a: [0,0,0], b: [[-0.5,0,-0.5,1.0,6,1.0,80,0]] },
  O: { p: [-5,3,2], a: [0,0,0], b: [[-0.5,6,-1,1.0,2,2,74,4]] },
  P: { p: [0,4,-10], a: [0.5235988,0,0], b: [[1.5,-8,-4,1.0,2,2,74,13]] },
  Q: { p: [0,4,-10], a: [0.5235988,0,0], b: [[-2.5,-8,-4,1.0,2,2,74,13]] },
  R: { p: [0,4,-10], a: [0,0,0], b: [[2.6,-6,-6,0.0,3,16,44,10]] },
  S: { p: [0,4,-10], a: [0,0,0], b: [[-2.6,-6,-6,0.0,3,16,44,5]] },
};

import { mhSin as sin, mhCos as cos } from "./lighting.js";

const f = Math.fround, fk = f;
const rotation = (prev, cur, t) => { // bhs.a(F, F, F): the interpolated yaw, the difference wrapped into [-180, 180)
  prev = f(prev);
  let d = f(f(cur) - prev);
  while (d < -180) d = f(d + 360);
  while (d >= 180) d = f(d - 360);
  return f(prev + f(t * d));
};
const max = Math.max;

// The model object: one per renderer in 1.7.10 (RenderHorse's ModelHorse), so a field some branch does not write keeps the value an earlier horse left.
export function createHorseModel() {
  const parts = {};
  for (const [k, { p, a }] of Object.entries(HORSE_PARTS)) parts[k] = { c: f(p[0]), d: f(p[1]), e: f(p[2]), f: f(a[0]), g: f(a[1]), h: f(a[2]) };
  return parts;
}

// bhs.a(sv, limbSwing, limbSwingAmount, partialTicks) on `m` (createHorseModel). `s` carries what the method reads from the entity (bytecode order and float arithmetic,
// MathHelper's sin / cos tables for qh.a / qh.b): prevRenderYawOffset (aN) renderYawOffset (aM) prevRotationYawHead (aP) rotationYawHead (aO) prevRotationPitch (B)
// rotationPitch (z) ticksExisted (aa); lean (p), rear (q) and mouth (r) already read at the partial tick; tail (bp != 0), saddled (cu), rider (wi.l != null).
export function setHorseAnimations(m, s, swing, amount, partial) {
  const t = f(partial), v2 = f(swing), v3 = f(amount);
  const v5 = rotation(s.prevRenderYawOffset, s.renderYawOffset, t), v6 = rotation(s.prevRotationYawHead, s.rotationYawHead, t);
  const pp = f(s.prevRotationPitch), v7 = f(pp + f(f(f(s.rotationPitch) - pp) * t));
  let v8 = f(v6 - v5), v9 = f(v7 / fk(57.29578));
  if (v8 > 20) v8 = 20;
  if (v8 < -20) v8 = -20;
  if (v3 > fk(0.2)) v9 = f(v9 + f(f(cos(f(v2 * fk(0.4))) * fk(0.15)) * v3));
  const v11 = f(s.lean), v12 = f(s.rear), v13 = f(1 - v12), v14 = f(s.mouth);
  const v15 = !!s.tail, v16 = !!s.saddled, v17 = !!s.rider;
  const v18 = f(f(s.ticksExisted) + t);
  const v19 = cos(f(f(v2 * fk(0.6662)) + fk(3.141593)));
  const v20 = f(f(v19 * fk(0.8)) * v3);
  const { a, b, c, d, e, f: pf, g, h, i, j, k, l, m: mm, n, o, v, w, x, y, z, A, B, C, D, E, F, G, H, I, J, K: Kp, L, M, N, O, P, Q, R, S } = m;
  a.d = 4; a.e = -10; l.d = 3; mm.e = 14; H.d = 3; H.e = 10; k.f = 0;
  a.f = f(fk(0.5235988) + v9);
  a.g = f(v8 / fk(57.29578));
  const rest = f(1 - max(v12, v11));
  a.f = f(f(f(v12 * f(fk(0.2617994) + v9)) + f(v11 * fk(2.18166))) + f(rest * a.f));
  a.g = f(f(v12 * f(v8 / fk(57.29578))) + f(rest * a.g));
  a.d = f(f(f(v12 * -6) + f(v11 * 11)) + f(rest * a.d));
  a.e = f(f(f(v12 * -1) + f(v11 * -10)) + f(rest * a.e));
  l.d = f(f(v12 * 9) + f(v13 * l.d));
  mm.e = f(f(v12 * 18) + f(v13 * mm.e));
  H.d = f(f(v12 * fk(5.5)) + f(v13 * H.d));
  H.e = f(f(v12 * 15) + f(v13 * H.e));
  k.f = f(f(v12 * fk(-0.7853981)) + f(v13 * k.f));
  for (const q of [d, e, pf, g, h, j]) q.d = a.d;
  b.d = fk(0.02); c.d = 0;
  for (const q of [d, e, pf, g, h, j]) q.e = a.e;
  b.e = f(fk(0.02) - f(v14 * 1)); c.e = f(0 + f(v14 * 1));
  for (const q of [d, e, pf, g, h, j]) q.f = a.f;
  b.f = f(0 - f(fk(0.09424778) * v14)); c.f = f(0 + f(fk(0.15707964) * v14));
  for (const q of [d, e, pf, g, h, j]) q.g = a.g;
  b.g = 0; c.g = 0;
  G.f = f(v20 / 5); H.f = f(f(-v20) / 5);
  const v24 = f(fk(0.2617994) * v12), v25 = cos(f(f(v18 * fk(0.6)) + fk(3.141593)));
  A.d = f(f(-2 * v12) + f(9 * v13)); A.e = f(f(-2 * v12) + f(-8 * v13));
  D.d = A.d; D.e = A.e;
  const HP = fk(1.5707964), TP = fk(4.712389), SW = fk(-1.0471976);
  const swingA = f(f(f(-v19) * fk(0.5)) * v3), swingB = f(f(v19 * fk(0.5)) * v3);
  v.d = f(o.d + f(sin(f(f(HP + v24) + f(v13 * swingA))) * 7));
  v.e = f(o.e + f(cos(f(f(TP + v24) + f(v13 * swingA))) * 7));
  y.d = f(x.d + f(sin(f(f(HP + v24) + f(v13 * swingB))) * 7));
  y.e = f(x.e + f(cos(f(f(TP + v24) + f(v13 * swingB))) * 7));
  const v26 = f(f(f(SW + v25) * v12) + f(v20 * v13));
  const v27 = f(f(f(SW + f(-v25)) * v12) + f(f(-v20) * v13));
  B.d = f(A.d + f(sin(f(HP + v26)) * 7)); B.e = f(A.e + f(cos(f(TP + v26)) * 7));
  E.d = f(D.d + f(sin(f(HP + v27)) * 7)); E.e = f(D.e + f(cos(f(TP + v27)) * 7));
  o.f = f(v24 + f(swingA * v13));
  v.f = f(f(fk(-0.08726646) * v12) + f(f(swingA - max(0, swingB)) * v13));
  w.f = v.f;
  x.f = f(v24 + f(swingB * v13));
  y.f = f(f(fk(-0.08726646) * v12) + f(f(swingB - max(0, swingA)) * v13));
  z.f = y.f;
  A.f = v26;
  B.f = f(f(f(A.f + f(fk(3.1415927) * max(0, f(fk(0.2) + f(v25 * fk(0.2)))))) * v12) + f(f(v20 + max(0, swingB)) * v13));
  C.f = B.f;
  D.f = v27;
  E.f = f(f(f(D.f + f(fk(3.1415927) * max(0, f(fk(0.2) - f(v25 * fk(0.2)))))) * v12) + f(f(f(-v20) + max(0, swingA)) * v13));
  F.f = E.f;
  w.d = v.d; w.e = v.e; z.d = y.d; z.e = y.e; C.d = B.d; C.e = B.e; F.d = E.d; F.e = E.e;
  if (v16) {
    I.d = f(f(v12 * fk(0.5)) + f(v13 * 2)); I.e = f(f(v12 * 11) + f(v13 * 2));
    for (const q of [J, Kp, L, N, M, O]) q.d = I.d;
    G.d = H.d;
    for (const q of [J, Kp, L, N, M, O]) q.e = I.e;
    G.e = H.e;
    I.f = k.f; J.f = k.f; Kp.f = k.f;
    for (const q of [R, S, i, P, Q]) q.d = a.d;
    for (const q of [R, S, i, P, Q]) q.e = a.e;
    R.f = v9; S.f = v9;
    for (const q of [i, P, Q]) q.f = a.f;
    for (const q of [i, P, R, Q, S]) q.g = a.g;
    if (v17) {
      for (const q of [L, M, N, O]) { q.f = SW; q.h = 0; }
    } else {
      const sf = f(v20 / 3);
      L.f = M.f = N.f = O.f = sf;
      L.h = M.h = f(v20 / 5);
      N.h = O.h = f(f(-v20) / 5);
    }
  }
  let v21 = f(fk(-1.3089) + f(v3 * fk(1.5)));
  if (v21 > 0) v21 = 0;
  if (v15) { l.g = cos(f(v18 * fk(0.7))); v21 = 0; } else l.g = 0;
  mm.g = l.g; n.g = l.g; mm.d = l.d; n.d = l.d; mm.e = l.e; n.e = l.e;
  l.f = v21; mm.f = v21; n.f = f(fk(-0.2618) + v21);
  return m;
}
