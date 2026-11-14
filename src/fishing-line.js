// RenderFish (bns) line endpoint and curve, in the bytecode's float and double order (batch 65 clientreplays; replayed by clientreplays-b65.test.js
// against public/research/clientreplays-reference.json, executed over the unchanged azw/qh/EntityPlayer classes).
//   first person (the angler is the local player and the view is first person): the hand vector (-0.5, 0.03, 0.8) turned about X by the pitch,
//     about Y by the yaw, then about Y by sin(sqrt(swing) * pi) * 0.5 and about X by -sin(sqrt(swing) * pi) * 0.7; added to the interpolated
//     position (posY is the eye for the local player: yOffset 1.62).
//   any other view: renderYawOffset's sine and cosine: (-cos * 0.35 - sin * 0.85, eye - 0.45, -sin * 0.35 + cos * 0.85). The eye term is 0 for the
//     local player (its posY already is the eye) and getEyeHeight (0.12, EntityPlayer) for another player, whose posY is its feet
//     (EntityOtherPlayerMP.yOffset 0). There is no sneak term in 1.7.10: the local player's ySize already lowers posY.
//   the curve runs from the hook (i = 0) to the tip (i = 16): hook + tip-minus-hook * f horizontally, and y = hook + (tipY - hookY - 0.25) * (f * f + f) * 0.5 + 0.25.
const f = Math.fround, PI = f(3.1415927);
let TABLE;
const table = () => TABLE ??= Float32Array.from({ length: 65536 }, (_, i) => Math.sin((i * Math.PI * 2) / 65536));
// MathHelper.sin / cos (qh.a / qh.b): the 65536-entry float table.
export const mhSin = (x) => table()[Math.trunc(f(x * f(10430.378))) & 65535];
export const mhCos = (x) => table()[Math.trunc(f(f(x * f(10430.378)) + f(16384))) & 65535];
export const EYE_HEIGHT_OTHER = f(0.12); // EntityPlayer.getEyeHeight (yz.g)
const rotX = (v, a) => { const c = mhCos(a), s = mhSin(a); [v[1], v[2]] = [v[1] * c + v[2] * s, v[2] * c - v[1] * s]; };
const rotY = (v, a) => { const c = mhCos(a), s = mhSin(a); [v[0], v[2]] = [v[0] * c + v[2] * s, v[2] * c - v[0] * s]; };
const lerp = (a, b, pt) => a + (b - a) * pt; // doubles
const flerp = (a, b, pt) => f(a + f(f(b - a) * pt)); // floats

// `angler` { px, py, pz, x, y, z (posY: the eye for the local player, the feet for another), prevYaw, yaw, prevPitch, pitch (Java degrees),
// prevRenderYawOffset, renderYawOffset }; `hook` { px, py, pz, x, y, z }; `swing` getSwingProgress(partial); `local` is the angler being the player
// that is controlled here. Returns { tip: [x, y, z], points: 17 vertices from the hook to the tip } in world coordinates.
export function fishingLine({ angler: a, hook: h, first, local, swing = 0, partial = 1 }) {
  const pt = f(partial);
  let tip;
  if (first) {
    const s = mhSin(f(f(Math.sqrt(f(swing))) * PI)); // qh.c is (float)Math.sqrt
    const v = [-0.5, 0.03, 0.8];
    rotX(v, f(f(-flerp(a.prevPitch, a.pitch, pt) * PI) / f(180)));
    rotY(v, f(f(-flerp(a.prevYaw, a.yaw, pt) * PI) / f(180)));
    rotY(v, f(s * f(0.5)));
    rotX(v, f(-s * f(0.7)));
    tip = [lerp(a.px, a.x, pt) + v[0], lerp(a.py, a.y, pt) + v[1], lerp(a.pz, a.z, pt) + v[2]];
  } else {
    const b = f(f(flerp(a.prevRenderYawOffset, a.renderYawOffset, pt) * PI) / f(180)), sn = mhSin(b), cs = mhCos(b), eye = local ? 0 : EYE_HEIGHT_OTHER;
    tip = [lerp(a.px, a.x, pt) - cs * 0.35 - sn * 0.85, a.py + eye + (a.y - a.py) * pt - 0.45, lerp(a.pz, a.z, pt) - sn * 0.35 + cs * 0.85];
  }
  const hx = lerp(h.px, h.x, pt), hy = lerp(h.py, h.y, pt), hz = lerp(h.pz, h.z, pt);
  const dx = f(tip[0] - hx), dy = f(tip[1] - (hy + 0.25)), dz = f(tip[2] - hz), points = [];
  for (let i = 0; i <= 16; i++) {
    const t = f(i / 16);
    points.push([hx + dx * t, hy + dy * f(f(t * t) + t) * 0.5 + 0.25, hz + dz * t]);
  }
  return { tip, points };
}
